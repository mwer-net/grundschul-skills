import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { AusgabeVariante, FolienZusatz, MappenVariante, Meldung, Pruefbericht } from '@schoolbox/kern';
import {
	AUSGABE_VARIANTEN,
	ausgabeDateiname,
	ausgabeSchluessel,
	dokumentDir,
	fuegePdfsZusammen,
	HTML_DATEI,
	istFolienVariante,
	leseMappe,
	leseMeta,
	leseStand,
	LOESUNG_PDF_DATEI,
	MAPPEN_VARIANTEN,
	mappenDir,
	mappenPdfDateiname,
	PDF_DATEI,
	schreibeStand,
	zusatzBerichtDatei,
	zusatzPdfDatei,
	zusatzStandDatei,
} from '@schoolbox/kern';
import type { Request, Response } from 'express';

import type { Begrenzung } from './begrenzung';
import type { Ereignisse } from './ereignisse';
import { HttpFehler } from './fehler';
import type { Sperre } from './sperre';

/** Baut `ausgabe/` eines Dokumentordners samt `stand.json`. Im Betrieb blatt.py, in den Browser-Tests ein Ersatz. */
export type PdfBauer = (dokDir: string) => Promise<unknown>;

/** Baut einen Zusatz für Folien nach `ausgabe/`, samt Prüfbericht und Stand-Datei. Im Betrieb blatt.py. */
export type FolienBauer = (dokDir: string, art: FolienZusatz) => Promise<unknown>;

export interface PdfMeldung extends Meldung {
	dok: string;
	titel: string;
}

export interface PdfDatei {
	datei: string;
	dateiname: string;
	/** Nur Fehler aus der Prüfung; Warnungen und Hinweise sind für Claude, nicht für den Download. */
	meldungen: PdfMeldung[];
}

export interface Pdf {
	dokument: (mappe: string, dok: string, variante: AusgabeVariante) => Promise<PdfDatei>;
	/** Alle Dokumente der Mappe in Mappenreihenfolge, wahlweise mit den Lösungen am Ende. */
	mappe: (mappe: string, variante: MappenVariante) => Promise<PdfDatei>;
}

interface Abhaengigkeiten {
	materialDir: string;
	ereignisse: Ereignisse;
	sperre: Sperre;
	begrenzung: Begrenzung;
	bauer: PdfBauer;
	folienBauer: FolienBauer;
}

const BEIDES_DATEI = 'material-beides.pdf';
const LOESUNG_PRAEFIX = 'Lösungsblatt: ';
const NICHT_GEBAUT =
	'Das PDF ließ sich gerade nicht erstellen. Bitte versuch es noch einmal; klappt es wieder nicht, sag Claude Bescheid.';

const pdfSperre = (mappe: string, dok?: string) => `_pdf/${mappe}${dok === undefined ? '' : `/${dok}`}`;

const leseFehler = async (ausgabe: string, mitLoesung: boolean, datei = 'pruefbericht.json'): Promise<Meldung[]> => {
	try {
		const bericht = JSON.parse(await readFile(path.join(ausgabe, datei), 'utf8')) as Pruefbericht;
		return bericht.meldungen
			.filter((m) => m.stufe === 'FEHLER')
			.filter((m) => mitLoesung || !m.text.startsWith(LOESUNG_PRAEFIX));
	} catch {
		return [];
	}
};

interface Gebaut {
	ausgabe: string;
	stand: string;
	loesung: boolean;
}

const NUR_FOLIEN = 'Das gibt es nur für Präsentationen (Folien).';

export const erstellePdf = ({
	bauer,
	begrenzung,
	ereignisse,
	folienBauer,
	materialDir,
	sperre,
}: Abhaengigkeiten): Pdf => {
	/** Stellt sicher, dass `ausgabe/` zum jetzigen Dokument passt. Nur innerhalb der PDF-Sperre des Dokuments. */
	const stelleSicher = async (mappe: string, dok: string): Promise<Gebaut> => {
		const dir = dokumentDir(materialDir, mappe, dok);
		const ausgabe = path.join(dir, 'ausgabe');
		if (!existsSync(path.join(dir, 'material.html'))) {
			throw new HttpFehler(404, 'Dieses Dokument gibt es nicht mehr.');
		}
		const [stand, schluessel] = await Promise.all([leseStand(ausgabe), ausgabeSchluessel(dir)]);
		if (stand !== schluessel || !existsSync(path.join(ausgabe, PDF_DATEI))) {
			try {
				await begrenzung(() => bauer(dir));
			} catch (fehler) {
				console.error(`PDF für ${mappe}/${dok}:`, fehler instanceof Error ? fehler.message : fehler);
				throw existsSync(path.join(dir, 'material.html'))
					? new HttpFehler(500, NICHT_GEBAUT)
					: new HttpFehler(404, 'Dieses Dokument gibt es nicht mehr.');
			}
			ereignisse.sende({ typ: 'pdf-fertig', daten: { mappe, dok } });
		}
		return {
			ausgabe,
			stand: (await leseStand(ausgabe)) ?? schluessel,
			loesung: existsSync(path.join(ausgabe, LOESUNG_PDF_DATEI)),
		};
	};

	/** PDF mit Schritten oder Folien mit Notizen, gebaut wie das PDF: bei Bedarf und global begrenzt. */
	const stelleZusatzSicher = async (mappe: string, dok: string, { ausgabe, stand }: Gebaut, art: FolienZusatz) => {
		const datei = path.join(ausgabe, zusatzPdfDatei(art));
		if ((await leseStand(ausgabe, zusatzStandDatei(art))) === stand && existsSync(datei)) {
			return datei;
		}
		const dir = dokumentDir(materialDir, mappe, dok);
		try {
			await begrenzung(() => folienBauer(dir, art));
		} catch (fehler) {
			console.error(`${art} für ${mappe}/${dok}:`, fehler instanceof Error ? fehler.message : fehler);
			throw existsSync(path.join(dir, 'material.html'))
				? new HttpFehler(500, NICHT_GEBAUT)
				: new HttpFehler(404, 'Dieses Dokument gibt es nicht mehr.');
		}
		return datei;
	};

	/** Die Datei zur Variante, dazu Fehler, die nur sie hat (Folien mit Notizen werden eigens geprüft). */
	const bereitstellen = async (
		mappe: string,
		dok: string,
		gebaut: Gebaut,
		variante: AusgabeVariante,
	): Promise<{ datei: string; fehler: Meldung[] }> => {
		const { ausgabe, loesung } = gebaut;
		if (variante === 'praesentation') {
			return { datei: path.join(ausgabe, HTML_DATEI), fehler: [] };
		}
		if (variante === 'schritte' || variante === 'notizen') {
			const datei = await stelleZusatzSicher(mappe, dok, gebaut, variante);
			return { datei, fehler: await leseFehler(ausgabe, false, zusatzBerichtDatei(variante)) };
		}
		if (variante !== 'arbeitsblatt' && !loesung) {
			throw new HttpFehler(404, 'Zu diesem Dokument gibt es keine Lösung.');
		}
		const blatt = path.join(ausgabe, PDF_DATEI);
		const beides = path.join(ausgabe, BEIDES_DATEI);
		if (variante === 'beides' && !existsSync(beides)) {
			await fuegePdfsZusammen([blatt, path.join(ausgabe, LOESUNG_PDF_DATEI)], beides);
		}
		const dateien = { arbeitsblatt: blatt, loesung: path.join(ausgabe, LOESUNG_PDF_DATEI), beides };
		return { datei: dateien[variante], fehler: [] };
	};

	const mitTitel = (dok: string, titel: string, meldungen: Meldung[]): PdfMeldung[] =>
		meldungen.map((m) => ({ ...m, dok, titel }));

	const dokument: Pdf['dokument'] = async (mappeId, dok, variante) => {
		const [mappe, meta] = await Promise.all([leseMappe(materialDir, mappeId), leseMeta(materialDir, mappeId, dok)]);
		if (istFolienVariante(variante) && meta.format !== 'folie') {
			throw new HttpFehler(404, NUR_FOLIEN);
		}
		return sperre(pdfSperre(mappeId, dok), async () => {
			const gebaut = await stelleSicher(mappeId, dok);
			const { datei, fehler } = await bereitstellen(mappeId, dok, gebaut, variante);
			const blattFehler = await leseFehler(gebaut.ausgabe, variante === 'loesung' || variante === 'beides');
			return {
				datei,
				dateiname: ausgabeDateiname(mappe, meta, variante),
				meldungen: mitTitel(dok, meta.titel, [...blattFehler, ...fehler]),
			};
		});
	};

	const mappePdf: Pdf['mappe'] = async (mappeId, variante) => {
		const mappe = await leseMappe(materialDir, mappeId);
		if (mappe.dokumente.length === 0) {
			throw new HttpFehler(404, 'In dieser Mappe gibt es noch keine Dokumente.');
		}
		const mitLoesungen = variante === 'alles-mit-loesungen';
		const teile = await Promise.all(
			mappe.dokumente.map(async (dok) => {
				const meta = await leseMeta(materialDir, mappeId, dok);
				return sperre(pdfSperre(mappeId, dok), async () => {
					const gebaut = await stelleSicher(mappeId, dok);
					const fehler = await leseFehler(gebaut.ausgabe, mitLoesungen);
					return { dok, ...gebaut, meldungen: mitTitel(dok, meta.titel, fehler) };
				});
			}),
		);
		const reihenfolge = [
			...teile.map((t) => path.join(t.ausgabe, PDF_DATEI)),
			...(mitLoesungen ? teile.filter((t) => t.loesung).map((t) => path.join(t.ausgabe, LOESUNG_PDF_DATEI)) : []),
		];
		const schluessel = createHash('sha256')
			.update(JSON.stringify([variante, teile.map((t) => [t.dok, t.stand, t.loesung])]))
			.digest('hex')
			.slice(0, 32);

		const dir = mappenDir(materialDir, mappeId);
		const ausgabe = path.join(dir, 'ausgabe');
		const datei = path.join(ausgabe, `${variante}.pdf`);
		const standDatei = `${variante}.json`;
		await sperre(pdfSperre(mappeId), async () => {
			if ((await leseStand(ausgabe, standDatei)) === schluessel && existsSync(datei)) {
				return;
			}
			// Nie rekursiv anlegen: Liegt die Mappe inzwischen im Papierkorb, darf ihr Ordner nicht neu entstehen.
			if (!existsSync(path.join(dir, 'mappe.json'))) {
				throw new HttpFehler(404, 'Diese Mappe gibt es nicht mehr.');
			}
			if (!existsSync(ausgabe)) {
				await mkdir(ausgabe);
			}
			await fuegePdfsZusammen(reihenfolge, datei);
			await schreibeStand(ausgabe, schluessel, standDatei);
		});
		return {
			datei,
			dateiname: mappenPdfDateiname(mappe, variante),
			meldungen: teile.flatMap((t) => t.meldungen),
		};
	};

	return { dokument, mappe: mappePdf };
};

const ASCII_ERSATZ: Record<string, string> = {
	'ä': 'ae',
	'ö': 'oe',
	'ü': 'ue',
	'Ä': 'Ae',
	'Ö': 'Oe',
	'Ü': 'Ue',
	'ß': 'ss',
	'–': '-',
	'—': '-',
};

/**
 * `Content-Disposition` mit UTF-8-Dateinamen nach RFC 6266/5987 (`filename*`, versteht Safari) und einem
 * ASCII-Ersatz in `filename` für alles andere.
 */
export const inhaltsAngabe = (art: 'attachment' | 'inline', name: string) => {
	const ascii = name
		.replace(/[äöüÄÖÜß–—]/g, (z) => ASCII_ERSATZ[z] ?? z)
		.normalize('NFKD')
		.replace(/[^\x20-\x7e]/g, '')
		.replace(/["\\%]/g, '_');
	const utf8 = encodeURIComponent(name).replace(/['()*]/g, (z) => `%${z.charCodeAt(0).toString(16).toUpperCase()}`);
	return `${art}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
};

/**
 * Mit `?anzeigen=1` zum Ansehen und Drucken im Browser, sonst als Download. Die Offline-Präsentation (HTML) gibt es
 * nur als Download, und zwar als `application/octet-stream`: Bei `text/html` zeigt WebKit die Datei trotz `attachment`
 * teils an, statt sie zu speichern.
 */
export const sendePdf = (req: Request, res: Response, { datei, dateiname }: PdfDatei) =>
	new Promise<void>((resolve, reject) => {
		const pdf = path.extname(datei) === '.pdf';
		const art = req.query.anzeigen === '1' && pdf ? 'inline' : 'attachment';
		res.set({ 'Content-Disposition': inhaltsAngabe(art, dateiname), 'Cache-Control': 'private, no-cache' });
		res.type(pdf ? 'application/pdf' : 'application/octet-stream').sendFile(
			datei,
			{ cacheControl: false },
			(fehler) => {
				if (fehler) {
					reject(fehler);
				} else {
					resolve();
				}
			},
		);
	});

const waehle = <T extends string>(wert: unknown, gueltig: readonly T[]): T => {
	const treffer = gueltig.find((g) => g === wert);
	if (treffer === undefined) {
		throw new HttpFehler(400, `Diese Fassung gibt es nicht. Möglich: ${gueltig.join(', ')}.`);
	}
	return treffer;
};

export const waehlePdfVariante = (wert: unknown) => waehle(wert, AUSGABE_VARIANTEN);
export const waehleMappenVariante = (wert: unknown) => waehle(wert, MAPPEN_VARIANTEN);

/** Antwort beim Vorbereiten: wohin der Browser für die Datei geht, wie sie heißt, was die Prüfung fand. */
export const pdfAntwort = (adresse: string, { dateiname, meldungen }: PdfDatei) => ({
	adresse: `${adresse}/${encodeURIComponent(dateiname)}`,
	dateiname,
	meldungen,
});

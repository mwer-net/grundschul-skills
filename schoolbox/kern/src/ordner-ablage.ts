import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { aktualisiereMappe, dokumentDir, dupliziereMappe, leseMappe, mappenDir, sammleMappen } from './ablage';
import { SchoolboxFehler } from './fehler';
import type { AblageKnoten, AktionsErgebnis, Baum, Bestand, Effekt, Faellig, Umgebung } from './ordner';
import {
	entferneAusBaum,
	faelligImPapierkorb,
	gleicheAb,
	istUngueltigesZiel,
	knotenSchluessel,
	lebenderOrdner,
	leseBaumNachsichtig,
	MAX_NAME,
	neueOrdnerId,
	ordnerUnter,
} from './ordner';
import { ID_MUSTER } from './schema';

const ID_REGEX = new RegExp(ID_MUSTER);

/** Was der Abgleich über die Platte wissen muss. Kaputte Mappen stehen unter `unlesbar`, ihre Plätze bleiben. */
export const leseBestand = async (materialDir: string): Promise<Bestand> => {
	const { defekt, mappen } = await sammleMappen(materialDir, { mitGeloeschten: true });
	const namen = await readdir(materialDir).catch(() => []);
	const ohneDatei = namen.filter((n) => ID_REGEX.test(n) && !existsSync(path.join(materialDir, n, 'mappe.json')));
	return {
		mappen: mappen.map(({ dokumente, mappe }) => ({
			id: mappe.id,
			titel: mappe.titel,
			erstellt: mappe.erstellt,
			dokumente: dokumente.map((d) => ({ id: d.id, erstellt: d.meta.erstellt })),
			...(mappe.ablage === undefined ? {} : { ablage: mappe.ablage }),
		})),
		unlesbar: [...defekt.map((d) => d.id), ...ohneDatei],
	};
};

/** Der Baum, wie der Server ihn gerade sehen würde, ohne etwas zu schreiben: für die CLI. */
export const baumZumLesen = async (materialDir: string): Promise<Baum> =>
	gleicheAb(leseBaumNachsichtig(materialDir), await leseBestand(materialDir)).baum;

/** `--ordner "Klasse 3/Mathe"`: dieselben Regeln wie für Namen in der Oberfläche. */
export const pruefeAblagePfad = (wert: string | undefined): string | undefined => {
	const teile = (wert ?? '')
		.split('/')
		.map((t) => t.trim())
		.filter(Boolean);
	if (teile.some((t) => t.length > MAX_NAME)) {
		throw new SchoolboxFehler(`Ein Ordnername ist zu lang (höchstens ${MAX_NAME} Zeichen).`);
	}
	return teile.length > 0 ? teile.join('/') : undefined;
};

const kopieName = (name: string, vergeben: readonly string[]) => {
	const belegt = (n: string) => vergeben.some((v) => v.toLocaleLowerCase('de') === n.toLocaleLowerCase('de'));
	if (!belegt(name)) {
		return name;
	}
	if (!belegt(`${name} (Kopie)`)) {
		return `${name} (Kopie)`;
	}
	let n = 2;
	while (belegt(`${name} (Kopie ${n})`)) {
		n += 1;
	}
	return `${name} (Kopie ${n})`;
};

const namenAmZiel = (baum: Baum, ziel: string | null, u: Umgebung) => [
	...baum.ordner.filter((o) => o.eltern === ziel && !o.geloescht).map((o) => o.name),
	...Object.entries(baum.dokumente)
		.filter(([, p]) => p.ordner === ziel && !p.geloescht)
		.map(([s]) => {
			const [mappe = '', dok = ''] = s.split('/');
			return u.titel(mappe, dok) ?? '';
		}),
];

/**
 * Eine Kopie ist immer unabhängig: Je Quellbehälter entsteht ein neuer Behälter mit den gemeinsamen Dateien und den
 * gewählten Dokumenten, der Baum wird nachgebaut. Läge sie im selben Behälter, änderte eine Anpassung am Thema auch
 * das Original.
 */
export const kopiereKnoten = async (
	materialDir: string,
	vorher: Baum,
	{ knoten, ziel }: { knoten: AblageKnoten[]; ziel: string | null },
	u: Umgebung,
): Promise<AktionsErgebnis> => {
	if (ziel !== null && !lebenderOrdner(vorher, ziel)) {
		throw new SchoolboxFehler('Diesen Ordner gibt es nicht mehr.');
	}
	const zeit = u.jetzt.toISOString();
	const baum = structuredClone(vorher);
	baum.rev += 1;
	const dokumenteIn = (ordner: ReadonlySet<string>) =>
		Object.entries(baum.dokumente).filter(([, p]) => p.ordner !== null && ordner.has(p.ordner) && !p.geloescht);
	const jeBehaelter = new Map<string, Set<string>>();
	const merke = (schluessel: string) => {
		const [mappe = '', dok = ''] = schluessel.split('/');
		jeBehaelter.set(mappe, (jeBehaelter.get(mappe) ?? new Set()).add(dok));
	};
	for (const k of knoten) {
		if ('ordner' in k) {
			if (!lebenderOrdner(baum, k.ordner)) {
				throw new SchoolboxFehler('Diesen Ordner gibt es nicht mehr.');
			}
			if (istUngueltigesZiel(baum, k.ordner, ziel)) {
				throw new SchoolboxFehler('Ein Ordner kann nicht in sich selbst liegen.');
			}
			dokumenteIn(new Set(ordnerUnter(baum, k.ordner))).forEach(([s]) => merke(s));
		} else {
			const platz = baum.dokumente[knotenSchluessel(k)];
			if (!platz || platz.geloescht) {
				throw new SchoolboxFehler('Dieses Material gibt es nicht mehr.');
			}
			merke(knotenSchluessel(k));
		}
	}
	const neueBehaelter = new Map<string, string>();
	for (const [mappe, doks] of jeBehaelter) {
		const { titel } = await leseMappe(materialDir, mappe);
		const kopie = await dupliziereMappe(materialDir, mappe, u.jetzt, { nurDokumente: [...doks], titel });
		neueBehaelter.set(mappe, kopie.id);
	}
	const vergeben = namenAmZiel(baum, ziel, u);
	const effekte: Effekt[] = [];
	const ergebnis: AblageKnoten[] = [];

	const kopiereDokument = (schluessel: string, inOrdner: string | null): AblageKnoten => {
		const [mappe = '', dok = ''] = schluessel.split('/');
		const neueMappe = neueBehaelter.get(mappe) ?? mappe;
		baum.dokumente[`${neueMappe}/${dok}`] = { ordner: inOrdner, geloescht: null };
		return { mappe: neueMappe, dok };
	};

	const kopiereOrdner = (id: string, eltern: string | null, name: string | null): string => {
		const quelle = vorher.ordner.find((o) => o.id === id);
		if (!quelle) {
			throw new SchoolboxFehler('Diesen Ordner gibt es nicht mehr.');
		}
		const neu = neueOrdnerId();
		const behaelter = quelle.behaelter === null ? null : (neueBehaelter.get(quelle.behaelter) ?? null);
		baum.ordner.push({
			id: neu,
			name: name ?? quelle.name,
			eltern,
			behaelter,
			erstellt: zeit,
			geaendert: zeit,
			geloescht: null,
		});
		if (behaelter !== null && name !== null && name !== quelle.name) {
			effekte.push({ art: 'mappe-titel', mappe: behaelter, titel: name });
		}
		for (const [s, p] of Object.entries(vorher.dokumente)) {
			if (p.ordner === id && !p.geloescht) {
				kopiereDokument(s, neu);
			}
		}
		for (const kind of vorher.ordner.filter((o) => o.eltern === id && !o.geloescht)) {
			kopiereOrdner(kind.id, neu, null);
		}
		return neu;
	};

	for (const k of knoten) {
		if ('ordner' in k) {
			const alt = vorher.ordner.find((o) => o.id === k.ordner)?.name ?? '';
			const name = kopieName(alt, vergeben);
			vergeben.push(name);
			ergebnis.push({ ordner: kopiereOrdner(k.ordner, ziel, name) });
		} else {
			const alt = u.titel(k.mappe, k.dok) ?? k.dok;
			const name = kopieName(alt, vergeben);
			vergeben.push(name);
			const neu = kopiereDokument(knotenSchluessel(k), ziel);
			ergebnis.push(neu);
			if (name !== alt && 'dok' in neu) {
				effekte.push({ art: 'dokument-titel', mappe: neu.mappe, dok: neu.dok, titel: name });
			}
		}
	}
	return {
		baum,
		// Eine Kopie ist echtes Material und könnte schon bearbeitet sein: Rückgängig legt sie in den Papierkorb.
		umkehr: [{ art: 'papierkorb', knoten: ergebnis }],
		effekte,
		knoten: ergebnis,
		umbenannt: [],
		loescht: false,
	};
};

export interface Aufgeraeumt {
	baum: Baum;
	faellig: Faellig;
	mappen: string[];
}

/**
 * Nach der Frist endgültig: Dokumentordner weg, aus der Mappe austragen, AblageKnoten entfernen. Ein Behälter ohne Dokumente
 * geht mit, und `behaelter` wird `null`. Hält er noch Dokumente anderswo, bleibt er. Die Platte kommt zuerst: Bricht es
 * mittendrin ab, trägt der Abgleich die verschwundenen Einträge aus.
 */
export const loescheFaelligeAusBaum = async (
	materialDir: string,
	vorher: Baum,
	tage: number,
	jetzt = new Date(),
): Promise<Aufgeraeumt | null> => {
	const faellig = faelligImPapierkorb(vorher, tage, jetzt);
	if (faellig.dokumente.length === 0 && faellig.ordner.length === 0) {
		return null;
	}
	const kandidaten = new Set<string>();
	const entfernt: { mappe: string; dok: string }[] = [];
	for (const { dok, mappe } of faellig.dokumente) {
		try {
			await aktualisiereMappe(materialDir, mappe, jetzt, (m) => {
				m.dokumente = m.dokumente.filter((d) => d !== dok);
			});
			await rm(dokumentDir(materialDir, mappe, dok), { recursive: true, force: true });
			kandidaten.add(mappe);
			entfernt.push({ dok, mappe });
		} catch (fehler) {
			if (!(fehler instanceof SchoolboxFehler)) {
				throw fehler;
			}
			// Kaputte Mappe: Das Dokument bleibt im Papierkorb, der nächste Lauf versucht es wieder.
			console.error(`Papierkorb: ${mappe}/${dok}: ${fehler.message}`);
		}
	}
	for (const o of vorher.ordner) {
		if (o.behaelter !== null && faellig.ordner.includes(o.id)) {
			kandidaten.add(o.behaelter);
		}
	}
	const mappen: string[] = [];
	for (const mappe of kandidaten) {
		const dir = mappenDir(materialDir, mappe);
		if (existsSync(path.join(dir, 'mappe.json')) && (await leseMappe(materialDir, mappe)).dokumente.length === 0) {
			await rm(dir, { recursive: true, force: true });
			mappen.push(mappe);
		}
	}
	const wirklich = { dokumente: entfernt, ordner: faellig.ordner };
	const baum = entferneAusBaum(vorher, wirklich);
	for (const o of baum.ordner) {
		if (o.behaelter !== null && mappen.includes(o.behaelter)) {
			o.behaelter = null;
		}
	}
	return { baum, faellig: wirklich, mappen };
};

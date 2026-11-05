import type { AblageKnoten, Baum, Geloescht } from '@schoolbox/kern';
import {
	dokKnotenSchluessel,
	entferneFreigabenVon,
	istPapierkorbEintrag,
	leerePapierkorb,
	listePapierkorb,
	loescheFaelligeAusBaum,
	ordnerUnter,
	PAPIERKORB_TAGE,
	sammleMappen,
	stelleWiederHer,
} from '@schoolbox/kern';
import { Router } from 'express';

import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';
import { FREIGABEN_SPERRE } from './kontext';

const TAG_MS = 24 * 60 * 60 * 1000;

export interface PapierkorbObjekt {
	knoten: AblageKnoten;
	name: string;
	geloescht: Geloescht;
	bis: string;
	/** Bei einem Ordner: was darin liegt. */
	objekte?: number;
	art?: string;
}

const bisDatum = (g: Geloescht) => new Date(new Date(g.zeit).getTime() + PAPIERKORB_TAGE * TAG_MS).toISOString();

/** Was im Baum gelöscht ist, je ein Eintrag; ein Ordner nimmt seinen Inhalt mit. */
const objekteImBaum = async (materialDir: string, baum: Baum): Promise<PapierkorbObjekt[]> => {
	const { mappen } = await sammleMappen(materialDir, { mitGeloeschten: true });
	const metas = new Map(
		mappen.flatMap(({ dokumente, mappe }) =>
			dokumente.map(({ id, meta }) => [dokKnotenSchluessel(mappe.id, id), meta] as const),
		),
	);
	const anzahl = (id: string) => {
		const unter = new Set(ordnerUnter(baum, id));
		const ordner = unter.size - 1;
		const doks = Object.values(baum.dokumente).filter((p) => p.ordner && unter.has(p.ordner) && !p.geloescht).length;
		return ordner + doks;
	};
	const ordner: PapierkorbObjekt[] = baum.ordner.flatMap((o) =>
		o.geloescht
			? [{ knoten: { ordner: o.id }, name: o.name, geloescht: o.geloescht, bis: bisDatum(o.geloescht), objekte: anzahl(o.id) }]
			: [],
	);
	const dokumente: PapierkorbObjekt[] = Object.entries(baum.dokumente).flatMap(([schluessel, p]) => {
		const [mappe = '', dok = ''] = schluessel.split('/');
		const meta = metas.get(schluessel);
		return p.geloescht && meta
			? [
					{
						knoten: { mappe, dok },
						name: meta.titel,
						art: meta.art,
						geloescht: p.geloescht,
						bis: bisDatum(p.geloescht),
					},
				]
			: [];
	});
	return [...ordner, ...dokumente].sort((a, b) => b.geloescht.zeit.localeCompare(a.geloescht.zeit));
};

/** Gelöschtes ansehen. Zurücklegen läuft über `/api/ordner/aktion`; alte Einträge aus der Zeit vor 079 kommen von hier. */
export const papierkorbApi = (kontext: Kontext) => {
	const { materialDir } = kontext.konfig;
	const router = Router();

	router.get('/', async (_req, res) => {
		const baum = await kontext.ordner.abgleichen();
		res.json({
			eintraege: await listePapierkorb(materialDir),
			objekte: await objekteImBaum(materialDir, baum),
			tage: PAPIERKORB_TAGE,
		});
	});

	router.post('/:eintrag/wiederherstellen', async (req, res) => {
		const { eintrag } = req.params;
		const vorhanden = (await listePapierkorb(materialDir)).some((e) => e.eintrag === eintrag);
		if (!istPapierkorbEintrag(eintrag) || !vorhanden) {
			throw new HttpFehler(404, 'Das liegt nicht mehr im Papierkorb.');
		}
		const wiederhergestellt = await stelleWiederHer(materialDir, eintrag);
		await kontext.ordner.abgleichen();
		res.json({ eintrag: wiederhergestellt });
	});

	return router;
};

/**
 * Löscht endgültig, was 30 Tage im Papierkorb lag, samt den Teilen-Links: den Zustand im Baum und die alten Einträge
 * im Ordner `_papierkorb`. Gibt die IDs der Mappen zurück, die ganz verschwunden sind.
 */
export const raeumePapierkorbAuf = async (kontext: Kontext, jetzt = new Date()): Promise<string[]> => {
	const { materialDir } = kontext.konfig;
	const entfernt = await leerePapierkorb(materialDir, jetzt);
	if (entfernt.length > 0) {
		await kontext.sperre(FREIGABEN_SPERRE, () => entferneFreigabenVon(materialDir, { mappen: entfernt }));
		console.log(`Papierkorb: ${entfernt.length} Mappe(n) nach ${PAPIERKORB_TAGE} Tagen endgültig gelöscht.`);
	}
	const auf = await kontext.ordner.aendere(async (baum) => {
		const fertig = await loescheFaelligeAusBaum(materialDir, baum, PAPIERKORB_TAGE, jetzt);
		return fertig ? { baum: fertig.baum, ergebnis: fertig, loescht: true } : { baum, ergebnis: null };
	});
	if (!auf) {
		return entfernt;
	}
	for (const { dok, mappe } of auf.faellig.dokumente) {
		kontext.bekannt.delete(dokKnotenSchluessel(mappe, dok));
	}
	await kontext.sperre(FREIGABEN_SPERRE, () =>
		entferneFreigabenVon(materialDir, {
			mappen: auf.mappen,
			dokumente: auf.faellig.dokumente,
			ordner: auf.faellig.ordner,
		}),
	);
	console.log(
		`Papierkorb: ${auf.faellig.dokumente.length} Dokument(e) und ${auf.faellig.ordner.length} Ordner nach ${PAPIERKORB_TAGE} Tagen endgültig gelöscht.`,
	);
	return [...entfernt, ...auf.mappen];
};

export const starteAufraeumen = (kontext: Kontext) => {
	const lauf = () => {
		raeumePapierkorbAuf(kontext).catch((fehler: unknown) => console.error('Papierkorb:', fehler));
	};
	lauf();
	const takt = setInterval(lauf, TAG_MS);
	takt.unref();
	return { stop: () => clearInterval(takt) };
};

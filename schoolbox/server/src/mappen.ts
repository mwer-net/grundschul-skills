import { existsSync } from 'node:fs';
import path from 'node:path';

import type { Art, Fach, Format, Klasse, MappenEintrag, MappenFilter } from '@schoolbox/kern';
import {
	ART_FORMATE,
	ARTEN,
	dupliziereMappe,
	FAECHER,
	KLASSEN,
	legeInPapierkorb,
	leseMappe,
	leseMappenEintrag,
	leseMeta,
	mappenDir,
	neueMappe,
	neuesDokument,
	sammleMappen,
	STATUS,
	verfuegbareVorlagen,
	VORLAGE_FORMAT,
	waehleKlasse,
	waehleWert,
} from '@schoolbox/kern';
import { Router } from 'express';

import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';
import { pdfAntwort, sendePdf, waehleMappenVariante, waehleProfil } from './pdf';
import { pruefeIdParam } from './schutz';

const text = (wert: unknown) => (typeof wert === 'string' && wert.trim() ? wert : undefined);

const leseFilter = (query: Record<string, unknown>): MappenFilter => {
	const fach = text(query.fach);
	const klasse = text(query.klasse);
	const status = text(query.status);
	return {
		fach: fach === undefined ? undefined : waehleWert('Fach', fach, FAECHER),
		klasse: klasse === undefined ? undefined : waehleKlasse(klasse),
		status: status === undefined ? undefined : waehleWert('Status', status, STATUS),
		suche: text(query.suche),
	};
};

const verlangeMappe = (kontext: Kontext, mappe: string) => {
	if (!existsSync(path.join(mappenDir(kontext.konfig.materialDir, mappe), 'mappe.json'))) {
		throw new HttpFehler(404, `Die Mappe „${mappe}“ gibt es nicht.`);
	}
};

/**
 * Ergänzt je Dokument die Kennung seiner Vorschau. In der Übersicht braucht es nur die des ersten Dokuments (das
 * Titelbild der Kachel), in der Mappenansicht alle; nur diese werden bei Bedarf gebaut.
 */
const mitVorschau = async (kontext: Kontext, { dokumente, mappe }: MappenEintrag, alle: boolean) => ({
	mappe,
	dokumente: await Promise.all(
		dokumente.map(async ({ id, meta }, i) => ({
			id,
			meta,
			vorschau: await kontext.vorschau.stand(mappe.id, id, alle || i === 0),
		})),
	),
});

const MAX_TITEL = 120;

const pruefeTitel = (titel: unknown) => {
	const name = typeof titel === 'string' ? titel.trim() : '';
	if (name === '') {
		throw new HttpFehler(400, 'Bitte gib einen Titel ein.');
	}
	if (name.length > MAX_TITEL) {
		throw new HttpFehler(400, `Der Titel ist zu lang (höchstens ${MAX_TITEL} Zeichen).`);
	}
	return name;
};

const gleicherTitel = (a: string, b: string) => a.trim().toLocaleLowerCase('de') === b.toLocaleLowerCase('de');

/** Mappen auflisten, ansehen, als ein PDF holen, duplizieren und in den Papierkorb legen (unter `/api/mappen`). */
export const mappenApi = (kontext: Kontext) => {
	const { materialDir } = kontext.konfig;
	const router = Router();
	router.param('mappe', pruefeIdParam('Mappe'));

	router.get('/', async (req, res) => {
		const { defekt, mappen } = await sammleMappen(materialDir, leseFilter(req.query));
		res.json({ mappen: await Promise.all(mappen.map((e) => mitVorschau(kontext, e, false))), defekt });
	});

	router.get('/:mappe', async (req, res) => {
		verlangeMappe(kontext, req.params.mappe);
		res.json(await mitVorschau(kontext, await leseMappenEintrag(materialDir, req.params.mappe), true));
	});

	router.post('/:mappe/pdf', async (req, res) => {
		const { mappe } = req.params;
		verlangeMappe(kontext, mappe);
		const body = req.body as { variante?: unknown; profil?: unknown } | undefined;
		const variante = waehleMappenVariante(body?.variante);
		const profil = waehleProfil(body?.profil);
		res.json(
			pdfAntwort(
				`/api/mappen/${mappe}/pdf/${variante}`,
				await kontext.pdf.mappe(mappe, variante, profil),
				profil,
			),
		);
	});

	router.get('/:mappe/pdf/:variante{/:datei}', async (req, res) => {
		const { mappe, variante } = req.params;
		verlangeMappe(kontext, mappe);
		const profil = waehleProfil(req.query.profil);
		await sendePdf(req, res, await kontext.pdf.mappe(mappe, waehleMappenVariante(variante), profil));
	});

	router.post('/', async (req, res) => {
		const { fach, klasse, titel } = (req.body ?? {}) as Record<string, unknown>;
		const name = pruefeTitel(titel);
		if (!FAECHER.includes(fach as Fach) || !KLASSEN.includes(klasse as Klasse)) {
			throw new HttpFehler(400, 'Bitte wähle Fach und Klasse aus.');
		}
		const { mappen } = await sammleMappen(materialDir);
		if (mappen.some((m) => gleicherTitel(m.mappe.titel, name))) {
			throw new HttpFehler(409, `Eine Mappe „${name}“ gibt es schon. Wähle bitte einen anderen Titel.`);
		}
		const { mappe } = await neueMappe(materialDir, { titel: name, fach: fach as Fach, klasse: klasse as Klasse });
		kontext.ereignisse.sende({ typ: 'mappe-neu', daten: { mappe: mappe.id } });
		res.status(201).json({ mappe });
	});

	router.get('/vorlagen/liste', (_req, res) => {
		res.json({ vorlagen: verfuegbareVorlagen() });
	});

	router.post('/:mappe/dokumente', async (req, res) => {
		const { mappe } = req.params;
		verlangeMappe(kontext, mappe);
		const { art, format, titel, vorlage, zusatz } = (req.body ?? {}) as Record<string, unknown>;
		const name = pruefeTitel(titel);
		if (!ARTEN.includes(art as Art)) {
			throw new HttpFehler(400, 'Bitte wähle aus, was du anlegen möchtest.');
		}
		const fest = typeof vorlage === 'string' ? VORLAGE_FORMAT[vorlage]?.format : undefined;
		if (fest !== format && !ART_FORMATE[art as Art].includes(format as Format)) {
			throw new HttpFehler(400, 'Dieses Format passt nicht zu dieser Art.');
		}
		if (vorlage !== undefined && !verfuegbareVorlagen().includes(String(vorlage))) {
			throw new HttpFehler(400, 'Diese Vorlage gibt es nicht.');
		}
		const daten = await leseMappe(materialDir, mappe);
		const metas = await Promise.all(daten.dokumente.map((d) => leseMeta(materialDir, mappe, d)));
		if (metas.some((m) => gleicherTitel(m.titel, name))) {
			throw new HttpFehler(409, `In dieser Mappe gibt es „${name}“ schon. Wähle bitte einen anderen Titel.`);
		}
		const w = (zusatz ?? {}) as Record<string, unknown>;
		const { id } = await neuesDokument(materialDir, mappe, {
			titel: name,
			art: art as Art,
			format: format as Format,
			druckprofil: 'farbe',
			...(typeof vorlage === 'string' ? { vorlage } : {}),
			druckhinweise: [],
			urheber: 'lehrkraft',
			zusatz: {
				selbsteinschaetzung: w.selbsteinschaetzung === true,
				niveaus: w.niveaus === true,
				sternchen: w.sternchen === true,
			},
		});
		kontext.ereignisse.sende({ typ: 'mappe-neu', daten: { mappe } });
		res.status(201).json({ id });
	});

	router.post('/:mappe/duplizieren', async (req, res) => {
		verlangeMappe(kontext, req.params.mappe);
		res.status(201).json({ mappe: await dupliziereMappe(materialDir, req.params.mappe) });
	});

	router.post('/:mappe/loeschen', async (req, res) => {
		const { mappe } = req.params;
		verlangeMappe(kontext, mappe);
		const eintrag = await legeInPapierkorb(materialDir, mappe);
		for (const schluessel of [...kontext.bekannt.keys()].filter((k) => k.startsWith(`${mappe}/`))) {
			kontext.bekannt.delete(schluessel);
		}
		res.json({ eintrag });
	});

	return router;
};

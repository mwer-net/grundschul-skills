import { existsSync } from 'node:fs';
import path from 'node:path';

import { dokKnotenSchluessel, dokumentGeloescht, legeVarianteAn, leseMappenEintrag, mappenDir, verfuegbareVorlagen } from '@schoolbox/kern';
import { Router } from 'express';

import { verlangeDokument } from './dokumente';
import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';
import { pruefeIdParam } from './schutz';

const verlangeMappe = (kontext: Kontext, mappe: string) => {
	if (!existsSync(path.join(mappenDir(kontext.konfig.materialDir, mappe), 'mappe.json'))) {
		throw new HttpFehler(404, `Den Ordner „${mappe}“ gibt es nicht.`);
	}
};

/** Der unsichtbare Behälter (unter `/api/mappen`): Inhalt für die Dokumentansicht, Vorlagen, Varianten. */
export const mappenApi = (kontext: Kontext) => {
	const { materialDir } = kontext.konfig;
	const router = Router();
	router.param('mappe', pruefeIdParam('Mappe'));

	router.get('/vorlagen/liste', (_req, res) => {
		res.json({ vorlagen: verfuegbareVorlagen() });
	});

	router.get('/:mappe', async (req, res) => {
		const { mappe: id } = req.params;
		verlangeMappe(kontext, id);
		const baum = kontext.ordner.baum();
		const { dokumente, mappe } = await leseMappenEintrag(materialDir, id);
		const lebende = dokumente.filter((d) => !dokumentGeloescht(baum, id, d.id));
		res.json({
			mappe: { ...mappe, dokumente: lebende.map((d) => d.id) },
			dokumente: await Promise.all(
				lebende.map(async ({ id: dok, meta }) => ({
					id: dok,
					meta,
					vorschau: await kontext.vorschau.stand(id, dok, true),
				})),
			),
		});
	});

	/** Die Variante liegt im selben Behälter wie das Original und logisch direkt daneben. */
	router.post('/:mappe/dokumente/:dok/variante', async (req, res) => {
		const { dok, mappe } = req.params;
		verlangeDokument(kontext, mappe, dok);
		const antwort = await kontext.ordner.aendere(async (baum) => {
			const { id, titel } = await legeVarianteAn(materialDir, mappe, dok);
			const neu = structuredClone(baum);
			neu.rev += 1;
			neu.dokumente[dokKnotenSchluessel(mappe, id)] = {
				ordner: baum.dokumente[dokKnotenSchluessel(mappe, dok)]?.ordner ?? null,
				geloescht: null,
			};
			return { baum: neu, ergebnis: { id, titel } };
		});
		kontext.ereignisse.sende({ typ: 'mappe-neu', daten: { mappe } });
		res.status(201).json(antwort);
	});

	return router;
};

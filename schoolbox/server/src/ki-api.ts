import { KI_AKTIONEN, leseMappe, leseMeta } from '@schoolbox/kern';
import type { Router as RouterTyp } from 'express';

import { leseQuelle, schreibeQuelle, verlangeDokument } from './dokumente';
import { HttpFehler } from './fehler';
import type { KiNachricht } from './ki';
import { aktionWunsch, KI_WARN_AB, leseVorschlag, verwirfVorschlag } from './ki';
import type { Kontext } from './kontext';
import { dokSchluessel, kennung } from './kontext';

const text = (wert: unknown) => (typeof wert === 'string' ? wert : undefined);

const nachrichten = (wert: unknown): KiNachricht[] | undefined => {
	if (wert === undefined) {
		return undefined;
	}
	if (!Array.isArray(wert)) {
		throw new HttpFehler(400, 'Der Verlauf ist ungültig.');
	}
	return wert.map((n: unknown) => {
		const { rolle, text: inhalt } = (n ?? {}) as Record<string, unknown>;
		if ((rolle !== 'lehrkraft' && rolle !== 'claude') || typeof inhalt !== 'string') {
			throw new HttpFehler(400, 'Der Verlauf ist ungültig.');
		}
		return { rolle, text: inhalt };
	});
};

const kennungDerQuelle = async (dir: string) => kennung(await leseQuelle(dir));

/** Aufträge an Claude (057). Hängt am `apiRouter`: nur mit Sitzung, nie über Teilen-Links. */
export const kiApi = (router: RouterTyp, kontext: Kontext) => {
	const { ki, konfig } = kontext;
	const { materialDir } = konfig;

	router.get('/ki/status', async (_req, res) => {
		res.json({ verfuegbar: await ki.angemeldet(), limit: ki.limit(), warnAb: KI_WARN_AB, aktionen: KI_AKTIONEN });
	});

	router.post('/dokumente/:mappe/:dok/ki', async (req, res) => {
		const { dok, mappe } = req.params;
		verlangeDokument(kontext, mappe, dok);
		const body = (req.body ?? {}) as Record<string, unknown>;
		const aktion = KI_AKTIONEN.find((a) => a.id === body.aktion);
		if (body.aktion !== undefined && !aktion) {
			throw new HttpFehler(400, 'Diese Aktion gibt es nicht.');
		}
		const inhalt = aktion
			? await aktionWunsch(aktion, {
					fach: (await leseMappe(materialDir, mappe)).fach,
					art: (await leseMeta(materialDir, mappe, dok)).art,
				})
			: { auftrag: text(body.auftrag) ?? '' };
		const eingabe = text(body.auftrag);
		if (aktion?.eingabe && !eingabe) {
			throw new HttpFehler(400, 'Bitte schreib, worum es geht.');
		}
		const auftrag = await ki.starte({
			...inhalt,
			auftrag: aktion?.eingabe ? `${inhalt.auftrag}\n\nWunsch der Lehrkraft: ${eingabe}` : inhalt.auftrag,
			mappe,
			dok,
			referenz: text(body.referenz),
			aufVorschlag: body.aufVorschlag === true,
			verlauf: nachrichten(body.verlauf),
			zitat: text(body.zitat),
			ohneRueckfragen: aktion !== undefined,
		});
		res.status(202).json({ auftrag });
	});

	router.get('/dokumente/:mappe/:dok/ki', (req, res) => {
		const { dok, mappe } = req.params;
		verlangeDokument(kontext, mappe, dok);
		res.json({ auftraege: ki.offene(mappe, dok) });
	});

	router.get('/ki/:id', (req, res) => {
		const auftrag = ki.auftrag(req.params.id);
		if (!auftrag) {
			throw new HttpFehler(404, 'Diesen Auftrag gibt es nicht mehr. Vielleicht wurde der Server neu gestartet.');
		}
		res.json({ auftrag });
	});

	router.post('/ki/:id/abbrechen', (req, res) => {
		res.json({ abgebrochen: ki.abbrechen(req.params.id) });
	});

	router.get('/dokumente/:mappe/:dok/vorschlag', async (req, res) => {
		const { dok, mappe } = req.params;
		const dir = verlangeDokument(kontext, mappe, dok);
		const vorschlag = await leseVorschlag(materialDir, mappe, dok);
		res.json({
			vorschlag: vorschlag && {
				...vorschlag.meta,
				konflikt: vorschlag.meta.basis !== (await kennungDerQuelle(dir)),
			},
		});
	});

	router.post('/dokumente/:mappe/:dok/vorschlag/annehmen', async (req, res) => {
		const { dok, mappe } = req.params;
		const dir = verlangeDokument(kontext, mappe, dok);
		const ergebnis = await kontext.sperre(dokSchluessel(mappe, dok), async () => {
			const vorschlag = await leseVorschlag(materialDir, mappe, dok);
			if (!vorschlag) {
				throw new HttpFehler(404, 'Diesen Vorschlag gibt es nicht mehr.');
			}
			if (vorschlag.meta.basis !== (await kennungDerQuelle(dir))) {
				throw new HttpFehler(409, 'Das Blatt wurde seit dem Auftrag geändert. Starte den Auftrag bitte neu.');
			}
			const gespeichert = await schreibeQuelle(kontext, mappe, dok, vorschlag.quelle, {
				urheber: 'claude',
				zusammenfassen: false,
			});
			await verwirfVorschlag(materialDir, mappe, dok);
			return gespeichert;
		});
		res.json(ergebnis);
	});

	router.post('/dokumente/:mappe/:dok/vorschlag/verwerfen', async (req, res) => {
		const { dok, mappe } = req.params;
		verlangeDokument(kontext, mappe, dok);
		await verwirfVorschlag(materialDir, mappe, dok);
		res.json({ verworfen: true });
	});
};

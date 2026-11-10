import type { Antworten } from '@schoolbox/kern';
import {
	auftragAus,
	KI_AKTIONEN,
	leseMappe,
	leseMeta,
	ordnerGeloescht,
	ordnerPfad,
	pruefeAntworten,
	pruefeAuftragText,
	sammleMappen,
	schritteFuer,
} from '@schoolbox/kern';
import type { Router as RouterTyp } from 'express';

import { leseQuelle, schreibeQuelle, verlangeDokument } from './dokumente';
import { HttpFehler } from './fehler';
import type { KiNachricht } from './ki';
import { aktionWunsch, KI_WARN_AB, leseVorschlag, pruefeGespraechId, verwirfVorschlag } from './ki';
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

/**
 * Der Teil der Lehrkraft für `neu-entwurf`. Aus dem Assistenten (131) baut der Server den Auftrag selbst aus den
 * Antworten, mit Art, Fach und Klasse des Dokuments; `auftragText` ersetzt ihn, wenn die Lehrkraft ihn bearbeitet hat.
 * Ohne Antworten der freie Wunsch aus dem Chat (077), bis 136 ihn entfernt.
 */
const eingabeVon = (body: Record<string, unknown>, dokument: Pick<Antworten, 'art' | 'fach' | 'klasse'>) => {
	if (body.antworten === undefined) {
		const wunsch = text(body.auftrag);
		if (!wunsch) {
			throw new HttpFehler(400, 'Bitte schreib, worum es geht.');
		}
		return `Wunsch der Lehrkraft: ${wunsch}`;
	}
	const antworten = { ...pruefeAntworten(body.antworten, dokument), ...dokument };
	if (antworten.weg !== 'claude') {
		throw new HttpFehler(400, 'Ein leeres Blatt braucht Claude nicht.');
	}
	const fehlt = schritteFuer(antworten)
		.filter((s) => s.id !== 'pruefen')
		.map((s) => s.fehlt?.(antworten))
		.find(Boolean);
	if (fehlt) {
		throw new HttpFehler(400, fehlt);
	}
	const auftrag = body.auftragText === undefined ? auftragAus(antworten) : pruefeAuftragText(body.auftragText);
	return `Auftrag der Lehrkraft (aus dem Assistenten):\n${auftrag}`;
};

/** Aufträge an Claude (057). Hängt am `apiRouter`: nur mit Sitzung, nie über Teilen-Links. */
export const kiApi = (router: RouterTyp, kontext: Kontext) => {
	const { ki, konfig } = kontext;
	const { materialDir } = konfig;

	const kiStatus = async () => ({
		verfuegbar: await ki.angemeldet(),
		limit: ki.limit(),
		warnAb: KI_WARN_AB,
		aktionen: KI_AKTIONEN,
	});

	router.get('/ki/status', async (_req, res) => {
		res.json(await kiStatus());
	});

	router.post('/ki/limit/pruefen', async (_req, res) => {
		if (await ki.angemeldet()) {
			await ki.pruefeLimit();
		}
		res.json(await kiStatus());
	});

	router.post('/ki/einordnen', async (req, res) => {
		const body = (req.body ?? {}) as Record<string, unknown>;
		const { mappen } = await sammleMappen(materialDir);
		const baum = kontext.ordner.baum();
		const ordner = baum.ordner
			.filter((o) => !ordnerGeloescht(baum, o.id))
			.map((o) => {
				const behaelter = mappen.find((m) => m.mappe.id === o.behaelter)?.mappe;
				return {
					id: o.id,
					pfad: ordnerPfad(baum, o.id)
						.map((p) => p.name)
						.join(' > '),
					...(behaelter ? { fach: behaelter.fach, klasse: behaelter.klasse } : {}),
				};
			});
		const wunsch = text(body.ordner);
		const aktuelle = ordner.find((o) => o.id === wunsch);
		if (wunsch && !aktuelle) {
			throw new HttpFehler(404, 'Diesen Ordner gibt es nicht mehr.');
		}
		res.json(await ki.einordne({ text: text(body.text) ?? '', ordner, aktuelle }));
	});

	router.post('/dokumente/:mappe/:dok/ki', async (req, res) => {
		const { dok, mappe } = req.params;
		verlangeDokument(kontext, mappe, dok);
		const body = (req.body ?? {}) as Record<string, unknown>;
		const aktion = KI_AKTIONEN.find((a) => a.id === body.aktion);
		if (body.aktion !== undefined && !aktion) {
			throw new HttpFehler(400, 'Diese Aktion gibt es nicht.');
		}
		const { fach, klasse } = await leseMappe(materialDir, mappe);
		const { art } = await leseMeta(materialDir, mappe, dok);
		const inhalt = aktion ? await aktionWunsch(aktion, { fach, art }) : { auftrag: text(body.auftrag) ?? '' };
		const eingabe = aktion?.eingabe ? eingabeVon(body, { art, fach, klasse }) : undefined;
		const auftrag = await ki.starte({
			...inhalt,
			auftrag: eingabe ? `${inhalt.auftrag}\n\n${eingabe}` : inhalt.auftrag,
			mappe,
			dok,
			referenz: text(body.referenz),
			aufVorschlag: body.aufVorschlag === true,
			gespraechId: pruefeGespraechId(body.gespraechId),
			verlauf: nachrichten(body.verlauf),
			zitat: text(body.zitat),
			ohneRueckfragen: aktion !== undefined,
			neuesBlatt: aktion?.id === 'neu-entwurf',
		});
		res.status(202).json({ auftrag });
	});

	/** `entwurf`: der jüngste Auftrag am neuen Blatt, auch beendet (133). So stimmt der Editor nach dem Neuladen. */
	router.get('/dokumente/:mappe/:dok/ki', (req, res) => {
		const { dok, mappe } = req.params;
		verlangeDokument(kontext, mappe, dok);
		res.json({ auftraege: ki.offene(mappe, dok), entwurf: ki.entwurf(mappe, dok) });
	});

	router.post('/dokumente/:mappe/:dok/ki/nochmal', async (req, res) => {
		const { dok, mappe } = req.params;
		verlangeDokument(kontext, mappe, dok);
		res.status(202).json({ auftrag: await ki.nochmal(mappe, dok) });
	});

	router.post('/dokumente/:mappe/:dok/ki/entwurf/vergessen', (req, res) => {
		const { dok, mappe } = req.params;
		verlangeDokument(kontext, mappe, dok);
		ki.vergiss(mappe, dok);
		res.json({ vergessen: true });
	});

	router.get('/ki/entwuerfe', (_req, res) => {
		res.json({ entwuerfe: ki.entwuerfe() });
	});

	router.delete('/ki/gespraech/:id', async (req, res) => {
		const id = pruefeGespraechId(req.params.id);
		if (id) {
			await ki.beendeGespraech(id);
		}
		res.json({ beendet: true });
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
				// Das neue Blatt zeigt der Editor als Vorschlag selbst (133).
				...(req.query.quelle === '1' ? { quelle: vorschlag.quelle } : {}),
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
			if (vorschlag.meta.neuesBlatt) {
				ki.vergiss(mappe, dok);
			}
			return gespeichert;
		});
		res.json(ergebnis);
	});

	router.post('/dokumente/:mappe/:dok/vorschlag/verwerfen', async (req, res) => {
		const { dok, mappe } = req.params;
		verlangeDokument(kontext, mappe, dok);
		if ((await leseVorschlag(materialDir, mappe, dok))?.meta.neuesBlatt) {
			ki.vergiss(mappe, dok);
		}
		await verwirfVorschlag(materialDir, mappe, dok);
		res.json({ verworfen: true });
	});
};

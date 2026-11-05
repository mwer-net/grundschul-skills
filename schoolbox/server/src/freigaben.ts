import type { Baum, Druckprofil, Freigabe, FreigabeZiel, MappenVariante, OrdnerEintrag } from '@schoolbox/kern';
import {
	dokKnotenSchluessel,
	dokumenteVonZiel,
	dokumentGeloescht,
	ENTWURF_QUELLE,
	findeFreigabe,
	ID_MUSTER,
	istToken,
	KI_PRUEFDATEI,
	lebenderOrdner,
	legeFreigabeAn,
	leseFreigaben,
	leseMappe,
	leseMeta,
	ordneNachFolge,
	ordnerMitBehaelter,
	ordnerUnter,
	ordnerVonZiel,
	widerrufeFreigabe,
	zielGibtEs,
} from '@schoolbox/kern';
import type { Request, RequestHandler } from 'express';
import { Router } from 'express';

import { ansichtRouter } from './ansicht';
import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';
import { FREIGABEN_SPERRE } from './kontext';
import { MAX_SAMMLUNG, pdfAntwort, sendePdf, waehleMappenVariante, waehlePdfVariante, waehleProfil } from './pdf';

const ID_REGEX = new RegExp(ID_MUSTER);
const SICHERE_METHODEN = new Set(['GET', 'HEAD']);
/** Was ein Teilen-Link im Dokumentordner nie sieht: alte Stände, Entwürfe, Verwaltungsdaten. */
const GESPERRT_IM_DOKUMENT = new Set(['versionen', 'entwuerfe', 'vorschlag', KI_PRUEFDATEI, 'meta.json']);
export const GILT_NICHT_MEHR = 'Dieser Link gilt nicht mehr.';

export const freigabePfad = (token: string) => `/f/${token}`;

const mitLink = (kontext: Kontext, freigabe: Freigabe) => ({
	...freigabe,
	pfad: freigabePfad(freigabe.token),
	url: kontext.konfig.schoolboxUrl ? `${kontext.konfig.schoolboxUrl}${freigabePfad(freigabe.token)}` : null,
});

const leseZiel = (body: unknown): FreigabeZiel => {
	const { dok, mappe, ordner } = (body ?? {}) as { dok?: unknown; mappe?: unknown; ordner?: unknown };
	if (typeof ordner === 'string') {
		return { ordner };
	}
	if (typeof mappe !== 'string' || !ID_REGEX.test(mappe)) {
		throw new HttpFehler(400, '„mappe“ fehlt oder ist ungültig.');
	}
	if (dok !== undefined && dok !== null && (typeof dok !== 'string' || !ID_REGEX.test(dok))) {
		throw new HttpFehler(400, '„dok“ ist ungültig.');
	}
	return { mappe, dok: dok ?? null };
};

const text = (wert: unknown) => (typeof wert === 'string' && wert ? wert : undefined);

/** Verwaltung der Teilen-Links für die angemeldete Lehrkraft (unter `/api/freigaben`). */
export const freigabenApi = (kontext: Kontext) => {
	const { materialDir } = kontext.konfig;
	const router = Router();

	router.get('/', async (req, res) => {
		const mappe = text(req.query.mappe);
		const dok = text(req.query.dok);
		const ordner = text(req.query.ordner);
		const baum = kontext.ordner.baum();
		const passt = ({ ziel }: Freigabe) => {
			if ('ordner' in ziel) {
				return ordner === undefined ? mappe === undefined && dok === undefined : ziel.ordner === ordner;
			}
			if (ordner !== undefined) {
				// Ein alter Link auf die Mappe gehört zu dem Ordner, der aus ihr entstand.
				return ziel.dok === null && ordnerMitBehaelter(baum, ziel.mappe)?.id === ordner;
			}
			return (mappe === undefined || ziel.mappe === mappe) && (dok === undefined || ziel.dok === dok);
		};
		const freigaben = (await leseFreigaben(materialDir)).filter(passt).map((f) => mitLink(kontext, f));
		res.json({ freigaben });
	});

	router.post('/', async (req, res) => {
		const ziel = leseZiel(req.body);
		if ('ordner' in ziel && !lebenderOrdner(kontext.ordner.baum(), ziel.ordner)) {
			throw new HttpFehler(404, 'Diesen Ordner gibt es nicht mehr.');
		}
		const freigabe = await kontext.sperre(FREIGABEN_SPERRE, () => legeFreigabeAn(materialDir, ziel));
		kontext.ereignisse.sende({ typ: 'ordner-geaendert', daten: { rev: kontext.ordner.baum().rev } });
		res.status(201).json(mitLink(kontext, freigabe));
	});

	router.post('/:token/widerrufen', async (req, res) => {
		const { token } = req.params;
		const freigabe = istToken(token)
			? await kontext.sperre(FREIGABEN_SPERRE, () => widerrufeFreigabe(materialDir, token))
			: null;
		if (!freigabe) {
			throw new HttpFehler(404, 'Diesen Link gibt es nicht.');
		}
		kontext.ereignisse.sende({ typ: 'ordner-geaendert', daten: { rev: kontext.ordner.baum().rev } });
		res.json(mitLink(kontext, freigabe));
	});

	return router;
};

const freigaben = new WeakMap<Request, Freigabe>();

const freigabeVon = (req: Request): Freigabe => {
	const freigabe = freigaben.get(req);
	if (!freigabe) {
		throw new HttpFehler(500, 'Freigabe fehlt.');
	}
	return freigabe;
};

/** Dokument-IDs sind nur je Behälter eindeutig. Darum heißt es bei Ordner-Links `d/<mappe>~<dok>`. */
const zerlegeDokAdresse = (adresse: string, ziel: FreigabeZiel) => {
	const [links = '', rechts] = adresse.split('~');
	if (rechts !== undefined) {
		return { mappe: links, dok: rechts };
	}
	return 'ordner' in ziel ? null : { mappe: ziel.mappe, dok: links };
};

const zerlegePfad = (pfad: string): string[] => {
	const teile = pfad.slice(1).split('/');
	if (teile.length > 1 && teile.at(-1) === '') {
		teile.pop();
	}
	try {
		return teile.map((t) => decodeURIComponent(t));
	} catch {
		throw new HttpFehler(400, 'Ungültiger Pfad.');
	}
};

/**
 * Erlaubt in der Darstellung nur das freigegebene Ziel: die Dokumentordner (ohne Versionen, Entwürfe, meta.json), die
 * Bilder und Thema-CSS der Behälter, in denen ein erlaubtes Dokument liegt (`../../bilder/`, `../../detektiv.css` aus
 * dem Dokument), und `_assets/`. Alles andere ist 404, als gäbe es es nicht.
 */
const ansichtWaechter =
	(kontext: Kontext): RequestHandler =>
	(req, _res, next) => {
		const { ziel } = freigabeVon(req);
		const [mappe, ordner, dok, erster] = zerlegePfad(req.path);
		if (mappe === '_assets') {
			next();
			return;
		}
		const erlaubte = dokumenteVonZiel(kontext.ordner.baum(), ziel);
		const inBehaelter = erlaubte.some((d) => d.mappe === mappe);
		const gemeinsam = ordner === 'bilder' || (ordner?.endsWith('.css') === true && dok === undefined);
		const erlaubt =
			inBehaelter &&
			(gemeinsam ||
				(ordner === 'dokumente' &&
					erlaubte.some((d) => d.mappe === mappe && d.dok === dok) &&
					req.query.entwurf === undefined &&
					req.query.vorschlag === undefined &&
					(erster === undefined || !(GESPERRT_IM_DOKUMENT.has(erster) || ENTWURF_QUELLE.test(erster)))));
		next(erlaubt ? undefined : new HttpFehler(404, 'Nicht gefunden.'));
	};

/** Ziel lebt: Ein Link auf etwas im Papierkorb ist tot (410), wie auf etwas endgültig Gelöschtes. */
const zielLebt = (kontext: Kontext, ziel: FreigabeZiel) => {
	const baum = kontext.ordner.baum();
	if ('ordner' in ziel) {
		return lebenderOrdner(baum, ziel.ordner) !== null;
	}
	if (!zielGibtEs(kontext.konfig.materialDir, ziel)) {
		return false;
	}
	return ziel.dok === null
		? ordnerMitBehaelter(baum, ziel.mappe) !== null
		: !dokumentGeloescht(baum, ziel.mappe, ziel.dok);
};

const kenntZiel = (baum: Baum, ziel: FreigabeZiel) => {
	if ('ordner' in ziel) {
		return true;
	}
	return ziel.dok === null
		? baum.ordner.some((o) => o.behaelter === ziel.mappe)
		: baum.dokumente[dokKnotenSchluessel(ziel.mappe, ziel.dok)] !== undefined;
};

/**
 * Teilen-Links unter `/f/:token`: Seiten (Ansicht, Präsentation), eine nur lesende API, die Darstellung und die PDFs,
 * alles beschränkt auf das freigegebene Ziel. Schreiben geht hier nie.
 */
export const teilenRouter = (kontext: Kontext, sendeSeite: (status: number) => RequestHandler) => {
	const { materialDir } = kontext.konfig;
	const router = Router({ mergeParams: true });

	router.use(async (req, res, next) => {
		res.set('Cache-Control', 'no-store');
		if (!SICHERE_METHODEN.has(req.method)) {
			throw new HttpFehler(403, 'Über einen geteilten Link lässt sich nichts ändern.');
		}
		const { token = '' } = req.params as { token?: string };
		const freigabe = await findeFreigabe(materialDir, token);
		// Claude schreibt an der Platte vorbei: Was der Baum noch nicht kennt, gleicht der erste Zugriff ab.
		if (freigabe && !kenntZiel(kontext.ordner.baum(), freigabe.ziel)) {
			await kontext.ordner.abgleichen();
		}
		const gueltig = freigabe !== null && freigabe.widerrufen === null && zielLebt(kontext, freigabe.ziel);
		if (gueltig) {
			freigaben.set(req, freigabe);
			next();
			return;
		}
		const status = freigabe === null ? 404 : 410;
		if (/^\/(api|ansicht|pdf|alles)(\/|$)/.test(req.path)) {
			throw new HttpFehler(status, GILT_NICHT_MEHR);
		}
		sendeSeite(status)(req, res, next);
	});

	/** Die Metas der erlaubten Dokumente in der Reihenfolge, die auch die Oberfläche zeigt. */
	const leseErlaubte = async (baum: Baum, ziel: FreigabeZiel) => {
		const erlaubte = dokumenteVonZiel(baum, ziel);
		const eintraege = await Promise.all(
			erlaubte.map(async ({ dok, mappe }) => ({
				mappe,
				id: dok,
				meta: await leseMeta(materialDir, mappe, dok),
				behaelter: await leseMappe(materialDir, mappe),
				ordner: baum.dokumente[dokKnotenSchluessel(mappe, dok)]?.ordner ?? null,
			})),
		);
		const wurzel = ordnerVonZiel(baum, ziel);
		return wurzel ? ordneNachFolge(baum, wurzel.id, eintraege) : eintraege;
	};

	router.get('/api/inhalt', async (req, res) => {
		const { ziel } = freigabeVon(req);
		const baum = await kontext.ordner.abgleichen();
		const wurzel = ordnerVonZiel(baum, ziel);
		const eintraege = await leseErlaubte(baum, ziel);
		const dokumente = await Promise.all(
			eintraege.map(async ({ behaelter, id, mappe, meta, ordner }) => ({
				mappe,
				id,
				meta,
				fach: behaelter.fach,
				klasse: behaelter.klasse,
				ordner,
				vorschau: await kontext.vorschau.stand(mappe, id, true),
			})),
		);
		const unterordner = wurzel
			? ordnerUnter(baum, wurzel.id)
					.filter((id) => id !== wurzel.id)
					.map((id) => baum.ordner.find((o) => o.id === id))
					.filter((o): o is OrdnerEintrag => o !== undefined)
					.map(({ behaelter, eltern, erstellt, geaendert, id, name }) => ({
						behaelter,
						eltern,
						erstellt,
						geaendert,
						id,
						name,
					}))
			: [];
		const mappe = 'ordner' in ziel ? null : await leseMappe(materialDir, ziel.mappe);
		res.json({
			ziel,
			titel: wurzel?.name ?? dokumente[0]?.meta.titel ?? '',
			wurzel: wurzel ? wurzel.id : null,
			wurzelBehaelter: wurzel?.behaelter ?? null,
			wurzelName: wurzel?.name ?? null,
			ordner: unterordner,
			dokumente,
			...(mappe ? { mappe: { ...mappe, dokumente: dokumente.map((d) => d.id) } } : {}),
		});
	});

	const verlangeDok = (req: Request) => {
		const { ziel } = freigabeVon(req);
		const { dok: adresse = '' } = req.params as { dok?: string };
		const gemeint = zerlegeDokAdresse(adresse, ziel);
		const erlaubt = dokumenteVonZiel(kontext.ordner.baum(), ziel);
		if (!gemeint || !erlaubt.some((d) => d.mappe === gemeint.mappe && d.dok === gemeint.dok)) {
			throw new HttpFehler(404, 'Nicht gefunden.');
		}
		return { ...gemeint, adresse };
	};

	/** „Alles als PDF“ nur für Links auf einen Ordner oder eine ganze Mappe. */
	const sammlungVon = async (req: Request, variante: MappenVariante, profil: Druckprofil | undefined) => {
		const { ziel } = freigabeVon(req);
		const baum = kontext.ordner.baum();
		const wurzel = ordnerVonZiel(baum, ziel);
		if (!wurzel) {
			throw new HttpFehler(404, 'Nicht gefunden.');
		}
		const teile = (await leseErlaubte(baum, ziel)).map(({ id, mappe }) => ({ mappe, dok: id }));
		if (teile.length > MAX_SAMMLUNG) {
			throw new HttpFehler(400, `Das sind zu viele Dokumente für ein PDF (höchstens ${MAX_SAMMLUNG}).`);
		}
		return kontext.pdf.sammlung(teile, variante, profil, wurzel.name);
	};

	const tokenVon = (req: Request) => (req.params as { token?: string }).token ?? '';

	router.get('/api/pdf/:dok/:variante', async (req, res) => {
		const { adresse, dok, mappe } = verlangeDok(req);
		const variante = waehlePdfVariante(req.params.variante);
		const profil = waehleProfil(req.query.profil);
		const pdf = await kontext.pdf.dokument(mappe, dok, variante, profil);
		res.json(pdfAntwort(`${freigabePfad(tokenVon(req))}/pdf/${adresse}/${variante}`, pdf, profil));
	});

	router.get('/api/alles/:variante', async (req, res) => {
		const variante = waehleMappenVariante(req.params.variante);
		const profil = waehleProfil(req.query.profil);
		const pdf = await sammlungVon(req, variante, profil);
		res.json(pdfAntwort(`${freigabePfad(tokenVon(req))}/alles/${variante}`, pdf, profil));
	});

	router.use('/api', () => {
		throw new HttpFehler(404, 'Nicht gefunden.');
	});

	router.use('/ansicht', ansichtWaechter(kontext), ansichtRouter(kontext));

	router.get('/pdf/:dok/:variante{/:datei}', async (req, res) => {
		const { dok, mappe } = verlangeDok(req);
		const profil = waehleProfil(req.query.profil);
		await sendePdf(
			req,
			res,
			await kontext.pdf.dokument(mappe, dok, waehlePdfVariante(req.params.variante), profil),
		);
	});

	router.get('/alles/:variante{/:datei}', async (req, res) => {
		const profil = waehleProfil(req.query.profil);
		await sendePdf(req, res, await sammlungVon(req, waehleMappenVariante(req.params.variante), profil));
	});

	router.get('/{*seite}', sendeSeite(200));

	return router;
};

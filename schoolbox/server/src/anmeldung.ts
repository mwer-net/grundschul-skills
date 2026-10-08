import { MAX_PASSWORT, pruefePasswort } from '@schoolbox/kern';
import type { Request, RequestHandler, Response } from 'express';
import { json, Router } from 'express';

import { ipSchluessel } from './bremse';
import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';
import { csrfSchutz } from './schutz';
import type { Sitzung } from './sitzung';
import { leseCookie, maxAlter, pruefeSitzung, signiereSitzung, SITZUNG_COOKIE, sollErneuern } from './sitzung';

export const ANMELDE_SEITE = '/anmelden';

const sicher = (kontext: Kontext, req: Request) =>
	req.secure || kontext.konfig.schoolboxUrl?.startsWith('https:') === true;

const cookieOptionen = (kontext: Kontext, req: Request) =>
	({ httpOnly: true, sameSite: 'lax', secure: sicher(kontext, req), path: '/' }) as const;

const setzeSitzung = (kontext: Kontext, req: Request, res: Response, sitzung: Sitzung) => {
	res.cookie(SITZUNG_COOKIE, signiereSitzung(kontext.konfig, sitzung), {
		...cookieOptionen(kontext, req),
		maxAge: maxAlter(sitzung),
	});
};

export const leseSitzung = (kontext: Kontext, req: Request) =>
	pruefeSitzung(kontext.konfig, leseCookie(req.headers.cookie, SITZUNG_COOKIE));

const minuten = (ms: number) => {
	const anzahl = Math.ceil(ms / 60_000);
	return anzahl === 1 ? 'eine Minute' : `${anzahl} Minuten`;
};

/** Feste Form, damit ein fail2ban-Filter darauf passen kann: `Anmeldung fehlgeschlagen: ip=<Adresse>`. */
const protokolliere = (was: 'fehlgeschlagen' | 'gebremst', req: Request) => {
	console.warn(`Anmeldung ${was}: ip=${req.ip ?? 'unbekannt'}`);
};

/** Anmelden, Abmelden und Sitzungsstatus. Liegt vor der Pflicht-Anmeldung, ist also ohne Sitzung erreichbar. */
export const anmeldeRouter = (kontext: Kontext) => {
	const router = Router();

	router.get('/sitzung', (req, res) => {
		res.set('Cache-Control', 'no-store').json({ angemeldet: leseSitzung(kontext, req) !== null });
	});

	router.post('/anmelden', csrfSchutz, json({ limit: '16kb' }), async (req, res) => {
		const { angemeldetBleiben, passwort } = (req.body ?? {}) as { angemeldetBleiben?: unknown; passwort?: unknown };
		if (typeof passwort !== 'string' || !passwort || passwort.length > MAX_PASSWORT) {
			throw new HttpFehler(400, 'Bitte gib das Passwort ein.');
		}
		const schluessel = ipSchluessel(req.ip);
		const warten = kontext.bremse.versuch(schluessel);
		if (warten > 0) {
			protokolliere('gebremst', req);
			res.set('Retry-After', String(Math.ceil(warten / 1000)));
			throw new HttpFehler(429, `Zu viele Versuche. Probier es in ${minuten(warten)} noch einmal.`, {
				wartenSekunden: Math.ceil(warten / 1000),
			});
		}
		if (!(await pruefePasswort(passwort, kontext.konfig.passwortHash))) {
			protokolliere('fehlgeschlagen', req);
			throw new HttpFehler(401, 'Das Passwort stimmt noch nicht.');
		}
		kontext.bremse.erfolg(schluessel);
		setzeSitzung(kontext, req, res, { ausgestellt: Date.now(), dauerhaft: angemeldetBleiben !== false });
		res.set('Cache-Control', 'no-store').json({ angemeldet: true });
	});

	router.post('/abmelden', csrfSchutz, (req, res) => {
		res.clearCookie(SITZUNG_COOKIE, cookieOptionen(kontext, req));
		res.set('Cache-Control', 'no-store').json({ angemeldet: false });
	});

	return router;
};

/**
 * Alles dahinter braucht eine Sitzung: Die API antwortet sonst mit 401, Seiten und Darstellung leiten zur
 * Anmeldung weiter. Eine genutzte Sitzung wird regelmäßig neu ausgestellt, damit sie nicht mitten im Gebrauch abläuft.
 */
export const verlangeSitzung =
	(kontext: Kontext): RequestHandler =>
	(req, res, next) => {
		const sitzung = leseSitzung(kontext, req);
		if (sitzung) {
			if (sollErneuern(sitzung)) {
				setzeSitzung(kontext, req, res, { ...sitzung, ausgestellt: Date.now() });
			}
			next();
			return;
		}
		if (req.originalUrl.startsWith('/api/') || !['GET', 'HEAD'].includes(req.method)) {
			next(new HttpFehler(401, 'Bitte melde dich an.'));
			return;
		}
		res.set('Cache-Control', 'no-store').redirect(
			302,
			`${ANMELDE_SEITE}?weiter=${encodeURIComponent(req.originalUrl)}`,
		);
	};

import { SchoolboxFehler } from '@schoolbox/kern';
import type { ErrorRequestHandler } from 'express';

export class HttpFehler extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly daten: Record<string, unknown> = {},
	) {
		super(message);
		this.name = 'HttpFehler';
	}
}

const statusAus = (fehler: unknown): number => {
	if (fehler instanceof HttpFehler) {
		return fehler.status;
	}
	if (fehler instanceof SchoolboxFehler) {
		return 400;
	}
	const status = (fehler as { status?: unknown } | null)?.status;
	return typeof status === 'number' && status >= 400 && status < 500 ? status : 500;
};

/** Eigene API und die nur lesende API hinter Teilen-Links antworten mit JSON. */
const API_PFAD = /^\/(f\/[^/]+\/)?api(\/|$)/;

const MELDUNGEN: Record<number, string> = {
	400: 'Die Anfrage ist ungültig.',
	413: 'Die Daten sind zu groß.',
	500: 'Etwas ist schiefgelaufen.',
};

export const fehlerBehandlung: ErrorRequestHandler = (fehler, req, res, next) => {
	const status = statusAus(fehler);
	if (status === 500) {
		console.error(`${req.method} ${req.originalUrl}`, fehler);
	}
	const eigen = fehler instanceof HttpFehler || fehler instanceof SchoolboxFehler;
	const meldung = eigen ? fehler.message : (MELDUNGEN[status] ?? MELDUNGEN[400]);
	if (res.headersSent) {
		next(fehler);
		return;
	}
	if (API_PFAD.test(req.originalUrl)) {
		res.status(status).json({ fehler: meldung, ...(fehler instanceof HttpFehler ? fehler.daten : {}) });
		return;
	}
	res.status(status).type('text/plain').send(meldung);
};

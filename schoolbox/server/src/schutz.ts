import { ID_MUSTER } from '@schoolbox/kern';
import type { RequestHandler, RequestParamHandler } from 'express';

import { HttpFehler } from './fehler';

export const CSRF_HEADER = 'x-schoolbox';
const ID_REGEX = new RegExp(ID_MUSTER);
const SICHERE_METHODEN = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Schreibende Anfragen nur als JSON mit eigenem Header. Ein fremdes Formular kann beides nicht setzen. */
export const csrfSchutz: RequestHandler = (req, _res, next) => {
	if (SICHERE_METHODEN.has(req.method) || (req.is('application/json') && req.get(CSRF_HEADER) === '1')) {
		next();
		return;
	}
	next(new HttpFehler(403, `Schreibende Anfragen brauchen Content-Type application/json und ${CSRF_HEADER}: 1.`));
};

export const pruefeIdParam = (was: string) => {
	const pruefen: RequestParamHandler = (_req, _res, next, wert: string) => {
		next(ID_REGEX.test(wert) ? undefined : new HttpFehler(400, `${was} „${wert}“ ist keine gültige ID.`));
	};
	return pruefen;
};

import { existsSync } from 'node:fs';
import path from 'node:path';

import type { RequestHandler } from 'express';
import express, { Router, static as statisch } from 'express';

import { ansichtRouter } from './ansicht';
import { apiRouter } from './api';
import { fehlerBehandlung } from './fehler';
import type { Kontext } from './kontext';

export const WEB_DIST = path.resolve(__dirname, '..', '..', 'web', 'dist');

const sicherheitsKoepfe: RequestHandler = (_req, res, next) => {
	res.set({
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'SAMEORIGIN',
		'Referrer-Policy': 'same-origin',
	});
	next();
};

/** Das gebaute Frontend; jede andere Seitenadresse bekommt index.html, den Rest erledigt der Router im Browser. */
const webRouter = (webDist: string) => {
	const router = Router();
	router.use(statisch(webDist, { index: false }));
	router.get('/{*seite}', (_req, res) => {
		const index = path.join(webDist, 'index.html');
		if (!existsSync(index)) {
			res.status(503).type('text/plain').send('Die Oberfläche ist noch nicht gebaut („pnpm build“).');
			return;
		}
		res.set('Cache-Control', 'no-cache').sendFile(index);
	});
	return router;
};

export const erstelleApp = (kontext: Kontext, webDist = WEB_DIST) => {
	const app = express();
	app.disable('x-powered-by');
	app.set('trust proxy', 'loopback');
	app.use(sicherheitsKoepfe);
	app.get('/healthz', (_req, res) => {
		res.set('Cache-Control', 'no-store').json({ status: 'ok', version: kontext.version });
	});
	app.use('/api', apiRouter(kontext));
	app.use('/ansicht', ansichtRouter(kontext));
	app.use(webRouter(webDist));
	app.use(fehlerBehandlung);
	return app;
};

import { existsSync, realpathSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { KatalogEintrag } from '@schoolbox/kern';
import {
	ASSETS,
	darstellungsHtml,
	dokumentGeloescht,
	einfuegbarAus,
	entferne,
	ID_MUSTER,
	KATALOG,
	klassenVon,
	leseStarter,
	liegtIn,
	mappenDir,
	sucheRessource,
	wendeAn,
	zerlege,
} from '@schoolbox/kern';
import { aufmachungVon } from '@schoolbox/kern/src/aufmachungen/index';
import { wendeAufmachungAn } from '@schoolbox/kern/src/aufmachungen';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { leseQuelle, verlangeDokument } from './dokumente';
import { HttpFehler } from './fehler';
import { leseVorschlag } from './ki';
import type { Kontext } from './kontext';
import { pruefeIdParam } from './schutz';

const ID_REGEX = new RegExp(ID_MUSTER);
const ASSETS_PFAD = '_assets';
const CSS_URL = /url\((?!data:)([^)]+)\)/g;

/**
 * Ein Vorschlag ist noch nicht angenommen und kommt von Claude: Selbst wenn die Prüfung etwas übersieht, läuft hier nur
 * Code vom Server und nichts lädt von außen. `script-src 'self'` statt `sandbox`, denn `abbildungen.js` zeichnet die Elemente.
 */
/** Setzt ein CSP-Schlüsselwort in einfache Anführungszeichen, etwa `'self'`. */
const wort = (name: string) => `'${name}'`;

export const VORSCHLAG_CSP = [
	`default-src ${wort('none')}`,
	`script-src ${wort('self')}`,
	`style-src ${wort('self')} ${wort('unsafe-inline')}`,
	`img-src ${wort('self')} data:`,
	`font-src ${wort('self')} data:`,
	`base-uri ${wort('none')}`,
	`form-action ${wort('none')}`,
	`frame-ancestors ${wort('self')}`,
].join('; ');

const nichtGefunden = () => new HttpFehler(404, 'Nicht gefunden.');

const leseEntwurf = async (dokDir: string, name: unknown) => {
	if (typeof name !== 'string' || !/^[A-Z]$/.test(name)) {
		throw new HttpFehler(400, 'Ungültiger Entwurf.');
	}
	return readFile(path.join(dokDir, 'entwuerfe', `${name}.html`), 'utf8').catch(() => {
		throw nichtGefunden();
	});
};

const leseVorschlagQuelle = async (kontext: Kontext, mappe: string, dok: string) => {
	const vorschlag = await leseVorschlag(kontext.konfig.materialDir, mappe, dok);
	if (!vorschlag) {
		throw nichtGefunden();
	}
	return vorschlag.quelle;
};

/**
 * Pfadteile aus der URL. Browser lösen `.` und `..` selbst auf, echte Seiten schicken sie also nie. Express
 * dekodiert `%2f` innerhalb eines Teils zu `/`; auch das ist ein Angriff, kein Dateiname.
 */
const pruefeTeile = (teile: unknown): string[] => {
	const liste = Array.isArray(teile) ? teile.filter((t): t is string => typeof t === 'string') : [];
	const ungueltig = (t: string) => !t || t.startsWith('.') || /[/\\\0]/.test(t);
	if (liste.length === 0 || liste.some(ungueltig)) {
		throw new HttpFehler(400, 'Ungültiger Pfad.');
	}
	return liste;
};

/** Erlaubt ist nur, was nach dem Auflösen aller Symlinks in der Mappe oder in assets/ liegt. */
const pruefeGrenzen = async (datei: string | null, mappeDir: string | null): Promise<string> => {
	const grenzen = [realpathSync(ASSETS), ...(mappeDir ? [realpathSync(mappeDir)] : [])];
	if (datei === null || !grenzen.some((g) => liegtIn(datei, g))) {
		throw nichtGefunden();
	}
	const info = await stat(datei).catch(() => null);
	if (!info?.isFile()) {
		throw nichtGefunden();
	}
	return datei;
};

/**
 * Passt den Inhalt ganz in den Rahmen (081). Gemessen wird erst, wenn `abbildungen.js` gezeichnet hat (das geschieht bei
 * `DOMContentLoaded`, dieser Lauschaufruf kommt danach) und die Schriften stehen. Bis dahin bleibt der Rahmen leer, damit
 * nichts springt. Notiz und Erwartungshorizont stehen sonst nur auf dem Lösungsblatt oder der Folie und wären hier leer.
 * Dazu `kl4`: Klasse 2 lehnte Starter mit größeren Zahlen ab, und die Vorschau zeigte die Fehlermeldung.
 */
const VORSCHAU_FIT = {
	stil: '<style>html{visibility:hidden}html,body{height:100%}body{padding:0}body>.koerper{position:absolute;left:0;top:0;width:max-content;max-width:400px;transform-origin:0 0}.notiz,x-erwartungshorizont{display:block}</style>',
	skript: `<script>(function () {
	var rand = 4;
	var koerper = document.querySelector('body > .koerper');
	var miss = function (mitKoerper) {
		var flaechen = (mitKoerper ? [koerper] : []).concat(Array.from(koerper.querySelectorAll('*:not(svg *)')))
			.map(function (e) { return e.getBoundingClientRect(); })
			.filter(function (r) { return r.width > 0 && r.height > 0; });
		var links = Math.min.apply(null, flaechen.map(function (r) { return r.left; }));
		var oben = Math.min.apply(null, flaechen.map(function (r) { return r.top; }));
		return {
			links: links,
			oben: oben,
			b: Math.max.apply(null, flaechen.map(function (r) { return r.right; })) - links,
			h: Math.max.apply(null, flaechen.map(function (r) { return r.bottom; })) - oben,
		};
	};
	var passe = function () {
		var frei = { b: innerWidth - 2 * rand, h: innerHeight - 2 * rand };
		if (frei.b <= 0 || frei.h <= 0) return;
		koerper.style.transform = 'none';
		koerper.style.width = '';
		// Linien und anderes ohne eigene Breite wären sonst fast unsichtbar; was von selbst schmal ist, bleibt schmal.
		var m = miss(true);
		if (m.b < 120) {
			koerper.style.width = '400px';
			if (miss(false).b <= m.b + 1) koerper.style.width = '';
			m = miss(true);
		}
		if (m.b > 0 && m.h > 0) {
			var s = Math.min(1, frei.b / m.b, frei.h / m.h);
			var x = rand + (frei.b - m.b * s) / 2 - m.links * s;
			var y = rand + (frei.h - m.h * s) / 2 - m.oben * s;
			koerper.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
		}
		document.documentElement.style.visibility = 'visible';
		document.documentElement.dataset.fit = '1';
	};
	addEventListener('resize', passe);
	// Bilder kennen ihre Größe erst danach.
	addEventListener('load', passe);
	addEventListener('DOMContentLoaded', function () {
		// Die Messung löst das Laden der Schriften aus, sonst wäre \`fonts.ready\` schon erfüllt.
		koerper.getBoundingClientRect();
		(document.fonts ? document.fonts.ready : Promise.resolve()).then(passe);
	});
})();</script>`,
} as const;

const katalogVorschau = (e: KatalogEintrag, starter: ReadonlyMap<string, string>, assets: string, fit: boolean) => {
	const b = einfuegbarAus(e, starter);
	const innen = b.teile ? b.teile.join('') : (b.html ?? '');
	return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Vorschau</title><base href="${assets}">
<link rel="stylesheet" href="blatt.css"><style>html,body{background:#fff;overflow:hidden}body{margin:0;padding:12px}.flaeche{min-width:240px;outline:1px dashed #aaa;outline-offset:-1px}</style>${fit ? VORSCHAU_FIT.stil : ''}</head>
<body class="${fit ? 'kl4' : 'kl2'} farbe"><div class="koerper">${innen}</div><script src="abbildungen.js"></script>${fit ? VORSCHAU_FIT.skript : ''}</body></html>`;
};

const urlPfad = (teile: string[]) => teile.map(encodeURIComponent).join('/');

/**
 * Wie blatt.py: `url()` in CSS gilt relativ zum Ordner der CSS-Datei, nicht zur Adresse im Browser. Darum werden
 * die Verweise auf die tatsächlich gefundene Datei umgeschrieben, relativ zur Adresse der CSS-Datei.
 */
const schreibeCssUm = (css: string, cssDatei: string, req: Request, mappe: string | null, mappeDir: string | null) => {
	const cssUrl = `${req.baseUrl}${req.path}`;
	const assets = realpathSync(ASSETS);
	const mappeEcht = mappeDir ? realpathSync(mappeDir) : null;
	return css.replace(CSS_URL, (ganz, roh: string) => {
		const datei = sucheRessource(roh.trim().replace(/^["']|["']$/g, ''), path.dirname(cssDatei));
		if (datei === null) {
			return ganz;
		}
		let ziel: string | null = null;
		if (liegtIn(datei, assets)) {
			ziel = `${req.baseUrl}/${ASSETS_PFAD}/${urlPfad(path.relative(assets, datei).split(path.sep))}`;
		} else if (mappe && mappeEcht && liegtIn(datei, mappeEcht)) {
			ziel = `${req.baseUrl}/${mappe}/${urlPfad(path.relative(mappeEcht, datei).split(path.sep))}`;
		}
		return ziel === null ? ganz : `url("${path.posix.relative(path.posix.dirname(cssUrl), ziel)}")`;
	});
};

const sendeDatei = async (
	req: Request,
	res: Response,
	datei: string,
	mappe: string | null,
	mappeDir: string | null,
) => {
	res.set('Cache-Control', 'no-cache');
	if (path.extname(datei).toLowerCase() === '.css') {
		const css = await readFile(datei, 'utf8');
		res.type('text/css').send(schreibeCssUm(css, datei, req, mappe, mappeDir));
		return;
	}
	await new Promise<void>((resolve, reject) => {
		res.sendFile(datei, { dotfiles: 'allow', cacheControl: false }, (fehler) => {
			if (fehler) {
				reject(fehler);
			} else {
				resolve();
			}
		});
	});
};

/**
 * Darstellung von material.html und seinen Ressourcen. Die Adresse spiegelt die Ablage
 * (`/ansicht/<mappe>/dokumente/<dok>/`), damit `../../bilder/x.png` wie in blatt.py die Bilder der Mappe trifft.
 */
export const ansichtRouter = (kontext: Kontext) => {
	const { materialDir } = kontext.konfig;
	const router = Router({ strict: true });
	router.param('mappe', pruefeIdParam('Mappe'));
	router.param('dok', pruefeIdParam('Dokument'));

	router.get(`/${ASSETS_PFAD}/*teile`, async (req, res) => {
		const teile = pruefeTeile(req.params.teile);
		const datei = existsSync(path.join(ASSETS, ...teile)) ? realpathSync(path.join(ASSETS, ...teile)) : null;
		await sendeDatei(req, res, await pruefeGrenzen(datei, null), null, null);
	});

	// Vorschau eines Katalogeintrags für die Bibliothek (044): mit denselben Assets wie ein Dokument.
	router.get('/_katalog/:id', (req, res) => {
		const eintrag = KATALOG.find((e) => e.id === req.params.id);
		if (!eintrag) {
			throw nichtGefunden();
		}
		res.set('Cache-Control', 'no-cache')
			.type('html')
			.send(katalogVorschau(eintrag, leseStarter(), `${req.baseUrl}/${ASSETS_PFAD}/`, req.query.fit === '1'));
	});

	// >> 119 Vorschau eines Rezepts: erste Seite, Rezept nur in der Antwort
	const nurSeite = (quelle: string, seite: unknown) => {
		if (seite !== '1') {
			return quelle;
		}
		const z = zerlege(quelle);
		const seiten = z.knoten.filter((k) => klassenVon(k).includes('seite'));
		const oberste = seiten.filter((k) => !seiten.some((s) => s !== k && s.start < k.start && k.ende <= s.ende));
		return oberste.length > 1 ? wendeAn(quelle, oberste.slice(1).flatMap((k) => entferne(z, k))) : quelle;
	};
	const mitRezept = (quelle: string, id: unknown) => {
		if (typeof id !== 'string' || !aufmachungVon(id)) {
			return quelle;
		}
		try {
			return wendeAufmachungAn(quelle, id);
		} catch {
			// Minibuch oder kein `body`: Die Kachel zeigt das Blatt ohne Rezept.
			return quelle;
		}
	};
	// << 119

	router.get('/:mappe/dokumente/:dok', (req, res) => {
		const [pfad, query] = req.originalUrl.split('?', 2);
		res.redirect(301, `${pfad}/${query === undefined ? '' : `?${query}`}`);
	});

	router.get('/:mappe/dokumente/:dok/', async (req, res) => {
		const dir = verlangeDokument(kontext, req.params.mappe, req.params.dok);
		const { aufmachung, entwurf, loesung, praesentation, profil, seite, vorschlag } = req.query;
		// Ein Entwurf unter derselben Adresse wie material.html: Relative Pfade gelten wie nach `schoolbox waehle`.
		const gelesen =
			vorschlag === undefined
				? await (entwurf === undefined ? leseQuelle(dir) : leseEntwurf(dir, entwurf))
				: await leseVorschlagQuelle(kontext, req.params.mappe, req.params.dok);
		// 119: Kacheln der Rezepte-Schublade. Nur für die Antwort, gespeichert wird nichts; mit `vorschlag` ignoriert.
		const quelle = vorschlag === undefined ? mitRezept(nurSeite(gelesen, seite), aufmachung) : gelesen;
		const html = darstellungsHtml(quelle, {
			loesung: loesung === '1',
			praesentation: praesentation === '1',
			profil: profil === 'sw' || profil === 'farbe' ? profil : undefined,
		});
		if (vorschlag !== undefined) {
			res.set('Content-Security-Policy', VORSCHLAG_CSP);
		}
		res.set('Cache-Control', 'no-store').type('html').send(html);
	});

	router.get('/:mappe/*teile', async (req, res) => {
		const { mappe } = req.params;
		const mappeDir = mappenDir(materialDir, mappe);
		if (!existsSync(path.join(mappeDir, 'mappe.json'))) {
			throw nichtGefunden();
		}
		const teile = pruefeTeile(req.params.teile);
		const [ordner, dok, ...rest] = teile;
		if (ordner === 'dokumente' && dok !== undefined && dokumentGeloescht(kontext.ordner.baum(), mappe, dok)) {
			throw nichtGefunden();
		}
		let datei: string | null;
		if (ordner === 'dokumente' && dok !== undefined && ID_REGEX.test(dok) && rest.length > 0) {
			datei = sucheRessource(rest.join('/'), path.join(mappeDir, 'dokumente', dok));
		} else {
			const kandidat = path.join(mappeDir, ...teile);
			datei = existsSync(kandidat) ? realpathSync(kandidat) : null;
		}
		await sendeDatei(req, res, await pruefeGrenzen(datei, mappeDir), mappe, mappeDir);
	});

	router.use(() => {
		throw nichtGefunden();
	});
	return router;
};

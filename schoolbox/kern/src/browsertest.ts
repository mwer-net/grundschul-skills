/**
 * Stufen der Tests: `pnpm test` läuft ohne Browser, `pnpm run test:alles` mit (vor dem Merge). Alles, was Chromium über
 * blatt.py braucht, fragt hier nach, und viele Prüfungen laufen gesammelt in einem Browser.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { BLATT_PY, WURZEL } from './konfig';

export const BROWSER_HINWEIS = 'Braucht Chromium: nur mit pnpm run test:alles';

const CHROMIUM_DA = 'import sys; sys.path.insert(0, sys.argv[1]); import blatt; blatt.finde_chromium()';

const istChromiumDa = () => {
	try {
		execFileSync('python3', ['-B', '-c', CHROMIUM_DA, path.dirname(BLATT_PY)], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
};

let fehlt: boolean | undefined;

export const browserFehlt = () => {
	fehlt ??= process.env.SCHOOLBOX_TESTS !== 'alles' || !istChromiumDa();
	return fehlt;
};

export const browserSkip = () => (browserFehlt() ? BROWSER_HINWEIS : false);

export interface StapelAuftrag {
	/** HTML-Datei; eingebettet wird wie beim Bauen. */
	quelle: string;
	/** Id des Elements, dessen Text das Ergebnis ist. */
	element?: string;
	/** Die Prüfung mitlaufen lassen. */
	pruefen?: boolean;
}

/** Ein Chromium für alle Seiten. Eine leere Antwort heißt: Die Seite hat das Element nicht rechtzeitig angelegt. */
export const imStapel = (auftraege: StapelAuftrag[]): string[] => {
	const ordner = mkdtempSync(path.join(tmpdir(), 'schoolbox-stapel-'));
	try {
		const aus = auftraege.map((_, i) => path.join(ordner, `${i}.txt`));
		const auftrag = path.join(ordner, 'auftrag.json');
		const zeilen = auftraege.map((a, i) => ({
			aus: aus[i],
			element: a.element ?? 'pruefbericht',
			pruefen: a.pruefen ?? true,
			quelle: a.quelle,
		}));
		writeFileSync(auftrag, JSON.stringify(zeilen));
		execFileSync(
			'python3',
			['-B', path.join(WURZEL, 'schoolbox', 'kern', 'src', 'pruefstapel.py'), path.dirname(BLATT_PY), auftrag],
			{
				stdio: ['ignore', 'ignore', 'inherit'],
			},
		);
		return aus.map((d) => readFileSync(d, 'utf8'));
	} finally {
		rmSync(ordner, { force: true, recursive: true });
	}
};

export interface Pruefmeldung {
	stufe: string;
	text: string;
	code?: string;
}

const NICHT_DURCHGELAUFEN = JSON.stringify({
	meldungen: [{ stufe: 'FEHLER', text: 'Prüfung lief nicht durch (Skriptfehler?)' }],
});

/** Dasselbe Ergebnis wie `blatt.py bauen --nur-pruefen`; ein Test in `browsertest.test.ts` hält beides gleich. */
export const pruefeStapel = (quellen: string[]) =>
	imStapel(quellen.map((quelle) => ({ quelle }))).map(
		(t) => (JSON.parse(t || NICHT_DURCHGELAUFEN) as { meldungen: Pruefmeldung[] }).meldungen,
	);

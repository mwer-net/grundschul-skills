/** Liest die Starter aus `assets/muster/*.html` (043): Die Muster sind die eine Quelle, geprüft von `muster.test.ts`. */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ASSETS } from './konfig';

const ohneKennungen = (html: string) => html.replace(/\s+data-katalog="[^"]*"/g, '');

/** Das ganze Element ab `start`, auch wenn gleichnamige Elemente darin stecken. */
const elementAb = (html: string, start: number, tag: string) => {
	if (['img', 'br', 'hr', 'input'].includes(tag)) {
		return html.slice(start, html.indexOf('>', start) + 1);
	}
	const muster = new RegExp(`<(/?)${tag}(?=[\\s>])[^>]*>`, 'g');
	muster.lastIndex = start;
	let tiefe = 0;
	for (let t = muster.exec(html); t; t = muster.exec(html)) {
		tiefe += t[1] === '/' ? -1 : 1;
		if (tiefe === 0) {
			return html.slice(start, t.index + t[0].length);
		}
	}
	throw new Error(`Element <${tag}> ist nicht geschlossen.`);
};

/** Kennung → HTML des Starters, aus allen Mustern. Eine doppelte Kennung ist ein Fehler. */
export const leseStarter = (ordner = path.join(ASSETS, 'muster')) => {
	const starter = new Map<string, string>();
	for (const datei of readdirSync(ordner).filter((d) => d.endsWith('.html'))) {
		const html = readFileSync(path.join(ordner, datei), 'utf8');
		for (const treffer of html.matchAll(/<([a-z][a-z0-9-]*)(?=\s)[^>]*\sdata-katalog="([^"]+)"[^>]*>/g)) {
			const [, tag = '', id = ''] = treffer;
			if (starter.has(id)) {
				throw new Error(`Starter „${id}“ steht doppelt, zuletzt in ${datei}.`);
			}
			starter.set(id, ohneKennungen(elementAb(html, treffer.index, tag)));
		}
	}
	return starter;
};

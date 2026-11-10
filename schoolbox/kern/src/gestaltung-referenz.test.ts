/**
 * Die Referenz für Claude bleibt ehrlich (112, Z11): Jedes Beispiel in `references/gestaltung.md` geht durch die
 * Allow-Liste, jede gebaute Art hat ein Beispiel, und die Verweise aus Skill und Prompt zeigen auf die Datei. Spätere
 * Tickets, die Beispiele ergänzen, laufen hier mit durch.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { BLATT_FARBEN, blattFarbenListe, WEISS } from './blatt-farben';
import { pruefeFreiesHtml } from './frei';
import type { Etappe } from './gestaltung-arten';
import { GESTALTUNG_ARTEN } from './gestaltung-arten';
import { ASSETS, SKILL_DIR, WURZEL } from './konfig';
import { abgleichen } from './quellen';
import { zerlege } from './quelltext';
import { passt } from './referenz';

const REFERENZ = readFileSync(path.join(SKILL_DIR, 'references', 'gestaltung.md'), 'utf8');
const BLOECKE = [...REFERENZ.matchAll(/```html\n([\s\S]*?)```/g)].map((t) => t[1] ?? '');
const BEISPIEL = 'beispiel-deckblatt-formen.html';

/** Bis zur Welle 4 gebaut: E1 bis E3. Spätere Etappen kommen dazu, wenn ihr Ticket die Liste hier ändert. */
const GEBAUT: readonly Etappe[] = ['E1', 'E2', 'E3'];

/** `gestaltung` ist die Auffang-Art für alles mit `data-lage` ohne eigene Art und hat darum kein eigenes Beispiel. */
const AUFFANG = 'gestaltung';

/** Die Art eines Elements wie im Editor: die erste passende Zeile. */
const artVon = (k: ReturnType<typeof zerlege>['knoten'][number]) =>
	GESTALTUNG_ARTEN.find((a) => passt(k, a.selektor, false))?.art ?? null;

describe('references/gestaltung.md (112)', () => {
	it('hat Beispiele', () => {
		assert.ok(BLOECKE.length >= 10, `nur ${BLOECKE.length} html-Blöcke`);
	});

	for (const [i, block] of BLOECKE.entries()) {
		it(`Beispiel ${i + 1} geht ohne Fund durch die Allow-Liste: ${block.split('\n')[0]?.slice(0, 60)}`, () => {
			assert.deepEqual(pruefeFreiesHtml(block), []);
		});
	}

	it('jede gebaute Art hat ein Beispiel', () => {
		const gezeigt = new Set(BLOECKE.flatMap((b) => zerlege(b).knoten.map(artVon)));
		const fehlt = GESTALTUNG_ARTEN.filter((a) => GEBAUT.includes(a.ab) && a.art !== AUFFANG && !gezeigt.has(a.art));
		assert.deepEqual(
			fehlt.map((a) => a.art),
			[],
		);
	});

	it('Gegenprobe: ein Beispiel mit foreignObject in der Ebene fiele auf', () => {
		const boese =
			'<div class="ebene vorne"><svg class="form" data-lage="frei" data-form="stern" style="--x:10px;--y:10px;--b:120px;--h:120px"><foreignObject><div>Hallo</div></foreignObject></svg></div>';
		assert.ok(pruefeFreiesHtml(boese).length > 0);
	});

	it('die erzeugten Listen sind aktuell (wie `pnpm run quellen:pruefen`)', () => {
		assert.deepEqual(
			abgleichen(WURZEL, false).filter((s) => s.includes('gestaltung.md')),
			[],
		);
	});

	it('die Farben kommen aus der Liste des Farbwählers, auch Weiß', () => {
		for (const wert of [...BLATT_FARBEN.map((f) => f.wert), WEISS]) {
			assert.ok(REFERENZ.includes(`\`${wert}\``), wert);
		}
		assert.ok(REFERENZ.includes(blattFarbenListe()));
	});
});

describe('Verweise auf die Referenz (112)', () => {
	it('SKILL.md nennt beide gestaltung.md getrennt und das Beispiel-Deckblatt', () => {
		const skill = readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
		assert.match(skill, /\| `references\/gestaltung\.md` \|/);
		assert.match(skill, /grundschul-didaktik\/references\/gestaltung\.md/);
		assert.match(skill, new RegExp(`\\| \`assets/${BEISPIEL}\` \\|`));
	});

	it('auftrag.md geht bei jedem Auftrag mit und nennt die Referenz und die Regel für Gestaltung', () => {
		const auftrag = readFileSync(path.join(WURZEL, 'schoolbox', 'vorlagen', 'ki', 'auftrag.md'), 'utf8');
		assert.match(auftrag, /references\/gestaltung\.md/);
		assert.match(auftrag, /data-lage/);
		assert.match(auftrag, /Anker/);
	});

	it('der Inhalt des Beispiel-Deckblatts geht ohne Fund durch die Allow-Liste und nutzt nur Bilder aus assets/bilder', () => {
		const html = readFileSync(path.join(ASSETS, BEISPIEL), 'utf8');
		// Kopf und Skripte des Blatts sind Bestand jeder Vorlage; Claude schreibt in den `<body>`.
		const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';
		assert.ok(body.includes('class="seite"'));
		assert.deepEqual(pruefeFreiesHtml(body), []);
		for (const [, src] of body.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)) {
			assert.match(src ?? '', /^bilder\/[a-z-]+\.png$/);
		}
		assert.match(html, /data-lage="frei"/);
	});
});

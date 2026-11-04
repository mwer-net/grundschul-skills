import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { browserSkip } from './browsertest';
import { ASSETS } from './konfig';

const BLATT = path.join(ASSETS, '..', 'scripts', 'blatt.py');

const baue = (thema: string, koerper: string) => {
	const dir = mkdtempSync(path.join(tmpdir(), 'thema-'));
	cpSync(path.join(ASSETS, 'blatt.css'), path.join(dir, 'blatt.css'));
	cpSync(path.join(ASSETS, 'abbildungen.js'), path.join(dir, 'abbildungen.js'));
	writeFileSync(path.join(dir, 'thema.css'), thema);
	const html = path.join(dir, 'blatt.html');
	writeFileSync(
		html,
		`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>T</title><link rel="stylesheet" href="blatt.css"><link rel="stylesheet" href="thema.css"><script src="abbildungen.js"></script></head><body class="kl3 farbe palette-himmel"><section class="seite">${koerper}</section></body></html>`,
	);
	return execFileSync('python3', ['-B', BLATT, 'bauen', '--nur-pruefen', html], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
	});
};
const KIT =
	'<div class="thema-band" data-flaeche-ok></div><div class="aufgabe"><span class="nr">1</span><div class="anw"><span class="text">Lies.</span></div></div>';

describe('Thema und Kit-Anteil (055)', { skip: browserSkip() }, () => {
	it('Das Beispiel-Thema ist ohne Hinweis', () => {
		const aus = baue(readFileSync(path.join(ASSETS, 'thema-beispiel.css'), 'utf8'), KIT);
		assert.doesNotMatch(aus, /thema\.css|Kit-Anteil/);
	});
	it('Gegenprobe: Layout, fremde Klasse und fremde Variable werden gemeldet', () => {
		const aus = baue('.aufgabe{display:none}\n.meins{color:red}\nbody{--eigen:1px}', KIT);
		assert.match(aus, /„\.aufgabe“ setzt display/);
		assert.match(aus, /Klasse ohne Registereintrag: meins/);
		assert.match(aus, /„body“ setzt --eigen/);
	});
	it('Gegenprobe: Eigene Klassen senken den Kit-Anteil', () => {
		const aus = baue('', '<div class="meins"><p class="auch-meins">Text</p></div>');
		assert.match(aus, /Kit-Anteil 0 %/);
	});
});

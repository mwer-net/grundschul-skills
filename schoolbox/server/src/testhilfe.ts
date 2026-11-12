import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { Druckprofil, FolienZusatz, Format, Meldung } from '@schoolbox/kern';
import {
	ASSETS,
	ausgabeOrdner,
	ausgabeSchluessel,
	dokumentDir,
	erzeugePasswortHash,
	figurenDir,
	formatAusHtml,
	HTML_DATEI,
	ladeKonfig,
	LOESUNG_PDF_DATEI,
	neueMappe,
	neuesDokument,
	PDF_DATEI,
	schreibeStand,
	uebernehmeAusgabe,
	zusatzBerichtDatei,
	zusatzPdfDatei,
	zusatzStandDatei,
} from '@schoolbox/kern';
import { A4, FOLIE, testPdf } from '@schoolbox/kern/src/testpdf';

import { erstelleApp } from './app';
import type { KiPruefer } from './ki';
import type { ServerKonfig } from './konfig';
import { pruefeServerKonfig } from './konfig';
import type { Kontext } from './kontext';
import { erstelleKontext } from './kontext';
import type { FolienBauer, PdfBauer } from './pdf';
import { CSRF_HEADER } from './schutz';
import type { Sitzung } from './sitzung';
import { signiereSitzung, SITZUNG_COOKIE } from './sitzung';
import type { Ueberwachung } from './ueberwachung';
import { starteUeberwachung } from './ueberwachung';
import type { VorschauBauer } from './vorschau';

type Init = NonNullable<Parameters<typeof fetch>[1]>;

/** Spielt `claude` nach (Issue 057): Kein Test verbraucht Limit. Das Verhalten steht in `fall.txt` daneben. */
export const KI_ATTRAPPE = String.raw`#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path');
const fall = fs.readFileSync(path.join(__dirname, 'fall.txt'), 'utf8').trim();
const args = process.argv.slice(2);
fs.appendFileSync(path.join(__dirname, 'aufrufe.jsonl'), JSON.stringify({ args, cwd: process.cwd(), env: Object.keys(process.env) }) + '\n');
if (args[0] === 'auth') {
	if (fall === 'abgemeldet') { console.log('{"loggedIn":false}'); process.exit(1); }
	console.log('{"loggedIn":true}'); process.exit(0);
}
fs.writeFileSync(path.join(__dirname, 'pid'), String(process.pid));
const sag = (o) => console.log(JSON.stringify(o));
const projekt = path.join(process.env.HOME, '.claude', 'projects', process.cwd().replace(/[^a-zA-Z0-9]/g, '-'));
// Wie das echte claude: Eine Sitzung findet es nur in der Ablage des Arbeitsordners, sonst endet es ohne Ergebnis.
if (args.includes('--resume') && (fall === 'resume-fehlt' || !fs.existsSync(path.join(projekt, 'sitzung.jsonl')))) {
	console.error('No conversation found with session ID');
	process.exit(1);
}
fs.mkdirSync(projekt, { recursive: true });
fs.writeFileSync(path.join(projekt, 'sitzung.jsonl'), 'materialtext');
let eingabe = '';
process.stdin.on('data', (d) => { eingabe += d; });
process.stdin.on('end', () => {
	fs.appendFileSync(path.join(__dirname, 'prompts.txt'), eingabe + '\n---\n');
	sag({ type: 'system', subtype: 'init', session_id: 's1' });
	const amLimit = { status: 'rejected', resetsAt: 1900000000, rateLimitType: 'seven_day', overageResetsAt: 1950000000, unifiedWindows: { five_hour: { utilization: 0.83, status: 'allowed' }, seven_day: { utilization: 1, status: 'rejected' } } };
	const limitJe = {
		'limit-guthaben': { ...amLimit, overageStatus: 'allowed', isUsingOverage: true },
		'limit-budget': { ...amLimit, overageStatus: 'allowed', isUsingOverage: true },
		'limit-gesperrt': { ...amLimit, overageStatus: 'rejected', isUsingOverage: false },
		'limit-ohne-feld': amLimit,
	};
	sag({ type: 'rate_limit_event', rate_limit_info: limitJe[fall] ?? { status: 'allowed', resetsAt: 1900000000, unifiedWindows: { five_hour: { utilization: 0.5, resetsAt: 1900000000 }, seven_day: { utilization: 0.2, resetsAt: 1900000000 } } } });
	if (fall === 'limit-gesperrt') { sag({ type: 'assistant', error: 'rate_limit', message: { content: [] } }); sag({ type: 'result', subtype: 'success', is_error: true, result: 'limit', num_turns: 1, total_cost_usd: 0 }); process.exit(1); }
	if (args.includes('--no-session-persistence')) { sag({ type: 'result', subtype: 'success', is_error: false, result: 'ok', num_turns: 1, total_cost_usd: 0.0006 }); return; }
	const nutzung = fall === 'kontext-gross' ? { usage: { input_tokens: 10, cache_read_input_tokens: 120000, cache_creation_input_tokens: 500 } } : {};
	sag({ type: 'assistant', message: { ...nutzung, content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'fach-mathematik' } }, { type: 'tool_use', name: 'Edit', input: {} }] } });
	const ende = (extra) => sag({ type: 'result', subtype: 'success', is_error: false, result: 'Annahme: Klasse 2', num_turns: 2, total_cost_usd: 0.01, usage: { output_tokens: 5 }, permission_denials: [], ...extra });
	// 139: eine Einheit mit zwei Materialien; „einheit-skript“ baut erst ein Skript ein, „einheit-haenger“ bleibt nach dem ersten stehen.
	if (fall.startsWith('einheit')) {
		const blatt = (titel, extra = '') => '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>' + titel + '</title><link rel="stylesheet" href="blatt.css"><link rel="stylesheet" href="../../thema.css"></head><body class="kl2 a4-hoch farbe"><section class="seite"><h1>' + titel + '</h1><img src="../../bilder/uhr.png" alt="Uhr">' + extra + '</section></body></html>';
		const plan = (fertig) => fs.writeFileSync('einheit.json', JSON.stringify({ titel: 'Uhrzeit', annahmen: ['Klasse 2'], dokumente: [{ slug: 'fall-1', titel: 'Fall 1', art: 'arbeitsblatt', format: 'a4-hoch', zweck: 'Einstieg', fertig: fertig >= 1 }, { slug: 'fall-2', titel: 'Fall 2', art: 'arbeitsblatt', format: 'a4-hoch', zweck: 'Üben', fertig: fertig >= 2 }] }));
		const warte = (ms) => new Promise((r) => setTimeout(r, ms));
		(async () => {
			if (eingabe.includes('Korrekturrunde')) { fs.writeFileSync('dokumente/fall-2/material.html', blatt('Fall 2')); plan(2); ende({ result: 'Behoben.' }); return; }
			plan(0);
			fs.writeFileSync('thema.css', ':root { --akzent: #c33; }');
			fs.mkdirSync('bilder', { recursive: true });
			fs.writeFileSync('bilder/uhr.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
			for (const slug of ['fall-1', 'fall-2']) { fs.mkdirSync('dokumente/' + slug, { recursive: true }); }
			fs.writeFileSync('dokumente/fall-1/material.html', blatt('Fall 1'));
			plan(1);
			await warte(2500);
			if (fall === 'einheit-haenger') { setInterval(() => {}, 1000); return; }
			fs.writeFileSync('dokumente/fall-2/material.html', blatt('Fall 2', fall === 'einheit-skript' ? '<script>window.boese = 1</script>' : ''));
			plan(2);
			ende({ result: 'Zwei Fälle gebaut.' });
		})();
		return;
	}
	// Ein Canva-Bild. Die Adresse in bilder.json lädt nie (kein Netz), deshalb legt der Fall das Bild selbst nach bilder/.
	if (fall.startsWith('canva')) {
		(async () => {
			if (fall === 'canva-pause') { fs.writeFileSync('ergebnis.json', JSON.stringify({ fehler: 'canva-pause' })); ende({ result: 'Canva macht eine Pause.' }); return; }
			if (fall === 'canva-bild') {
				const jpg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCABIAIADASIAAhEBAxEB/8QAGgABAAMBAQEAAAAAAAAAAAAAAAEDBAUCBv/EACgQAAICAQMEAQMFAAAAAAAAAAABAgMRFDGhBBIhUkEFE2EiI1GRsf/EABkBAQADAQEAAAAAAAAAAAAAAAACAwQFAf/EACERAAMAAQMFAQEAAAAAAAAAAAABAhEDEiEEBRMxUUEi/9oADAMBAAIRAxEAPwD7cAGkyAAAAAAAAAAAAAAAAHiTy/wQm1sc2+4xN7Uso2T0dOc5LAE8oHQmlSVL9MjTTwwACR4AAAAAAAAAAAAAAAVtYYLGkyFFI4t9tvf/AC+Doz1k7efYisIkA6+nC04Ur8MF06p0wCnVUe/DGqo9+GeeWPqI5LgU6qj34Y1VHvwx5Y+oZMPX9bP7rqpm4xj4k14bZhrsnVLurk4v8ENtttttvdsgi3k0JJLB2+h6nUU/qf7kfEvHJpOP9NtjVfLvk1Fx5ydLVUe/DJeSV7ZTaSZPVXrp6HN77RX8s4dt1l0s2zcn/ht+qXRsVark2lnK/o5546T9FkJYya+j62dU4xsm3Vs8+cHZPmzt09VV9ivvsfd2rOU98BWl7ZHUSXJpBTqqPfhjVUe/DPfLH1FeS4FOqo9+GNVR78MeWPqGTmgA5BAAAAz2wak2s4fkrNhCilskjTPUYWGi1auFyeKodscvdlgBnqnTyytvLyeLI90cfO5maaeGsGwhpPdJlulrbOGTjU28GaEHN/OPlmoAjqajtkbvcwACsiAAAAAAAAAAAAAAAAAAAAAAAAAAAf/Z', 'base64');
				fs.mkdirSync('bilder', { recursive: true });
				fs.writeFileSync('bilder/bild.jpg', jpg);
				fs.writeFileSync('bilder.json', JSON.stringify([{ datei: 'bild.jpg', url: 'https://attrappe.invalid/bild.jpg', motiv: 'Willi und Wilma im Garten', mediaId: 'MAattrappe2' }]));
				fs.writeFileSync('ergebnis.json', '{}');
				await new Promise((r) => setTimeout(r, 2500));
				ende({ result: 'Bild fertig.' });
				return;
			}
			const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAA/0lEQVR42u2ZyxHCMAxEra2GIigiFVAcFaQIiqAbODHDgVgfy7ZMtOdg7ZMyyngpJZVKpWaKvA/crpcX98z+eFIoAInpXjDkbfy+8b+77X4g5GVeYpwDsUBQq3mL8RqIFoKs5j2MH4FoIBDF/Pe5mqWAKOatEIhk3gIB7bYZLa4+tF0ZJWk9RO6+xAcidl9TF2VxIcrmsW6k/51AAiRAAiRAAjQBfG5Fvy7gI8Xd0s7xCs2agqRuFcAzQWtRzQc8uzG6+yKA2VPg6kNzyKgpaPIhaDvRG0IbbsEyzl4QlmTufNnoUVKwVDpdizuW+X+AA/Fak0MAtDBRvvCpVCqA3uJygkAbuBVtAAAAAElFTkSuQmCC', 'base64');
			fs.mkdirSync('bilder', { recursive: true });
			fs.writeFileSync('bilder/bild.png', fall === 'canva-kein-png' ? 'kein Bild' : png);
			fs.writeFileSync('bilder.json', JSON.stringify([{ datei: 'bild.png', url: 'https://attrappe.invalid/bild.png', motiv: 'Willi mit Lupe', mediaId: 'MAattrappe1' }]));
			const neu = /^Neue Figur\./m.test(eingabe);
			fs.writeFileSync('ergebnis.json', JSON.stringify({ wort: 'lupe', ...(neu ? { name: 'Igel', steckbrief: 'kleiner brauner Igel mit hellem Bauch, gelbes Halstuch' } : {}) }));
			await new Promise((r) => setTimeout(r, 2500));
			ende({ result: 'Bild fertig.' });
		})();
		return;
	}
	const aendere = () => { const d = 'material.html'; const alt = fs.readFileSync(d, 'utf8'); fs.writeFileSync(d, alt.includes('</h1>') ? alt.replace('</h1>', ' von Claude</h1>') : alt.includes('</section>') ? alt.replace('</section>', '<p>von Claude</p></section>') : alt.replace(/^\s*<[a-z-]+/, '$& data-von-claude')); };
	if (fall === 'haenger') { setInterval(() => {}, 1000); return; }
	if (fall === 'fehler') { sag({ type: 'assistant', error: 'rate_limit', message: { content: [] } }); ende({ is_error: true, result: 'limit' }); process.exit(1); }
	if (fall === 'abmeldung') { sag({ type: 'assistant', error: 'authentication_failed', message: { content: [] } }); ende({ is_error: true, result: 'Not logged in' }); process.exit(1); }
	if (fall === 'limit-budget') { ende({ subtype: 'error_max_budget_usd', is_error: true, result: '' }); process.exit(1); }
	if (fall === 'nichts') { ende({}); return; }
	if (fall === 'leer') { ende({ result: '' }); return; }
	// 131: Claude setzt am Body ein anderes Format; „format-fremd“ eines, das es nicht gibt, und bessert nicht nach.
	if (fall === 'format-quer' || fall === 'format-fremd') { if (!eingabe.includes('Die Prüfung meldet')) { const d = 'material.html'; fs.writeFileSync(d, fs.readFileSync(d, 'utf8').replace(/<body([^>]*?)class="/, '<body$1class="' + (fall === 'format-quer' ? 'a4-quer' : 'a2-hoch') + ' ')); } ende({ result: 'Format geändert.' }); return; }
	if (eingabe.includes('RUECKFRAGE')) { ende({ result: 'Für welche Klasse soll das Rätsel sein?' }); return; }
	if (eingabe.includes('FRAGE')) { ende({ result: 'Das Blatt hat vier Uhren.' }); return; }
	if (fall === 'gross') { fs.writeFileSync('material.html', 'x'.repeat(6 * 1024 * 1024)); ende({}); return; }
	if (fall === 'aussen') { aendere(); fs.writeFileSync('andere.txt', 'boese'); fs.writeFileSync(path.join(__dirname, 'aussen.txt'), 'gelaufen'); ende({}); return; }
	const FREI = '<figure data-frei data-frei-titel="Tangram Waschbär"><svg viewBox="0 0 100 100" width="300" height="300"><polygon points="0,0 100,0 50,50" fill="none" stroke="#000" stroke-width="2"/><text x="50" y="90">Waschbär</text></svg><figcaption>Lege den Waschbären.</figcaption></figure>';
	const SPERRE = { 'frei-skript': '<script>window.boese = 1</script>', 'frei-ereignis': '<svg onload="window.boese = 1"></svg>', 'frei-extern': '<img src="https://boese.example/x.png">', 'frei-use': '<svg><use href="https://boese.example/x.svg#a"/></svg>', 'frei-absage': '<script>window.boese = 1</script>', 'frei-nachgebessert': '<script>window.boese = 1</script>' };
	const baue = (html) => { const d = 'material.html'; const alt = fs.readFileSync(d, 'utf8'); fs.writeFileSync(d, /<html/i.test(alt) ? alt.replace('</section>', html + '</section>') : html); };
	// Gestaltung von Claude: Wilma frei vorne, ein Stern ohne Pfad, eine Sprechblase ohne SVG am Anker der ersten Aufgabe
	const GESTALTUNG_VORNE = '<div class="ebene vorne"><img class="figur-frei" data-lage="frei" data-figur="wilma" src="bilder/wilma.png" alt="Wilma" style="--x:560px;--y:300px;--b:150px;--spiegeln:-1"><svg class="form" data-lage="frei" data-form="stern" data-zacken="5" style="--x:620px;--y:90px;--b:110px;--h:110px"></svg></div>';
	const BLASE_AM_ANKER = '<div class="form-text" data-lage="frei" data-anker data-form="sprechblase" data-zipfel="200,60" style="--x:440px;--y:-30px;--b:180px;--h:84px"><div class="form-inhalt">Zähl genau!</div></div>';
	const amEndeDerAufgabe = (html, teil) => {
		const i = html.search(/<div class="aufgabe[" ]/);
		const re = /<\/?div\b[^>]*>/g;
		re.lastIndex = Math.max(i, 0);
		let tiefe = 0;
		for (let t = re.exec(html); i >= 0 && t; t = re.exec(html)) {
			tiefe += t[0][1] === '/' ? -1 : 1;
			if (tiefe === 0) { return html.slice(0, t.index) + teil + html.slice(t.index); }
		}
		return html;
	};
	if (fall === 'gestaltung') { const d = 'material.html'; fs.writeFileSync(d, amEndeDerAufgabe(fs.readFileSync(d, 'utf8'), BLASE_AM_ANKER).replace('</section>', GESTALTUNG_VORNE + '</section>')); ende({ result: 'Wilma, Stern und Sprechblase gesetzt.' }); return; }
	if (fall === 'gestaltung-fremd') { if (!eingabe.includes('Sicherheitsprüfung')) { baue('<div class="ebene vorne"><svg class="form" data-lage="frei" data-form="stern" style="--x:10px;--y:10px;--b:120px;--h:120px"><foreignObject><div>Hallo</div></foreignObject></svg></div>'); } ende({}); return; }
	// Claude ändert die Seitenfläche: Der Vorschlag steht so in der Datei, wie Claude ihn schreibt
	if (fall === 'flaeche-gelb') { const d = 'material.html'; fs.writeFileSync(d, fs.readFileSync(d, 'utf8').replace(/(<div class="seitenflaeche"[^>]*style="[^"]*)--f1:[^;"]*/, '$1--f1:#fff3c4')); ende({ result: 'Die Fläche ist jetzt gelb.' }); return; }
	// Gruppe und Pfad von Claude: eine Gruppe aus Wilma und Sprechblase, ein Pfad mit relativen Befehlen und einem Bogen
	const GRUPPE = '<div class="ebene vorne"><div class="gruppe" data-lage="frei" style="--x:420px;--y:620px;--b:300px;--h:220px"><img class="figur-frei" data-lage="frei" data-figur="wilma" src="bilder/wilma.png" alt="Wilma" style="--x:170px;--y:70px;--b:130px"><div class="form-text" data-lage="frei" data-form="sprechblase" data-zipfel="200,60" style="--x:0px;--y:0px;--b:180px;--h:84px"><div class="form-inhalt">Zähl genau!</div></div></div></div>';
	const PFAD = '<div class="ebene vorne"><svg class="form" data-lage="frei" data-form="pfad" viewBox="0 0 100 60" style="--x:300px;--y:640px;--b:100px;--h:60px"><path d="m10 50 a40 40 0 0 1 80 0 z" style="fill:var(--akzent);stroke:var(--dunkel);stroke-width:3px"/></svg></div>';
	if (fall === 'gruppe' || fall === 'pfad') { const d = 'material.html'; fs.writeFileSync(d, fs.readFileSync(d, 'utf8').replace('</section>', (fall === 'gruppe' ? GRUPPE : PFAD) + '</section>')); ende({ result: fall === 'gruppe' ? 'Wilma und Sprechblase als Gruppe.' : 'Eine Wolke als eigene Form.' }); return; }
	if (fall === 'frei') { baue(FREI); ende({ result: 'Annahme: sieben Steine.' }); return; }
	if (fall === 'frei-zwei') { baue(eingabe.includes('Sicherheitsprüfung') ? FREI : FREI + FREI); ende({}); return; }
	if (SPERRE[fall]) {
		if (!eingabe.includes('Sicherheitsprüfung')) { fs.writeFileSync(path.join(__dirname, 'vorher.html'), fs.readFileSync('material.html')); baue(FREI + SPERRE[fall]); ende({}); return; }
		if (fall === 'frei-nachgebessert') { fs.writeFileSync('material.html', fs.readFileSync(path.join(__dirname, 'vorher.html'))); baue(FREI); ende({ result: 'Ohne Skript gebaut.' }); return; }
		if (fall === 'frei-absage') { fs.writeFileSync('material.html', fs.readFileSync(path.join(__dirname, 'vorher.html'))); ende({ result: 'Etwas zum Anklicken geht hier nicht.' }); return; }
		ende({}); return;
	}
	aendere(); ende({});
});
`;

/**
 * Die Testfigur „Kiki“ (177): erzeugt, nie aus dem Material, denn das Repo ist öffentlich. `kiki-strich.png` hat das
 * Seitenverhältnis von `kiki.png`; `kiki-winkt.png` hat keine Strichfassung.
 */
const KIKI = {
	'kiki.png': 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABPUlEQVR4nO2ZwQ3DIAxF06qnDJEJOluG6WyZIEP02p4sIUqwP3awSP1uqQj+H1OjmGkKgiAIgsCPm/WEy7J8uDH7vpvFNZlIIvoIrRnVyyXh2zqz7z1f75/fWo00G8jFS4Tn5EZaTDQZSMW3CM9JjaAmYAMk3kJ4DhlBTNyRAGeKT+dFioLYwNniCdSEyEAv8QRigjWgqfEWcPHFW6jX6qPxqga8V5+o6XhIJuBWI63j6ElcG7+tc/HUToHKKCem9Kwdz3FooHflOYKrSOoMeKM2kGeIyxg6nkP0J+ZARVhuy9hC3oQBb65rgL6KtCelFu4r7boZSPHKgiRu1YBlB01DTYd4C/XOgjQea8A7C1x8UQZ6VySkPyTeQr1MoM0tqIyebaKlM/d/vVFi6O40MfT9QMqwNzQlet+RDc8XewmrkP08BccAAAAASUVORK5CYII=',
	'kiki-strich.png': 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAABC0lEQVR4nO2ZUQ6EMAhEdeM5ev9zcZH1q4lp2kKBgkTe3yaVmRHWaHscSZIkSZL4cWoXLKX8sTUAoKarUohieoQ0jOjinnGKIe51PdgBWhMcAxo1WAGewhrzrF0PFZPMvFdtG4GdGhbmt2lZml/V/FEK6VjigemjASrbnw5MvWkA77tfmfm4KAWwu7H6HKeuB4BTbYQoZnq/pesxhgFqYevZb6n6o6DiDngjDtB2COvY6noM0p8YY9WE5ljmCHmTAbwJH2CKx2v0qofwHSAF8OqC+IPG+z2oMvNBHiGPT0rKOjSAdxfU9EPvSmwvbKnxtp258Huj39ydHhmgmnjF+cCTsCc0PazPyMJzAwSnsfzqQnPQAAAAAElFTkSuQmCC',
	'kiki-winkt.png': 'iVBORw0KGgoAAAANSUhEUgAAADAAAAA4CAYAAAC7UXvqAAABg0lEQVR4nO2ZzY3DIBCFcbSnFOEKUluK2dpSwRSx1+Q00SwyzC8QR/OdLBmZ9xh42LiUZC3bagEc+74/W/cAYLvMFDOCn9UCpDzu1/f17ffvfX36CqSB1aSB1YSnUC+3EQAI239CDEhEt9p7zbgMHAmned2C5jg+w2rEbKAWLxFet62NWEyYDFDxGuE1tRGLCbUBFO8RXkONaE2oYnSEeAo+VxMKYqejxVNwSgHAFvI6PVM87UdSCXYNaDN+BL01IV4Ds0Zf21/XwCeMfil9HaIY5UaDbkjanbjX/nG//mt7hPtttO6A61DbnqNpYHbytOAS6fTfA24DdYW4imnbc4R8D2hFRE7LnEKrSQOr+V4D+Abo3Sm90G+Do/vfWwHKqipI+u0aiDxB8xDyQTO7CtL+WAOrq8D1L6rA7ETikocinkKzTGjEl6KM0dEmtOJLMf4njjobReiAaNeceYF6TqeRupKWwHAlTMT/AcSadiER6Tk/8sZ0eMbP/keWJEmSJKfmBc6bxFmoKpxwAAAAAElFTkSuQmCC',
};

/** Eine Figurenbibliothek mit Kiki und zwei Posen; mit `figuren.json` läuft keine Übernahme. */
export const legeTestfigurenAn = async (materialDir: string) => {
	const dir = figurenDir(materialDir);
	await mkdir(dir, { recursive: true });
	for (const [name, daten] of Object.entries(KIKI)) {
		await writeFile(path.join(dir, name), Buffer.from(daten, 'base64'));
	}
	const kiki = { id: 'kiki', name: 'Kiki', posen: [{ datei: 'kiki.png' }, { datei: 'kiki-winkt.png' }] };
	await writeFile(path.join(dir, 'figuren.json'), `${JSON.stringify({ version: 1, figuren: [kiki] }, null, '\t')}\n`);
};

export const BEISPIEL = path.join(ASSETS, 'beispiel-zehner-einer-kl2.html');
export const TEST_PASSWORT = 'drei-kleine-woerter';
export const TEST_GEHEIMNIS = 'g'.repeat(64);

export interface TestServer {
	url: string;
	kontext: Kontext;
	materialDir: string;
	webDist: string;
	/** Cookie-Kopf einer gültigen Sitzung. */
	cookie: string;
	/** `fetch` mit dieser Sitzung. */
	holen: (url: string | URL, init?: Init) => Promise<Response>;
	stop: () => Promise<void>;
}

export const sitzungsCookie = (konfig: ServerKonfig, sitzung: Partial<Sitzung> = {}) =>
	`${SITZUNG_COOKIE}=${signiereSitzung(konfig, { ausgestellt: Date.now(), dauerhaft: true, ...sitzung })}`;

export interface TestServerOptionen {
	ueberwachung?: boolean;
	ruheMs?: number;
	/** `true`: leerer Ordner für eine eigene index.html. Ein Pfad: diese gebaute Oberfläche. */
	webDist?: boolean | string;
	vorschauBauer?: VorschauBauer;
	/** Ohne baut blatt.py die PDFs. */
	pdfBauer?: PdfBauer;
	/** Ohne baut blatt.py die Zusätze für Folien. */
	folienBauer?: FolienBauer;
	/** Fester Port und feste Ablage für die Browser-Tests; sonst ein freier Port und ein neuer Ordner in /tmp. */
	port?: number;
	materialDir?: string;
	/** Zusätzliche Konfiguration, z. B. `CLAUDE_BIN` für die Attrappe. */
	env?: Record<string, string>;
	kiPruefer?: KiPruefer;
}

export const starteTestServer = async (optionen: TestServerOptionen = {}) => {
	const materialDir = optionen.materialDir ?? (await mkdtemp(path.join(tmpdir(), 'schoolbox-server-')));
	const env = {
		MATERIAL_DIR: materialDir,
		PORT: '4999',
		PASSWORT_HASH: await erzeugePasswortHash(TEST_PASSWORT, 10),
		SITZUNG_GEHEIMNIS: TEST_GEHEIMNIS,
		...optionen.env,
	};
	const konfig = pruefeServerKonfig(ladeKonfig(env, materialDir));
	const kontext = erstelleKontext(konfig, 'test', {
		vorschau: optionen.vorschauBauer,
		pdf: optionen.pdfBauer,
		folien: optionen.folienBauer,
		kiPruefer: optionen.kiPruefer,
	});
	const ueberwachung: Ueberwachung | null = optionen.ueberwachung
		? await starteUeberwachung(kontext, optionen.ruheMs)
		: null;
	const webDist =
		typeof optionen.webDist === 'string'
			? optionen.webDist
			: await mkdtemp(path.join(tmpdir(), optionen.webDist ? 'schoolbox-web-' : 'schoolbox-kein-web-'));
	if (!optionen.webDist) {
		await rm(webDist, { recursive: true });
	}
	const server = erstelleApp(kontext, webDist).listen(optionen.port ?? 0, '127.0.0.1');
	await new Promise<void>((resolve) => server.once('listening', resolve));
	const { port } = server.address() as AddressInfo;
	const stop = async () => {
		ueberwachung?.stop();
		kontext.ki.stop();
		kontext.einheiten.stop();
		kontext.canva.stop();
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	};
	const cookie = sitzungsCookie(konfig);
	const holen = (url: string | URL, init: Init = {}) =>
		fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), cookie } });
	const ergebnis: TestServer = {
		url: `http://127.0.0.1:${port}`,
		kontext,
		materialDir,
		webDist,
		cookie,
		holen,
		stop,
	};
	return ergebnis;
};

/** Legt eine Mappe mit einem Dokument an; optional mit dem Beispielblatt aus assets/ als material.html. */
export const legeDokumentAn = async (
	materialDir: string,
	optionen: { beispiel?: boolean; format?: Format; jetzt?: Date } = {},
) => {
	const jetzt = optionen.jetzt ?? new Date();
	const { mappe } = await neueMappe(materialDir, { titel: 'Zehner und Einer', fach: 'mathematik', klasse: 2 }, jetzt);
	const angaben = { titel: 'Blatt', art: 'arbeitsblatt', druckprofil: 'sw', druckhinweise: [] } as const;
	const { id } = await neuesDokument(
		materialDir,
		mappe.id,
		{ ...angaben, format: optionen.format ?? 'a4-hoch' },
		jetzt,
	);
	const dir = dokumentDir(materialDir, mappe.id, id);
	if (optionen.beispiel) {
		await copyFile(BEISPIEL, path.join(dir, 'material.html'));
	}
	return { mappe: mappe.id, dok: id, dir };
};

export const schreibKoepfe = { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' };

/** Anfrage mit genau diesem Pfad. `fetch` würde `..` vorher auflösen, ein Angreifer tut das nicht. */
export const rohAnfrage = (url: string, pfad: string, cookie?: string) =>
	new Promise<{ status: number; text: string }>((resolve, reject) => {
		const { hostname, port } = new URL(url);
		const headers = cookie ? { cookie } : {};
		const anfrage = http.get({ hostname, port, path: pfad, headers }, (antwort) => {
			let text = '';
			antwort.on('data', (teil: Buffer) => {
				text += teil.toString();
			});
			antwort.on('end', () => resolve({ status: antwort.statusCode ?? 0, text }));
		});
		anfrage.on('error', reject);
	});

/** Liest Server-Sent Events, bis `bedingung` erfüllt ist oder die Zeit abläuft. */
export const sammleEreignisse = (url: string, cookie: string) => {
	const ereignisse: { typ: string; daten: unknown; zeit: number }[] = [];
	const steuerung = new AbortController();
	const bereit = fetch(`${url}/api/ereignisse`, { signal: steuerung.signal, headers: { cookie } }).then((antwort) => {
		const leser = antwort.body?.getReader();
		const dekoder = new TextDecoder();
		let puffer = '';
		void (async () => {
			try {
				for (;;) {
					const teil = await leser?.read();
					if (!teil || teil.done) {
						return;
					}
					puffer += dekoder.decode(teil.value as Uint8Array, { stream: true });
					const bloecke = puffer.split('\n\n');
					puffer = bloecke.pop() ?? '';
					for (const block of bloecke) {
						const typ = /^event: (.+)$/m.exec(block)?.[1];
						const daten = /^data: (.+)$/m.exec(block)?.[1];
						if (typ && daten) {
							ereignisse.push({ typ, daten: JSON.parse(daten) as unknown, zeit: Date.now() });
						}
					}
				}
			} catch {
				// Abbruch durch stop()
			}
		})();
	});
	return { bereit, ereignisse, stop: () => steuerung.abort() };
};

export interface Ablage {
	rev: number;
	ordner: { id: string; name: string; eltern: string | null; behaelter: string | null }[];
	dokumente: { mappe: string; id: string; ordner: string | null; vorschau: string | null; meta: { titel: string } }[];
	defekt: { id: string; fehler: string }[];
	geteilt: { ordner: string[]; dokumente: string[] };
	hinweis?: string;
}

export const leseAblage = async (s: Pick<TestServer, 'holen' | 'url'>) =>
	(await (await s.holen(`${s.url}/api/ordner`)).json()) as Ablage;

export const fuehreAus = (s: Pick<TestServer, 'holen' | 'url'>, aktion: unknown) =>
	s.holen(`${s.url}/api/ordner/aktion`, { method: 'POST', headers: schreibKoepfe, body: JSON.stringify(aktion) });

export const ordnerVon = async (s: Pick<TestServer, 'holen' | 'url'>, mappe: string) => {
	const ordner = (await leseAblage(s)).ordner.find((o) => o.behaelter === mappe);
	assert.ok(ordner, `kein Ordner zu ${mappe}`);
	return ordner.id;
};

export const warte = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const UEBERLAUF = '„Aufgabe 4“ ragt aus der Seite (31 px) → kürzen, Item streichen oder zweite Seite';

/**
 * Ersatz für blatt.py, ohne Chromium und in Millisekunden: je eine leere Seite im Format des Dokuments, eine Lösung,
 * wenn die Quelle `data-l` enthält, und ein Prüffehler, wenn sie `data-test-ueberlauf` enthält.
 */
export const baueErsatzAusgabe = async (dokDir: string, profil?: Druckprofil) => {
	const schluessel = await ausgabeSchluessel(dokDir, profil);
	const html = await readFile(path.join(dokDir, 'material.html'), 'utf8');
	const seite = ['folie', 'a4-quer'].includes(formatAusHtml(html)) ? FOLIE : A4;
	const meldungen: Meldung[] = html.includes('data-test-ueberlauf')
		? [{ stufe: 'FEHLER', seite: 1, text: UEBERLAUF }]
		: [];
	const tmp = await mkdtemp(path.join(tmpdir(), 'schoolbox-ersatz-'));
	try {
		await writeFile(path.join(tmp, PDF_DATEI), testPdf([seite]));
		if (html.includes('data-l=')) {
			await writeFile(path.join(tmp, LOESUNG_PDF_DATEI), testPdf([seite]));
		}
		const bericht = { seiten: [], meldungen, fehler: meldungen.length };
		await writeFile(path.join(tmp, 'pruefbericht.json'), JSON.stringify(bericht));
		await writeFile(path.join(tmp, HTML_DATEI), html);
		await uebernehmeAusgabe(tmp, dokDir, schluessel, await ausgabeOrdner(dokDir, profil));
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

export const NOTIZ_ZU_LANG = 'Folien mit Notizen: „Folie 1 mit Notiz“ ragt aus der Seite (62 px) → Notiz kürzen';

/**
 * Ersatz für `blatt.py --nur-zusatz`: zwei Folienseiten mit Schritten bzw. ein A4-Blatt mit Notizen, ein Prüffehler
 * der Notizen, wenn die Quelle `data-test-notiz-lang` enthält. Erwartet wie das Original einen fertigen Bau.
 */
export const baueErsatzFolien = async (dokDir: string, art: FolienZusatz) => {
	const schluessel = await ausgabeSchluessel(dokDir);
	const html = await readFile(path.join(dokDir, 'material.html'), 'utf8');
	const ausgabe = path.join(dokDir, 'ausgabe');
	const meldungen: Meldung[] =
		art === 'notizen' && html.includes('data-test-notiz-lang')
			? [{ stufe: 'FEHLER', seite: 1, text: NOTIZ_ZU_LANG }]
			: [];
	await writeFile(path.join(ausgabe, zusatzPdfDatei(art)), testPdf(art === 'notizen' ? [A4] : [FOLIE, FOLIE]));
	const bericht = { seiten: [], meldungen, fehler: meldungen.length };
	await writeFile(path.join(ausgabe, zusatzBerichtDatei(art)), JSON.stringify(bericht));
	await schreibeStand(ausgabe, schluessel, zusatzStandDatei(art));
};

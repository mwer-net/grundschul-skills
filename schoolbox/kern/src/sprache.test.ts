import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	buchstabenMischen,
	istUnsicher,
	lueckenText,
	markiereBuchstaben,
	reinerText,
	setzeZeilennummern,
	silbentext,
	silbenVon,
	wendeSprachwerkzeugAn,
	woerterMischen,
} from './sprache';

/** Wörter aus Klasse 1–4, von Hand nach Sprechsilben getrennt. */
const LISTE =
	'A|bend Ro|si|ne Was|ser Zu|cker Ta|fel Hund Kat|ze Mut|ter Va|ter Schu|le Kin|der Blu|me Son|ne Mond O|ma O|pa Au|to E|sel I|gel U|hu Ei|mer Au|ge Hau|se Bäu|me Fens|ter Kas|ten Küs|te Wes|pe Mus|ter Mei|se Rei|se Bie|ne Lie|be Tie|re spie|len le|sen schrei|ben rech|nen ma|len sin|gen la|chen ko|chen ba|cken si|cher Bä|cker Wol|ke Ma|the|ma|tik Sach|un|ter|richt Pau|se Heft Stift Li|ne|al Ra|dier|gum|mi Bü|cher Ge|schich|te Früh|ling Som|mer Herbst Win|ter Schmet|ter|ling Ka|nin|chen Mäd|chen Eich|hörn|chen Feu|er|wehr Haus|tür Stra|ße Flie|ge Tor|te Thea|ter Kla|vier Mu|sik Na|tur Pa|pier Te|le|fon Com|pu|ter Fa|mi|lie Tü|te Zei|tung Rit|ter Dra|chen Prin|zes|sin Ge|burts|tag Weih|nach|ten Os|tern ge|hen se|hen ru|fen Bau|er Feu|er Ti|ger Lö|we E|le|fant Gi|raf|fe Pin|gu|in Kro|ko|dil Pfer|de Ap|fel Bir|ne Ba|na|ne Erd|bee|re To|ma|te Kar|tof|fel Trep|pe Müt|ze glück|lich fröh|lich trau|rig hung|rig lus|tig schnell Un|ter|richt'.split(
		' ',
	);
/** Bekannte Abweichungen: Die Muster trennen so, der Hinweis im Panel nennt sie, in `x-silben` korrigierbar. */
const ABWEICHEND = ['neu|e', 'blau|e'];

const seite = (innen: string) => `<!doctype html><html><body><section class="seite">${innen}</section></body></html>`;
const nrVon = (q: string, tag: string) =>
	[...q.matchAll(/<(\/?)([a-z][\w-]*)/g)].filter((m) => !m[1]).findIndex((m) => m[2] === tag);

describe('Silben (052)', () => {
	for (const wort of LISTE) {
		it(wort, () => assert.equal(silbenVon(wort.replaceAll('|', '')), wort));
	}
	it('Bekannte Abweichungen sind wirklich anders, und die mit Vokalfolge gelten als unsicher', () => {
		for (const w of ABWEICHEND) {
			assert.notEqual(silbenVon(w.replaceAll('|', '')), w);
		}
		assert.equal(istUnsicher(silbenVon('neue')), true);
		assert.equal(istUnsicher(silbenVon('blaue')), true);
		assert.equal(istUnsicher('Thea|ter'), true, 'Gegenprobe: ea ist kein einzelner Laut');
		assert.equal(istUnsicher('Au|to'), false, 'Gegenprobe: au ist ein Laut');
	});
	it('Satzzeichen und Bindestriche bleiben', () => {
		assert.equal(silbentext('Die Rosine, süß!').inhalt, 'Die Ro|si|ne, süß!');
		assert.equal(silbentext('Oma-Tasche').inhalt, 'O|ma-Ta|sche');
	});
});

describe('Lücken aus Text (052)', () => {
	const t = 'Der Hund bellt laut. Die Katze miaut leise.';
	it('jedes n-te Wort', () => {
		assert.equal(lueckenText(t, 'nte', 3), 'Der Hund [bellt] laut. Die [Katze] miaut leise.');
		assert.throws(() => lueckenText(t, 'nte', 1));
	});
	it('Nomen nur, wenn sicher: groß und nicht am Satzanfang', () => {
		assert.equal(lueckenText(t, 'nomen'), 'Der [Hund] bellt laut. Die [Katze] miaut leise.');
	});
	it('Vokale, Konsonanten, ie/ei und Anfangsbuchstaben', () => {
		assert.equal(lueckenText('Hund', 'vokale'), 'H[u]nd');
		assert.equal(lueckenText('Hund', 'konsonanten'), '[H]u[n][d]');
		assert.equal(lueckenText('Biene am Deich', 'ie-ei'), 'B[ie]ne am D[ei]ch');
		assert.equal(lueckenText('Hund', 'anfang'), '[H]und');
	});
	it('Nur im markierten Bereich', () => {
		assert.equal(lueckenText('Hund und Maus', 'anfang', 5, { von: 9, bis: 13 }), 'Hund und [M]aus');
	});
});
describe('Mischen und Markieren (052)', () => {
	it('Wörter: ein Sortieren je Satz, doppelte Wörter bleiben eindeutig', () => {
		assert.equal(
			woerterMischen('Der Hund bellt. Oma ruft.'),
			'<x-sortieren art="woerter" eintraege="Der; Hund; bellt."></x-sortieren>\n<x-sortieren art="woerter" eintraege="Oma; ruft."></x-sortieren>',
		);
		const doppelt = /eintraege="([^"]*)"/.exec(woerterMischen('Die Maus und die Maus.'))?.[1]?.split('; ') ?? [];
		assert.equal(new Set(doppelt).size, doppelt.length);
		assert.throws(() =>
			woerterMischen('Ein Satz mit wirklich sehr sehr vielen einzelnen kleinen Wörtern ganz am Ende hier.'),
		);
	});
	it('Buchstaben: gemischt, nie schon das Wort, Lösung als Lücke', () => {
		const m = buchstabenMischen('Hund Oma');
		assert.match(m, /→ \[Hund\] · .* → \[Oma\]/);
		assert.notEqual(m.split(' →')[0]?.replaceAll(' ', ''), 'Hund');
	});
	it('Markieren lässt Tags und Entitäten stehen und zählt im Bereich', () => {
		assert.equal(markiereBuchstaben('Hu<b>nd</b> am', 'vokale'), 'H<mark>u</mark><b>nd</b> <mark>a</mark>m');
		assert.equal(markiereBuchstaben('Biene &amp; Tier', 'ie'), 'B<mark>ie</mark>ne &amp; T<mark>ie</mark>r');
		assert.equal(markiereBuchstaben('Biene Tier', 'ie', { von: 6, bis: 10 }), 'Biene T<mark>ie</mark>r');
		assert.throws(() => markiereBuchstaben('Hund', 'x'));
		assert.equal(reinerText('  A <b>b</b>\n c '), 'A b c');
	});
});

describe('Werkzeuge an der Quelle (052)', () => {
	it('Silben: Der Absatz bleibt, darin ganz oder als Stück', () => {
		const q = seite('<p class="text">Die Rosine</p>');
		const nr = nrVon(q, 'p');
		assert.ok(
			wendeSprachwerkzeugAn(q, nr, { art: 'silben', darstellung: 'boegen' }).quelle.includes(
				'<p class="text"><x-silben>Die Ro|si|ne</x-silben></p>',
			),
		);
		const teil = wendeSprachwerkzeugAn(q, nr, { art: 'silben', darstellung: 'farbe' }, { von: 4, bis: 10 }).quelle;
		assert.ok(teil.includes('<p class="text">Die <x-silben im-text darstellung="farbe">Ro|si|ne</x-silben></p>'));
	});
	it('Lücken ersetzen den Absatz; Mischen lässt nicht Markiertes als Absatz stehen', () => {
		const q = seite('<p class="text">Der Hund bellt. Die Katze miaut.</p>');
		const nr = nrVon(q, 'p');
		assert.ok(
			wendeSprachwerkzeugAn(q, nr, { art: 'luecken', regel: 'nomen' }).quelle.includes(
				'<x-lueckentext>Der [Hund] bellt. Die [Katze] miaut.</x-lueckentext>',
			),
		);
		const m = wendeSprachwerkzeugAn(q, nr, { art: 'woerter-mischen' }, { von: 16, bis: 32 }).quelle;
		assert.ok(
			m.includes(
				'<p class="text">Der Hund bellt.</p>\n<x-sortieren art="woerter" eintraege="Die; Katze; miaut."></x-sortieren>',
			),
		);
	});
	it('Überschriften lehnen Blöcke ab, Abbildungen im Text ebenso', () => {
		const h = seite('<h2>Der Hund</h2>');
		assert.throws(() => wendeSprachwerkzeugAn(h, nrVon(h, 'h2'), { art: 'woerter-mischen' }));
		const a = seite('<p>Die <x-silben im-text>Ro|si|ne</x-silben></p>');
		assert.throws(() => wendeSprachwerkzeugAn(a, nrVon(a, 'p'), { art: 'silben', darstellung: 'boegen' }));
		assert.ok(
			wendeSprachwerkzeugAn(h, nrVon(h, 'h2'), { art: 'markieren', buchstaben: 'vokale' }).quelle.includes(
				'<mark>e</mark>',
			),
		);
	});
	it('Zeilennummern gelten für alle Absätze des Lesetexts, auch auf der nächsten Seite, Aufgaben nicht', () => {
		const q =
			'<!doctype html><html><body><section class="seite"><p class="text">A</p><div class="aufgabe"><p class="text">Frage</p></div></section><section class="seite"><p class="text">B</p></section></body></html>';
		const neu = setzeZeilennummern(q, nrVon(q, 'p'), 5).quelle;
		assert.equal(neu.match(/<p data-zeilennummern="5" class="text">/g)?.length, 2);
		assert.ok(neu.includes('<div class="aufgabe"><p class="text">Frage'));
		assert.equal(setzeZeilennummern(neu, nrVon(neu, 'p'), null).quelle, q);
	});
});

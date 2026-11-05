import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { schemaVon, setzeAbbildung, werteVon } from './abbildungen';
import { zerlege } from './quelltext';
import {
	buchstabenMischen,
	istUnsicher,
	leseSprachstand,
	lueckenText,
	markiereBuchstaben,
	reinerText,
	schalteMarkierung,
	setzeSilben,
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
	it('Überschriften lehnen Blöcke ab, andere Abbildungen im Text ebenso', () => {
		const h = seite('<h2>Der Hund</h2>');
		assert.throws(() => wendeSprachwerkzeugAn(h, nrVon(h, 'h2'), { art: 'woerter-mischen' }));
		const a = seite('<p>Die <x-lueckentext>[Rosine]</x-lueckentext></p>');
		assert.throws(() => setzeSilben(a, nrVon(a, 'p'), 'boegen'), /schon eine Abbildung/);
	});
	it('Übung aus Text mit Silben: Der sichtbare Text zählt, ohne Striche', () => {
		const q = seite('<p class="text"><x-silben>Der Hund bel|lt.</x-silben></p>');
		assert.ok(
			wendeSprachwerkzeugAn(q, nrVon(q, 'p'), { art: 'luecken', regel: 'nomen' }).quelle.includes(
				'<x-lueckentext>Der [Hund] bellt.</x-lueckentext>',
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

describe('Lesehilfen: Stand und Umschalten (083)', () => {
	const TEXT = 'Die Biene auf';
	const q = (innen: string) => seite(`<p class="text">${innen}</p>`);
	const innen = (quelle: string) => /<p class="text">([\s\S]*)<\/p>/.exec(quelle)?.[1];
	const nr = nrVon(q(TEXT), 'p');
	const stand = (quelle: string) => {
		const s = leseSprachstand(quelle, nr);
		return s && { silben: s.silben, vokale: s.vokale, buchstaben: s.buchstaben };
	};

	const VOKALE = 'D<mark>ie</mark> B<mark>ie</mark>n<mark>e</mark> <mark>au</mark>f';
	const VOKALE_SILBEN = 'D<mark>ie</mark> B<mark>ie</mark>|n<mark>e</mark> <mark>au</mark>f';
	const ANFANG: [string, string, Partial<ReturnType<typeof stand>>][] = [
		['leer', TEXT, { silben: 'aus', vokale: false, buchstaben: null }],
		['Silben', '<x-silben>Die Bie|ne auf</x-silben>', { silben: 'boegen', vokale: false }],
		['Silben, Farbe', '<x-silben darstellung="farbe">Die Bie|ne auf</x-silben>', { silben: 'farbe' }],
		['Vokale', VOKALE, { silben: 'aus', vokale: true }],
		['Vokale, Silben', `<x-silben>${VOKALE_SILBEN}</x-silben>`, { silben: 'boegen', vokale: true }],
		['Fett', 'Die <b>Biene</b> auf', { silben: 'aus', vokale: false, buchstaben: null }],
		['Teilsilben', 'Die <x-silben im-text>Bie|ne</x-silben> auf', { silben: 'teilweise', vokale: false }],
	];
	for (const [name, html, erwartet] of ANFANG) {
		it(`${name}: Der Stand steht in der Quelle`, () => {
			const s = stand(q(html));
			assert.ok(s);
			for (const [schluessel, wert] of Object.entries(erwartet ?? {})) {
				assert.equal(s[schluessel as keyof typeof s], wert, schluessel);
			}
		});
	}

	const AKTIONEN: [string, (quelle: string) => string, Record<string, string>][] = [
		[
			'Bögen',
			(a) => setzeSilben(a, nr, 'boegen').quelle,
			{
				'leer': '<x-silben>Die Bie|ne auf</x-silben>',
				'Silben': '<x-silben>Die Bie|ne auf</x-silben>',
				'Silben, Farbe': '<x-silben>Die Bie|ne auf</x-silben>',
				'Vokale': `<x-silben>${VOKALE_SILBEN}</x-silben>`,
				'Vokale, Silben': `<x-silben>${VOKALE_SILBEN}</x-silben>`,
				'Fett': '<x-silben>Die <b>Bie|ne</b> auf</x-silben>',
				'Teilsilben': '<x-silben>Die Bie|ne auf</x-silben>',
			},
		],
		[
			'Beides',
			(a) => setzeSilben(a, nr, 'beides').quelle,
			{
				'leer': '<x-silben darstellung="beides">Die Bie|ne auf</x-silben>',
				'Silben': '<x-silben darstellung="beides">Die Bie|ne auf</x-silben>',
				'Silben, Farbe': '<x-silben darstellung="beides">Die Bie|ne auf</x-silben>',
				'Vokale': `<x-silben darstellung="beides">${VOKALE_SILBEN}</x-silben>`,
				'Vokale, Silben': `<x-silben darstellung="beides">${VOKALE_SILBEN}</x-silben>`,
				'Fett': '<x-silben darstellung="beides">Die <b>Bie|ne</b> auf</x-silben>',
				'Teilsilben': '<x-silben darstellung="beides">Die Bie|ne auf</x-silben>',
			},
		],
		[
			'Aus',
			(a) => setzeSilben(a, nr, null).quelle,
			{
				'leer': TEXT,
				'Silben': TEXT,
				'Silben, Farbe': TEXT,
				'Vokale': VOKALE,
				'Vokale, Silben': VOKALE,
				'Fett': 'Die <b>Biene</b> auf',
				'Teilsilben': TEXT,
			},
		],
		[
			'Vokale umschalten',
			(a) => schalteMarkierung(a, nr, 'vokale').quelle,
			{
				'leer': VOKALE,
				'Silben': `<x-silben>${VOKALE_SILBEN}</x-silben>`,
				'Silben, Farbe': `<x-silben darstellung="farbe">${VOKALE_SILBEN}</x-silben>`,
				'Vokale': TEXT,
				'Vokale, Silben': '<x-silben>Die Bie|ne auf</x-silben>',
				'Fett': 'D<mark>ie</mark> <b>B<mark>ie</mark>n<mark>e</mark></b> <mark>au</mark>f',
				'Teilsilben':
					'D<mark>ie</mark> <x-silben im-text>B<mark>ie</mark>|n<mark>e</mark></x-silben> <mark>au</mark>f',
			},
		],
	];
	for (const [aktion, tue, erwartet] of AKTIONEN) {
		for (const [name, html] of ANFANG) {
			it(`${name} + ${aktion}`, () => {
				assert.equal(innen(tue(q(html))), erwartet[name]);
			});
		}
	}

	describe('Rundreise: an, dann aus ergibt die Quelle zeichengleich', () => {
		const START = [
			TEXT,
			'Die <b>Biene</b> auf',
			'Die\n   <b>Biene</b>  &amp; auf',
			'  Um 8 Uhr: „Bie<u>ne</u>“!\n',
		];
		for (const html of START) {
			it(`Silben: ${JSON.stringify(html)}`, () => {
				for (const d of ['boegen', 'farbe', 'beides'] as const) {
					const an = setzeSilben(q(html), nr, d).quelle;
					assert.notEqual(an, q(html));
					assert.equal(stand(an)?.silben, d);
					assert.equal(setzeSilben(an, nr, null).quelle, q(html));
				}
			});
			it(`Vokale: ${JSON.stringify(html)}`, () => {
				const an = schalteMarkierung(q(html), nr, 'vokale').quelle;
				assert.equal(stand(an)?.vokale, true);
				assert.equal(schalteMarkierung(an, nr, 'vokale').quelle, q(html));
			});
			it(`Buchstaben: ${JSON.stringify(html)}`, () => {
				const an = schalteMarkierung(q(html), nr, 'ie').quelle;
				assert.equal(stand(an)?.buchstaben, 'ie');
				assert.equal(schalteMarkierung(an, nr, 'ie').quelle, q(html));
			});
			it(`Sichtbarer Text bleibt: ${JSON.stringify(html)}`, () => {
				const an = setzeSilben(schalteMarkierung(q(html), nr, 'vokale').quelle, nr, 'boegen').quelle;
				assert.equal(reinerText(innen(an) ?? ''), reinerText(html));
			});
		}
	});

	it('Vokale und Silben: beide Reihenfolgen ergeben dieselbe Quelle, auch bei einer Grenze in einer Marke', () => {
		for (const text of [TEXT, 'Das Feuer', 'A<b>bend</b> und <mark>a</mark>uf', 'Theater Oma Eimer']) {
			const zuerstSilben = schalteMarkierung(setzeSilben(q(text), nr, 'boegen').quelle, nr, 'vokale').quelle;
			const zuerstVokale = setzeSilben(schalteMarkierung(q(text), nr, 'vokale').quelle, nr, 'boegen').quelle;
			assert.equal(zuerstSilben, zuerstVokale);
		}
		assert.ok(
			setzeSilben(schalteMarkierung(q('Feuer'), nr, 'vokale').quelle, nr, 'boegen').quelle.includes(
				'F<mark>eu|e</mark>r',
			),
		);
	});

	it('Wort über Knoten hinweg: wird zusammengesetzt, getrennt und wieder verteilt', () => {
		assert.equal(
			innen(setzeSilben(q('<b>Ro</b>sine'), nr, 'boegen').quelle),
			'<x-silben><b>Ro</b>|si|ne</x-silben>',
		);
		assert.equal(
			innen(setzeSilben(q('Ro<b>si</b>ne'), nr, 'boegen').quelle),
			'<x-silben>Ro|<b>si</b>|ne</x-silben>',
		);
	});

	it('Darstellung wechseln: nur das Attribut; Striche von Hand und `aufgabe` bleiben', () => {
		const hand = q('<x-silben aufgabe="boegen">Thea|ter</x-silben>');
		assert.equal(stand(hand)?.silben, 'boegen');
		assert.equal(
			innen(setzeSilben(hand, nr, 'farbe').quelle),
			'<x-silben darstellung="farbe" aufgabe="boegen">Thea|ter</x-silben>',
		);
		assert.equal(setzeSilben(setzeSilben(hand, nr, 'farbe').quelle, nr, 'boegen').quelle, hand);
		assert.equal(innen(setzeSilben(hand, nr, null).quelle), 'Theater');
	});

	describe('Teilmarkierung', () => {
		const text = 'Die Biene fliegt.';
		const biene = { von: 4, bis: 9 };
		const fliegt = { von: 10, bis: 16 };
		it('Mehrere Stellen, je eine entfernbar', () => {
			const eine = setzeSilben(q(text), nr, 'boegen', biene).quelle;
			assert.equal(innen(eine), 'Die <x-silben im-text>Bie|ne</x-silben> fliegt.');
			const zwei = setzeSilben(eine, nr, 'farbe', fliegt).quelle;
			assert.equal(
				innen(zwei),
				'Die <x-silben im-text>Bie|ne</x-silben> <x-silben im-text darstellung="farbe">fliegt</x-silben>.',
			);
			assert.equal(stand(zwei)?.silben, 'teilweise');
			const rest = setzeSilben(zwei, nr, null, { von: 5, bis: 6 }).quelle;
			assert.equal(innen(rest), 'Die Biene <x-silben im-text darstellung="farbe">fliegt</x-silben>.');
			assert.equal(setzeSilben(rest, nr, null, fliegt).quelle, q(text));
			assert.equal(setzeSilben(zwei, nr, null).quelle, q(text), 'ohne Bereich alle');
		});
		it('Ohne Bereich erfasst die Darstellung den ganzen Text; die Striche der Stellen bleiben', () => {
			const hand = q('Der <x-silben im-text>Thea|ter</x-silben> dort');
			assert.equal(innen(setzeSilben(hand, nr, 'boegen').quelle), '<x-silben>Der Thea|ter dort</x-silben>');
		});
		it('Eine Markierung in einer Stelle wechselt nur deren Darstellung; überlappend gehen beide zusammen', () => {
			const eine = setzeSilben(q(text), nr, 'boegen', biene).quelle;
			assert.equal(
				innen(setzeSilben(eine, nr, 'farbe', { von: 5, bis: 7 }).quelle),
				'Die <x-silben darstellung="farbe" im-text>Bie|ne</x-silben> fliegt.',
			);
			assert.equal(
				innen(setzeSilben(eine, nr, 'boegen', { von: 6, bis: 16 }).quelle),
				'Die <x-silben im-text>Bie|ne fliegt</x-silben>.',
			);
		});
		it('Leerraum am Rand der Markierung bleibt draußen, sonst klebten die Wörter zusammen', () => {
			assert.equal(
				innen(setzeSilben(q(text), nr, 'boegen', { von: 3, bis: 10 }).quelle),
				'Die <x-silben im-text>Bie|ne</x-silben> fliegt.',
			);
		});
		it('Offsets zählen ohne Striche, im Text davor und in Marken', () => {
			const eine = setzeSilben(q(text), nr, 'boegen', biene).quelle;
			const wieder = setzeSilben(eine, nr, 'boegen', fliegt).quelle;
			assert.ok(wieder.includes('<x-silben im-text>fliegt</x-silben>.'));
			const markiert = schalteMarkierung(wieder, nr, 'ie', { von: 10, bis: 16 }).quelle;
			assert.ok(markiert.includes('<x-silben im-text>Bie|ne</x-silben>'), 'Die erste Stelle bleibt unberührt');
			assert.ok(markiert.includes('fl<mark>ie</mark>gt'));
		});
		it('Eine Markierung über eine Fett-Grenze bleibt gültig und kommt zeichengleich zurück', () => {
			const fett = q('a<b>Hund und</b> Maus');
			const an = setzeSilben(fett, nr, 'boegen', { von: 6, bis: 14 }).quelle;
			assert.equal(innen(an), 'a<b>Hund </b><x-silben im-text><b>und</b> Maus</x-silben>');
			assert.equal(setzeSilben(an, nr, null).quelle, fett);
		});
		it('Text darum bleibt, ein Satzzeichen allein zählt nicht als ungeschützter Text', () => {
			const q2 = q('<x-silben im-text>Bie|ne</x-silben>!');
			assert.equal(stand(q2)?.silben, 'boegen');
		});
	});

	describe('Gewähltes x-silben', () => {
		const q2 = q(
			'Die <x-silben im-text>Bie|ne</x-silben> und <x-silben im-text darstellung="farbe">Blu|me</x-silben>',
		);
		const zerlegt = zerlege(q2);
		const kinder = zerlegt.knoten.filter((k) => k.tag === 'x-silben');
		const erste = kinder[0]?.nr as number;
		const zweite = kinder[1]?.nr as number;
		it('Am Kind steht der Stand dieser Stelle, das Ziel ist der Text darum', () => {
			assert.equal(leseSprachstand(q2, erste)?.silben, 'boegen');
			assert.equal(leseSprachstand(q2, zweite)?.silben, 'farbe');
			assert.equal(leseSprachstand(q2, erste)?.ziel, nr);
			assert.equal(leseSprachstand(q2, nr)?.silben, 'teilweise');
		});
		it('Aus entfernt diese Stelle, der Text bleibt, das Elternteil ist gewählt', () => {
			const e = setzeSilben(q2, erste, null);
			assert.equal(innen(e.quelle), 'Die Biene und <x-silben im-text darstellung="farbe">Blu|me</x-silben>');
			assert.equal(e.nr, nr);
		});
		it('Ein Wechsel ändert nur diese Stelle, das Kind bleibt gewählt', () => {
			const e = setzeSilben(q2, zweite, 'boegen');
			assert.equal(e.nr, zweite);
			assert.ok(e.quelle.includes('<x-silben im-text>Blu|me</x-silben>'));
			assert.ok(e.quelle.includes('<x-silben im-text>Bie|ne</x-silben>'));
		});
		it('Allein auf der Seite: Aus lässt einen Absatz mit demselben Text stehen, Attribute des Bausteins bleiben', () => {
			const allein = seite(
				'<div class="koerper"><x-silben data-nur="ab" aufgabe="boegen">Ta|<mark>f</mark>el</x-silben></div>',
			);
			const n = nrVon(allein, 'x-silben');
			assert.equal(leseSprachstand(allein, n)?.ziel, n);
			assert.equal(leseSprachstand(allein, n)?.buchstaben, 'f');
			const e = setzeSilben(allein, n, null);
			assert.ok(e.quelle.includes('<p class="text" data-nur="ab">Ta<mark>f</mark>el</p>'));
			assert.equal(e.nr, n);
		});
	});

	describe('Was angeboten wird', () => {
		const lies = (html: string, tag: string) => {
			const quelle = seite(html);
			return leseSprachstand(quelle, nrVon(quelle, tag));
		};
		it('Absatz, Zelle, Listenpunkt sind umwandelbar, und `setzeBlock` nimmt genau sie an', () => {
			for (const [html, tag] of [
				['<p class="text">Der Hund bellt.</p>', 'p'],
				['<ul><li>Der Hund bellt.</li></ul>', 'li'],
				['<table><tr><td>Der Hund bellt.</td></tr></table>', 'td'],
				['<table><tr><th>Der Hund bellt.</th></tr></table>', 'th'],
				['<div>Der Hund bellt.</div>', 'div'],
			] as const) {
				assert.equal(lies(html, tag)?.umwandelbar, true, html);
				const quelle = seite(html);
				assert.doesNotThrow(
					() => wendeSprachwerkzeugAn(quelle, nrVon(quelle, tag), { art: 'woerter-mischen' }),
					html,
				);
			}
		});
		it('Aufgabentext, Überschrift, Lernziel, Sprechblase sind es nicht, und das scheitert nicht erst beim Klick', () => {
			for (const [html, tag] of [
				['<div class="anw"><span class="text">Lies ab.</span></div>', 'span'],
				['<h2>Der Hund</h2>', 'h2'],
				['<p class="ziel">Ich kann lesen.</p>', 'p'],
				['<p class="blase">Der Hund.</p>', 'p'],
			] as const) {
				assert.equal(lies(html, tag)?.umwandelbar, false, html);
				const quelle = seite(html);
				assert.throws(
					() => wendeSprachwerkzeugAn(quelle, nrVon(quelle, tag), { art: 'woerter-mischen' }),
					html,
				);
			}
		});
		it('Überschrift und Lernziel nur Silben; Zeilennummern nur am Absatz', () => {
			assert.equal(lies('<h2>Der Hund</h2>', 'h2')?.nurSilben, true);
			assert.equal(lies('<p class="ziel">Ich kann lesen.</p>', 'p')?.nurSilben, true);
			assert.equal(lies('<p class="text">Lesen.</p>', 'p')?.nurSilben, false);
			assert.equal(lies('<p class="text">Lesen.</p>', 'p')?.mitZeilennummern, true);
			assert.equal(lies('<ul><li>Lesen.</li></ul>', 'li')?.mitZeilennummern, false);
			assert.equal(
				lies('<div class="anw"><span class="text">Lesen.</span></div>', 'span')?.mitZeilennummern,
				false,
			);
		});
		it('Kein Text oder eine andere Abbildung darin: nichts anbieten', () => {
			assert.equal(lies('<p class="text"></p>', 'p'), null);
			assert.equal(lies('<p class="text">Es ist <x-uhr></x-uhr></p>', 'p'), null);
			assert.ok(lies('<p class="text">Es ist <x-silben im-text>spä|ter</x-silben></p>', 'p'));
		});
		it('Zeilennummern und Stand am Kind: wirken am Absatz darum', () => {
			const quelle = q('<x-silben>Bie|ne</x-silben>');
			const kind = nrVon(quelle, 'x-silben');
			assert.equal(leseSprachstand(setzeZeilennummern(quelle, kind, 5).quelle, kind)?.zeilennummern, 5);
		});
	});

	describe('Buchstaben', () => {
		it('Mehrere Angaben, längste zuerst; der Stand nennt sie', () => {
			const an = schalteMarkierung(q('Die Eier schie'), nr, 'ie, ei').quelle;
			assert.equal(innen(an), 'D<mark>ie</mark> <mark>Ei</mark>er sch<mark>ie</mark>');
			assert.equal(stand(an)?.buchstaben, 'ie, ei');
		});
		it('„ie“ wird auch über einen Silbenstrich gefunden', () => {
			const an = schalteMarkierung(q('<x-silben>Li|e</x-silben>'), nr, 'ie').quelle;
			assert.equal(innen(an), '<x-silben>L<mark>i|e</mark></x-silben>');
		});
		it('`soll: false` nimmt weg, auch wenn nur ein Teil markiert ist; Hand-Marken anderer Buchstaben bleiben', () => {
			const teil = q('Biene T<mark>ie</mark>r <mark>a</mark>');
			assert.equal(
				innen(schalteMarkierung(teil, nr, 'ie', undefined, false).quelle),
				'Biene Tier <mark>a</mark>',
			);
		});
		it('Treffer gibt es nicht: eine Meldung, keine Änderung', () => {
			assert.throws(() => schalteMarkierung(q(TEXT), nr, 'xy'), /kommen hier nicht vor/);
		});
		it('Vokale nur in der Markierung, dann der Stand: nicht an, aber abzulesen', () => {
			const an = schalteMarkierung(q('Hund Maus'), nr, 'vokale', { von: 0, bis: 4 }).quelle;
			assert.equal(innen(an), 'H<mark>u</mark>nd Maus');
			assert.equal(stand(an)?.vokale, false);
			assert.equal(stand(an)?.buchstaben, 'u');
		});
	});

	describe('Feld „Text“ am x-silben', () => {
		const schema = schemaVon('x-silben');
		const q2 = q('<x-silben>Bie|<mark>n</mark>e auf</x-silben>');
		const kind = nrVon(q2, 'x-silben');
		it('zeigt den Text ohne Tags', () => {
			const z = zerlege(q2);
			const k = z.knoten[kind];
			assert.ok(schema && k);
			assert.equal(werteVon(schema, k, z).inhalt, 'Bie|ne auf');
		});
		it('Neue Striche: Marke bleibt', () => {
			assert.equal(
				innen(setzeAbbildung(q2, kind, { inhalt: 'Bi|e|ne auf' }).quelle),
				'<x-silben>Bi|e|<mark>n</mark>e auf</x-silben>',
			);
		});
		it('Neuer Text: Marke bleibt, wo Anfang und Ende gleich sind', () => {
			assert.equal(
				innen(setzeAbbildung(q2, kind, { inhalt: 'Bie|ne fort' }).quelle),
				'<x-silben>Bie|<mark>n</mark>e fort</x-silben>',
			);
		});
		it('Ohne Auszeichnung wie bisher', () => {
			const ohne = q('<x-silben>Ta|fel</x-silben>');
			assert.equal(
				innen(setzeAbbildung(ohne, kind, { inhalt: 'Ta|fel & Co' }).quelle),
				'<x-silben>Ta|fel &amp; Co</x-silben>',
			);
		});
	});
});

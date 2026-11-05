import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';

import type { AbbildungSchema, Feld, ListeFeld, Werte, ZahlFeld } from './abbildungen';
import {
	ABBILDUNG_SCHEMA,
	abschnittVon,
	aendereFeld,
	attributeVon,
	auswahlOptionen,
	feldWert,
	GRUPPEN_ABSCHNITT,
	LERNLANDKARTE_PLATZHALTER,
	markeSetzen,
	markeTrennen,
	markeVerbinden,
	markierungKlartext,
	markierungLesen,
	markierungNeuerText,
	markierungText,
	miniTeile,
	NOTEN_VORSCHLAG,
	notenAnfuegen,
	notenInTakt,
	notenMitTon,
	notenPunkt,
	notenTon,
	notenZuruecknehmen,
	NUR_ZUR_LAUFZEIT,
	planLage,
	planObjekteText,
	planObjekteVon,
	pruefeWerte,
	rasterText,
	rasterVon,
	rechenreiheMoeglich,
	SATZSPIEGEL,
	schemaVon,
	setzeAbbildung,
	SKALA_STANDARD,
	tafelAusschnitt,
	VERKEHRSZEICHEN,
	vornMoeglich,
	werteVon,
	zahlStandard,
	zeilenAlsText,
	zeilenAusText,
	zeilenText,
	zeilenVon,
	ziffernText,
} from './abbildungen';
import { ABSCHNITT_TITEL } from './abschnitte';
import { ASSETS, BLATT_PY } from './konfig';
import { hatLoesung, MIT_LOESUNG, OHNE_LOESUNGSANGABE } from './loesungen';
import { zerlege } from './quelltext';

const JS = readFileSync(path.join(ASSETS, 'abbildungen.js'), 'utf8');

/** Attribute, die kein Feld haben, weil ein eigener Knopf sie setzt: `seed` über „Neue Zahlen“. */
const UEBER_KNOPF: Record<string, string[]> = { 'x-rechenreihe': ['seed'] };

/** Tag → Name der Zeichenfunktion, aus `const ARTEN = { "x-uhr": uhr, … }`. */
const arten = (): Record<string, string> => {
	const liste = /const ARTEN = \{([^}]*)\}/.exec(JS)?.[1] ?? '';
	return Object.fromEntries([...liste.matchAll(/"(x-[a-z0-9-]+)":\s*(\w+)/g)].map((t) => [t[1] ?? '', t[2] ?? '']));
};

/** Alle Attribute, die eine Zeichenfunktion liest (`num(el, "…")`, `getAttribute("…")`, `hasAttribute("…")`). */
const gelesen = (funktion: string) => {
	const start = JS.indexOf(`function ${funktion}(el)`);
	assert.ok(start >= 0, funktion);
	const rumpf = JS.slice(start, JS.indexOf('\n  }\n', start));
	const namen = [
		...rumpf.matchAll(
			/(?:num\(el, |attr\(el, |liste\(el, |paare\(el, |raster\(el, |getAttribute\(|hasAttribute\()"([a-z0-9-]+)"/g,
		),
	].map((t) => t[1]);
	if (/\binhalt\(el\)/.test(rumpf)) {
		namen.push('inhalt');
	}
	if (/\bsamen\(el,/.test(rumpf)) {
		namen.push('seed');
	}
	// Die Rechenreihe liest ihre Einstellungen über einen Kern, den auch der Test ruft (050).
	if (/\brechenreiheEinstellungen\(/.test(rumpf)) {
		const start2 = JS.indexOf('const rechenreiheEinstellungen');
		const kern = JS.slice(start2, JS.indexOf('\n  });\n', start2));
		namen.push(...[...kern.matchAll(/lies\("([a-z0-9-]+)"/g)].map((t) => t[1]));
	}
	return [...new Set(namen)].sort();
};

const schema = (tag: keyof typeof ABBILDUNG_SCHEMA): AbbildungSchema => ABBILDUNG_SCHEMA[tag];

const feld = (s: AbbildungSchema, attribut: string): Feld => {
	const f = s.felder.find((x) => x.attribut === attribut);
	assert.ok(f, attribut);
	return f;
};

const pruefe = (tag: keyof typeof ABBILDUNG_SCHEMA, werte: Werte) => {
	const s = schema(tag);
	const leer = Object.fromEntries(attributeVon(s).map((a) => [a, null]));
	return pruefeWerte(s, { ...leer, ...werte });
};

describe('Schema der Abbildungen', () => {
	it('hat für jedes Element aus abbildungen.js genau einen Eintrag', () => {
		assert.deepEqual(Object.keys(arten()).sort(), Object.keys(ABBILDUNG_SCHEMA).sort());
	});

	it('kennt genau die Attribute, die abbildungen.js liest', () => {
		for (const [tag, funktion] of Object.entries(arten())) {
			const s = schemaVon(tag);
			assert.ok(s, tag);
			const imSchema = [
				...attributeVon(s),
				...NUR_ZUR_LAUFZEIT.filter((a) => gelesen(funktion).includes(a)),
				...(UEBER_KNOPF[tag] ?? []),
			];
			assert.deepEqual([...new Set(imSchema)].sort(), gelesen(funktion), tag);
		}
	});

	it('nimmt jede Abbildung aus den Vorlagen, Beispielen und Musterblättern als gültig an', () => {
		let anzahl = 0;
		const dateien = [
			...readdirSync(ASSETS)
				.filter((d) => d.endsWith('.html'))
				.map((d) => path.join(ASSETS, d)),
			...readdirSync(path.join(ASSETS, 'muster')).map((d) => path.join(ASSETS, 'muster', d)),
		];
		for (const datei of dateien) {
			const z = zerlege(readFileSync(datei, 'utf8'));
			for (const k of z.knoten) {
				const s = schemaVon(k.tag);
				if (s && !k.attribute.some((a) => a.name === 'data-erwarteter-fehler')) {
					anzahl += 1;
					assert.deepEqual(pruefeWerte(s, werteVon(s, k, z)), {}, `${datei}: <${k.tag}>`);
				}
			}
		}
		assert.ok(anzahl > 5);
	});

	it('nimmt bei einem Schritt unter 1 auch Kommazahlen an, sonst nur ganze', () => {
		const plan = schemaVon('x-plan');
		assert.ok(plan);
		const fehler = (wert: string) => pruefeWerte(plan, { kaestchen: wert }).kaestchen;
		assert.equal(fehler('0.9'), undefined);
		assert.equal(fehler('1,2'), undefined);
		assert.match(fehler('0.95') ?? '', /Schritten von 0,1/);
		assert.match(fehler('0.5') ?? '', /von 0,8 bis 3/);
		assert.match(pruefeWerte(plan, { spalten: '2.5' }).spalten ?? '', /ganze Zahl/);
	});

	it('abbildungen.js nennt jedes Element wie das Schema', () => {
		const block = /const NAMEN = \{([^}]*)\}/.exec(JS)?.[1] ?? '';
		const namen = new Map([...block.matchAll(/"(x-[a-z0-9-]+)":\s*"([^"]+)"/g)].map((t) => [t[1], t[2]]));
		for (const [tag, s] of Object.entries(ABBILDUNG_SCHEMA)) {
			assert.equal(namen.get(tag), s.name, tag);
		}
	});
});

describe('Prüfen', () => {
	it('Uhrzeit: Minuten 0 bis 59, Format Stunde:Minute', () => {
		assert.deepEqual(pruefe('x-uhr', { zeit: '4:30' }), {});
		assert.deepEqual(pruefe('x-uhr', { loesung: '11:05' }), {});
		assert.match(pruefe('x-uhr', { zeit: '4:75' }).zeit ?? '', /Minuten 0 bis 59/);
		assert.match(pruefe('x-uhr', { zeit: 'halb fünf' }).zeit ?? '', /4:30/);
	});

	it('Zahlen: ganz und in den Grenzen', () => {
		assert.match(pruefe('x-zwanzigerfeld', { n: '21' }).n ?? '', /von 0 bis 20/);
		assert.match(pruefe('x-zwanzigerfeld', { n: '2,5' }).n ?? '', /ganze Zahl/);
		assert.deepEqual(pruefe('x-zwanzigerfeld', { n: '20' }), {});
	});

	it('Menge: Bündel nur bei 10 je Reihe und nur volle Zehner', () => {
		assert.deepEqual(pruefe('x-menge', { 'n': '36', 'buendel-loesung': '3' }), {});
		assert.match(pruefe('x-menge', { n: '36', buendel: '4' }).buendel ?? '', /nur 3 volle Zehnerreihen/);
		assert.match(pruefe('x-menge', { n: '8', buendel: '1' }).buendel ?? '', /keinen vollen Zehner/);
		assert.match(pruefe('x-menge', { n: '36', reihe: '5', buendel: '1' }).buendel ?? '', /10 in einer Reihe/);
	});

	it('Zahlenstrahl: von < bis, Zahlen und Pfeile im Bereich, nicht zu viele Striche', () => {
		assert.deepEqual(pruefe('x-zahlenstrahl', { von: '0', bis: '100', schritt: '10', pfeile: '30 70' }), {});
		assert.match(pruefe('x-zahlenstrahl', { von: '20', bis: '20' }).bis ?? '', /größer/);
		assert.match(pruefe('x-zahlenstrahl', { pfeile: '7 25' }).pfeile ?? '', /25 liegt nicht zwischen 0 und 20/);
		assert.match(pruefe('x-zahlenstrahl', { bis: '1000' }).schritt ?? '', /1000 Striche/);
		assert.match(pruefe('x-zahlenstrahl', { zahlen: '0 fünf' }).zahlen ?? '', /keine Zahl/);
	});

	it('Stellentafel: so viele Zahlen wie Stellen, Lücken nur rechts', () => {
		assert.deepEqual(pruefe('x-stellentafel', { stellen: 'H Z E', loesung: '1 3 5' }), {});
		assert.deepEqual(pruefe('x-stellentafel', { werte: '3' }), {});
		assert.match(pruefe('x-stellentafel', { loesung: '1 3 5' }).werte ?? '', /nur 2 Stellen/);
		assert.match(pruefe('x-stellentafel', { stellen: 'H Z E', werte: '? 3 5' }).werte ?? '', /Bei „H“ fehlt/);
	});

	it('Timer: die Skala reicht bis zu den Minuten', () => {
		assert.deepEqual(pruefe('x-timer', { minuten: '5', skala: '5' }), {});
		assert.match(pruefe('x-timer', { minuten: '25', skala: '10' }).skala ?? '', /nur bis 10/);
	});

	it('Strich-Punkt und Dienes: mindestens ein Zehner oder Einer', () => {
		assert.match(pruefe('x-strichpunkt', { z: '0', e: '0' }).e ?? '', /Mindestens/);
		assert.deepEqual(pruefe('x-dienes', { z: '3' }), {});
	});
});

describe('Felder ändern', () => {
	it('legt den Wert mit „nur in der Lösung“ in das Lösungs-Attribut und zurück', () => {
		const s = schema('x-uhr');
		const uhrzeit = feld(s, 'zeit');
		const start: Werte = { zeit: '4:30', loesung: null, ziffern: null, groesse: null };
		const versteckt = aendereFeld(s, start, uhrzeit, '4:30', true);
		assert.deepEqual([versteckt.zeit, versteckt.loesung], [null, '4:30']);
		assert.deepEqual(feldWert(uhrzeit, versteckt), { wert: '4:30', nurLoesung: true });
		const spaeter = aendereFeld(s, versteckt, uhrzeit, '5:00');
		assert.deepEqual([spaeter.zeit, spaeter.loesung], [null, '5:00']);
		const leer = aendereFeld(s, spaeter, uhrzeit, null);
		assert.deepEqual([leer.zeit, leer.loesung], [null, null]);
	});

	it('Bündel: das Lösungs-Attribut hat Vorrang wie in abbildungen.js', () => {
		const s = schema('x-menge');
		assert.deepEqual(feldWert(feld(s, 'buendel'), { 'buendel': '1', 'buendel-loesung': '3' }), {
			wert: '3',
			nurLoesung: true,
		});
	});

	it('Zwanzigerfeld: die Art nimmt passende Anzahlen mit, was passt, bleibt', () => {
		const s = schema('x-zwanzigerfeld');
		const art = feld(s, 'art');
		const neu = (w: Werte, wert: string | null) => aendereFeld(s, w, art, wert);
		assert.deepEqual(neu({ n: '13' }, 'fuenfer'), { art: 'fuenfer', n: '3', n2: null });
		assert.deepEqual(neu({ n: '13' }, 'zehner'), { art: 'zehner', n: '5', n2: null });
		assert.deepEqual(neu({ n: '13', n2: '2' }, 'fuenfer'), { art: 'fuenfer', n: '3', n2: '2' });
		assert.deepEqual(neu({ n: '4', n2: '3' }, 'fuenfer'), { art: 'fuenfer', n: '4', n2: '1' });
		assert.deepEqual(neu({ n: '3' }, 'fuenfer'), { art: 'fuenfer', n: '3' });
		assert.deepEqual(neu({ n: '5', n2: '2' }, 'zehner'), { art: 'zehner', n: '5', n2: '2' });
		assert.deepEqual(neu({ loesung: '12 3' }, 'zehner'), { art: 'zehner', loesung: '5 3' });
		assert.deepEqual(neu({ art: 'fuenfer', n: '3' }, null), { art: null, n: '3' });
	});

	it('Hundertertafel: der Ausschnitt schreibt die gezeigte Mittelzahl mit', () => {
		const s = schema('x-hundertertafel');
		const ausschnitt = feld(s, 'ausschnitt');
		const neu = (w: Werte, wert: string) => aendereFeld(s, w, ausschnitt, wert);
		assert.equal(neu({}, 'kreuz').mitte, '45');
		assert.equal(neu({ mitte: '68' }, 'block').mitte, '68');
		assert.equal(neu({ von: '301', bis: '400' }, 'kreuz').mitte, '345');
		assert.equal(neu({ mitte: '41' }, 'kreuz').mitte, '42', 'Am Rand geht es nicht, die nächste Zahl schon');
		assert.equal(neu({ von: '1', bis: '5' }, 'kreuz').mitte, undefined, 'Geht es gar nicht, sagt das die Meldung');
		assert.equal(neu({}, 'ganz').mitte, undefined);
		const starter = neu({ luecken: '7 23 58 94', markiert: '5 10 45 50' }, 'zeile');
		assert.deepEqual([starter.luecken, starter.markiert], [null, '45 50']);
		const mitte = feld(s, 'mitte');
		const geruckt = aendereFeld(
			s,
			{ ausschnitt: 'kreuz', mitte: '45', luecken: '35 46', markiert: '55' },
			mitte,
			'46',
		);
		assert.deepEqual([geruckt.luecken, geruckt.markiert], ['46', null]);
		const rand = aendereFeld(s, { ausschnitt: 'kreuz', mitte: '45', markiert: '45' }, mitte, '41');
		assert.equal(rand.markiert, '45', 'Geht der Ausschnitt nicht, bleibt alles, bis die Zahl passt');
	});

	it('Zahlenmauer: Minus nimmt eine Reihenfolge ohne Stein unter 0 mit, was aufgeht, bleibt', () => {
		const s = schema('x-zahlenmauer');
		const art = feld(s, 'art');
		const neu = (basis: string, wert: string) => aendereFeld(s, { basis }, art, wert).basis;
		assert.equal(neu('3 5 2', 'minus'), '5 3 2');
		assert.equal(neu('20 7 3', 'minus'), '20 7 3');
		assert.equal(neu('3 5 2', 'plus'), '3 5 2');
		const { mauerWerte } = rechenkerne() as unknown as { mauerWerte: (b: number[], a: string) => number[][] };
		for (const basis of ['3 5 2', '4 2 6 1', '9 5 4 1', '1 2 3 4 5', '7 7']) {
			const zahlen = (neu(basis, 'minus') ?? '').split(' ').map(Number);
			assert.equal(zahlen.length, basis.split(' ').length, basis);
			assert.ok(
				mauerWerte(zahlen, 'minus')
					.flat()
					.every((z) => z >= 0),
				`${basis} wird ${zahlen.join(' ')}`,
			);
		}
	});

	it('Rechenreihe: die Wahl nimmt mit, was sonst am Starter scheitert', () => {
		const s = schema('x-rechenreihe');
		const neu = (w: Werte, attribut: string, wert: string | null) => aendereFeld(s, w, feld(s, attribut), wert);
		const starter = { rechenart: '+', zahlenraum: '20', anzahl: '8', uebergang: 'mit' };
		assert.deepEqual(neu(starter, 'rechenart', '·'), { ...starter, rechenart: '·', uebergang: null });
		assert.deepEqual(neu(starter, 'rechenart', ':'), { ...starter, rechenart: ':', uebergang: null });
		assert.equal(neu(starter, 'rechenart', '−').uebergang, 'mit', 'Bei Minus gilt der Übergang weiter');
		const mal = { rechenart: '·', zahlenraum: '100', anzahl: '8', reihe: '7' };
		assert.equal(neu(mal, 'rechenart', '+').reihe, null);
		assert.equal(neu({ ...mal, rechenart: ':', rest: '1' }, 'rechenart', '·').rest, null);
		assert.equal(neu({ beziehung: 'tausch' }, 'rechenart', '−').beziehung, null);

		const raum = neu(starter, 'zahlenraum', '10');
		assert.deepEqual([raum.uebergang, raum.anzahl], [null, '8']);
		assert.equal(neu({ uebergang: 'mit', zahlenraum: '10' }, 'uebergang', 'mit').zahlenraum, '20');
		assert.equal(neu({ ...mal, reihe: '7' }, 'zahlenraum', '10').anzahl, '1', 'Bis 10 gibt es nur 7 · 1');

		const reihe = neu({ rechenart: '·', zahlenraum: '20', anzahl: '8' }, 'reihe', '7');
		assert.deepEqual([reihe.zahlenraum, reihe.anzahl], ['100', '8']);
		assert.equal(neu({ rechenart: '·', zahlenraum: '20' }, 'reihe', '2').zahlenraum, '20', 'Passt, bleibt');
		assert.equal(neu({ rechenart: ':', rest: '1' }, 'reihe', '1').rest, null);

		const rest = neu({ rechenart: ':', platzhalter: 'erste', beziehung: 'umkehr', reihe: '1' }, 'rest', '1');
		assert.deepEqual([rest.platzhalter, rest.beziehung, rest.reihe], [null, null, null]);
		assert.equal(neu({ rechenart: ':', platzhalter: 'erste' }, 'rest', '0').platzhalter, 'erste');
	});

	it('Zauberdreieck: die Form nimmt Zahlen, Summe und Vorgaben mit', () => {
		const s = schema('x-zauberdreieck');
		const art = feld(s, 'art');
		const neu = (w: Werte, wert: string) => aendereFeld(s, w, art, wert);
		assert.deepEqual(neu({ summe: '9', vorgegeben: 'e0 e1' }, 'quadrat'), {
			art: 'quadrat',
			summe: '15',
			vorgegeben: 'z0 z4 z5',
		});
		assert.deepEqual(neu({ art: 'quadrat', summe: '15', vorgegeben: 'z0 z4 z5' }, 'dreieck'), {
			art: 'dreieck',
			summe: '9',
			vorgegeben: 'e0 e1',
		});
		assert.deepEqual(neu({ zahlen: '1 2 3 4 5 6', vorgegeben: 'e0' }, 'quadrat'), {
			art: 'quadrat',
			vorgegeben: null,
			zahlen: null,
		});
		assert.deepEqual(neu({}, 'quadrat'), { art: 'quadrat' });
	});

	it('Messgerät: Gerät und Einheit nehmen Einheit, Striche und einen Wert auf einem Strich mit', () => {
		const s = schema('x-skala');
		const start: Werte = { art: 'lineal', von: '0', bis: '12', wert: '7.5', aufgabe: 'ablesen' };
		const art = (w: Werte, wert: string) => aendereFeld(s, w, feld(s, 'art'), wert);
		const einheit = (w: Werte, wert: string | null) => aendereFeld(s, w, feld(s, 'einheit'), wert);

		const becher = art(start, 'messbecher');
		assert.deepEqual([becher.von, becher.bis, becher.teilung, becher.wert], [null, null, null, '260']);
		assert.equal(art({ ...start, einheit: 'mm' }, 'waage').einheit, null);
		assert.equal(art({ art: 'lineal', einheit: 'cm' }, 'massband').einheit, 'cm');
		assert.equal(art({ art: 'messbecher', wert: '300' }, 'waage').wert, '300');
		assert.equal(art({ art: 'messbecher', loesung: '300' }, 'thermometer').loesung, '10');
		assert.equal(einheit({ art: 'waage', wert: '350' }, 'kg').wert, '2,5');

		// Dieselbe wirksame Einheit: Der eigene Bereich bleibt.
		assert.deepEqual(einheit(start, 'cm'), { ...start, einheit: 'cm' });

		// Aus jedem Gerät und jeder Einheit: Die Zeichnung findet ihre Striche, der Wert liegt auf einem.
		const { skalaStriche } = rechenkerne();
		for (const [schluessel, [von, bis, teilung]] of Object.entries(SKALA_STANDARD)) {
			const [geraet = '', wahl = ''] = schluessel.split('|');
			const neu = einheit(art({ ...start, art: geraet === 'lineal' ? 'waage' : 'lineal' }, geraet), wahl);
			const [haupt = 0, klein = 0] = teilung.split(' ').map(Number);
			const zahl = Number((neu.wert ?? '').replace(',', '.'));
			assert.deepEqual([neu.von, neu.bis, neu.teilung], [null, null, null], schluessel);
			assert.ok(
				skalaStriche(von, bis, haupt, klein).some((x) => Math.abs(x.wert - zahl) < 1e-6),
				`${schluessel}: ${neu.wert}`,
			);
		}
	});

	it('Messgerät: Das Panel bietet je Gerät die Einheiten aus SKALA_STANDARD an', () => {
		const s = schema('x-skala');
		const f = feld(s, 'einheit');
		assert.ok(f.art === 'auswahl' && f.optionenJe);
		const namen = (art: string) => f.optionenJe?.werte[art]?.map((o) => o.name);
		assert.deepEqual(namen('lineal'), ['Passend zum Gerät', 'cm', 'mm']);
		assert.deepEqual(namen('messbecher'), ['Passend zum Gerät', 'ml', 'l']);
		assert.equal(Object.keys(f.optionenJe.werte)[0], 'lineal');
		for (const liste of Object.values(f.optionenJe.werte)) {
			for (const o of liste) {
				assert.ok(
					f.optionen.some((x) => x.wert === o.wert),
					o.name,
				);
			}
		}
		assert.equal(f.nurWenn?.({ art: 'thermometer' }), false);
		assert.equal(f.nurWenn?.({}), true);
	});

	it('Taktart: nimmt die Noten mit, wenn keine über einen Taktstrich ragt; die Zeichnung nimmt das Ergebnis an', () => {
		const { leseTakte } = rechenkerne();
		const rhythmus = schema('x-rhythmus');
		const takt = (s: AbbildungSchema, w: Werte, wert: string) => aendereFeld(s, w, feld(s, 'takt'), wert);
		const karte: Werte = { art: 'karte', takt: '2/4', noten: '4 8 8', silben: 'ta' };
		assert.equal(takt(rhythmus, karte, '3/4').noten, '4 8 8 r4');
		assert.equal(takt(rhythmus, karte, '4/4').noten, '4 8 8 r2');
		assert.equal(takt(rhythmus, takt(rhythmus, karte, '4/4'), '2/4').noten, '4 8 8', 'Pausen am Ende fallen weg');
		// Die Karte hat genau einen Takt: Was nicht hineinpasst, bleibt, und die Meldung nennt den Weg.
		assert.equal(takt(rhythmus, { art: 'karte', takt: '4/4', noten: '2 4 4' }, '2/4').noten, '2 4 4');
		assert.equal(takt(rhythmus, { takt: '4/4', noten: '2 4 4' }, '2/4').noten, '2 | 4 4');
		// Eine Halbe über dem Taktstrich und ein Auftakt bleiben unverändert.
		assert.equal(takt(rhythmus, { takt: '4/4', noten: '4 2 4' }, '2/4').noten, '4 2 4');
		assert.equal(takt(rhythmus, { takt: '4/4', noten: '4 | 4 4 4 4', auftakt: 'ja' }, '3/4').noten, '4 | 4 4 4 4');
		// Passt schon: Nichts ändert sich.
		assert.deepEqual(takt(rhythmus, { takt: '2/4', noten: '2 4' }, '3/4'), { takt: '3/4', noten: '2 4' });

		const noten = schema('x-noten');
		const melodie: Werte = { takt: '4/4', noten: String.raw`c'4 d'4 e'4 f'4 | g'4 a'4 h'4 c''4`, namen: 'ja' };
		assert.equal(takt(noten, melodie, '2/4').noten, String.raw`c'4 d'4 | e'4 f'4 | g'4 a'4 | h'4 c''4`);
		assert.equal(takt(noten, melodie, '3/4').noten, String.raw`c'4 d'4 e'4 | f'4 g'4 a'4 | h'4 c''4 r4`);
		assert.equal(notenInTakt('4 8', '4/4'), '4 8 r8 r2');
		assert.equal(notenInTakt('4 x', '4/4'), null);

		for (const [text, ziel] of [
			['4 8 8', '3/4'],
			['4 8', '4/4'],
			['8 8 8 8 4 4 | 4 4 4 4', '3/4'],
			['4 4 4 | 4 4 4', '4/4'],
		] as const) {
			const neu = notenInTakt(text, ziel);
			assert.ok(neu !== null, `${text} in ${ziel}`);
			assert.doesNotThrow(() => leseTakte(neu, ziel, false), `${text} in ${ziel}: ${neu}`);
		}
	});

	it('Satzglieder: Nach vorn stehen nur Satzglieder zur Wahl, die das Umstellen findet', () => {
		const s = schema('x-satzglieder');
		const vorn = feld(s, 'vorn');
		assert.ok(vorn.art === 'auswahl');
		const satz = '[Am Morgen]Zeit [bringt]P [der Briefträger]S [dem Kind]DaO [ein Paket]AkO.';
		const namen = (inhalt: string) => auswahlOptionen(vorn, { inhalt, aufgabe: 'umstellen' }).map((o) => o.name);
		assert.deepEqual(namen('[Der Hund]S [bellt]P [den Briefträger]AkO [an]P.'), [
			'Nächstes Satzglied',
			'Akkusativobjekt',
		]);
		assert.deepEqual(namen(satz), ['Nächstes Satzglied', 'Subjekt', 'Akkusativobjekt', 'Dativobjekt']);

		// Dieselbe Regel wie `satzUmstellen` in abbildungen.js: angeboten heißt, das Umstellen gelingt.
		const { satzUmstellen } = rechenkerne();
		const saetze = [
			satz,
			'[Der Hund]S [bellt]P [den Briefträger]AkO [an]P.',
			'[Wir]S [gehen]P [morgen]Zeit [ins Kino]Ort.',
			'[Im Garten]Ort [wächst]P [eine Blume]S.',
			'[Er]S [schenkt]P [ihr]DaO [eine Rose]AkO.',
		];
		for (const text of saetze) {
			for (const rolle of vorn.optionen.flatMap((o) => (o.wert ? [o.wert] : []))) {
				const geht = (() => {
					try {
						satzUmstellen(text, rolle);
						return true;
					} catch {
						return false;
					}
				})();
				assert.equal(vornMoeglich(text).has(rolle), geht, `${text} ${rolle}`);
			}
		}

		// Ändert sich der Satz, fällt ein Satzglied weg, das es dort nicht mehr gibt; sonst bleibt es.
		const inhalt = feld(s, 'inhalt');
		const start: Werte = { inhalt: satz, aufgabe: 'umstellen', vorn: 'DaO' };
		assert.equal(aendereFeld(s, start, inhalt, '[Der Hund]S [bellt]P [den Briefträger]AkO [an]P.').vorn, null);
		assert.equal(
			aendereFeld(s, start, inhalt, '[Heute]Zeit [gibt]P [Oma]S [dem Kind]DaO [ein Buch]AkO.').vorn,
			'DaO',
		);
	});

	it('Sortieren: Art „Bilder“ ohne Bild meldet an der Liste, in welchen Zeilen es fehlt', () => {
		const eintraege = 'Samen; Stängel: bilder/stengel.png; Blume';
		assert.deepEqual(pruefe('x-sortieren', { eintraege }), {});
		const fehler = pruefe('x-sortieren', { eintraege, art: 'bilder' });
		assert.deepEqual(Object.keys(fehler), ['eintraege']);
		assert.match(fehler.eintraege ?? '', /Bild-Knopf.*Zeile 1 und 3\.$/);
		assert.deepEqual(pruefe('x-sortieren', { eintraege: 'A: a.png; B: b.png', art: 'bilder' }), {});
	});

	it('Suchsel: Wortliste „Bilder“ ohne Bild meldet an der Liste und nennt den Weg über das Menü der Zeile', () => {
		const woerter = 'Oma: bild:bilder/oma.png; Opa; Mama: uhr:7:30; Papa: bild:';
		assert.deepEqual(pruefe('x-suchsel', { woerter }), {});
		const fehler = pruefe('x-suchsel', { woerter, wortliste: 'bilder' });
		assert.deepEqual(Object.keys(fehler), ['woerter']);
		assert.match(fehler.woerter ?? '', /^Bei der Wortliste „Bilder“ .*Menü ⋯ der Zeile.*„Bild“.*Zeile 2 und 4\.$/);
		// Jeder Mini-Inhalt gilt als Bild, wie in der Referenz.
		assert.deepEqual(pruefe('x-suchsel', { woerter: 'Oma: bild:a.png; Opa: wuerfel:3', wortliste: 'bilder' }), {});
		// Erst die Wörter selbst, dann die Bilder.
		assert.match(
			pruefe('x-suchsel', { woerter: 'Oma1; Opa', wortliste: 'bilder' }).woerter ?? '',
			/nur aus Buchstaben/,
		);
	});

	it('Kreuzworträtsel: Lösungswort senkrecht meldet am Lösungswort, was fehlt, und nennt den Weg', () => {
		const eintraege = 'a: STUHL; b: STIFT; c: SCHULE; d: LINEAL; e: RADIERER; f: DOSE; g: TAFEL; h: RANZEN';
		assert.deepEqual(pruefe('x-kreuzwort', { eintraege, loesungswort: 'HEFT' }), {});
		const zuKurz = pruefe('x-kreuzwort', { eintraege, loesungswort: 'HEFT', art: 'senkrecht' });
		assert.deepEqual(Object.keys(zuKurz), ['loesungswort']);
		assert.match(
			zuKurz.loesungswort ?? '',
			/4 Buchstaben, es sind aber 8 Wörter\..*8 Buchstaben\..*oder 4 Wörter\.$/,
		);
		assert.match(
			pruefe('x-kreuzwort', { eintraege, art: 'senkrecht' }).loesungswort ?? '',
			/^Hier fehlt das Lösungswort\. .*8 Buchstaben\.$/,
		);
		const vier = 'a: STUHL; b: TAFEL; c: STIFT; d: DOSE';
		assert.match(
			pruefe('x-kreuzwort', { eintraege: vier, loesungswort: 'HEFT', art: 'senkrecht' }).loesungswort ?? '',
			/^„DOSE“ enthält kein T, den 4\. Buchstaben .*Reihenfolge\.$/,
		);
		const passend = 'a: STUHL; b: TAFEL; c: STIFT; d: TAFEL';
		assert.deepEqual(pruefe('x-kreuzwort', { eintraege: passend, loesungswort: 'heft', art: 'senkrecht' }), {});
		// ß zählt wie in abbildungen.js als SS.
		assert.deepEqual(
			pruefe('x-kreuzwort', { eintraege: 'a: SONNE; b: STERN', loesungswort: 'ß', art: 'senkrecht' }),
			{},
		);
	});

	it('Spielplan: Die Lernlandkarte nimmt Platzhalter, wenn die Inhalte nicht 2 bis 12 Ziele sind', () => {
		const s = schema('x-spielplan');
		const art = feld(s, 'art');
		const aufgaben = `; ${Array.from({ length: 28 }, (_, i) => `${i}+1`).join('; ')}`;
		assert.equal(aendereFeld(s, { inhalt: aufgaben }, art, 'lernlandkarte').inhalt, LERNLANDKARTE_PLATZHALTER);
		assert.equal(aendereFeld(s, { inhalt: null }, art, 'lernlandkarte').inhalt, LERNLANDKARTE_PLATZHALTER);
		const ziele = 'Ich kann zählen.; ; Ich kann ergänzen.';
		assert.equal(aendereFeld(s, { inhalt: ziele }, art, 'lernlandkarte').inhalt, ziele);
		// Zurück zum Spielplan bleibt alles.
		assert.equal(aendereFeld(s, { art: 'lernlandkarte', inhalt: ziele }, art, 'spiel').inhalt, ziele);
	});

	it('Gitter: Die Aufgabe nimmt Spalten, Zeilen, Kästchen und Achse mit', () => {
		const s = schema('x-gitter');
		const aufgabe = feld(s, 'aufgabe');
		const neu = (w: Werte, wert: string) => aendereFeld(s, w, aufgabe, wert);
		const figur = '0 0 0 0 0 0 / 0 0 0 1 1 1 / 0 0 1 1 0 0 / 0 1 1 1 0 0 / 0 0 0 1 1 1 / 0 0 0 0 0 0';
		const start: Werte = {
			'spalten': '12',
			'zeilen': '6',
			'aufgabe': 'spiegeln',
			'achse': 'senkrecht',
			'achse-bei': '6',
			figur,
		};
		const fort = neu(start, 'fortsetzen');
		assert.deepEqual([fort.spalten, fort.zeilen, fort.kaestchen], ['24', '6', '0.5']);
		const gross = neu(start, 'vergroessern');
		assert.deepEqual([gross.spalten, gross.zeilen, gross.kaestchen], ['12', '8', '0.5']);
		assert.deepEqual([gross.achse, gross['achse-bei']], [null, null]);
		assert.deepEqual(neu(gross, 'spiegeln').achse, 'senkrecht');
		assert.deepEqual(neu(gross, 'spiegeln')['achse-bei'], '6');
		assert.equal(zahlStandard(feld(s, 'rapport') as ZahlFeld, fort), 6);
		assert.equal(zahlStandard(feld(s, 'rapport') as ZahlFeld, {}), 4);

		const passt: Werte = { spalten: '24', zeilen: '4', kaestchen: '0.5', rapport: '4', figur: '1 1 0 0 / 1 0 0 0' };
		assert.deepEqual(neu(passt, 'fortsetzen'), { ...passt, aufgabe: 'fortsetzen' });
		const breit = neu({ spalten: '12', figur: '1 1 1 1 1 1 1 1 1 1' }, 'fortsetzen');
		assert.deepEqual([breit.spalten, breit.rapporte], ['30', '1']);
		const zuBreit = { spalten: '12', figur: '1 1 1 1 1 1 1 1 1 1 1 1' };
		assert.deepEqual(neu(zuBreit, 'fortsetzen'), { ...zuBreit, aufgabe: 'fortsetzen' });
		const leer = { spalten: '12' };
		assert.deepEqual(neu(leer, 'vergroessern'), { ...leer, aufgabe: 'vergroessern' });
		const nachLangem = neu({ spalten: '24', zeilen: '6', figur }, 'vergroessern');
		assert.equal(nachLangem.spalten, '10');
	});

	it('Gitter: Fortsetzen durch und Größe wirken nur in ihrer Aufgabe', () => {
		const s = schema('x-gitter');
		const figur = '1 1 1 1 1 1 / 1 1 1 1 1 1';
		const anders = aendereFeld(s, { spalten: '12', figur, aufgabe: 'keine' }, feld(s, 'rapportart'), 'drehen');
		assert.equal(anders.spalten, '12');
		const fort = aendereFeld(s, { spalten: '12', figur, aufgabe: 'fortsetzen' }, feld(s, 'rapportart'), 'drehen');
		assert.equal(fort.spalten, '24');
		const zurueck = aendereFeld(
			s,
			{ spalten: '12', zeilen: '6', figur, aufgabe: 'vergroessern', faktor: '0.5' },
			feld(s, 'faktor'),
			'2',
		);
		assert.deepEqual([zurueck.spalten, zurueck.zeilen], ['12', '6']);
	});

	it('Satzspiegel im Schema und in `abbildungen.js` sind gleich', () => {
		assert.equal(/const SATZSPIEGEL = (\d+)/.exec(JS)?.[1], String(SATZSPIEGEL));
	});

	it('Würfelgebäude: Die Frage nimmt die Vorgabe weg, nicht umgekehrt', () => {
		const s = schema('x-wuerfelbau');
		const fragen = feld(s, 'fragen');
		const zeige = 'schraegbild bauplan vorne rechts links oben';
		assert.equal(aendereFeld(s, { zeige }, fragen, 'vorne').zeige, 'schraegbild bauplan rechts links oben');
		assert.equal(aendereFeld(s, { zeige }, fragen, 'bauplan oben').zeige, 'schraegbild vorne rechts links');
		assert.equal(aendereFeld(s, { zeige }, fragen, 'anzahl').zeige, zeige);
		assert.equal(aendereFeld(s, { zeige: 'bauplan vorne' }, fragen, 'bauplan').zeige, 'schraegbild vorne');
		assert.equal(aendereFeld(s, { zeige: 'bauplan' }, fragen, 'bauplan').zeige, null);
		assert.equal(aendereFeld(s, {}, fragen, 'bauplan').zeige ?? null, null);
		assert.equal(aendereFeld(s, { fragen: 'vorne' }, feld(s, 'zeige'), 'vorne').fragen, 'vorne');
		assert.equal(aendereFeld(s, { zeige }, fragen, 'bauplan').verdeckt, 'zeigen');
		assert.equal(aendereFeld(s, { zeige: 'schraegbild' }, fragen, 'anzahl').verdeckt, 'zeigen');
		assert.equal(aendereFeld(s, { zeige }, fragen, 'anzahl').verdeckt ?? null, null);
		assert.equal(aendereFeld(s, { zeige }, fragen, 'vorne').verdeckt ?? null, null);
	});

	it('Würfelnetz: „Kein Netz“ nimmt die Aufgabe mit, der Quader seine Maße', () => {
		const s = schema('x-wuerfelnetz');
		const netz = feld(s, 'netz');
		const kein = aendereFeld(
			s,
			{ aufgabe: 'gegenueber', markiere: '2', bastel: 'ja', laschen: 'ja', art: 'quader' },
			netz,
			'n3',
		);
		assert.deepEqual(
			[kein.aufgabe, kein.bastel, kein.laschen, kein.art, kein.markiere],
			['netz-oder-nicht', null, null, null, '2'],
		);
		assert.equal(aendereFeld(s, {}, netz, 'n1').aufgabe, 'netz-oder-nicht');
		assert.equal(aendereFeld(s, { aufgabe: 'gegenueber' }, netz, '4').aufgabe, 'gegenueber');
		assert.equal(aendereFeld(s, { netz: 'n3' }, feld(s, 'aufgabe'), 'gegenueber').netz, '1');
		assert.equal(aendereFeld(s, { netz: '4' }, feld(s, 'aufgabe'), 'gegenueber').netz, '4');

		const art = feld(s, 'art');
		assert.equal(aendereFeld(s, { netz: '3' }, art, 'quader').masse, '4 2 1');
		assert.equal(aendereFeld(s, { netz: '3' }, art, 'quader').netz, '3');
		assert.equal(aendereFeld(s, { netz: '9' }, art, 'quader').netz, '1');
		assert.equal(aendereFeld(s, { netz: '3', masse: '5 3 2' }, art, 'quader').masse, '5 3 2');
		assert.equal(aendereFeld(s, { netz: '3', masse: '5 3 2' }, art, null).masse, '5 3 2');
	});

	it('Stellen ändern: Zahlen bleiben rechtsbündig an ihrer Stelle', () => {
		const s = schema('x-stellentafel');
		const stellen = feld(s, 'stellen');
		const start: Werte = { stellen: null, werte: null, loesung: '3 5', zeilen: null };
		const mehr = aendereFeld(s, start, stellen, 'H Z E');
		assert.equal(mehr.loesung, '? 3 5');
		assert.match(pruefeWerte(s, mehr).werte ?? '', /Bei „H“ fehlt/);
		const weniger = aendereFeld(s, { ...start, stellen: 'H Z E', loesung: '1 3 5' }, stellen, null);
		assert.equal(weniger.loesung, '3 5');
	});

	it('ziffernText: leere Stellen rechts fallen weg, eine leere Tafel hat keinen Wert', () => {
		assert.equal(ziffernText(['3', '', '']), '3');
		assert.equal(ziffernText(['', '5']), '? 5');
		assert.equal(ziffernText(['', '']), null);
	});
});

describe('neue Feldtypen', () => {
	const probe = schema('x-probe');
	const liste = feld(probe, 'eintraege') as ListeFeld;

	it('Liste: Paare lesen und schreiben, leere Felder bleiben im Entwurf sichtbar', () => {
		assert.deepEqual(zeilenVon(liste, 'Hund: 7; Katze: 4'), [
			['Hund', '7'],
			['Katze', '4'],
		]);
		assert.deepEqual(zeilenVon(liste, 'Hund: 7;'), [['Hund', '7']]);
		assert.equal(
			zeilenText(liste, [
				['Hund', '7'],
				['Katze', '4'],
			]),
			'Hund: 7; Katze: 4',
		);
		const entwurf = zeilenText(liste, [
			['Hund', ''],
			['', '4'],
		]);
		assert.deepEqual(zeilenVon(liste, entwurf), [
			['Hund', ''],
			['', '4'],
		]);
		assert.equal(zeilenText(liste, []), null);
	});

	it('Liste: andere Trenner', () => {
		const spruenge: ListeFeld = {
			art: 'liste',
			attribut: 'a',
			name: 'A',
			zeilenTrenner: ' ',
			unter: [{ name: 'S', art: 'text' }],
		};
		assert.deepEqual(zeilenVon(spruenge, '+30 +4'), [['+30'], ['+4']]);
		assert.equal(zeilenText(spruenge, [['+30'], ['+4']]), '+30 +4');
		const paar: ListeFeld = {
			art: 'liste',
			attribut: 'a',
			name: 'A',
			feldTrenner: ' ',
			unter: [
				{ name: 'X', art: 'zahl' },
				{ name: 'Y', art: 'zahl' },
			],
		};
		assert.deepEqual(zeilenVon(paar, '3 4; 5 2'), [
			['3', '4'],
			['5', '2'],
		]);
		assert.equal(
			zeilenText(paar, [
				['3', '4'],
				['5', '2'],
			]),
			'3 4; 5 2',
		);
	});

	it('Liste ohne Trenner zwischen Zahl und Zeichen', () => {
		const weg: ListeFeld = {
			art: 'liste',
			attribut: 'weg',
			name: 'Weg',
			zeilenTrenner: ' ',
			feldTrenner: '',
			unter: [
				{ name: 'S', art: 'zahl' },
				{ name: 'R', art: 'text' },
			],
		};
		assert.deepEqual(zeilenVon(weg, '3→ 12↑'), [
			['3', '→'],
			['12', '↑'],
		]);
		assert.equal(
			zeilenText(weg, [
				['3', '→'],
				['12', '↑'],
			]),
			'3→ 12↑',
		);
		assert.deepEqual(zeilenVon(weg, zeilenText(weg, [['', '→']])), [['', '→']]);
	});

	it('Prüfen: Text, Liste, Mehrfach, Raster, Muster und Regeln', () => {
		assert.match(pruefe('x-probe', { titel: 'x'.repeat(21) }).titel ?? '', /Höchstens 20/);
		assert.match(pruefe('x-probe', { inhalt: 'Ro1' }).inhalt ?? '', /Nur Buchstaben/);
		assert.deepEqual(pruefe('x-probe', { inhalt: 'Ro|si|ne' }), {});
		assert.match(pruefe('x-probe', { eintraege: 'A: 200' }).eintraege ?? '', /Zeile 1.*0 bis 99/);
		assert.match(pruefe('x-probe', { eintraege: 'A: ∅' }).eintraege ?? '', /Zeile 1: „Zahl“ fehlt/);
		assert.match(pruefe('x-probe', { eintraege: 'A: 1; B: 1; C: 1; D: 1' }).eintraege ?? '', /Vier geht nicht/);
		assert.match(pruefe('x-probe', { arten: 'vier' }).arten ?? '', /gibt es hier nicht/);
		assert.match(pruefe('x-probe', { feld: '0 2' }).feld ?? '', /„2“ geht/);
		assert.match(pruefe('x-probe', { hoehen: '1 9' }).hoehen ?? '', /von 0 bis 5/);
		assert.match(pruefe('x-probe', { farbe: 'pink' }).farbe ?? '', /gibt es hier nicht/);
	});

	it('Feld am Inhalt: Wert ist der Text im Element, geschrieben wird nur der Inhalt', () => {
		const q = '<div><x-probe titel="a">Ro|si&amp;ne</x-probe></div>';
		const z = zerlege(q);
		const k = z.knoten.find((x) => x.tag === 'x-probe');
		assert.ok(k);
		assert.equal(werteVon(probe, k, z).inhalt, 'Ro|si&ne');
		const { quelle } = setzeAbbildung('<div><x-probe titel="a">Ro|sine</x-probe></div>', k.nr, {
			inhalt: 'Ro|si|ne<',
		});
		assert.equal(quelle, '<div><x-probe titel="a">Ro|si|ne&lt;</x-probe></div>');
	});

	it('Raster lesen und schreiben', () => {
		assert.deepEqual(rasterVon('0 1 1 / 0 1 0'), [
			['0', '1', '1'],
			['0', '1', '0'],
		]);
		assert.equal(
			rasterText([
				['0', '1'],
				['1', '0'],
			]),
			'0 1 / 1 0',
		);
		assert.equal(rasterText([]), null);
	});
});

describe('setzeAbbildung', () => {
	const QUELLE = `<div class="aufgabe">
  <div class="reihe">
    <div class="zelle beispiel"><x-uhr zeit="4:30" groesse="88"></x-uhr></div>
    <div class="zelle"><x-uhr loesung="9:00"></x-uhr></div>
  </div>
</div>
`;
	const uhren = (q: string) => zerlege(q).knoten.filter((k) => k.tag === 'x-uhr');

	it('ändert nur das Attribut, die Nummern bleiben', () => {
		const nr = uhren(QUELLE)[0]?.nr ?? -1;
		const { nr: danach, quelle } = setzeAbbildung(QUELLE, nr, { zeit: '7:15' });
		assert.equal(danach, nr);
		assert.equal(quelle, QUELLE.replace('zeit="4:30"', 'zeit="7:15"'));
		assert.equal(zerlege(quelle).knoten.length, zerlege(QUELLE).knoten.length);
	});

	it('setzt mehrere neue Attribute und entfernt andere', () => {
		const nr = uhren(QUELLE)[1]?.nr ?? -1;
		const { quelle } = setzeAbbildung(QUELLE, nr, { loesung: null, zeit: '9:00', ziffern: 'nein', groesse: '120' });
		assert.match(quelle, /<x-uhr groesse="120" ziffern="nein" zeit="9:00"><\/x-uhr>/);
	});

	it('lehnt ungültige Werte und Nicht-Abbildungen ab', () => {
		const nr = uhren(QUELLE)[0]?.nr ?? -1;
		assert.throws(() => setzeAbbildung(QUELLE, nr, { zeit: '4:99' }), /Minuten 0 bis 59/);
		assert.throws(() => setzeAbbildung(QUELLE, 0, { zeit: '4:30' }), /keine Abbildung/);
	});
});

interface Form {
	zellen: number[][];
	polys: number[][][];
}

const flaecheVon = (p: number[][]) =>
	Math.abs(
		p.reduce((summe, [x = 0, y = 0], i) => {
			const [c = 0, d = 0] = p[(i + 1) % p.length] ?? [];
			return summe + x * d - c * y;
		}, 0),
	) / 2;

const kantenVon = (p: number[][]) =>
	p
		.map(([x = 0, y = 0], i) => {
			const [c = 0, d = 0] = p[(i + 1) % p.length] ?? [];
			return Math.round(Math.hypot(c - x, d - y) * 1000) / 1000;
		})
		.sort((a, b) => a - b);

const liegtIn = (x: number, y: number, p: number[][]) => {
	let drin = false;
	p.forEach(([a = 0, b = 0], i) => {
		const [c = 0, d = 0] = p[(i + 1) % p.length] ?? [];
		const [ober, unter] = [b > y, d > y];
		if (ober !== unter && x < a + ((y - b) * (c - a)) / (d - b)) {
			drin = !drin;
		}
	});
	return drin;
};

interface BeschriftLinie {
	wort: string;
	von: { x: number; y: number };
	bis: { x: number; y: number };
}

interface KreuzLage {
	nr: number;
	wort: string[];
	x: number;
	y: number;
	quer: boolean;
}

interface Stellenrechnung {
	ziffern: number[];
	uebertraege?: number[];
	neu?: (number | null)[];
	sprechweise?: string[];
	ergebnis: number;
}

/** Lädt `abbildungen.js` ohne Browser; nötig sind nur die Rechenkerne. */
const rechenkerne = () => {
	const fenster: Record<string, unknown> = {};
	const dokument = {
		readyState: 'complete',
		querySelectorAll: () => [],
		body: { classList: { contains: () => false } },
	};
	runInNewContext(JS, { window: fenster, document: dokument, Element: class {} });
	return fenster.schoolboxAbbildungen as {
		zahl: (n: number) => string;
		cm: (x: number) => number;
		zufall: (seed: number) => () => number;
		gemischt: <T>(feld: T[], zz: () => number) => T[];
		trenneListe: (text: string) => string[];
		trenneRaster: (text: string) => string[][];
		bildVon: (form: Form, abbildung: (x: number, y: number) => number[]) => Form;
		spiegelung: (achse: string, bei: number) => (x: number, y: number) => number[];
		skaliere: (form: Form, faktor: number) => Form;
		gehWeg: (start: number[], schritte: string[], spalten: number, zeilen: number) => number[][];
		flaecheUmfang: (form: Form) => { flaeche: number; umfang: number | null };
		TANGRAM_TEILE: Record<string, number[][]>;
		TANGRAM_UMRISSE: Record<string, Record<string, number[][]>>;
		ansichtenVon: (plan: number[][]) => { vorne: number[]; rechts: number[]; links: number[]; oben: number[][] };
		wuerfelVon: (plan: number[][]) => unknown[];
		verdeckteWuerfel: (plan: number[][], art?: string) => unknown[];
		WUERFELNETZE: Record<string, string>;
		NICHT_NETZE: Record<string, string>;
		netzZellen: (code: string) => { nr: number; c: number; r: number }[];
		falteNetz: (zellen: unknown[]) => { nr: number; rahmen: { n: number[] } }[];
		istWuerfelnetz: (zellen: unknown[]) => boolean;
		netzLaschen: (zellen: unknown[]) => { nr: number; seite: string }[];
		AUGEN_DER_SEITE: Record<string, number>;
		vielflach: (form: string, masse: number[]) => { punkte: unknown[]; kanten: unknown[]; flaechen: unknown[] };
		KOERPER_ZAHLEN: Record<string, { ecken: number; kanten: number; flaechen: number }>;
		tafelOrt: (von: number, zahl: number) => number[];
		ausschnittZahlen: (von: number, bis: number, art: string, mitte: number | null) => number[];
		rechenstrichWerte: (start: number, spruenge: number[]) => number[];
		leseSprung: (text: string) => number;
		mauerWerte: (basis: number[], art?: string) => number[][];
		mauerEindeutig: (stufen: number, offen: string[], art?: string) => boolean;
		istEindeutig: (gleichungen: Record<string, number>[], offen: string[]) => boolean;
		RECHENDREIECK_GLEICHUNGEN: Record<string, number>[];
		zauberLoesungen: (art: string, zahlen: number[], summe: number | null) => Record<string, number>[];
		ketteWerte: (start: number, ops: unknown[]) => number[];
		leseOperator: (text: string) => unknown;
		malkreuzRechnung: (a: number, b: number) => { produkte: number[][]; summen: number[]; ergebnis: number };
		addiere: (zahlen: number[]) => Stellenrechnung;
		subtrahiereErweitern: (a: number, b: number, verfahren: string) => Stellenrechnung;
		subtrahiereEntbuendeln: (a: number, b: number, verfahren: string) => Stellenrechnung;
		multipliziere: (
			a: number,
			b: number,
		) => {
			teile: { faktor: number; verschoben: number; uebertraege: number[]; wert: number }[];
			summe: Stellenrechnung | null;
			ergebnis: number;
		};
		dividiere: (
			a: number,
			b: number,
		) => {
			schritte: { ende: number; teil: number; q: number; produkt: number; rest: number }[];
			quotient: number;
			rest: number;
		};
		moeglicheFehler: (art: string, zahlen: number[], verfahren: string | null) => { art: string }[];
		ANDIKA_X_HOEHE: number;
		lineaturMass: (
			art: string,
			band: number | null,
		) => { band: number; oben: number; unten: number; abstand: number; hoehe: number; schrift: number };
		silbenTeile: (text: string) => { silben?: string[]; text?: string }[];
		pruefeSilben: (text: string) => void;
		lueckenLesen: (roh: string) => { text?: string; wort?: string; beispiel?: boolean }[];
		lueckeFehler: (teile: unknown[]) => string | null;
		wortspeicherFehler: (woerter: string[], luecken: string[]) => string | null;
		ankreuzenLesen: (roh: string) => { frage: string; optionen: { text: string; richtig: boolean }[] }[];
		ankreuzenFehler: (fragen: unknown[], mehrfach: boolean) => string | null;
		aussagenLesen: (roh: string) => { text: string; wert: string }[];
		aussagenFehler: (aussagen: unknown[]) => string | null;
		rechenreiheEinstellungen: (lies: (name: string, standard: string | null) => string | null) => unknown;
		rechenreiheAufgaben: (e: unknown, seed: string) => { aufgaben: string[]; fehler: string | null };
		punkteAus: (text: string) => number;
		notenGrenzen: (roh: string) => number[] | null;
		notenZeilen: (gesamt: number, grenzen: number[]) => { note: number; von: number; bis: number }[];
		NOTEN_VORSCHLAG: string;
		rechnungLesen: (text: string) => { teile?: string[]; loesung?: string; fehler: string | null };
		mitUebergang: (zeichen: string, a: number, b: number) => boolean;
		neueZahlen: (tag: string, werte: Record<string, string>, seed: string) => Record<string, string> | null;
		NEUE_ZAHLEN: string[];
		zuordnenLesen: (roh: string) => { links: string; rechts: string; bildLinks: string; bildRechts: string }[];
		zuordnenFehler: (paare: unknown[]) => string | null;
		zuordnenFolge: (n: number, seed: string) => number[];
		zuordnenKreuzungen: (folge: number[]) => number;
		sortierenLesen: (roh: string) => { text: string; bild: string }[];
		sortierenFehler: (eintraege: unknown[]) => string | null;
		sortierenFolge: (n: number, seed: string) => number[];
		punkteLesen: (roh: string) => { x: number; y: number; wort: string }[];
		punkteFehler: (punkte: unknown[]) => string | null;
		beschriftenPlan: (punkte: unknown[]) => {
			links: BeschriftLinie[];
			rechts: BeschriftLinie[];
			kreuzen: (a: BeschriftLinie, b: BeschriftLinie) => boolean;
		};
		WORTARTEN: Record<string, { name: string; symbol: string; voll: boolean; linie: string }>;
		ROLLEN: Record<string, { name: string; frage: string }>;
		wortartenTeile: (text: string) => { wort?: string; marke?: string | null; text?: string }[];
		satzLesen: (text: string) => { glieder: { text: string; rolle: string | null }[]; zeichen: string };
		satzUmstellen: (
			text: string,
			vorn?: string | null,
		) => { glieder: { text: string; rolle: string | null }[]; zeichen: string };
		pruefeBausteine: (wort: string, stamm: string | null) => string[];
		zeitPos: (jahr: number) => number;
		jahrText: (jahr: number) => string;
		MUENZEN: Record<string, { mm: number; wert: number }>;
		SCHEINE: Record<string, { b: number; h: number; wert: number }>;
		betragText: (cent: number, klasse: number) => string;
		mindestStueckelung: (cent: number, vorrat?: string[]) => string[] | null;
		skalaStriche: (
			von: number,
			bis: number,
			haupt: number,
			klein: number,
		) => { wert: number; gross: boolean; anteil: number }[];
		kalenderMonat: (jahr: number, monat: number) => { tage: number; start: number };
		isoWoche: (jahr: number, monat: number, tag: number) => number;
		zeitStationen: (von: number, bis: number, spruenge: string | null) => number[];
		dauerText: (minuten: number) => string;
		stromTeile: (woerter: string[]) => { art: string; zustand: string | null }[];
		stromkreis: (
			teile: { art: string; zustand: string | null }[],
			zweig?: { art: string; zustand: string | null }[],
		) => { ergebnis: string; laufen: { art: string }[] };
		VERKEHRSZEICHEN: Record<string, string>;
		leseTakte: (
			text: string,
			takt: string,
			mitTon: boolean,
			auftakt?: boolean,
		) => { stufe: number | null; wert: number; pause: boolean; achtel: number }[][];
		halsNachOben: (stufe: number) => boolean;
		suchselBau: (
			woerter: string[][],
			spalten: number,
			zeilen: number,
			richtungen: string[],
			seed: string,
			gross?: boolean,
		) => { gitter: string[][]; lagen: { wort: string; dx: number; dy: number }[] } | null;
		suchselZaehle: (gitter: string[][], wort: string[]) => number;
		suchselStandard: (klasse: number) => string[];
		raetselWort: (wort: string, gross: boolean) => string[];
		kreuzBau: (
			woerter: string[][],
			seed: string,
			maxSpalten?: number,
			maxZeilen?: number,
		) => { lagen: KreuzLage[]; spalten: number; zeilen: number } | null;
		kreuzGueltig: (lagen: KreuzLage[]) => boolean;
		loesungswortFehler: (
			buchstaben: string[],
			antworten: string[],
			legende: Map<string, string>,
			bezug: string,
		) => string | null;
		bingoKarten: (eintraege: string[], felder: number, karten: number, seed: string) => number[][] | null;
		dominoSteine: (paare: string[][], kette: string) => { nr: number; links: string; rechts: string }[];
		dominoFehler: (paare: string[][]) => string | null;
		spielplanRaster: (form: string, felder: number, b: number, h: number) => [number, number];
		spielplanWeg: (form: string, felder: number, c: number, r: number) => number[][];
		teilePaar: (t: string) => string[];
		balkenGruppen: (noten: { wert: number; pause: boolean; achtel: number }[], vorn?: number) => number[][];
		gruppeNachOben: (stufen: number[]) => boolean;
		silbeStandard: (n: { wert: number; pause: boolean; punkt: boolean }) => string;
		rechnungsplan: (
			art: string,
			zahlen: number[],
			verfahren: string | null,
			fehler: unknown,
			mitUebertrag: boolean,
		) => { text: string | number; zeilen: { zellen: { c: number; t: string; rolle: string }[] }[] };
	};
};

describe('Rechenkerne in abbildungen.js', () => {
	it('schreibt Zahlen mit Komma und schmalem Leerzeichen ab fünf Stellen', () => {
		const { zahl } = rechenkerne();
		assert.equal(zahl(1000), '1000');
		assert.equal(zahl(12_500), '12\u202F500');
		assert.equal(zahl(2.5), '2,5');
		assert.equal(zahl(-3), '−3');
	});

	it('mischt mit gleichem Seed gleich, mit anderem anders', () => {
		const { gemischt, zufall } = rechenkerne();
		const zahlen = Array.from({ length: 20 }, (_, i) => i);
		assert.deepEqual([...gemischt(zahlen, zufall(7))], [...gemischt(zahlen, zufall(7))]);
		assert.notDeepEqual([...gemischt(zahlen, zufall(7))], [...gemischt(zahlen, zufall(8))]);
		assert.deepEqual(
			[...gemischt(zahlen, zufall(7))].sort((a, b) => a - b),
			zahlen,
		);
	});

	it('trennt Listen und Raster wie das Schema', () => {
		const { trenneListe, trenneRaster } = rechenkerne();
		assert.deepEqual([...trenneListe('a b c')], ['a', 'b', 'c']);
		assert.deepEqual([...trenneListe('a b; c')], ['a b', 'c']);
		assert.deepEqual(
			Array.from(trenneRaster('0 1 / 1 0'), (z) => [...z]),
			[
				['0', '1'],
				['1', '0'],
			],
		);
	});
});

describe('Daten und Zufall (024)', () => {
	it('prüft die Regeln über mehrere Felder', () => {
		assert.match(pruefe('x-gluecksrad', { felder: 'rot; blau', anteile: '0 0' }).anteile ?? '', /mehr als 0/);
		assert.match(pruefe('x-gluecksrad', { felder: 'rot; blau', anteile: '1 1 2' }).anteile ?? '', /genau 2 Zahlen/);
		assert.match(pruefe('x-diagramm', { werte: 'A: 12', bis: '10' }).bis ?? '', /größer als 10/);
		assert.match(pruefe('x-urne', { kugeln: 'rot: 15; blau: 6' }).kugeln ?? '', /21/);
		assert.match(
			pruefe('x-wahrscheinlichkeit', { ereignisse: 'A: sehr wahrscheinlich' }).ereignisse ?? '',
			/nicht auf/,
		);
		assert.deepEqual(pruefe('x-wahrscheinlichkeit', { stufen: '5', ereignisse: 'A: sehr wahrscheinlich' }), {});
	});

	it('hält die Regel fürs Lösungsblatt mit blatt.py gleich', () => {
		const blatt = readFileSync(BLATT_PY, 'utf8');
		assert.ok(blatt.includes(`OHNE_LOESUNGSANGABE = r"${OHNE_LOESUNGSANGABE}"`));
		assert.ok(blatt.includes(`MIT_LOESUNG = r"${MIT_LOESUNG}"`));
		assert.equal(hatLoesung('<x-gluecksrad felder="rot; blau"></x-gluecksrad>'), false);
		assert.equal(hatLoesung('<x-diagramm werte="A: 1"></x-diagramm>'), false);
		assert.equal(hatLoesung('<x-diagramm werte="A: 1" offen="1"></x-diagramm>'), true);
		assert.equal(hatLoesung('<x-strichliste werte="A: 1"></x-strichliste>'), true);
	});
});

describe('Ebene Geometrie (025)', () => {
	const zuListe = (w: number[][]) => Array.from(w, (z) => Array.from(z).join(',')).sort();
	const leer: number[][][] = [];

	it('spiegelt Kästchen und Linien genau', () => {
		const { bildVon, spiegelung } = rechenkerne();
		const b = bildVon(
			{
				zellen: [
					[3, 1],
					[4, 2],
				],
				polys: [
					[
						[0, 0],
						[3, 0],
						[3, 2],
					],
				],
			},
			spiegelung('senkrecht', 6),
		);
		assert.deepEqual(zuListe(b.zellen), ['7,2', '8,1']);
		assert.deepEqual(
			Array.from(b.polys[0] ?? [], (p) => Array.from(p).join(',')),
			['12,0', '9,0', '9,2'],
		);
		const w = bildVon({ zellen: [[3, 1]], polys: leer }, spiegelung('waagerecht', 4));
		assert.deepEqual(zuListe(w.zellen), ['3,6']);
	});

	it('vergrößert und verkleinert', () => {
		const { skaliere } = rechenkerne();
		assert.deepEqual(zuListe(skaliere({ zellen: [[2, 1]], polys: leer }, 2).zellen), ['0,0', '0,1', '1,0', '1,1']);
		const voll = [
			[2, 2],
			[3, 2],
			[2, 3],
			[3, 3],
		];
		assert.deepEqual(zuListe(skaliere({ zellen: voll, polys: leer }, 0.5).zellen), ['0,0']);
		assert.throws(() => skaliere({ zellen: [[2, 2]], polys: leer }, 0.5), /nicht halbieren/);
	});

	it('geht den Weg und lehnt das Verlassen ab', () => {
		const { gehWeg } = rechenkerne();
		const orte = gehWeg([1, 4], ['3→', '2↑', '1←'], 10, 6);
		assert.deepEqual(Array.from(orte.at(-1) ?? []), [3, 2]);
		assert.throws(() => gehWeg([1, 1], ['2↑'], 10, 6), /verlässt das Gitter/);
	});

	it('rechnet Fläche und Umfang', () => {
		const { flaecheUmfang } = rechenkerne();
		assert.deepEqual(
			{
				...flaecheUmfang({
					zellen: [
						[0, 0],
						[1, 0],
					],
					polys: leer,
				}),
			},
			{ flaeche: 2, umfang: 6 },
		);
		const schraeg = flaecheUmfang({
			zellen: [],
			polys: [
				[
					[1, 1],
					[5, 1],
					[3, 3],
				],
			],
		});
		assert.equal(schraeg.flaeche, 4);
		assert.equal(schraeg.umfang, null);
	});

	it('Tangram: Die sieben Teile ergeben das Quadrat, jeder Umriss ist eine gültige Lage', () => {
		const { TANGRAM_TEILE, TANGRAM_UMRISSE } = rechenkerne();
		const teile = Object.entries(TANGRAM_TEILE);
		assert.equal(teile.length, 7);
		assert.equal(
			teile.reduce((a, [, p]) => a + flaecheVon(p), 0),
			16,
		);
		const pruefeLage = (name: string, lage: Record<string, number[][]>) => {
			for (const [teil, p] of teile) {
				const q = lage[teil];
				assert.ok(q, `${name}: ${teil}`);
				assert.equal(q.length, p.length, `${name}: ${teil}`);
				assert.deepEqual(kantenVon(q), kantenVon(p), `${name}: ${teil} ist deckungsgleich`);
			}
			const alle = Object.values(lage);
			const xs = alle.flat().map((v) => v[0] ?? 0);
			const ys = alle.flat().map((v) => v[1] ?? 0);
			for (let x = Math.min(...xs) + 0.07; x < Math.max(...xs); x += 0.13) {
				for (let y = Math.min(...ys) + 0.11; y < Math.max(...ys); y += 0.13) {
					assert.ok(
						alle.filter((p) => liegtIn(x, y, p)).length <= 1,
						`${name}: Teile überlappen bei ${x},${y}`,
					);
				}
			}
		};
		pruefeLage('Quadrat', TANGRAM_TEILE);
		assert.ok(Object.keys(TANGRAM_UMRISSE).length >= 5);
		for (const [name, lage] of Object.entries(TANGRAM_UMRISSE)) {
			pruefeLage(name, lage);
		}
	});
});

describe('Räumliche Geometrie (026)', () => {
	const netto = <T>(wert: T): T => JSON.parse(JSON.stringify(wert)) as T;

	it('Ansichten passen zu Bauplänen, die von Hand gerechnet sind', () => {
		const { ansichtenVon, wuerfelVon } = rechenkerne();
		const faelle = [
			{
				plan: [
					[2, 1],
					[3, 1],
				],
				anzahl: 7,
				vorne: [3, 1],
				rechts: [3, 2],
				links: [2, 3],
				oben: [
					[1, 1],
					[1, 1],
				],
			},
			{
				plan: [
					[3, 0, 1],
					[2, 1, 1],
				],
				anzahl: 8,
				vorne: [3, 1, 1],
				rechts: [2, 3],
				links: [3, 2],
				oben: [
					[1, 0, 1],
					[1, 1, 1],
				],
			},
			{
				plan: [[0], [4], [1]],
				anzahl: 5,
				vorne: [4],
				rechts: [1, 4, 0],
				links: [0, 4, 1],
				oben: [[0], [1], [1]],
			},
		];
		for (const { anzahl, links, oben, plan, rechts, vorne } of faelle) {
			assert.deepEqual(netto(ansichtenVon(plan)), { vorne, rechts, links, oben });
			assert.equal(wuerfelVon(plan).length, anzahl);
		}
	});

	it('findet verdeckte Würfel', () => {
		const { verdeckteWuerfel } = rechenkerne();
		const voll = [
			[2, 2],
			[2, 2],
		];
		assert.equal(verdeckteWuerfel(voll).length, 1);
		assert.equal(verdeckteWuerfel(voll, 'iso').length, 1);
		assert.equal(
			verdeckteWuerfel([
				[1, 2],
				[1, 3],
			]).length,
			0,
		);
	});

	it('Alle 11 Netze falten sich zum Würfel mit 7 Laschen, Nicht-Netze scheitern', () => {
		const { AUGEN_DER_SEITE, NICHT_NETZE, WUERFELNETZE, falteNetz, istWuerfelnetz, netzLaschen, netzZellen } =
			rechenkerne();
		assert.equal(Object.keys(WUERFELNETZE).length, 11);
		for (const code of Object.keys(WUERFELNETZE)) {
			const zellen = netzZellen(code);
			assert.equal(zellen.length, 6, code);
			assert.ok(istWuerfelnetz(zellen), code);
			assert.equal(netzLaschen(zellen).length, 7, code);
			const augen = Object.fromEntries(
				falteNetz(zellen).map((z) => [z.rahmen.n.join(), AUGEN_DER_SEITE[z.rahmen.n.join()]]),
			);
			for (const [seite, zahl] of Object.entries(augen)) {
				const gegen = seite
					.split(',')
					.map((a) => -Number(a) || 0)
					.join();
				assert.equal((zahl ?? 0) + (augen[gegen] ?? 0), 7, code);
			}
		}
		assert.equal(Object.keys(NICHT_NETZE).length, 8);
		for (const code of Object.keys(NICHT_NETZE)) {
			const zellen = netzZellen(code);
			assert.equal(zellen.length, 6, code);
			assert.ok(!istWuerfelnetz(zellen), code);
		}
	});

	it('Körper haben die richtigen Zahlen', () => {
		const { KOERPER_ZAHLEN, vielflach } = rechenkerne();
		for (const form of ['wuerfel', 'quader', 'pyramide', 'prisma']) {
			const { flaechen, kanten, punkte } = vielflach(form, [3, 2, 2]);
			assert.deepEqual(
				{ ecken: punkte.length, kanten: kanten.length, flaechen: flaechen.length },
				netto(KOERPER_ZAHLEN[form]),
				form,
			);
		}
	});
});

describe('Zahldarstellungen (027)', () => {
	it('Hundertertafel: Ausschnitte stehen an der richtigen Stelle', () => {
		const { ausschnittZahlen, tafelOrt } = rechenkerne();
		assert.deepEqual([...ausschnittZahlen(1, 100, 'kreuz', 45)], [35, 44, 45, 46, 55]);
		assert.deepEqual([...tafelOrt(1, 45)], [4, 4]);
		assert.deepEqual([...tafelOrt(1, 35)], [4, 3]);
		assert.deepEqual([...tafelOrt(301, 345)], [4, 4]);
		assert.deepEqual([...ausschnittZahlen(301, 400, 'kreuz', 345)], [335, 344, 345, 346, 355]);
		assert.deepEqual([...ausschnittZahlen(1, 100, 'zeile', 45)], [41, 42, 43, 44, 45, 46, 47, 48, 49, 50]);
		assert.equal(ausschnittZahlen(1, 100, 'spalte', 45).length, 10);
		assert.deepEqual([...ausschnittZahlen(1, 100, 'treppe', 23)], [23, 24, 34, 35, 45, 46]);
		assert.throws(() => ausschnittZahlen(1, 100, 'kreuz', 41), /am Rand/);
		assert.throws(() => ausschnittZahlen(1, 100, 'kreuz', 5), /steht nicht auf dieser Tafel/);
		assert.throws(() => ausschnittZahlen(1, 100, 'kreuz', null), /fehlt die Mittelzahl/);
	});

	it('Hundertertafel: der Ausschnitt im Schema rechnet wie abbildungen.js', () => {
		const { ausschnittZahlen } = rechenkerne();
		for (const [von, bis] of [
			[1, 100],
			[301, 400],
			[1, 20],
		] as const) {
			for (const art of ['zeile', 'spalte', 'kreuz', 'block', 'treppe']) {
				for (let mitte = von; mitte <= bis; mitte += 1) {
					let erwartet: number[] | null = null;
					try {
						erwartet = [...ausschnittZahlen(von, bis, art, mitte)];
					} catch {
						erwartet = null;
					}
					assert.deepEqual(
						tafelAusschnitt(von, bis, art, mitte),
						erwartet,
						`${art} ${mitte} (${von}-${bis})`,
					);
				}
			}
		}
	});

	it('Rechenstrich rechnet und liest Sprünge', () => {
		const { leseSprung, rechenstrichWerte } = rechenkerne();
		assert.deepEqual([...rechenstrichWerte(47, [30, 4])], [47, 77, 81]);
		assert.equal(leseSprung('+30'), 30);
		assert.equal(leseSprung('−4'), -4);
		assert.equal(leseSprung('-4'), -4);
		assert.throws(() => leseSprung('30'), /kein Sprung/);
	});
});

describe('Rechenformate (028)', () => {
	it('Zahlenmauer rechnet und prüft die Eindeutigkeit', () => {
		const { mauerEindeutig, mauerWerte } = rechenkerne();
		const reihen = Array.from(mauerWerte([3, 5, 2]), (r) => [...r]);
		assert.deepEqual(reihen, [[3, 5, 2], [8, 7], [15]]);
		assert.ok(mauerEindeutig(3, ['1-0', '1-1', '2-0']));
		assert.ok(!mauerEindeutig(3, ['0-0', '0-1', '0-2', '1-0', '1-1']));
		assert.ok(mauerEindeutig(3, ['0-1', '1-0', '2-0']));
		assert.deepEqual([...(mauerWerte([20, 7, 3], 'minus').at(-1) ?? [])], [9]);
	});

	it('Rechendreieck: Außenzahlen allein reichen, Mischungen nicht immer', () => {
		const { RECHENDREIECK_GLEICHUNGEN, istEindeutig } = rechenkerne();
		assert.ok(istEindeutig(RECHENDREIECK_GLEICHUNGEN, ['i0', 'i1', 'i2']));
		assert.ok(istEindeutig(RECHENDREIECK_GLEICHUNGEN, ['a0', 'a1', 'a2']));
		assert.ok(istEindeutig(RECHENDREIECK_GLEICHUNGEN, ['i0', 'i1', 'a0']));
		assert.ok(!istEindeutig(RECHENDREIECK_GLEICHUNGEN, ['i0', 'i1', 'i2', 'a0']));
	});

	it('Zauberdreieck und magisches Quadrat', () => {
		const { zauberLoesungen } = rechenkerne();
		assert.equal(zauberLoesungen('quadrat', [1, 2, 3, 4, 5, 6, 7, 8, 9], 15).length, 8);
		for (const summe of [9, 10, 11, 12]) {
			const alle = zauberLoesungen('dreieck', [1, 2, 3, 4, 5, 6], summe);
			assert.equal(alle.length, 6, String(summe));
			for (const l of alle) {
				const s = (a: string, b: string, c: string) => (l[a] ?? 0) + (l[b] ?? 0) + (l[c] ?? 0);
				assert.equal(s('e0', 's0', 'e1'), summe);
				assert.equal(s('e1', 's1', 'e2'), summe);
				assert.equal(s('e2', 's2', 'e0'), summe);
			}
		}
		assert.equal(zauberLoesungen('dreieck', [1, 2, 3, 4, 5, 6], null).length, 24);
		assert.equal(zauberLoesungen('dreieck', [1, 2, 3, 4, 5, 6], 13).length, 0);
	});

	it('Rechenschritte', () => {
		const { ketteWerte, leseOperator } = rechenkerne();
		assert.deepEqual([...ketteWerte(8, ['+5', '−3', '·2'].map(leseOperator))], [8, 13, 10, 20]);
		assert.throws(() => ketteWerte(9, [leseOperator(':4')]), /ohne Rest/);
		assert.throws(() => leseOperator('5'), /kein Rechenschritt/);
	});
});

describe('Einmaleins und schriftliches Rechnen (029)', () => {
	const stellen = (n: number) => [...String(n)].reverse().map(Number);
	const liste = <T>(x: readonly T[] | undefined) => Array.from(x ?? []);
	const zufaellig = (seed: number) => {
		const zz = rechenkerne().zufall(seed);
		return (bis: number) => Math.floor(zz() * bis);
	};

	it('Malkreuz zerlegt nach Stellenwerten', () => {
		const { malkreuzRechnung } = rechenkerne();
		const r = malkreuzRechnung(23, 45);
		assert.deepEqual(
			Array.from(r.produkte, (z) => [...z]),
			[
				[800, 120],
				[100, 15],
			],
		);
		assert.deepEqual([...r.summen], [920, 115]);
		assert.equal(r.ergebnis, 1035);
		assert.equal(malkreuzRechnung(30, 6).produkte.length, 1);
	});

	it('903 − 478 wie im Schulbuch: Entbündeln oben, Erweitern unter dem Subtrahenden', () => {
		const { subtrahiereEntbuendeln, subtrahiereErweitern } = rechenkerne();
		const bund = subtrahiereEntbuendeln(903, 478, 'abziehen');
		assert.deepEqual(liste(bund.neu), [13, 9, 8]);
		assert.deepEqual(liste(bund.ziffern), [5, 2, 4]);
		assert.deepEqual(liste(bund.sprechweise), ['13 − 8 = 5', '9 − 7 = 2', '8 − 4 = 4']);
		const ergaenzen = subtrahiereErweitern(903, 478, 'ergaenzen');
		assert.deepEqual(liste(ergaenzen.uebertraege), [0, 1, 1]);
		assert.deepEqual(liste(ergaenzen.ziffern), [5, 2, 4]);
		assert.deepEqual(liste(ergaenzen.sprechweise), ['8 + 5 = 13, 1 gemerkt', '8 + 2 = 10, 1 gemerkt', '5 + 4 = 9']);
		assert.equal(subtrahiereErweitern(903, 478, 'abziehen').sprechweise?.[0], '13 − 8 = 5, 1 gemerkt');
	});

	it('Hand-Beispiele für Plus, Mal und Geteilt', () => {
		const { addiere, dividiere, multipliziere } = rechenkerne();
		assert.deepEqual(liste(addiere([345, 278, 96]).uebertraege), [0, 1, 2]);
		const mal = multipliziere(345, 23);
		assert.deepEqual(
			Array.from(mal.teile, (t) => t.wert),
			[6900, 1035],
		);
		assert.deepEqual(liste(mal.teile[1]?.uebertraege), [0, 1, 1, 1]);
		const geteilt = dividiere(957, 4);
		assert.deepEqual(
			Array.from(geteilt.schritte, (x) => [x.teil, x.q, x.produkt, x.rest]),
			[
				[9, 2, 8, 1],
				[15, 3, 12, 3],
				[37, 9, 36, 1],
			],
		);
		assert.equal(dividiere(4081, 4).quotient, 1020);
		assert.equal(dividiere(3, 4).quotient, 0);
		assert.equal(dividiere(3, 4).rest, 3);
	});

	it('1000 zufällige Aufgaben je Verfahren stimmen mit der Rechnung überein', () => {
		const { addiere, dividiere, multipliziere, subtrahiereEntbuendeln, subtrahiereErweitern } = rechenkerne();
		const zz = zufaellig(29);
		for (let i = 0; i < 1000; i++) {
			const zahlen = Array.from({ length: 2 + zz(3) }, () => zz(300_000));
			const summe = addiere(zahlen);
			assert.equal(
				summe.ergebnis,
				zahlen.reduce((x, y) => x + y, 0),
			);
			liste(summe.ziffern).forEach((z, stelle) => {
				const spalte = zahlen.reduce((t, n) => t + (stellen(n)[stelle] ?? 0), summe.uebertraege?.[stelle] ?? 0);
				assert.equal(spalte % 10, z);
				assert.equal(Math.floor(spalte / 10), summe.uebertraege?.[stelle + 1] ?? 0);
			});

			const [x, y] = [zz(1_000_000), zz(1_000_000)];
			const [a, b] = [Math.max(x, y), Math.min(x, y)];
			const erweitern = subtrahiereErweitern(a, b, 'ergaenzen');
			assert.equal(erweitern.ergebnis, a - b);
			const entbuendeln = subtrahiereEntbuendeln(a, b, 'abziehen');
			assert.equal(entbuendeln.ergebnis, a - b);
			stellen(a).forEach((o, stelle) => {
				const unten = (stellen(b)[stelle] ?? 0) + (erweitern.uebertraege?.[stelle] ?? 0);
				const z = stellen(a - b)[stelle] ?? 0;
				assert.equal((unten + z) % 10, o);
				assert.equal(unten + z >= 10 ? 1 : 0, erweitern.uebertraege?.[stelle + 1] ?? 0);
				assert.equal((entbuendeln.neu?.[stelle] ?? o) - (stellen(b)[stelle] ?? 0), z);
			});

			const [m, n] = [zz(10_000), zz(1000)];
			const mal = multipliziere(m, n);
			assert.equal(mal.ergebnis, m * n);
			mal.teile.forEach((t) => {
				assert.equal(t.wert, m * t.faktor * 10 ** t.verschoben);
			});

			const [p, q] = [zz(1_000_000), 2 + zz(8)];
			const geteilt = dividiere(p, q);
			assert.equal(geteilt.quotient, Math.floor(p / q));
			assert.equal(geteilt.rest, p % q);
			geteilt.schritte.forEach((schritt) => {
				assert.equal(schritt.produkt, schritt.q * q);
				assert.equal(schritt.rest, schritt.teil - schritt.produkt);
				assert.ok(schritt.q < 10 && schritt.rest < q);
			});
		}
	});

	it('Jeder eingebaute Fehler verfälscht das Ergebnis', () => {
		const { moeglicheFehler, rechnungsplan } = rechenkerne();
		const zz = zufaellig(7);
		const verfahren = ['abziehen-entbuendeln', 'ergaenzen-erweitern'];
		for (let i = 0; i < 300; i++) {
			const [x, y] = [zz(100_000), zz(100_000)];
			const aufgaben: [string, number[]][] = [
				['plus', [x, y]],
				['minus', [Math.max(x, y), Math.min(x, y)]],
				['mal', [zz(1000), zz(100)]],
				['geteilt', [x, 2 + zz(8)]],
			];
			for (const [art, zahlen] of aufgaben) {
				const v = verfahren[i % 2] ?? null;
				const richtig = rechnungsplan(art, zahlen, v, null, true).text;
				for (const fehler of moeglicheFehler(art, zahlen, v)) {
					const falsch = rechnungsplan(art, zahlen, v, fehler, true).text;
					assert.notEqual(
						String(falsch),
						String(richtig),
						`${art} ${zahlen.join(' ')} ${JSON.stringify(fehler)}`,
					);
				}
			}
		}
	});

	it('Das Raster hat eine Ziffer je Kästchen, Stellen stehen untereinander', () => {
		const { rechnungsplan } = rechenkerne();
		const plan = rechnungsplan('minus', [903, 478], 'ergaenzen-erweitern', null, true);
		const zeile = (nr: number) => Array.from(plan.zeilen[nr]?.zellen ?? [], (z) => `${z.c}:${z.t}`);
		assert.deepEqual(zeile(0), ['3:3', '2:0', '1:9']);
		assert.deepEqual(zeile(1), ['3:8', '2:7', '1:4', '0:−']);
		assert.deepEqual(zeile(2), ['2:1', '1:1']);
		assert.deepEqual(zeile(3), ['3:5', '2:2', '1:4']);
		const karte = rechnungsplan('mal', [345, 23], null, null, false);
		for (const z of karte.zeilen) {
			assert.ok(z.zellen.every((c) => c.t.length === 1));
		}
	});
});

describe('Größen (030)', () => {
	it('Münzen haben die echten Verhältnisse', () => {
		const { MUENZEN } = rechenkerne();
		assert.ok((MUENZEN['10ct']?.mm ?? 0) < (MUENZEN['5ct']?.mm ?? 0));
		assert.equal(MUENZEN['2€']?.mm, 25.75);
		assert.equal(MUENZEN['1ct']?.mm, 16.25);
	});

	it('Beträge: bis Klasse 2 mit Einheiten, ab Klasse 3 mit Komma', () => {
		const { betragText } = rechenkerne();
		assert.equal(betragText(345, 2), '3 € 45 ct');
		assert.equal(betragText(345, 3), '3,45 €');
		assert.equal(betragText(45, 1), '45 ct');
		assert.equal(betragText(300, 2), '3 €');
		assert.equal(betragText(5, 4), '0,05 €');
	});

	it('Wenigste Stücke gegen Hand-Beispiele', () => {
		const { mindestStueckelung } = rechenkerne();
		assert.deepEqual([...(mindestStueckelung(345) ?? [])], ['2€', '1€', '20ct', '20ct', '5ct']);
		assert.deepEqual([...(mindestStueckelung(880) ?? [])], ['5€', '2€', '1€', '50ct', '20ct', '10ct']);
		assert.deepEqual([...(mindestStueckelung(40, ['20ct', '20ct', '10ct']) ?? [])], ['20ct', '20ct']);
		assert.deepEqual(
			[...(mindestStueckelung(60, ['50ct', '20ct', '20ct', '20ct']) ?? [])],
			['20ct', '20ct', '20ct'],
		);
		assert.equal(mindestStueckelung(30, ['20ct', '20ct']), null);
		// Das Beispiel im Feld geht mit den Stücken des Starters.
		assert.equal(
			(mindestStueckelung(385, ['1ct', '2ct', '5ct', '10ct', '20ct', '50ct', '1€', '2€']) ?? []).length,
			6,
		);
	});

	it('Skala: gleiche Abstände, auch bei Kommateilung', () => {
		const { skalaStriche } = rechenkerne();
		const striche = Array.from(skalaStriche(0, 2, 1, 0.1));
		assert.equal(striche.length, 21);
		assert.equal(striche[3]?.wert, 0.3);
		assert.deepEqual(
			striche.filter((s) => s.gross).map((s) => s.wert),
			[0, 1, 2],
		);
		striche.forEach((s, i) => {
			assert.ok(Math.abs(s.anteil - i / 20) < 1e-9);
		});
		const kalt = Array.from(skalaStriche(-20, 40, 10, 2));
		assert.deepEqual(
			kalt.filter((s) => s.gross).map((s) => s.wert),
			[-20, -10, 0, 10, 20, 30, 40],
		);
		assert.throws(() => skalaStriche(0, 10, 5, 3), /passen nicht/);
	});

	it('Kalender stimmt für viele Monate mit Date überein', () => {
		const { isoWoche, kalenderMonat } = rechenkerne();
		const februar = kalenderMonat(2028, 2);
		assert.equal(februar.tage, 29);
		assert.equal(februar.start, 1);
		for (let i = 0; i < 2400; i++) {
			const jahr = 1900 + Math.floor(i / 12);
			const monat = (i % 12) + 1;
			const { start, tage } = kalenderMonat(jahr, monat);
			assert.equal(tage, new Date(Date.UTC(jahr, monat, 0)).getUTCDate());
			assert.equal(start, (new Date(Date.UTC(jahr, monat - 1, 1)).getUTCDay() + 6) % 7);
		}
		assert.equal(isoWoche(2028, 1, 1), 52);
		assert.equal(isoWoche(2026, 1, 1), 1);
		assert.equal(isoWoche(2026, 12, 31), 53);
		assert.equal(isoWoche(2028, 2, 14), 7);
	});

	it('Zeitspanne: zur vollen Stunde, dann weiter', () => {
		const { dauerText, zeitStationen } = rechenkerne();
		assert.deepEqual([...zeitStationen(500, 585, null)], [500, 540, 585]);
		assert.deepEqual([...zeitStationen(500, 705, null)], [500, 540, 660, 705]);
		assert.deepEqual([...zeitStationen(540, 660, null)], [540, 660]);
		assert.deepEqual([...zeitStationen(500, 580, 'bis 9:00, +40 min')], [500, 540, 580]);
		assert.throws(() => zeitStationen(500, 590, 'bis 9:00, +40 min'), /enden bei 9:40, nicht bei 9:50.*„bis 9:50“/);
		const beispiel = schema('x-zeitspanne').felder.find((f) => f.attribut === 'spruenge');
		assert.ok(beispiel?.art === 'text' && beispiel.beispiel);
		assert.deepEqual([...zeitStationen(500, 585, beispiel.beispiel)], [500, 540, 570, 585]);
		assert.equal(dauerText(85), '1 h 25 min');
		assert.equal(dauerText(60), '1 h');
		assert.equal(dauerText(5), '5 min');
	});
});

describe('Lineatur und Silben (031)', () => {
	it('Lineatur: Maße je Art, Schrift aus dem Mittelband', () => {
		const { ANDIKA_X_HOEHE, lineaturMass } = rechenkerne();
		const zwei = lineaturMass('2', null);
		assert.deepEqual([zwei.oben, zwei.band, zwei.unten], [4, 4, 4]);
		assert.equal(zwei.schrift * ANDIKA_X_HOEHE, 4);
		assert.equal(lineaturMass('1', null).band, 5);
		assert.equal(lineaturMass('3', null).band, 3.5);
		assert.equal(lineaturMass('3', null).oben, 0);
		assert.equal(lineaturMass('4', null).band, 0);
		const eigen = lineaturMass('1', 6);
		assert.deepEqual([eigen.oben, eigen.band, eigen.unten], [6, 6, 6]);
	});

	it('Silben: Wörter, Satzzeichen und Grenzen', () => {
		const { pruefeSilben, silbenTeile } = rechenkerne();
		const teile = Array.from(silbenTeile('Die Ro|si|ne, süß.'), (t) => (t.silben ? [...t.silben] : t.text));
		assert.deepEqual(teile, [['Die'], ' ', ['Ro', 'si', 'ne'], ', ', ['süß'], '.']);
		pruefeSilben('A|bend „Was|ser“, Zu|cker!');
		assert.throws(() => pruefeSilben('Ro||si'), /direkt nebeneinander/);
		assert.throws(() => pruefeSilben('|Rosine'), /Anfang oder Ende/);
		assert.throws(() => pruefeSilben('Ro|si| ne'), /Anfang oder Ende/);
		assert.throws(() => pruefeSilben('Rosine|.'), /Anfang oder Ende/);
		pruefeSilben('Um 8 Uhr: 3 + 4 = 7 €');
	});

	it('Schema sperrt dieselben Silbenfehler', () => {
		const regeln = ABBILDUNG_SCHEMA['x-silben'].regeln;
		const fuer = (wort: string) =>
			regeln?.({
				liste: () => [],
				raster: () => [],
				text: (a) => (a === 'inhalt' ? wort : null),
				zahl: () => 0,
				zahlen: () => [],
				zeilen: () => [],
			}) ?? {};
		assert.deepEqual(fuer('Ro|si|ne.'), {});
		assert.ok(fuer('Ro||si').inhalt);
		assert.ok(fuer('|Ro').inhalt);
		assert.deepEqual(
			fuer('Um 8 Uhr'),
			{},
			'Der Text kommt auch aus den Lesehilfen, und dort darf nichts scheitern.',
		);
	});
});

describe('Sprache untersuchen (032)', () => {
	it('stellt Sätze richtig um: Verbzweit, Partikel, Großschreibung', () => {
		const { satzUmstellen } = rechenkerne();
		const faelle: [string, string, string?][] = [
			['[Der Hund]S [bellt]P [den Briefträger]AkO [an]P.', 'Den Briefträger bellt der Hund an.'],
			['[Anna]S [liest]P [ein Buch]AkO.', 'Ein Buch liest Anna.'],
			['[Der Lehrer]S [gibt]P [dem Kind]DaO [das Heft]AkO.', 'Dem Kind gibt der Lehrer das Heft.'],
			['[Heute]Zeit [spielt]P [Ben]S [Fußball]AkO.', 'Ben spielt heute Fußball.'],
			['[Die Katze]S [schläft]P [auf dem Sofa]Ort.', 'Auf dem Sofa schläft die Katze.'],
			['[Wir]S [gehen]P [morgen]Zeit [ins Kino]Ort.', 'Morgen gehen wir ins Kino.'],
			['[Mein Bruder]S [räumt]P [sein Zimmer]AkO [auf]P.', 'Sein Zimmer räumt mein Bruder auf.'],
			['[Tante Anna]S [ruft]P [uns]AkO [an]P.', 'Uns ruft Tante Anna an.'],
			['[Kleine Kinder]S [malen]P [bunte Bilder]AkO.', 'Bunte Bilder malen kleine Kinder.'],
			['[Ben und Anna]S [bauen]P [ein Haus]AkO.', 'Ein Haus bauen Ben und Anna.'],
			['[Hunde]S [fressen]P [Knochen]AkO.', 'Knochen fressen Hunde.'],
			['[Im Garten]Ort [wächst]P [eine Blume]S.', 'Eine Blume wächst im Garten.'],
			['[Er]S [schenkt]P [ihr]DaO [eine Rose]AkO.', 'Ihr schenkt er eine Rose.'],
			['[Frau Meier]S [schreibt]P [einen Brief]AkO.', 'Einen Brief schreibt Frau Meier.'],
			['[Die Kinder]S [steigen]P [in den Bus]Ort [ein]P.', 'In den Bus steigen die Kinder ein.'],
			['[Am Montag]Zeit [fährt]P [die Klasse]S [nach Ulm]Ort.', 'Die Klasse fährt am Montag nach Ulm.'],
			['[Das Kind]S [hilft]P [der Oma]DaO!', 'Der Oma hilft das Kind!'],
			['[Oma]S [backt]P [einen Kuchen]AkO.', 'Einen Kuchen backt Oma.'],
			['[Der Hund]S [bellt]P [den Mann]AkO [heute]Zeit [an]P.', 'Heute bellt der Hund den Mann an.', 'Zeit'],
			['[Viele Vögel]S [fliegen]P [im Herbst]Zeit [nach Süden]Ort.', 'Im Herbst fliegen viele Vögel nach Süden.'],
		];
		for (const [satz, erwartet, vorn] of faelle) {
			const neu = satzUmstellen(satz, vorn ?? null);
			assert.equal(`${neu.glieder.map((g) => g.text).join(' ')}${neu.zeichen}`, erwartet, satz);
		}
	});

	it('lehnt ab, was sich nicht umstellen lässt', () => {
		const { satzLesen, satzUmstellen } = rechenkerne();
		assert.throws(() => satzLesen('[Der Hund]S schläft.'), /Prädikat/);
		assert.throws(() => satzLesen('[Der Hund]X [bellt]P.'), /gibt es nicht/);
		assert.throws(() => satzLesen('[Der Hund S [bellt]P.'), /Klammer/);
		assert.throws(() => satzUmstellen('[Bellt]P [der Hund]S?'), /Fragen/);
		assert.throws(() => satzUmstellen('[Bring]P [den Ball]AkO!'), /zweiter Stelle/);
		assert.throws(() => satzUmstellen('[Der Hund]S [bellt]P.'), /noch ein Satzglied/);
		assert.throws(() => satzUmstellen('Der Hund [bellt]P [laut]Ort.'), /zweiter Stelle|jedes Wort/);
	});

	it('Wortarten: Kürzel je Wort, jedes Symbol und jede Linie einzeln', () => {
		const { WORTARTEN, wortartenTeile } = rechenkerne();
		const teile = Array.from(wortartenTeile('Der/Art Hund/N bellt, laut/A.'), (t) => ({ ...t }));
		assert.deepEqual(teile, [
			{ wort: 'Der', marke: 'Art' },
			{ text: ' ' },
			{ wort: 'Hund', marke: 'N' },
			{ text: ' ' },
			{ wort: 'bellt', marke: null },
			{ text: ', ' },
			{ wort: 'laut', marke: 'A' },
			{ text: '.' },
		]);
		const alle = Object.values(WORTARTEN);
		assert.equal(new Set(alle.map((w) => w.symbol)).size, alle.length);
		assert.equal(new Set(alle.map((w) => w.linie)).size, alle.length);
	});

	it('Wortbausteine: Stamm muss ein Baustein sein', () => {
		const { pruefeBausteine } = rechenkerne();
		assert.deepEqual(Array.from(pruefeBausteine('ver|fahr|en', 'fahr')), ['ver', 'fahr', 'en']);
		assert.deepEqual(Array.from(pruefeBausteine('Fahr|er', 'fahr')), ['Fahr', 'er']);
		assert.throws(() => pruefeBausteine('ver|fahr|en', 'lauf'), /keiner der Bausteine/);
		assert.throws(() => pruefeBausteine('ver||en', null), /fehlt ein Baustein/);
		assert.deepEqual(pruefe('x-wortbausteine', { inhalt: 'ver|fahr|en', stamm: 'fahr' }), {});
		assert.ok(pruefe('x-wortbausteine', { inhalt: 'ver|fahr|en', stamm: 'lauf' }).stamm);
		assert.ok(pruefe('x-wortbausteine', { inhalt: 'ver|fahr', art: 'familie', woerter: 'a; b' }).inhalt);
		assert.ok(pruefe('x-wortbausteine', { inhalt: 'fahr', art: 'familie' }).woerter);
		assert.ok(pruefe('x-wortbausteine', { inhalt: 'ver|fahr', aufgabe: 'familie' }).aufgabe);
	});

	it('Schema: Kürzel, Rollen und Prädikat', () => {
		assert.deepEqual(pruefe('x-wortarten', { inhalt: 'Der/Art Hund/N bellt/V.' }), {});
		assert.ok(pruefe('x-wortarten', { inhalt: 'Der/X Hund.' }).inhalt);
		assert.deepEqual(pruefe('x-satzglieder', { inhalt: '[Der Hund]S [bellt]P.' }), {});
		assert.match(pruefe('x-satzglieder', { inhalt: '[Der Hund]S schläft.' }).inhalt ?? '', /Prädikat/);
		assert.ok(pruefe('x-satzglieder', { inhalt: '[Der Hund]X [bellt]P.' }).inhalt);
		assert.ok(pruefe('x-satzglieder', { inhalt: '[Der Hund S [bellt]P.' }).inhalt);
	});

	it('Markierung: lesen, schreiben, Gruppen', () => {
		const einzeln = 'Der/Art Hund/N bellt laut/A.';
		const satz = markierungLesen(einzeln);
		assert.equal(markierungKlartext(satz), 'Der Hund bellt laut.');
		assert.equal(markierungText(satz), einzeln);
		const glieder = '[Der Hund]S [bellt]P den Mann [an]P.';
		const g = markierungLesen(glieder, true);
		assert.equal(markierungKlartext(g), 'Der Hund bellt den Mann an.');
		assert.equal(markierungText(g, true), glieder);

		const verbunden = markeVerbinden(g, 3);
		assert.equal(markierungText(verbunden, true), '[Der Hund]S [bellt]P [den Mann] [an]P.');
		const gesetzt = markeSetzen(verbunden, 4, 'AkO');
		assert.equal(markierungText(gesetzt, true), '[Der Hund]S [bellt]P [den Mann]AkO [an]P.');
		assert.equal(markierungText(markeTrennen(gesetzt, 0), true), '[Der]S [Hund]S [bellt]P [den Mann]AkO [an]P.');
		assert.equal(markierungText(markeVerbinden(g, 1), true), '[Der Hund bellt]S den Mann [an]P.');
	});

	it('Markierung: ändert sich ein Wort, bleiben die übrigen markiert', () => {
		const alt = markierungLesen('Der/Art Hund/N bellt/V laut/A.');
		assert.equal(
			markierungText(markierungNeuerText(alt, 'Der Dackel bellt laut.')),
			'Der/Art Dackel bellt/V laut/A.',
		);
		assert.equal(markierungText(markierungNeuerText(alt, 'Der Hund bellt.')), 'Der/Art Hund/N bellt/V.');
		assert.equal(markierungText(markierungNeuerText(alt, 'Heute bellt der Hund.')), 'Heute bellt/V der Hund.');
		const g = markierungLesen('[Der Hund]S [bellt]P.', true);
		assert.equal(
			markierungText(markierungNeuerText(g, 'Der große Hund bellt.'), true),
			'[Der große Hund]S [bellt]P.',
		);
		assert.equal(
			markierungText(markierungNeuerText(g, 'Der Hund bellt laut.'), true),
			'[Der Hund]S [bellt]P laut.',
		);
	});
});

describe('Sachunterricht: Zeit und Raum (033)', () => {
	it('Zeitleiste: kein Jahr 0, v. Chr. ausgeschrieben', () => {
		const { jahrText, zeitPos } = rechenkerne();
		assert.equal(zeitPos(1) - zeitPos(-1), 1);
		assert.equal(zeitPos(2000) - zeitPos(1900), 100);
		assert.equal(jahrText(-500), '500 v. Chr.');
		assert.equal(jahrText(1969), '1969');
	});

	it('Zeitleiste: Regeln', () => {
		assert.deepEqual(
			pruefe('x-zeitleiste', { von: '1900', bis: '2020', ereignisse: '1914: Krieg; 1900-1914: Zeit' }),
			{},
		);
		assert.ok(pruefe('x-zeitleiste', { von: '2000', bis: '1900' }).bis);
		assert.match(pruefe('x-zeitleiste', { ereignisse: '1800: Alt' }).ereignisse ?? '', /außerhalb/);
		assert.match(pruefe('x-zeitleiste', { ereignisse: 'um 1900: Alt' }).ereignisse ?? '', /kein Jahr/);
		assert.match(pruefe('x-zeitleiste', { von: '-100', ereignisse: '0: Null' }).ereignisse ?? '', /Jahr 0/);
		assert.deepEqual(pruefe('x-zeitleiste', { art: 'leben', von: '0', bis: '10', ereignisse: '0: Geburt' }), {});
	});

	it('Jahreskreis: Jahreszeiten und Markierung passen zur Art', () => {
		assert.deepEqual(pruefe('x-jahreskreis', { markiert: 'Juli', jahreszeiten: 'ja' }), {});
		assert.ok(pruefe('x-jahreskreis', { art: 'tag', jahreszeiten: 'ja' }).jahreszeiten);
		assert.ok(pruefe('x-jahreskreis', { art: 'tag', markiert: 'Juli' }).markiert);
	});

	it('Plan: Planquadrate und Objekte', () => {
		assert.deepEqual(planLage('B3', 6, 5), { x: 1, y: 2 });
		assert.equal(planLage('G1', 6, 5), null);
		assert.equal(planLage('A6', 6, 5), null);
		const orte = planObjekteVon('schule: B3; baum: A2 A3');
		assert.equal(orte.get('A3'), 'baum');
		assert.equal(planObjekteText(orte), 'schule: B3; baum: A2 A3');
		assert.equal(planObjekteText(new Map()), null);
		assert.ok(pruefe('x-plan', { objekte: 'tisch: A1' }).boden);
		assert.ok(pruefe('x-plan', { objekte: 'schule: Z9' }).boden);
		assert.ok(pruefe('x-plan', { spalten: '26' }).spalten);
		assert.deepEqual(pruefe('x-plan', { aufgabe: 'weg', weg: 'A1 A2 B2' }), {});
		assert.ok(pruefe('x-plan', { aufgabe: 'weg', weg: 'A1 C3' }).weg);
	});
});

const schemaVonSicher = (tag: string) => {
	const gefunden = schemaVon(tag);
	assert.ok(gefunden);
	return gefunden;
};

describe('Sachunterricht: Natur und Technik (034)', () => {
	const { VERKEHRSZEICHEN: IM_JS, stromTeile, stromkreis } = rechenkerne();
	const kreis = (teile: string, zweig = '') => {
		const woerter = (t: string) => t.split(' ').filter(Boolean);
		return stromkreis(stromTeile(woerter(teile)), stromTeile(woerter(zweig)));
	};
	const ZEICHEN = path.join(ASSETS, 'bilder', 'verkehrszeichen');

	it('rechnet, ob die Lampe leuchtet', () => {
		assert.equal(kreis('batterie schalter:offen lampe').ergebnis, 'nein');
		assert.equal(kreis('batterie schalter:zu lampe').ergebnis, 'ja');
		assert.equal(kreis('batterie lampe').ergebnis, 'ja');
		assert.equal(kreis('batterie eisen lampe').ergebnis, 'ja');
		assert.equal(kreis('batterie holz lampe').ergebnis, 'nein');
		assert.equal(kreis('batterie schalter:zu motor').laufen[0]?.art, 'motor');
	});

	it('erkennt den Kurzschluss, auch ohne Verbraucher', () => {
		assert.equal(kreis('batterie lampe', 'kabel').ergebnis, 'kurzschluss');
		assert.equal(kreis('batterie lampe', 'kabel').laufen.length, 0);
		assert.equal(kreis('batterie').ergebnis, 'kurzschluss');
		assert.equal(kreis('batterie kabel').ergebnis, 'kurzschluss');
		assert.equal(kreis('batterie schalter:zu').ergebnis, 'kurzschluss');
		assert.equal(kreis('batterie schalter:offen').ergebnis, 'nein');
		assert.equal(kreis('batterie lampe', 'schalter:offen').ergebnis, 'ja');
		assert.equal(kreis('batterie lampe', 'schalter:zu').ergebnis, 'kurzschluss');
	});

	it('rechnet zwei Zweige getrennt', () => {
		const beide = kreis('batterie lampe', 'motor');
		assert.equal(beide.ergebnis, 'ja');
		assert.deepEqual(Array.from(beide.laufen, (t) => t.art).sort(), ['lampe', 'motor']);
		assert.deepEqual(
			Array.from(kreis('batterie schalter:offen lampe', 'motor').laufen, (t) => t.art),
			['motor'],
		);
		assert.equal(kreis('batterie schalter:offen lampe', 'holz motor').ergebnis, 'nein');
	});

	it('lehnt falsche Teile ab und verlangt die Batterie', () => {
		assert.throws(() => kreis('batterie toaster'));
		assert.throws(() => kreis('batterie schalter lampe'));
		assert.throws(() => kreis('schalter:zu lampe'));
		assert.ok(pruefeWerte(schemaVonSicher('x-schaltplan'), { teile: 'schalter:zu lampe' }).teile);
		assert.deepEqual(pruefeWerte(schemaVonSicher('x-schaltplan'), { teile: 'batterie schalter:zu lampe' }), {});
	});

	it('jede Nummer hat alle Dateien und eine Quelle, Schema und Zeichnen führen dieselben', () => {
		const quellen = readFileSync(path.join(ZEICHEN, 'QUELLEN.md'), 'utf8');
		const nummern = VERKEHRSZEICHEN.map((o) => o.wert);
		assert.deepEqual(Object.keys(IM_JS).sort(), [...nummern].sort());
		for (const nr of nummern) {
			assert.match(quellen, new RegExp(`^\\| ${nr} \\| .*commons\\.wikimedia\\.org`, 'mu'), nr);
			for (const variante of ['', '-grau', '-kontur']) {
				const datei = readFileSync(path.join(ZEICHEN, `${nr}${variante}.svg`), 'utf8');
				assert.doesNotMatch(datei, /<script|<image|foreignObject|href="http/iu, `${nr}${variante}`);
				if (variante) {
					assert.doesNotMatch(datei, /#c1121c|#154889|#f7ba0b/iu, `${nr}${variante}: noch farbig`);
				}
			}
		}
	});

	it('Temperaturen unter null nur beim Liniendiagramm', () => {
		const s = schemaVonSicher('x-diagramm');
		assert.deepEqual(pruefeWerte(s, { art: 'linie', werte: 'Mo: -5; Di: 3' }), {});
		assert.deepEqual(pruefeWerte(s, { art: 'linie', werte: 'Mo; Di' }), {});
		assert.ok(pruefeWerte(s, { werte: 'Mo: -5' }).werte);
		assert.ok(pruefeWerte(s, { werte: 'Mo' }).werte);
	});
});

/** Noten schreiben Oktaven mit Apostrophen; so bleiben sie lesbar. */
const T = String.raw;

describe('Musik (035)', () => {
	const { balkenGruppen, gruppeNachOben, halsNachOben, leseTakte } = rechenkerne();
	const stufe = (ton: string) => leseTakte(`${ton}1`, '4/4', true)[0]?.[0]?.stufe;

	it('prüft die Takte und nennt die Nummer', () => {
		assert.throws(() => leseTakte('4 4 8 8 4 4 | 4 4 2', '4/4', false), /Takt 1 hat 5 Viertel statt 4/);
		assert.throws(() => leseTakte('4 4 | 4', '2/4', false), /Takt 2 hat 1 Viertel statt 2/);
		assert.throws(() => leseTakte('4 8', '2/4', false), /Takt 1 hat 1,5 Viertel statt 2/);
		assert.throws(
			() => leseTakte('4 | 4 4 | 2.', '2/4', false),
			/Takt 1 hat 1 Viertel statt 2, Takt 3 hat 3 Viertel statt 2\. Passe die Noten an: Jeder Takt braucht 2 Viertel\.$/,
			'Die Meldung nennt jeden falschen Takt und den Weg (084, E-U1)',
		);
		assert.equal(leseTakte('4 8 8 4 r4 | 2.  4', '4/4', false).length, 2);
		assert.throws(() => leseTakte('4', '4/4', false), /Takt 1/);
		assert.equal(leseTakte('4 | 4 4 4 4 | 4 4 4', '4/4', false, true).length, 3);
		assert.throws(() => leseTakte('4 4 4 4 4', '4/4', false, true), /Takt 1/);
		assert.throws(() => leseTakte('4', '6/8', false), /6\/8/);
		assert.throws(() => leseTakte('16', '4/4', false), /kein Notenwert/);
		assert.throws(() => leseTakte('8.', '4/4', false), /Achtel/);
	});

	it('legt die Tonhöhen von c bis a in Stufen ab und lehnt alles andere ab', () => {
		const leiter = [
			T`c'`,
			T`d'`,
			T`e'`,
			T`f'`,
			T`g'`,
			T`a'`,
			T`h'`,
			T`c''`,
			T`d''`,
			T`e''`,
			T`f''`,
			T`g''`,
			T`a''`,
		];
		assert.deepEqual(leiter.map(stufe), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
		assert.equal(stufe(T`b'`), 6);
		assert.throws(() => stufe(T`h''`), /zu hoch/);
		assert.throws(() => stufe('c'), /keine Note/);
		assert.throws(() => stufe(T`c'''`), /keine Note/);
	});

	it('Halsrichtung an zehn Beispielen', () => {
		const faelle: [string, boolean][] = [
			[T`c'`, true],
			[T`d'`, true],
			[T`e'`, true],
			[T`g'`, true],
			[T`a'`, true],
			[T`h'`, false],
			[T`c''`, false],
			[T`e''`, false],
			[T`g''`, false],
			[T`a''`, false],
		];
		for (const [ton, oben] of faelle) {
			assert.equal(halsNachOben(stufe(ton) ?? -1), oben, ton);
		}
	});

	it('balkt Achtel nur innerhalb eines Schlags', () => {
		const gruppen = (text: string, vorn = 0) =>
			Array.from(balkenGruppen(leseTakte(text, '4/4', false, true)[0] ?? [], vorn), (g) => Array.from(g));
		assert.deepEqual(gruppen('8 8 4 4 4'), [[0, 1]]);
		assert.deepEqual(gruppen('8 8 8 8 2'), [
			[0, 1],
			[2, 3],
		]);
		assert.deepEqual(gruppen('4 8 8 2'), [[1, 2]]);
		assert.deepEqual(gruppen('8 4 8 2'), []);
		assert.deepEqual(gruppen('r8 8 8 8 2'), [[2, 3]]);
		assert.deepEqual(gruppen('8 8', 1), []);
		assert.equal(gruppeNachOben([0, 2]), true);
		assert.equal(gruppeNachOben([8, 10]), false);
		assert.equal(gruppeNachOben([4, 9]), false);
	});

	it('die Notenleiste füllt die Takte der Reihe nach', () => {
		let t = '';
		for (const w of ['4', '4', '8', '8', '4', '2']) {
			t = notenAnfuegen(t, w, '4/4');
		}
		assert.equal(t, '4 4 8 8 4 | 2');
		assert.equal(notenAnfuegen('4 4', '4', '2/4'), '4 4 | 4');
		assert.equal(notenZuruecknehmen('4 4 8 8 4 | 2'), '4 4 8 8 4');
		assert.equal(notenZuruecknehmen('4'), '');
		assert.equal(notenPunkt('4 2'), '4 2.');
		assert.equal(notenPunkt('4 2.'), '4 2');
		assert.equal(notenPunkt('8'), '8');
	});

	it('Tonhöhe ändert genau eine Note und bleibt im Umfang', () => {
		assert.equal(notenTon(T`c'4 r4 g'2`, 1, 1), T`c'4 r4 a'2`);
		assert.equal(notenTon(T`h'4`, 0, 1), T`c''4`);
		assert.equal(notenTon(T`c''4`, 0, -1), T`h'4`);
		assert.equal(notenTon(T`c'4`, 0, -1), T`c'4`);
		assert.equal(notenTon(T`a''4`, 0, 1), T`a''4`);
		assert.deepEqual(notenMitTon(T`c'4 r4 | g'2`), [T`c'4`, T`g'2`]);
	});
});

describe('Rätsel (038)', () => {
	const { kreuzBau, kreuzGueltig, loesungswortFehler, raetselWort, suchselBau, suchselStandard, suchselZaehle } =
		rechenkerne();

	it('Suchsel Klasse 1: nur waagerecht, groß, jedes Wort genau einmal über 100 seeds', () => {
		const woerter = ['Oma', 'Opa', 'Mama', 'Papa', 'Ball', 'Hut'].map((w) => raetselWort(w, true));
		assert.deepEqual(Array.from(suchselStandard(1)), ['rechts']);
		for (let seed = 0; seed < 100; seed++) {
			const bau = suchselBau(woerter, 8, 8, ['rechts'], String(seed));
			assert.ok(bau, `seed ${seed}`);
			for (const lage of bau.lagen) {
				assert.deepEqual([lage.dx, lage.dy], [1, 0]);
			}
			for (const wort of woerter) {
				assert.equal(suchselZaehle(bau.gitter, wort), 1, `${wort.join('')} bei seed ${seed}`);
			}
			assert.ok(bau.gitter.flat().every((b) => b === b.toUpperCase()));
		}
	});

	it('Suchsel Klasse 4: alle Richtungen, Umlaut eine Zelle, ß wird groß zu SS', () => {
		assert.deepEqual(Array.from(raetselWort('Straße', true)), ['S', 'T', 'R', 'A', 'S', 'S', 'E']);
		assert.deepEqual(Array.from(raetselWort('Bär', true)), ['B', 'Ä', 'R']);
		const woerter = ['Fluss', 'Straße', 'Brücke', 'Märchen', 'Wiese', 'König'].map((w) => raetselWort(w, false));
		for (let seed = 0; seed < 100; seed++) {
			const bau = suchselBau(
				woerter,
				12,
				10,
				['rechts', 'runter', 'diagonal', 'rueckwaerts'],
				String(seed),
				false,
			);
			assert.ok(bau, `seed ${seed}`);
			for (const wort of woerter) {
				assert.equal(suchselZaehle(bau.gitter, wort), 1, `${wort.join('')} bei seed ${seed}`);
			}
		}
	});

	it('Suchsel: Zu viele Wörter ergeben keine Lösung, Palindrome zählen je Lage einmal', () => {
		const woerter = ['AAAA', 'BBBB', 'CCCC', 'DDDD', 'EEEE'].map((w) => raetselWort(w, true));
		assert.equal(suchselBau(woerter, 4, 4, ['rechts'], 'x'), null);
		assert.equal(suchselZaehle([['O', 'T', 'T', 'O']], ['O', 'T', 'T', 'O']), 1);
	});

	it('Kreuzworträtsel: zusammenhängend und regelkonform über 100 seeds', () => {
		const woerter = ['STUHL', 'STIFT', 'SCHULE', 'LINEAL', 'RADIERER', 'DOSE', 'TAFEL', 'RANZEN'].map((w) =>
			raetselWort(w, true),
		);
		for (let seed = 0; seed < 100; seed++) {
			const bau = kreuzBau(woerter, String(seed), 20, 26);
			assert.ok(bau, `seed ${seed}`);
			assert.equal(bau.lagen.length, 8);
			assert.ok(kreuzGueltig(bau.lagen), `seed ${seed}`);
			assert.ok(bau.spalten <= 20 && bau.zeilen <= 26);
		}
	});

	it('Kreuzworträtsel: Die Prüfung erkennt Berührung und Lücke', () => {
		const lage = (nr: number, wort: string, x: number, y: number, quer: boolean) => ({
			nr,
			wort: [...wort],
			x,
			y,
			quer,
		});
		assert.ok(kreuzGueltig([lage(0, 'HUND', 0, 0, true), lage(1, 'UHR', 1, 0, false)]));
		assert.ok(!kreuzGueltig([lage(0, 'HUND', 0, 0, true), lage(1, 'BAD', 0, 1, true)]), 'nebeneinander');
		assert.ok(!kreuzGueltig([lage(0, 'HUND', 0, 0, true), lage(1, 'BAD', 0, 5, true)]), 'nicht verbunden');
		assert.equal(
			kreuzBau(
				[
					['A', 'B'],
					['C', 'D'],
				].map((w) => Array.from(w)),
				'x',
			),
			null,
		);
	});

	it('Lösungswort: erkennt eine geänderte Item-Lösung', () => {
		const legende = new Map([
			['42', 'S'],
			['64', 'O'],
			['27', 'N'],
			['28', 'N'],
			['45', 'E'],
		]);
		const wort = [...'SONNE'];
		assert.equal(loesungswortFehler(wort, ['42', '64', '27', '28', '45'], legende, '3'), null);
		assert.equal(
			loesungswortFehler(wort, ['42', '48', '27', '28', '45'], legende, '3'),
			'Aufgabe 3, Eintrag 2 hat jetzt die Lösung 48; das Lösungswort stimmt nicht mehr.',
		);
		assert.match(loesungswortFehler(wort, ['42'], legende, '3') ?? '', /hat 1 Lösungen/);
	});

	it('Das Panel lehnt falsche Wörter ab', () => {
		const suchsel = schemaVonSicher('x-suchsel');
		assert.deepEqual(pruefeWerte(suchsel, { spalten: '10', woerter: 'Hund; Katze' }), {});
		assert.match(pruefeWerte(suchsel, { spalten: '10', woerter: 'Hund 2; Katze' }).woerter ?? '', /Buchstaben/);
		assert.match(
			pruefeWerte(suchsel, { spalten: '5', zeilen: '5', woerter: 'Schildkröte; Hund' }).woerter ?? '',
			/länger/,
		);
		const kreuz = schemaVonSicher('x-kreuzwort');
		assert.match(
			pruefeWerte(kreuz, { art: 'senkrecht', eintraege: 'a: HUND; b: UHR' }).loesungswort ?? '',
			/fehlt/,
		);
		assert.deepEqual(pruefeWerte(schemaVonSicher('x-loesungswort'), { wort: 'SONNE', bezug: '3' }), {});
	});
});

describe('Spiele (037)', () => {
	const { bingoKarten, dominoFehler, dominoSteine, spielplanRaster, spielplanWeg, teilePaar } = rechenkerne();
	const eintraege = Array.from({ length: 24 }, (_, i) => `e${i}`);

	it('Bingo: Karten unterscheiden sich in mindestens zwei Feldern, gleicher seed gleiche Karten', () => {
		for (let seed = 0; seed < 40; seed++) {
			const karten = bingoKarten(eintraege, 16, 28, String(seed));
			assert.ok(karten);
			assert.equal(karten.length, 28);
			karten.forEach((a, i) => {
				assert.equal(new Set(a).size, 16);
				karten.slice(i + 1).forEach((b) => {
					assert.ok(a.filter((x) => !b.includes(x)).length >= 2);
				});
			});
		}
		assert.deepEqual(
			JSON.stringify(bingoKarten(eintraege, 16, 5, 'a')),
			JSON.stringify(bingoKarten(eintraege, 16, 5, 'a')),
		);
		assert.notEqual(
			JSON.stringify(bingoKarten(eintraege, 16, 5, 'a')),
			JSON.stringify(bingoKarten(eintraege, 16, 5, 'b')),
		);
	});

	it('Bingo: Zu wenige Einträge lehnt das Panel ab', () => {
		const s = schemaVonSicher('x-bingo');
		const mit = (n: number) => eintraege.slice(0, n).join('; ');
		assert.match(pruefeWerte(s, { felder: '4', eintraege: mit(14) }).eintraege ?? '', /mindestens 20/);
		assert.deepEqual(pruefeWerte(s, { felder: '4', eintraege: mit(24) }), {});
	});

	it('Domino: Die Kette schließt sich und ist eindeutig', () => {
		const paare = Array.from({ length: 12 }, (_, i) => [`a${i}`, `l${i}`]);
		const steine = Array.from(dominoSteine(paare, 'geschlossen'));
		assert.equal(steine.length, 12);
		steine.forEach((stein, k) => {
			assert.equal(stein.rechts, `a${k}`);
			assert.equal(stein.links, `l${(k + 11) % 12}`);
		});
		const offen = Array.from(dominoSteine(paare, 'offen'));
		assert.equal(offen.length, 13);
		assert.equal(offen[0]?.links, 'Start');
		assert.equal(offen[12]?.rechts, 'Ende');
		assert.equal(dominoFehler(paare), null);
		assert.match(dominoFehler([...paare.slice(1), ['a0', 'l1']]) ?? '', /zweimal/);
		assert.match(dominoFehler([...paare.slice(1), ['a0', 'a1']]) ?? '', /zugleich/);
		assert.match(dominoFehler(paare.slice(1)) ?? '', /12 bis 24/);
		const s = schemaVonSicher('x-domino');
		const text = paare.map(([a, l]) => `${a}: ${l}`).join('; ');
		assert.deepEqual(pruefeWerte(s, { paare: text }), {});
		assert.match(pruefeWerte(s, { paare: text.replace('l2', 'l1') }).paare ?? '', /zweimal/);
	});

	it('Domino und Bingo: Mini-Inhalte behalten ihre Doppelpunkte', () => {
		assert.deepEqual(Array.from(teilePaar('uhr:7:30: halb acht')), ['uhr:7:30', 'halb acht']);
		assert.deepEqual(Array.from(teilePaar('uhr:7:30')), ['uhr:7:30', '']);
		const paare = schemaVonSicher('x-domino').felder.find((f) => f.attribut === 'paare');
		assert.ok(paare?.art === 'liste');
		assert.deepEqual(zeilenVon(paare, 'uhr:7:30: halb 8; 7·8: 56'), [
			['uhr:7:30', 'halb 8'],
			['7·8', '56'],
		]);
		assert.equal(zeilenText(paare, [['uhr:7:30', 'halb 8']]), 'uhr:7:30: halb 8');
		assert.deepEqual(miniTeile('uhr:7:30'), { art: 'uhr', inhalt: '7:30' });
		assert.deepEqual(miniTeile('7·8'), { art: '', inhalt: '7·8' });
	});

	it('Spielplan: Jeder Weg läuft ohne Sprung und ohne Überschneidung', () => {
		for (const [b, h] of [
			[620, 870],
			[1003, 590],
		]) {
			for (const form of ['schlange', 'spirale', 'rundweg', 'leiter']) {
				for (let felder = 20; felder <= 40; felder++) {
					const [c, r] = spielplanRaster(form, felder, b ?? 0, h ?? 0);
					const weg = Array.from(spielplanWeg(form, felder, c, r), (o) => Array.from(o));
					assert.equal(weg.length, felder, `${form} ${felder}`);
					assert.equal(new Set(weg.map(String)).size, felder, `${form} ${felder}: überlappt`);
					weg.slice(1).forEach(([x = 0, y = 0], i) => {
						const [vx = 0, vy = 0] = weg[i] ?? [];
						assert.equal(Math.abs(x - vx) + Math.abs(y - vy), 1, `${form} ${felder}: Sprung`);
					});
				}
			}
		}
	});
});

describe('Generatoren (050)', () => {
	const schlicht = <T>(wert: T) => JSON.parse(JSON.stringify(wert)) as T;
	// Einmal laden: Der Test ruft die Kerne hunderttausendmal.
	const k = rechenkerne();
	const reihe = (angaben: Record<string, string>, seed: string) => {
		const e = k.rechenreiheEinstellungen((name, standard) => angaben[name] ?? standard);
		return k.rechenreiheAufgaben(e, seed);
	};
	/** Liest `a op b = c` samt berechneter Lösung; prüft, dass die Gleichung stimmt, ohne dem Generator zu glauben. */
	const lies = (text: string) => {
		const r = k.rechnungLesen(text);
		assert.equal(r.fehler, null, text);
		const [a, zeichen, b, , c] = r.teile ?? [];
		const wert = (t?: string) => (t === '_' ? Number((r.loesung ?? '').split(' ')[0]) : Number(t));
		const [x, y, z] = [wert(a), wert(b), wert(c)];
		const richtig: Record<string, () => boolean> = {
			'+': () => x + y === z,
			'−': () => x - y === z,
			'·': () => x * y === z,
			':': () => Math.floor(x / y) === z,
		};
		assert.ok(richtig[zeichen ?? '']?.(), `${text} ergibt ${r.loesung}`);
		return { x, y, z, zeichen: zeichen ?? '', loesung: r.loesung ?? '' };
	};

	it('Rechenreihe: über 1000 Seeds im Zahlenraum, Bedingungen erfüllt, Lösung korrekt, keine Doppelten', () => {
		const { mitUebergang } = k;
		const faelle: { angaben: Record<string, string>; pruefe: (a: ReturnType<typeof lies>) => boolean }[] = [
			{
				angaben: { rechenart: '+', zahlenraum: '20', anzahl: '10', uebergang: 'mit' },
				pruefe: (a) => mitUebergang('+', a.x, a.y) && a.z <= 20,
			},
			{
				angaben: { rechenart: '+', zahlenraum: '20', anzahl: '10', uebergang: 'ohne' },
				pruefe: (a) => !mitUebergang('+', a.x, a.y) && a.z <= 20,
			},
			{
				angaben: { rechenart: '−', zahlenraum: '100', anzahl: '10', uebergang: 'mit' },
				pruefe: (a) => mitUebergang('−', a.x, a.y) && a.x <= 100 && a.z >= 0,
			},
			{
				angaben: { rechenart: '·', zahlenraum: '100', anzahl: '8', reihe: '7' },
				pruefe: (a) => a.y === 7 && a.z <= 100,
			},
			{
				angaben: { rechenart: ':', zahlenraum: '100', anzahl: '8', reihe: '6' },
				pruefe: (a) => a.y === 6 && a.x % 6 === 0 && a.x <= 100,
			},
			{
				angaben: { rechenart: ':', zahlenraum: '100', anzahl: '8', rest: '1' },
				pruefe: (a) => a.x % a.y !== 0 && a.x <= 100,
			},
			{
				angaben: { rechenart: '+', zahlenraum: '1000000', anzahl: '12', platzhalter: 'gemischt' },
				pruefe: (a) => a.z <= 1000000,
			},
		];
		for (const { angaben, pruefe: fall } of faelle) {
			for (let seed = 0; seed < 1000; seed++) {
				const { aufgaben, fehler } = reihe(angaben, String(seed));
				assert.equal(fehler, null, JSON.stringify(angaben));
				assert.equal(aufgaben.length, Number(angaben.anzahl));
				assert.equal(new Set(aufgaben).size, aufgaben.length, `Doppelt: ${aufgaben.join('; ')}`);
				for (const text of aufgaben) {
					assert.ok(fall(lies(text)), `${JSON.stringify(angaben)}: ${text}`);
				}
			}
		}
		// Gegenprobe: Die Prüfung schlägt an, wenn die Bedingung nicht gilt.
		assert.equal(mitUebergang('+', 3, 7), false);
		assert.equal(mitUebergang('+', 5, 8), true);
		assert.equal(mitUebergang('−', 13, 5), true);
		assert.equal(mitUebergang('−', 20, 5), false);
	});

	it('Rechenreihe: Tausch und Umkehr stehen als Paare, Platzhalter an der gewählten Stelle', () => {
		const tausch = reihe({ rechenart: '+', zahlenraum: '20', anzahl: '6', beziehung: 'tausch' }, 'a').aufgaben.map(
			lies,
		);
		for (let i = 0; i < tausch.length; i += 2) {
			assert.deepEqual([tausch[i]?.x, tausch[i]?.y], [tausch[i + 1]?.y, tausch[i + 1]?.x]);
		}
		const umkehr = reihe({ rechenart: '+', zahlenraum: '20', anzahl: '6', beziehung: 'umkehr' }, 'a').aufgaben.map(
			lies,
		);
		for (let i = 0; i < umkehr.length; i += 2) {
			assert.equal(umkehr[i + 1]?.zeichen, '−');
			assert.equal(umkehr[i + 1]?.x, umkehr[i]?.z);
		}
		const { aufgaben } = reihe({ rechenart: '+', zahlenraum: '20', anzahl: '5', platzhalter: 'erste' }, 'a');
		assert.ok(aufgaben.every((t) => t.startsWith('_ + ')));
	});

	it('Rechenreihe: das Schema zählt die Aufgaben wie der Generator', () => {
		const faelle: Record<string, string>[] = [
			{ rechenart: '+', zahlenraum: '10' },
			{ rechenart: '+', zahlenraum: '10', uebergang: 'mit' },
			{ rechenart: '+', zahlenraum: '10', uebergang: 'ohne' },
			{ rechenart: '−', zahlenraum: '10' },
			{ rechenart: '+', zahlenraum: '20', uebergang: 'mit' },
			{ rechenart: '−', zahlenraum: '20', uebergang: 'mit' },
			{ rechenart: '+', zahlenraum: '10', beziehung: 'tausch' },
			{ rechenart: '+', zahlenraum: '10', beziehung: 'umkehr' },
			{ rechenart: '·', zahlenraum: '10' },
			{ rechenart: '·', zahlenraum: '20' },
			{ rechenart: '·', zahlenraum: '10', beziehung: 'umkehr' },
			{ rechenart: ':', zahlenraum: '10' },
			{ rechenart: ':', zahlenraum: '20' },
			{ rechenart: ':', zahlenraum: '10', rest: '1' },
			...['1', '2', '3', '7', '10'].flatMap((r) => [
				{ rechenart: '·', zahlenraum: '20', reihe: r },
				{ rechenart: ':', zahlenraum: '100', reihe: r },
			]),
			{ rechenart: ':', zahlenraum: '20', reihe: '7', rest: '1' },
		];
		for (const angaben of faelle) {
			const { aufgaben, fehler } = reihe({ ...angaben, anzahl: '60' }, 'zaehlen');
			const gefunden = fehler ? Number(/nur (\d+) verschiedene/.exec(fehler)?.[1]) : aufgaben.length;
			assert.equal(rechenreiheMoeglich(angaben), gefunden, JSON.stringify(angaben));
		}
	});

	it('Rechenreihe: Unerfüllbares meldet das Element, statt falsche Aufgaben zu liefern', () => {
		assert.match(
			reihe({ rechenart: '+', zahlenraum: '10', anzahl: '60' }, 'a').fehler ?? '',
			/nur \d+ verschiedene/,
		);
		assert.match(
			reihe({ rechenart: '−', zahlenraum: '10', anzahl: '3', uebergang: 'mit' }, 'a').fehler ?? '',
			/nur 0 verschiedene/,
		);
		assert.match(
			reihe({ rechenart: '·', zahlenraum: '100', anzahl: '3', uebergang: 'mit' }, 'a').fehler ?? '',
			/nur für Plus/,
		);
		assert.match(
			reihe({ rechenart: '+', zahlenraum: '100', anzahl: '3', rest: '1' }, 'a').fehler ?? '',
			/nur beim Teilen/,
		);
		assert.match(
			reihe({ rechenart: '−', zahlenraum: '100', anzahl: '3', beziehung: 'tausch' }, 'a').fehler ?? '',
			/Plus und Mal/,
		);
		assert.deepEqual(schlicht(reihe({ rechenart: '+', zahlenraum: '10', anzahl: '60' }, 'a').aufgaben), []);
	});

	it('Rechnung lesen: Lösung berechnet, was nicht aufgeht, wird genannt', () => {
		const { rechnungLesen } = rechenkerne();
		assert.equal(rechnungLesen('3 + _ = 7').loesung, '4');
		assert.equal(rechnungLesen('_ · 7 = 28').loesung, '4');
		assert.equal(rechnungLesen('17 : 5 = _').loesung, '3 R 2');
		assert.match(rechnungLesen('3 + 4 = 7').fehler ?? '', /genau einem _/);
		assert.match(rechnungLesen('7 : _ = 3').fehler ?? '', /geht nicht auf/);
		assert.match(rechnungLesen('_ + 5 = 3').fehler ?? '', /geht nicht auf/);
		assert.match(rechnungLesen('7 : 0 = _').fehler ?? '', /durch 0/);
	});

	const fuer = (tag: string, werte: Record<string, string>) => {
		const ergebnisse = Array.from({ length: 200 }, (_, i) => {
			const neu = k.neueZahlen(tag, werte, `s${i}`);
			assert.ok(neu, `${tag} Seed ${i}`);
			return schlicht(neu);
		});
		assert.ok(new Set(ergebnisse.map((e) => JSON.stringify(e))).size > 5, `${tag}: Es kommen kaum neue Zahlen`);
		return ergebnisse;
	};

	it('Neue Zahlen: Aufbau bleibt, Zahlen ändern sich, alles bleibt lösbar', () => {
		for (const e of fuer('x-zahlenmauer', { basis: '3 5 2' })) {
			assert.equal(e.basis?.split(' ').length, 3);
		}
		for (const e of fuer('x-zahlenkette', { start: '8', operatoren: '+5 −3 ·2' })) {
			assert.deepEqual(
				e.operatoren?.split(' ').map((o) => o[0]),
				['+', '−', '·'],
			);
		}
		for (const e of fuer('x-rechenrad', { mitte: ':4', zahlen: '4 8 12 16' })) {
			const d = Number(e.mitte?.slice(1));
			assert.ok(e.zahlen?.split(' ').every((z) => Number(z) % d === 0));
			assert.equal(e.zahlen?.split(' ').length, 4);
		}
		for (const e of fuer('x-schriftlich', { art: 'minus', zahlen: '903 478', verfahren: 'abziehen-entbuendeln' })) {
			const [a = 0, b = 0] = (e.zahlen ?? '').split(' ').map(Number);
			assert.ok(a >= b && a >= 100 && a < 1000);
		}
		for (const e of fuer('x-schriftlich', { art: 'geteilt', zahlen: '936 4' })) {
			const [a = 0, b = 0] = (e.zahlen ?? '').split(' ').map(Number);
			assert.equal(a % b, 0);
		}
	});

	it('Neue Zahlen: Größen bleiben im selben Aufbau', () => {
		for (const e of fuer('x-uhr', { zeit: '4:30' })) {
			assert.match(e.zeit ?? '', /^\d{1,2}:(00|30)$/);
		}
		for (const e of fuer('x-kalender', { monat: '2', jahr: '2027', markiert: '14', luecken: '8 22' })) {
			assert.ok(
				[...(e.markiert ?? '').split(' '), ...(e.luecken ?? '').split(' ')].every((t) => Number(t) <= 28),
			);
		}
		for (const e of fuer('x-zahlenstrahl', {
			von: '0',
			bis: '100',
			schritt: '10',
			zahlen: '0 50 100',
			pfeile: '30 70',
		})) {
			assert.ok(e.pfeile?.split(' ').every((t) => Number(t) % 10 === 0 && !['0', '50', '100'].includes(t)));
		}
		for (const tag of ['x-zahlenhaus', 'x-malkreuz', 'x-geld', 'x-rechendreieck', 'x-zeitspanne']) {
			assert.ok(k.NEUE_ZAHLEN.includes(tag));
		}
		// Zusammenhängendes bleibt: Hier gibt es bewusst nichts zu würfeln.
		assert.equal(k.neueZahlen('x-zeitspanne', { von: '8:20', bis: '10:00', spruenge: 'bis 9:00' }, 'a'), null);
		assert.equal(k.neueZahlen('x-schriftlich', { art: 'plus', zahlen: '1 2', fehlerhaft: 'ja' }, 'a'), null);
		assert.equal(k.neueZahlen('x-kalender', { art: 'jahr', jahr: '2028' }, 'a'), null);
		assert.equal(k.neueZahlen('x-suchsel', {}, 'a'), null);
	});
});

describe('Aufgabenformate (049)', () => {
	const schlicht = <T>(wert: T) => JSON.parse(JSON.stringify(wert)) as T;

	it('Zuordnen: nie schon gelöst, über viele Seeds und für jede Größe; die Mischung wählt wenige Kreuzungen', () => {
		const { zuordnenFolge, zuordnenKreuzungen } = rechenkerne();
		const einmal = (folge: number[]) => folge.reduce((n, p) => n + p, 0);
		for (let n = 2; n <= 10; n++) {
			for (let seed = 0; seed < 300; seed++) {
				const folge = [...zuordnenFolge(n, String(seed))];
				assert.ok(
					folge.every((p, z) => p !== z),
					`${n} Paare, Seed ${seed}: ${folge.join()}`,
				);
				assert.equal(new Set(folge).size, n);
				assert.equal(einmal(folge), (n * (n - 1)) / 2);
			}
		}
		// Gegenprobe: Der Zähler sieht Kreuzungen, und die Auswahl aus mehreren Mischungen drückt sie.
		assert.equal(zuordnenKreuzungen([0, 1, 2]), 0);
		assert.equal(zuordnenKreuzungen([2, 1, 0]), 3);
		const mittel = (f: (seed: string) => number[]) =>
			Array.from({ length: 200 }, (_, i) => zuordnenKreuzungen(f(String(i)))).reduce((a, b) => a + b, 0) / 200;
		const zufaellig = (n: number) => (n * (n - 1)) / 4;
		assert.ok(mittel((seed) => [...zuordnenFolge(8, seed)]) < zufaellig(8) * 0.8);
	});

	it('Zuordnen: Bilder sind freiwillig, zu wenig, leer und doppelt werden gemeldet', () => {
		const { zuordnenFehler, zuordnenLesen } = rechenkerne();
		assert.deepEqual(schlicht(zuordnenLesen('Apfel: Obst: a.png; Kohl: Gemüse')), [
			{ links: 'Apfel', rechts: 'Obst', bildLinks: 'a.png', bildRechts: '' },
			{ links: 'Kohl', rechts: 'Gemüse', bildLinks: '', bildRechts: '' },
		]);
		const f = (roh: string) => zuordnenFehler(zuordnenLesen(roh));
		assert.equal(f('a: 1; b: 2'), null);
		assert.match(f('a: 1') ?? '', /mindestens 2/);
		assert.match(f('a: 1; b') ?? '', /fehlt die andere Seite/);
		assert.match(f('a: 1; b: 1') ?? '', /doppelt/);
	});

	it('Sortieren: Die gemischte Reihenfolge ist über viele Seeds nie die Lösung', () => {
		const { sortierenFehler, sortierenFolge, sortierenLesen } = rechenkerne();
		for (let n = 2; n <= 12; n++) {
			for (let seed = 0; seed < 300; seed++) {
				const folge = [...sortierenFolge(n, String(seed))];
				assert.ok(
					folge.some((p, i) => p !== i),
					`${n} Einträge, Seed ${seed}`,
				);
				assert.equal(new Set(folge).size, n);
			}
		}
		assert.deepEqual(schlicht(sortierenLesen('Satz eins.; Samen: s.png')), [
			{ text: 'Satz eins.', bild: '' },
			{ text: 'Samen', bild: 's.png' },
		]);
		const f = (roh: string) => sortierenFehler(sortierenLesen(roh));
		assert.equal(f('a; b'), null);
		assert.match(f('a') ?? '', /mindestens 2/);
		assert.match(f('a; a') ?? '', /doppelt/);
	});

	it('Beschriften: Keine Linie kreuzt eine andere, auch bei ungünstigen Punkten', () => {
		const { beschriftenPlan } = rechenkerne();
		const naechste = (start: number) => {
			let z = start;
			return () => {
				z = (z * 48271) % 2147483647;
				return z / 2147483647;
			};
		};
		let vertauschtGekreuzt = 0;
		for (let seed = 1; seed <= 300; seed++) {
			const r = naechste(seed);
			const punkte = Array.from({ length: 12 }, (_, i) => ({
				x: i < 6 ? r() * 49 : 50 + r() * 50,
				y: r() * 100,
				wort: `W${i}`,
			}));
			const plan = beschriftenPlan(punkte);
			assert.equal(plan.links.length + plan.rechts.length, 12);
			for (const seite of [plan.links, plan.rechts]) {
				assert.equal(new Set(seite.map((l) => l.wort)).size, seite.length);
				for (let a = 0; a < seite.length; a++) {
					for (let b = a + 1; b < seite.length; b++) {
						const [la, lb] = [seite[a], seite[b]] as [BeschriftLinie, BeschriftLinie];
						assert.equal(plan.kreuzen(la, lb), false, `Seed ${seed}: ${la.wort} und ${lb.wort}`);
						// Gegenprobe: Mit vertauschten Zielen kreuzen sich die Linien, die Prüfung muss das sehen.
						if (plan.kreuzen({ ...la, bis: lb.bis }, { ...lb, bis: la.bis })) {
							vertauschtGekreuzt++;
						}
					}
				}
			}
		}
		assert.ok(vertauschtGekreuzt > 0, 'Gegenprobe: Die Prüfung erkennt gekreuzte Linien');
	});

	it('Beschriften: zu viele Punkte, außerhalb und ohne Wort werden gemeldet', () => {
		const { punkteFehler, punkteLesen } = rechenkerne();
		assert.deepEqual(schlicht(punkteLesen('12,70: Samen')), [{ x: 12, y: 70, wort: 'Samen' }]);
		const f = (roh: string) => punkteFehler(punkteLesen(roh));
		assert.equal(f('12,70: Samen; 88,25: Blume'), null);
		assert.match(f('120,70: Samen') ?? '', /nicht im Bild/);
		assert.match(f('12,70') ?? '', /kein Wort/);
		const voll = Array.from({ length: 6 }, (_, i) => `10,${i * 10}: W${i}`).join('; ');
		assert.equal(f(voll), null);
		assert.match(f(`${voll}; 20,80: Zu viel`) ?? '', /höchstens 6/);
	});
});

describe('Aufgabenformate (048)', () => {
	// Die Werte kommen aus einem eigenen `vm`-Kontext; `deepEqual` vergleicht sonst auch die Prototypen.
	const schlicht = <T>(wert: T) => JSON.parse(JSON.stringify(wert)) as T;

	it('Lücken: [Wort] und [[Wort]], ohne Lücke eine Meldung', () => {
		const { lueckeFehler, lueckenLesen } = rechenkerne();
		const teile = lueckenLesen('Der [Hund] und die [[Katze]].');
		assert.deepEqual(schlicht(teile.filter((t) => t.wort).map((t) => [t.wort, t.beispiel])), [
			['Hund', false],
			['Katze', true],
		]);
		assert.equal(lueckeFehler(teile), null);
		assert.match(lueckeFehler(lueckenLesen('Ohne Lücke.')) ?? '', /keine Lücke/);
	});

	it('Aufgabenformate: Ihre Klassen gelten nur im eigenen Element, weil Material dieselben Namen selbst nutzt', () => {
		const css = readFileSync(path.join(ASSETS, 'blatt.css'), 'utf8');
		assert.ok(css.includes('x-lueckentext .luecke{'), 'Gegenprobe: Die Regeln stehen in blatt.css');
		assert.deepEqual(css.match(/^(body\S*\s)?\.(luecke|wortspeicher|ankreuzen|frage|wahl|wahlen)\b[^\n]*/gm), null);
	});

	it('Wortspeicher: fehlendes und doppeltes Wort werden genannt, Ablenker sind erlaubt', () => {
		const { wortspeicherFehler } = rechenkerne();
		assert.equal(wortspeicherFehler(['Hund', 'Maus'], ['Hund']), null);
		assert.match(wortspeicherFehler(['Maus'], ['Hund']) ?? '', /„Hund“ findet kein Wort.*Ergänze/);
		assert.match(wortspeicherFehler(['Hund', 'Hund'], []) ?? '', /doppelt/);
	});

	it('Ankreuzen: mindestens eine richtig, ohne Mehrfachwahl genau eine, nichts doppelt', () => {
		const { ankreuzenFehler, ankreuzenLesen } = rechenkerne();
		const f = (roh: string, mehrfach = false) => ankreuzenFehler(ankreuzenLesen(roh), mehrfach);
		assert.deepEqual(schlicht(ankreuzenLesen('Was?: *a, b')[0]), {
			frage: 'Was?',
			optionen: [
				{ text: 'a', richtig: true },
				{ text: 'b', richtig: false },
			],
		});
		assert.equal(f('Was?: *a, b'), null);
		assert.match(f('Was?: a, b') ?? '', /keine richtige Antwort/);
		assert.match(f('Was?: *a, *b') ?? '', /2 richtige/);
		assert.equal(f('Was?: *a, *b', true), null);
		assert.match(f('Was?: *a, a') ?? '', /doppelt/);
		assert.match(f('') ?? '', /noch keine Frage/);
	});

	it('Richtig oder falsch: Jede Aussage braucht ihren Wahrheitswert', () => {
		const { aussagenFehler, aussagenLesen } = rechenkerne();
		assert.deepEqual(schlicht(aussagenLesen('Uhr: 3: r')[0]), { text: 'Uhr: 3', wert: 'r' });
		assert.equal(aussagenFehler(aussagenLesen('A: r; B: f')), null);
		assert.match(aussagenFehler(aussagenLesen('A')) ?? '', /richtig \(r\) oder falsch/);
	});
});

describe('Punkte und Noten (053)', () => {
	const k = rechenkerne();
	it('Der Vorschlag steht in Schema und Zeichnung gleich', () => {
		assert.equal(k.NOTEN_VORSCHLAG, NOTEN_VORSCHLAG);
	});
	it('liest alle Formen der Punkte', () => {
		assert.equal(k.punkteAus('4 P'), 4);
		assert.equal(k.punkteAus('(2,5 P.)'), 2.5);
		assert.equal(k.punkteAus('/ 3 P'), 3);
		assert.equal(k.punkteAus('ohne'), 0);
	});
	it('Der Schlüssel teilt 0 bis Gesamt lückenlos auf und passt sich an', () => {
		const grenzen = k.notenGrenzen(NOTEN_VORSCHLAG) ?? [];
		assert.deepEqual([...grenzen], [95, 80, 65, 50, 25]);
		for (const gesamt of [10, 20, 24, 37, 50, 100, 12.5]) {
			const z = k.notenZeilen(gesamt, grenzen);
			assert.equal(z.length, 6);
			assert.equal(z[0]?.bis, gesamt);
			assert.equal(z[5]?.von, 0);
			const schritt = Number.isInteger(gesamt) ? 1 : 0.5;
			z.slice(1).forEach((zeile, i) => assert.equal(zeile.bis, (z[i]?.von ?? 0) - schritt));
		}
		assert.deepEqual(
			[...k.notenZeilen(20, grenzen)].map((z) => z.von),
			[19, 16, 13, 10, 5, 0],
		);
		assert.deepEqual(
			[...k.notenZeilen(40, grenzen)].map((z) => z.von),
			[38, 32, 26, 20, 10, 0],
		);
	});
	it('Falsche Grenzen werden abgelehnt', () => {
		assert.equal(k.notenGrenzen('1:95; 2:80'), null);
		assert.equal(k.notenGrenzen('1:50; 2:80; 3:65; 4:50; 5:25'), null);
		assert.equal(k.notenGrenzen('2:95; 2:80; 3:65; 4:50; 5:25'), null);
	});
});

describe('Abschnitte im Inspektor', () => {
	it('Jede Gruppe des Schemas hat einen Abschnitt, die Uhr steht wie im Zielbild', () => {
		const felder = Object.values(ABBILDUNG_SCHEMA).flatMap((s) => s.felder);
		for (const f of felder) {
			if (f.gruppe) {
				assert.ok(GRUPPEN_ABSCHNITT[f.gruppe], `Gruppe ohne Abschnitt: ${f.gruppe}`);
			}
		}
		const uhr = Object.fromEntries(
			(ABBILDUNG_SCHEMA['x-uhr']?.felder ?? []).map((f) => [f.attribut, abschnittVon(f)]),
		);
		assert.equal(uhr.zeit, 'inhalt');
		assert.equal(uhr.ziffern, 'darstellung');
		assert.equal(uhr.groesse, 'darstellung');
		assert.equal(uhr.digital, 'weitere');
	});
});

describe('Schema: Namen, Gruppen und Bedingungen (084)', () => {
	const feldVon = (tag: string, attribut: string) => {
		const feld = schemaVon(tag)?.felder.find((f) => f.attribut === attribut);
		assert.ok(feld, `${tag}.${attribut}`);
		return feld;
	};
	const alle = Object.entries(ABBILDUNG_SCHEMA as Readonly<Record<string, AbbildungSchema>>);

	it('Kein Feld heißt wie sein Abschnitt, innerhalb eines Abschnitts kein Name doppelt', () => {
		for (const [tag, schema] of alle.filter(([t]) => t !== 'x-probe')) {
			const gesehen = new Set<string>();
			for (const f of schema.felder.filter((x) => !x.ohneFeld)) {
				const abschnitt = ABSCHNITT_TITEL[abschnittVon(f)];
				assert.notEqual(f.name, abschnitt, `${tag}.${f.attribut} heißt wie sein Abschnitt`);
				const schluessel = `${abschnitt}/${f.gruppe ?? ''}/${f.name}`;
				assert.ok(!gesehen.has(schluessel), `${tag}.${f.attribut}: „${f.name}“ doppelt`);
				gesehen.add(schluessel);
			}
		}
	});

	it('Keine Gruppenüberschrift wiederholt den Namen eines ihrer Felder', () => {
		for (const [tag, schema] of alle.filter(([t]) => t !== 'x-probe')) {
			for (const f of schema.felder.filter((x) => !x.ohneFeld && x.gruppe && x.gruppe !== 'Mehr')) {
				assert.notEqual(f.name, f.gruppe, `${tag}.${f.attribut}`);
			}
		}
	});

	it('`nurWenn` liest nur Felder, die es im Schema gibt', () => {
		for (const [tag, schema] of alle) {
			const gueltig = new Set(schema.felder.map((f) => f.attribut));
			for (const f of schema.felder.filter((x) => x.nurWenn)) {
				const gelesen = new Set<string>();
				const werte = new Proxy({}, {
					get: (_, name) => {
						gelesen.add(String(name));
						return null;
					},
				});
				f.nurWenn?.(werte);
				assert.ok(gelesen.size > 0, `${tag}.${f.attribut} liest kein Feld`);
				for (const g of gelesen) {
					assert.ok(gueltig.has(g), `${tag}.${f.attribut} liest „${g}“, das gibt es nicht`);
				}
			}
		}
	});

	it('Regel Inhalt und Darstellung: Größe und Breite gehören nie zum Inhalt', () => {
		for (const [tag, schema] of alle) {
			for (const f of schema.felder.filter((x) => ['groesse', 'breite'].includes(x.attribut))) {
				assert.notEqual(abschnittVon(f), 'inhalt', `${tag}.${f.attribut}`);
				assert.notEqual(abschnittVon(f), 'weitere', `${tag}.${f.attribut}`);
			}
		}
		assert.equal(abschnittVon(feldVon('x-tangram', 'umriss')), 'inhalt');
		assert.equal(abschnittVon(feldVon('x-wuerfelbau', 'einheit')), 'darstellung');
	});

	it('Als Text: Hin und zurück ändert nichts; leere Zeilen fallen weg', () => {
		const feld = feldVon('x-domino', 'paare') as ListeFeld;
		const zeilen = [
			['3·3', '9'],
			['4·4', '16'],
		];
		assert.deepEqual(zeilenAusText(feld, zeilenAlsText(feld, zeilen)), zeilen);
		assert.deepEqual(zeilenAusText(feld, '\n3·3 | 9\n\n'), [['3·3', '9']]);
	});
});

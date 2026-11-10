import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blattMit, FIGUR_ANKER, FIGUR_FREI } from '../../web/e2e/gestaltung-daten';
import {
	ankerNamen,
	ankerVon,
	ankerZiele,
	haengeAn,
	istAnkerbar,
	loeseAnker,
	mitAnkern,
	NICHT_ANKERBAR,
} from './anker';
import { fuegeBausteinAn } from './einfuegen-ablage';
import { leseLage, verschiebeAufSeite } from './gestaltung';
import { fehlendeLoesungen, hatLoesung, istAntwort, loesungVon } from './loesungen';
import { attribut, klassenVon, zerlege } from './quelltext';
import { dupliziereBaustein, loescheBaustein, nummeriere, verschiebeBaustein } from './struktur';

const N = { jeSeite: false };

const alle = (quelle: string, klasse: string) => zerlege(quelle).knoten.filter((k) => klassenVon(k).includes(klasse));

const nrMit = (quelle: string, klasse: string, i = 0) => {
	const k = alle(quelle, klasse)[i];
	assert.ok(k, `.${klasse} fehlt`);
	return k.nr;
};

const klasseAn = (quelle: string, nr: number | null) =>
	nr === null ? null : (attribut(zerlege(quelle).knoten[nr] ?? zerlege('<i>').knoten[0]!, 'class')?.wert ?? null);

/** Der Ursprung der Aufgaben, wie ihn der Editor messen würde; hier frei gewählt, der Kern rechnet nur. */
const URSPRUNG = [
	{ x: 76, y: 160 },
	{ x: 76, y: 300 },
	{ x: 76, y: 460 },
];

const WILMA = 'figur-frei';

describe('haengeAn und loeseAnker', () => {
	it('Anhängen und Lösen ergeben dieselbe Lage in Seitenkoordinaten', () => {
		const vorher = blattMit({ vorne: [FIGUR_FREI] });
		const lage = { x: 610, y: 520 };
		const dran = haengeAn(vorher, nrMit(vorher, WILMA), nrMit(vorher, 'aufgabe', 2), {
			lage,
			ursprung: URSPRUNG[2]!,
		});
		assert.ok(dran.nr !== null);
		assert.equal(klasseAn(dran.quelle, dran.nr), WILMA);
		assert.equal(ankerVon(dran.quelle, dran.nr), nrMit(dran.quelle, 'aufgabe', 2));
		assert.deepEqual(leseLage(dran.quelle, dran.nr), { x: 610 - 76, y: 520 - 460, b: 150, spiegeln: -1 });
		assert.equal(alle(dran.quelle, 'ebene').length, 0, 'Die leere Ebene ist weg.');
		const los = loeseAnker(dran.quelle, dran.nr, { lage });
		assert.equal(los.quelle, vorher, 'Aus „vorne“ angehängt und gelöst: Zeichen für Zeichen wie vorher.');
		assert.equal(klasseAn(los.quelle, los.nr), WILMA);
	});

	it('aus „hinten“ angehängt liegt das Element danach vorne, die leere Ebene ist weg', () => {
		const vorher = blattMit({ hinten: [FIGUR_FREI] });
		const dran = haengeAn(vorher, nrMit(vorher, WILMA), nrMit(vorher, 'aufgabe', 0), {
			lage: { x: 610, y: 520 },
			ursprung: URSPRUNG[0]!,
		});
		assert.equal(alle(dran.quelle, 'hinten').length, 0);
		assert.ok(dran.nr !== null);
		const los = loeseAnker(dran.quelle, dran.nr, { lage: { x: 610, y: 520 } });
		const ebene = zerlege(los.quelle).knoten[los.nr ?? -1]?.eltern;
		assert.ok(ebene && klassenVon(ebene).includes('vorne'), 'Gelöst liegt es vorne.');
		assert.equal(attribut(zerlege(los.quelle).knoten[los.nr ?? -1]!, 'data-anker'), undefined);
	});

	it('der Wechsel von Baustein A zu B ist ein Aufruf; die Lage im Blatt bleibt', () => {
		const vorher = blattMit({ anker: [FIGUR_ANKER] });
		const a = nrMit(vorher, 'aufgabe', 0);
		const b = nrMit(vorher, 'aufgabe', 1);
		const wilma = nrMit(vorher, WILMA);
		assert.equal(ankerVon(vorher, wilma), a);
		// Im Blatt liegt Wilma bei Ursprung A + (560, −40).
		const lage = { x: URSPRUNG[0]!.x + 560, y: URSPRUNG[0]!.y - 40 };
		const r = haengeAn(vorher, wilma, b, { lage, ursprung: URSPRUNG[1]! });
		assert.ok(r.nr !== null);
		assert.equal(ankerVon(r.quelle, r.nr), nrMit(r.quelle, 'aufgabe', 1));
		const { x, y } = leseLage(r.quelle, r.nr);
		assert.deepEqual({ x: (x ?? 0) + URSPRUNG[1]!.x, y: (y ?? 0) + URSPRUNG[1]!.y }, lage);
		assert.equal(alle(r.quelle, WILMA).length, 1);
		// Es ist das letzte Kind von B.
		assert.equal(zerlege(r.quelle).knoten[nrMit(r.quelle, 'aufgabe', 1)]?.kinder.at(-1)?.nr, r.nr);
	});

	it('nur an Bausteine derselben Seite', () => {
		const vorher = blattMit({ vorne: [FIGUR_FREI] }).replace(
			'</section>',
			'</section>\n<section class="seite">\n  <div class="aufgabe"><span class="nr">4</span></div>\n</section>',
		);
		assert.throws(() =>
			haengeAn(vorher, nrMit(vorher, WILMA), nrMit(vorher, 'aufgabe', 3), {
				lage: { x: 0, y: 0 },
				ursprung: { x: 0, y: 0 },
			}),
		);
	});
});

describe('ankerZiele', () => {
	it('ohne NICHT_ANKERBAR, ohne [data-lage], ohne Textbausteine, nur die eigene Seite', () => {
		assert.ok(NICHT_ANKERBAR.includes('.loesung-marke'));
		const vorher = blattMit({ vorne: [FIGUR_FREI] })
			.replace(
				'  <div class="kopf">',
				'  <div class="loesung-marke">Lösung</div>\n  <p>Ein Absatz.</p>\n  <x-uhr zeit="3:00"></x-uhr>\n  <div class="kopf">',
			)
			.replace(
				'</section>',
				'</section>\n<section class="seite">\n  <div class="aufgabe"><span class="nr">4</span></div>\n</section>',
			);
		const seite = nrMit(vorher, 'seite', 0);
		const ziele = ankerZiele(vorher, seite).map((nr) => klasseAn(vorher, nr));
		assert.deepEqual(ziele, ['namenszeile', 'kopf', 'aufgabe', 'aufgabe', 'aufgabe']);
		assert.equal(istAnkerbar(vorher, nrMit(vorher, WILMA)), false);
		assert.equal(istAnkerbar(vorher, nrMit(vorher, 'loesung-marke')), false);
		assert.deepEqual(
			ankerZiele(vorher, nrMit(vorher, 'seite', 1)).map((nr) => klasseAn(vorher, nr)),
			['aufgabe'],
		);
	});
});

describe('Bausteine mit Anker', () => {
	const SVG_ANKER =
		'<svg class="form" data-lage="frei" data-anker data-form="kreis" viewBox="0 0 10 10" style="--x:20px;--y:0px;--b:40px;--h:40px"><defs><linearGradient id="verlauf-ab12"><stop offset="0"/></linearGradient></defs><circle cx="5" cy="5" r="5" fill="url(#verlauf-ab12)"/></svg>';

	it('dupliziereBaustein vergibt dem Anker neue Ids, die Verweise stimmen', () => {
		const vorher = blattMit({ anker: [SVG_ANKER] });
		const { quelle } = dupliziereBaustein(vorher, nrMit(vorher, 'aufgabe', 0), N);
		const ids = [...quelle.matchAll(/id="(verlauf-[a-z0-9]+)"/g)].map((t) => t[1]);
		assert.equal(ids.length, 2);
		assert.notEqual(ids[0], ids[1]);
		for (const id of ids) {
			assert.ok(quelle.includes(`url(#${id})`), `Verweis auf ${id}`);
		}
	});

	it('nummeriere und die Lösung sind mit und ohne Anker gleich', () => {
		const ohne = blattMit();
		const mit = blattMit({ anker: [FIGUR_ANKER] });
		assert.equal(nummeriere(mit, N), mit);
		const loesungen = (q: string) => zerlege(q).knoten.filter(istAntwort).map(loesungVon);
		assert.deepEqual(loesungen(mit), loesungen(ohne));
		assert.equal(hatLoesung(mit), hatLoesung(ohne));
		assert.equal(fehlendeLoesungen(zerlege(mit)).length, fehlendeLoesungen(zerlege(ohne)).length);
		const nummern = (q: string) => alle(q, 'nr').map((k) => q.slice(k.oeffnerEnde, k.schliesserStart));
		assert.deepEqual(nummern(mit), nummern(ohne));
	});

	it('verschiebeAufSeite eines Elements am Anker löst es, es liegt dann vorne auf der neuen Seite', () => {
		const vorher = blattMit({ anker: [FIGUR_ANKER] }).replace(
			'</section>',
			'</section>\n<section class="seite">\n  <div class="aufgabe"><span class="nr">4</span></div>\n</section>',
		);
		const r = verschiebeAufSeite(vorher, nrMit(vorher, WILMA), nrMit(vorher, 'seite', 1), { x: 100, y: 200 });
		assert.ok(r.nr !== null);
		const k = zerlege(r.quelle).knoten[r.nr]!;
		assert.equal(attribut(k, 'data-anker'), undefined);
		assert.ok(k.eltern && klassenVon(k.eltern).includes('vorne'));
		assert.equal(k.eltern.eltern?.nr, nrMit(r.quelle, 'seite', 1));
		assert.deepEqual(leseLage(r.quelle, r.nr), { x: 100, y: 200, b: 110 });
		assert.equal(alle(r.quelle, 'ebene').length, 1, 'Auf der alten Seite bleibt keine leere Ebene.');
	});

	it('Löschen nimmt den Anker mit; die Beschreibung nennt ihn', () => {
		const vorher = blattMit({
			anker: [FIGUR_ANKER, '<div class="form-text" data-lage="frei" data-anker data-name="Sprechblase"></div>'],
		});
		const aufgabe = nrMit(vorher, 'aufgabe', 0);
		assert.deepEqual(ankerNamen(vorher, aufgabe), ['Sprechblase', 'Wilma']);
		assert.equal(mitAnkern(vorher, aufgabe), ', mit Sprechblase und Wilma');
		assert.equal(mitAnkern(vorher, nrMit(vorher, 'aufgabe', 1)), '');
		const { quelle } = loescheBaustein(vorher, aufgabe, N);
		assert.equal(alle(quelle, WILMA).length, 0);
	});

	it('ein in die Aufgabe verschobener Baustein kommt vor den Anker, der bleibt letztes Kind', () => {
		const vorher = blattMit({ anker: [FIGUR_ANKER] });
		const r = verschiebeBaustein(vorher, nrMit(vorher, 'kopf'), { in: nrMit(vorher, 'aufgabe', 0) }, N);
		const aufgabe = alle(r.quelle, 'aufgabe')[0]!;
		assert.ok(klassenVon(aufgabe.kinder.at(-1)!).includes(WILMA));
	});

	it('ein aus der Schublade in die Aufgabe gelegter Baustein kommt vor den Anker', () => {
		const vorher = blattMit({ anker: [FIGUR_ANKER] });
		const neu = { id: 'absatz', ort: 'seite' as const, html: '<p class="neu">Neu</p>' };
		const r = fuegeBausteinAn(vorher, neu, { in: nrMit(vorher, 'aufgabe', 0) }, N);
		const kinder = alle(r.quelle, 'aufgabe')[0]!.kinder.map((k) => klassenVon(k)[0]);
		assert.deepEqual(kinder.slice(-2), ['neu', WILMA]);
	});

	it('auf einer Folie gilt dasselbe', () => {
		const vorher = blattMit({ vorne: [FIGUR_FREI] }).replace('<body class="kl2', '<body class="folie kl2');
		const lage = { x: 300, y: 200 };
		const dran = haengeAn(vorher, nrMit(vorher, WILMA), nrMit(vorher, 'aufgabe', 1), {
			lage,
			ursprung: URSPRUNG[1]!,
		});
		assert.ok(dran.nr !== null);
		assert.equal(nummeriere(dran.quelle, { jeSeite: true }), dran.quelle);
		assert.equal(loeseAnker(dran.quelle, dran.nr, { lage }).quelle, vorher);
	});
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { ASSETS } from '@schoolbox/kern/src/konfig';
import { klassenVon, zerlege } from '@schoolbox/kern/src/quelltext';
import type { Ort } from '@schoolbox/kern/src/referenz';
import { erzeugeReferenz } from '@schoolbox/kern/src/referenz';
import { loescheBaustein, verschiebeBaustein } from '@schoolbox/kern/src/struktur';

import type { ClaudeLage } from './claude-faeden';
import {
	ergaenzeFaeden,
	lebt,
	meintGanzesBlatt,
	neuerFaden,
	ohneGespraech,
	verankert,
	vorschlagDes,
} from './claude-faeden';
import type { KiAuftrag, VorschlagAmBlatt } from './ki';

const BLATT = readFileSync(path.join(ASSETS, 'vorlage-arbeitsblatt.html'), 'utf8');
const ORT: Ort = {
	mappe: { id: '2026-11-11-uhr-ma-kl2', titel: 'Uhrzeit', fach: 'mathematik', klasse: 2 },
	dokument: { id: 'wie-spaet', titel: 'Wie spät ist es?' },
};

const BLATT_ZAEHLT = { jeSeite: false };
const lage = (quelle: string, echt = true): ClaudeLage => ({ z: zerlege(quelle), ort: ORT, loesung: false, echt });
const aufgaben = (quelle: string) => zerlege(quelle).knoten.filter((k) => klassenVon(k).includes('aufgabe'));
const nrDer = (quelle: string, i: number) => aufgaben(quelle)[i]?.nr ?? -1;
const referenzDer = (quelle: string, i: number) => erzeugeReferenz(zerlege(quelle), nrDer(quelle, i), ORT, false);

const vorschlag = (schluessel: string, referenz?: string): VorschlagAmBlatt => ({
	schluessel,
	...(referenz ? { referenz } : {}),
	auftrag: 'Schöner',
	umfang: 'Aufgabe 1',
	zeit: '2026-11-11T10:00:00Z',
	antwort: '',
	fehler: 0,
	konflikt: false,
	meldungen: [],
});

const auftrag = (id: string, teil: Partial<KiAuftrag>): KiAuftrag => ({
	id,
	status: 'laeuft',
	schritte: [],
	fehler: null,
	ergebnis: null,
	antwort: null,
	...teil,
});

describe('Fäden: Vorschläge und Aufträge finden ihren Faden (135)', () => {
	const r = referenzDer(BLATT, 0);
	const alt = vorschlag('g1', r);
	const nachbessern = auftrag('a1', { gespraech: 'g2', grundlage: 'g1', referenz: r });

	it('Neuladen während des Nachbesserns: ein Faden, der den alten Vorschlag hält', () => {
		const faeden = ergaenzeFaeden([], { a1: nachbessern }, [alt]);
		assert.equal(faeden.length, 1);
		assert.equal(faeden[0]?.auftragId, 'a1');
		assert.equal(faeden[0] && vorschlagDes(faeden[0], [alt], { a1: nachbessern }), alt);
	});

	it('Kommen die Vorschläge vor den Aufträgen, übernimmt derselbe Faden den Auftrag', () => {
		const erst = ergaenzeFaeden([], {}, [alt]);
		const dann = ergaenzeFaeden(erst, { a1: nachbessern }, [alt]);
		assert.equal(dann.length, 1);
		assert.equal(dann[0]?.key, erst[0]?.key);
		assert.equal(dann[0]?.auftragId, 'a1');
	});

	it('Am Ende liegt das Ergebnis unter dem Gespräch des Auftrags und gehört demselben Faden', () => {
		const faeden = ergaenzeFaeden([], { a1: nachbessern }, [alt]);
		const fertig = { a1: { ...nachbessern, status: 'fertig' as const, ergebnis: 'vorschlag' as const } };
		const neu = vorschlag('g2', r);
		const danach = ergaenzeFaeden(faeden, fertig, [neu]);
		assert.equal(danach.length, 1);
		assert.equal(danach[0] && vorschlagDes(danach[0], [neu], fertig), neu);
	});

	it('× während des Laufs: kein Gespräch mehr, der Vorschlag des Laufs findet den Faden trotzdem', () => {
		const laeuft = { a1: auftrag('a1', { gespraech: 'g1', referenz: r }) };
		const f = neuerFaden({ key: 'k', schluessel: 'k', referenz: r, gespraech: 'g1', auftragId: 'a1' });
		const ohne = { ...f, ...ohneGespraech(f, undefined) };
		assert.equal(ohne.gespraech, null);
		assert.equal(lebt(ohne, null, laeuft, []), true);
		const ende = { a1: { ...laeuft.a1, status: 'fertig' as const } };
		assert.equal(vorschlagDes(ohne, [vorschlag('g1', r)], ende)?.schluessel, 'g1');
		assert.equal(ergaenzeFaeden([ohne], ende, [vorschlag('g1', r)]).length, 1);
	});

	it('Ohne Gespräch, Auftrag und Vorschlag lebt nur die offene Blase', () => {
		const f = neuerFaden({ key: 'k', schluessel: 'k', referenz: r });
		assert.equal(lebt(f, null, {}, []), false);
		assert.equal(lebt(f, 'k', {}, []), true);
	});
});

describe('Fäden: Anker am Element (134, 135)', () => {
	it('Das Element zieht um: Der Faden geht mit; ist es gelöscht, ist er los', () => {
		const r = referenzDer(BLATT, 1);
		const f = neuerFaden({ key: 'k', schluessel: 'k', referenz: r, nr: nrDer(BLATT, 1) });
		const z = zerlege(BLATT);
		const zweite = z.knoten[nrDer(BLATT, 1)];
		const erste = z.knoten[nrDer(BLATT, 0)];
		assert.ok(zweite && erste);
		const umgestellt = verschiebeBaustein(BLATT, zweite.nr, { nr: erste.nr, wo: 'vor' }, BLATT_ZAEHLT).quelle;
		const hier = verankert(f, lage(umgestellt), z);
		assert.equal(hier?.nr, nrDer(umgestellt, 0));
		assert.equal(verankert(f, lage(loescheBaustein(BLATT, zweite.nr, BLATT_ZAEHLT).quelle), z), null);
	});

	it('Neu geschriebener Text: Der Faden bleibt an seiner Stelle', () => {
		const f = neuerFaden({ key: 'k', schluessel: 'k', referenz: referenzDer(BLATT, 1), nr: nrDer(BLATT, 1) });
		const neu = BLATT.replace('Zeichne die Zeiger ein.', 'Male etwas ganz anderes, mit Farben und Formen.');
		assert.notEqual(neu, BLATT);
		assert.equal(verankert(f, lage(neu), zerlege(BLATT))?.nr, nrDer(neu, 1));
	});

	it('Auf einem gezeigten Vorschlag bleibt der Faden, wo er war', () => {
		const f = neuerFaden({ key: 'k', schluessel: 'k', referenz: referenzDer(BLATT, 1), nr: 7 });
		assert.deepEqual(verankert(f, lage(BLATT, false)), f);
	});

	it('Ohne Referenz hängt er an der ersten Seite; bei nur einer Seite meint sie das ganze Blatt', () => {
		const f = neuerFaden({ key: 'k', schluessel: 'k', referenz: null });
		const l = lage(BLATT);
		const hier = verankert(f, l);
		assert.ok(hier && hier.nr !== null);
		assert.equal(meintGanzesBlatt({ ganz: false, nr: hier.nr }, l), true);
		assert.equal(meintGanzesBlatt({ ganz: false, nr: nrDer(BLATT, 0) }, l), false);
	});
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	artAus,
	bibliothekNeuSatz,
	bibliotheksGrund,
	bibliotheksName,
	bildFigur,
	gegenstaendeInGrundpose,
	leseHerkunft,
	posenText,
	requisitenFuer,
	steckbriefAus,
} from './einheit-bibliothek';
import { EINGEBAUTE } from './figuren';

describe('einheit-bibliothek (253)', () => {
	it('bildFigur: Felder zuerst, sonst Motiv und Dateiname; Varianten verlieren die Zahl', () => {
		assert.deepEqual(bildFigur({ datei: 'luna.png', motiv: 'Luna steht', figur: 'Luna', pose: 'grund' }), {
			figur: 'Luna',
			pose: 'grund',
		});
		assert.deepEqual(bildFigur({ datei: 'x.png', motiv: '', figur: 'Luna', pose: 'Zeigt' }), {
			figur: 'Luna',
			pose: 'zeigt',
		});
		assert.deepEqual(bildFigur({ datei: 'ella.png', motiv: 'Grundpose Ella: Eichhörnchen' }), {
			figur: 'Ella',
			pose: 'grund',
		});
		assert.deepEqual(bildFigur({ datei: 'luna-faltet-3.png', motiv: 'Pose Luna faltet ein Papier' }), {
			figur: 'Luna',
			pose: 'faltet',
		});
		assert.deepEqual(bildFigur({ datei: 'kobi.png', motiv: 'Kobi winkt' }, ['Kobi']), { figur: 'Kobi', pose: 'grund' });
		assert.equal(bildFigur({ datei: 'fall-1.jpg', motiv: 'Fall-Karte: Luna an der Werkbank' }, ['Luna']), null);
	});

	it('artAus und bibliotheksName: „Fridolin (Fuchs)“, Willi ist vergeben, dann eine Zahl', () => {
		assert.equal(artAus('Fuchs, Postbote mit blauer Postmütze', 'Fridolin'), 'Fuchs');
		assert.equal(artAus('Braune Eule mit Brille', 'Ole'), 'Eule');
		assert.equal(artAus('Eine kleine Eule mit Schal', 'Luna'), 'Eule');
		assert.equal(artAus('Ein Fuchs mit Mütze', 'Fridolin'), 'Fuchs');
		assert.equal(artAus('Das Eichhörnchen hat einen buschigen Schwanz', 'Ella'), 'Eichhörnchen');
		assert.equal(artAus('Kleine, runde Eule', 'Luna'), 'Eule');
		assert.equal(artAus('Eule mit Brille', 'Luna'), 'Eule');
		const vergeben = [...EINGEBAUTE, { id: 'fridolin', name: 'Fridolin' }];
		assert.equal(bibliotheksName('Luna', 'Eule', 'Spiegel', vergeben), 'Luna');
		assert.equal(bibliotheksName('Fridolin', 'Fuchs', 'Spiegel', vergeben), 'Fridolin (Fuchs)');
		assert.equal(bibliotheksName('willi', '', 'Spiegel', vergeben), 'willi (Spiegel)');
		const auchDer = [...vergeben, { id: 'fridolin2', name: 'Fridolin (Fuchs)' }];
		assert.equal(bibliotheksName('Fridolin', 'Fuchs', 'Spiegel', auchDer), 'Fridolin (Fuchs) 2');
	});

	it('gegenstaendeInGrundpose: das Glöckchen, das eine andere Figur in einer Szene hält', () => {
		const namen = ['Luna', 'Ella', 'Hanne'];
		const szenen = ['Fall 5: Unter der Tanne: Hanne hält das goldene Glöckchen, Luna staunt', 'Schere daneben'];
		const ella = 'Grundpose Ella: Eichhörnchen mit buschigem Schwanz und goldenem Glöckchen an der Schwanzspitze';
		assert.deepEqual(gegenstaendeInGrundpose(ella, 'Ella', szenen, namen), ['Glöckchen']);
		const hanne = 'Grundpose Hanne: Schneehase mit Pudelmütze und kleiner Schere in der Schürzentasche';
		assert.deepEqual(gegenstaendeInGrundpose(hanne, 'Hanne', szenen, namen), []);
		// Umlaut am Anfang und ß: ganze Wörter, nicht „Strau“.
		const igel = 'Grundpose Ilse: Igel mit Äpfeln und einem Strauß';
		const szene = ['Hanne trägt die Äpfel und den Strauß'];
		assert.deepEqual(gegenstaendeInGrundpose(igel, 'Ilse', szene, [...namen, 'Ilse']), ['Strauß']);
	});

	it('steckbriefAus: Kanon vor Aussehen', () => {
		assert.equal(steckbriefAus({ fest: ['graue Eule', 'rote Brille'], nie: ['Spiegel'] }, 'Eule'), 'graue Eule, rote Brille; nie: Spiegel');
		assert.equal(steckbriefAus(undefined, ' Eule mit Brille '), 'Eule mit Brille');
	});

	it('posenText: genau die Zeile der Figuren-Schublade, ohne eingebaute Dateien', () => {
		const luna = {
			id: 'luna',
			name: 'Luna',
			posen: [
				{ id: 'luna', schluessel: '_figuren/luna.png', strich: false },
				{ id: 'luna-zeigt', schluessel: '_figuren/luna-zeigt.png', strich: false },
			],
		};
		const text = posenText([luna], '../../bilder/');
		assert.match(text, /^Posen der Figuren/);
		assert.match(text, /- Luna: <img class="figur-frei" data-figur="luna" src="\.\.\/\.\.\/bilder\/luna\.png"/);
		assert.match(text, /src="\.\.\/\.\.\/bilder\/luna-zeigt\.png"/);
		assert.equal(posenText(EINGEBAUTE, '../../bilder/'), '');
	});

	it('requisitenFuer: nach gemeinsamen Wörtern, je Datei eines', () => {
		const alle = [
			{ datei: 'spiegel.png', motiv: 'Ein randloser Handspiegel', mappe: 'A' },
			{ datei: 'laterne.png', motiv: 'Leuchtende Laterne aus Papier', mappe: 'A' },
			{ datei: 'laterne.png', motiv: 'Laterne', mappe: 'B' },
			{ datei: 'apfel.png', motiv: 'Roter Apfel', mappe: 'B' },
		];
		assert.deepEqual(
			requisitenFuer(alle, 'Laternen basteln aus Papier').map((r) => `${r.datei} ${r.mappe}`),
			['laterne.png A'],
		);
		assert.deepEqual(requisitenFuer(alle, 'Zahlen bis 20'), []);
	});

	it('leseHerkunft: fünf oder acht Spalten, die letzte Zeile je Datei gilt', () => {
		const tsv = [
			'datei\tquelle\tmodell\tdatum\tmotiv',
			'a.png\topenai\tm\t2026\tPose Luna zeigt',
			'a.png\topenai\tm\t2026\tPose Luna zeigt\toffen\t\t',
			'b.jpg\topenai\tm\t2026\tSzene',
		].join('\n');
		const z = leseHerkunft(tsv);
		assert.deepEqual(z.get('a.png'), { datei: 'a.png', quelle: 'openai', motiv: 'Pose Luna zeigt', art: 'offen' });
		assert.equal(z.get('b.jpg')?.art, '');
	});

	it('bibliothekNeuSatz: neue Figuren mit Posen, dann neue Posen vorhandener Figuren', () => {
		assert.equal(
			bibliothekNeuSatz([
				{ id: 'luna', name: 'Luna', plan: 'Luna', figur: true, posen: ['faltet'] },
				{ id: 'fridolin2', name: 'Fridolin (Fuchs)', plan: 'Fridolin', figur: true, posen: [] },
				{ id: 'willi', name: 'Willi', plan: 'Willi', figur: false, posen: ['winkt'] },
			]),
			'Neu in der Figurenbibliothek: Luna (faltet), Fridolin (Fuchs). Neue Posen für Willi: winkt.',
		);
		assert.equal(bibliothekNeuSatz([]), '');
	});

	it('bibliotheksGrund: keine neue Grundpose und keine vorhandene Pose einer Figur der Bibliothek', () => {
		const luna = {
			figur: {
				id: 'luna',
				name: 'Luna',
				posen: [
					{ id: 'luna', schluessel: '_figuren/luna.png', strich: false },
					{ id: 'luna-zeigt', schluessel: '_figuren/luna-zeigt.png', strich: false },
				],
			},
			namen: ['Luna'],
		};
		assert.match(
			bibliotheksGrund([luna], { datei: 'luna.png', motiv: 'Luna', figur: 'Luna', pose: 'grund' }, 'referenzen') ?? '',
			/Figurenbibliothek.*referenzen\//,
		);
		assert.match(
			bibliotheksGrund([luna], { datei: 'luna-zeigt.png', motiv: 'Pose Luna zeigt' }, 'referenzen') ?? '',
			/\.\.\/\.\.\/bilder\/luna-zeigt\.png/,
		);
		assert.equal(bibliotheksGrund([luna], { datei: 'luna-winkt.png', motiv: 'Pose Luna winkt' }, 'referenzen'), null);
		assert.equal(bibliotheksGrund([luna], { datei: 'ella.png', motiv: 'Grundpose Ella' }, 'referenzen'), null);
	});
});

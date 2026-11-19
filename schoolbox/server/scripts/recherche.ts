/**
 * Eine Recherche (219) ohne Oberfläche und ohne Server, genau so, wie `recherchiereEinheit` sie startet: dieselbe
 * Vorlage, dasselbe Werkzeug `pruefen`, dieselben Grenzen und dieselbe Kürzungsrunde, Modell und Gründlichkeit aus der
 * Einstellung. Für die Abnahme von 243 und als Recherche für den Prüfstand.
 *
 *   pnpm --filter @schoolbox/server exec tsx scripts/recherche.ts <ausgabe.md> [--thema "Achsensymmetrie"]
 *     [--fach mathematik] [--klasse 2] [--ziel "…"]… [--material <art>] [--ja]
 *
 * Ohne `--ja` zeigt das Skript nur die Nachricht an den Lauf und startet nichts. Mit `--ja` schreibt es die geprüfte
 * Recherche nach `<ausgabe.md>` (so, wie der Server sie in den Arbeitsordner legt), die Mitschrift nach
 * `_ki-mitschrift/` daneben und am Ende Prüfpunkte und Kosten. Lehnt die Prüfung sie ab, liegt die Datei des Laufs als
 * `<ausgabe>.abgelehnt.md` daneben.
 */
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { Art, Fach, Klasse, RechercheAnfrage } from '@schoolbox/kern';
import {
	ARTEN,
	FAECHER,
	KLASSEN,
	ladeKonfig,
	pruefpunkteAus,
	pruefpunkteBefund,
	RECHERCHE_DATEI,
	rechercheText,
	WURZEL,
} from '@schoolbox/kern';

import { beendeKind, KI_GRENZEN, kiPfad, legeAblageAn, recherchiere } from '../src/ki';
import { kiLaufJetzt } from '../src/ki-einstellung';

class Abbruch extends Error {}

interface Optionen {
	ausgabe: string;
	anfrage: RechercheAnfrage;
	ja: boolean;
}

const leseOptionen = (argv: string[]): Optionen => {
	const anfrage: RechercheAnfrage = { fach: 'mathematik', klasse: 2, thema: 'Achsensymmetrie', ziele: [] };
	let ausgabe = '';
	let ja = false;
	const wert = (i: number, name: string) => {
		const w = argv[i + 1];
		if (!w || w.startsWith('--')) {
			throw new Abbruch(`${name} braucht einen Wert.`);
		}
		return w;
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i] ?? '';
		if (a === '--ja') {
			ja = true;
		} else if (a === '--thema') {
			anfrage.thema = wert(i, a);
			i++;
		} else if (a === '--fach') {
			const fach = wert(i, a);
			if (!FAECHER.includes(fach as Fach)) {
				throw new Abbruch(`Unbekanntes Fach: ${fach}. Erlaubt: ${FAECHER.join(', ')}.`);
			}
			anfrage.fach = fach as Fach;
			i++;
		} else if (a === '--klasse') {
			const roh = wert(i, a);
			const klasse = KLASSEN.find((k) => String(k) === roh);
			if (klasse === undefined) {
				throw new Abbruch(`Unbekannte Klasse: ${roh}. Erlaubt: ${KLASSEN.join(', ')}.`);
			}
			anfrage.klasse = klasse;
			i++;
		} else if (a === '--ziel') {
			anfrage.ziele.push(wert(i, a));
			i++;
		} else if (a === '--material') {
			const art = wert(i, a);
			if (!ARTEN.includes(art as Art)) {
				throw new Abbruch(`Unbekannte Art: ${art}.`);
			}
			anfrage.art = art as Art;
			i++;
		} else if (a.startsWith('--')) {
			throw new Abbruch(`Unbekannte Option: ${a}`);
		} else if (!ausgabe) {
			ausgabe = path.resolve(a);
		} else {
			throw new Abbruch(`Nur eine Ausgabedatei: ${a}`);
		}
	}
	if (!ausgabe) {
		throw new Abbruch('Aufruf: tsx scripts/recherche.ts <ausgabe.md> [--thema …] [--fach …] [--klasse …] [--ja]');
	}
	if (existsSync(ausgabe)) {
		throw new Abbruch(`${ausgabe} gibt es schon. Nichts gestartet.`);
	}
	return { ausgabe, anfrage, ja };
};

const usd = (n: number) => `${n.toFixed(2).replace('.', ',')} USD`;

const fuehreAus = async (o: Optionen) => {
	const konfig = ladeKonfig();
	const ki = await kiLaufJetzt(konfig, 'gross');
	const g = KI_GRENZEN.recherche;
	console.log(`Nachricht an den Lauf:\n${rechercheText(o.anfrage)}\n`);
	console.log(
		`Modell ${ki.modell}, Gründlichkeit ${ki.effort}. Budget höchstens ${usd(g.budgetUsd)}, dazu bei Überlänge eine Kürzungsrunde bis ${usd(g.kuerzen.budgetUsd)}; gemessen rund 2 USD.`,
	);
	if (!o.ja) {
		console.log('Nichts gestartet. Mit --ja starten.');
		return;
	}
	const arbeit = await mkdtemp(path.join(tmpdir(), 'schoolbox-recherche-'));
	const zustand: { laufend: ChildProcessWithoutNullStreams | null; abgebrochen: boolean } = {
		laufend: null,
		abgebrochen: false,
	};
	process.on('SIGINT', () => {
		zustand.abgebrochen = true;
		if (zustand.laufend) {
			beendeKind(zustand.laufend);
		}
	});
	try {
		const ablage = path.join(arbeit, 'ablage');
		await legeAblageAn(ablage, path.join(WURZEL, 'skills'));
		const ordner = path.join(arbeit, 'recherche');
		await mkdir(path.dirname(o.ausgabe), { recursive: true });
		const beginn = Date.now();
		const { ergebnis, verbrauch } = await recherchiere({
			bin: kiPfad(konfig),
			...ki,
			ordner,
			ablage,
			anfrage: o.anfrage,
			guthaben: false,
			schritt: (text) => console.log(`… ${text}`),
			gestartet: (kind) => {
				zustand.laufend = kind;
			},
			abgebrochen: () => zustand.abgebrochen,
			mitschrift: { materialDir: path.dirname(o.ausgabe), mappe: 'recherche', dok: null, art: 'recherche' },
		});
		const sekunden = Math.round((Date.now() - beginn) / 1000);
		const kosten = typeof verbrauch.kostenUsd === 'number' ? verbrauch.kostenUsd : 0;
		if (ergebnis.ok) {
			await writeFile(o.ausgabe, `${ergebnis.text}\n`);
			const punkte = pruefpunkteAus(ergebnis.text);
			console.log(
				`\nGeschrieben: ${o.ausgabe} (${ergebnis.text.length} Zeichen, ${ergebnis.quellen.length} Quellen, ${punkte.length} Prüfpunkte).`,
			);
			console.log(pruefpunkteBefund(ergebnis.text) ?? 'Prüfpunkte: in Ordnung.');
			for (const p of punkte) {
				console.log(`- ${p}`);
			}
		} else {
			const roh = path.join(ordner, RECHERCHE_DATEI);
			const abgelehnt = `${o.ausgabe.replace(/\.md$/, '')}.abgelehnt.md`;
			if (existsSync(roh)) {
				await copyFile(roh, abgelehnt);
			}
			console.log(
				`\nGescheitert: ${ergebnis.grund}${existsSync(abgelehnt) ? ` Datei des Laufs: ${abgelehnt}` : ''}`,
			);
		}
		console.log(`\n${sekunden} s, Kosten ${usd(kosten)}.`);
	} finally {
		await rm(arbeit, { recursive: true, force: true });
	}
};

Promise.resolve()
	.then(() => fuehreAus(leseOptionen(process.argv.slice(2))))
	.catch((fehler: unknown) => {
		console.error(fehler instanceof Abbruch ? fehler.message : fehler);
		process.exit(fehler instanceof Abbruch ? 2 : 1);
	});

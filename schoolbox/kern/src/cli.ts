import path from 'node:path';
import type { ParseArgsConfig } from 'node:util';
import { parseArgs } from 'node:util';

import type { Ziel } from './ablage';
import {
	leseMappe,
	leseMeta,
	listeMappen,
	neueMappe,
	neuesDokument,
	notiereWunsch,
	registriereEntwuerfe,
	waehleEntwurf,
	zerlegeZiel,
} from './ablage';
import { erzeugeGeheimnis, erzeugePasswortHash, pruefeNeuesPasswort, setzeEnvWerte } from './anmeldung';
import { fertigstellen } from './bauen';
import { SchoolboxFehler } from './fehler';
import type { Konfig } from './konfig';
import { ladeKonfig } from './konfig';
import { ARTEN, DRUCKPROFILE, FAECHER, FORMATE, STANDARD_FORMAT, waehleKlasse, waehleWert } from './werte';

const HILFE = `schoolbox – Mappen und Dokumente der Schoolbox anlegen und fertigstellen

  schoolbox neu --titel … --fach … --klasse …
  schoolbox dokument <mappe> --titel … --art … --druckprofil sw|farbe [--format …] [--vorlage arbeitsblatt]
                     [--druckhinweis "…"]…
  schoolbox entwuerfe <mappe>/<dok> A.html B.html [C.html]
  schoolbox waehle <mappe>/<dok> B
  schoolbox fertig <mappe>/<dok>
  schoolbox link <mappe>[/<dok>]
  schoolbox liste [--fach …] [--suche …]
  schoolbox wunsch "…"
  schoolbox status
  schoolbox passwort      (Passwort der Anmeldung setzen oder ändern)

Alle Befehle: --json für maschinenlesbare Ausgabe.
Fächer:  ${FAECHER.join(', ')}
Arten:   ${ARTEN.join(', ')}
Formate: ${FORMATE.join(', ')} (Standard ${STANDARD_FORMAT})
Klassen: 1, 2, 3, 4, gemischt`;

interface Ergebnis {
	code?: number;
	daten: object;
	text: string;
}

type Optionen = NonNullable<ParseArgsConfig['options']>;

const lies = <O extends Optionen>(argumente: string[], options: O) => {
	try {
		return parseArgs({ args: argumente, options, allowPositionals: true, strict: true });
	} catch (fehler) {
		throw new SchoolboxFehler(`${(fehler as Error).message}\n\n${HILFE}`);
	}
};

const pflicht = (wert: string | undefined, name: string): string => {
	if (!wert?.trim()) {
		throw new SchoolboxFehler(`--${name} fehlt.`);
	}
	return wert.trim();
};

const linkZu = (konfig: Konfig, ziel: Ziel): string => {
	if (!konfig.schoolboxUrl) {
		throw new SchoolboxFehler('SCHOOLBOX_URL fehlt in der .env im Repo-Hauptordner.');
	}
	return `${konfig.schoolboxUrl}/m/${ziel.mappe}${ziel.dok ? `/${ziel.dok}` : ''}`;
};

const mitDokument = (ziel: Ziel): Ziel & { dok: string } => ({ ...ziel, dok: ziel.dok ?? '' });

const befehlNeu = async (konfig: Konfig, argumente: string[]): Promise<Ergebnis> => {
	const { values } = lies(argumente, {
		titel: { type: 'string' },
		fach: { type: 'string' },
		klasse: { type: 'string' },
	});
	const titel = pflicht(values.titel, 'titel');
	const fach = waehleWert('Fach', values.fach, FAECHER);
	const klasse = waehleKlasse(values.klasse);
	const { mappe, pfad } = await neueMappe(konfig.materialDir, { titel, fach, klasse });
	return { daten: { id: mappe.id, pfad }, text: `Mappe angelegt: ${mappe.id}\nOrdner: ${pfad}` };
};

const befehlDokument = async (konfig: Konfig, argumente: string[]): Promise<Ergebnis> => {
	const { positionals, values } = lies(argumente, {
		titel: { type: 'string' },
		art: { type: 'string' },
		format: { type: 'string' },
		druckprofil: { type: 'string' },
		vorlage: { type: 'string' },
		druckhinweis: { type: 'string', multiple: true },
	});
	const { mappe } = zerlegeZiel(positionals[0], false);
	const angaben = {
		titel: pflicht(values.titel, 'titel'),
		art: waehleWert('Art', values.art, ARTEN),
		format: waehleWert('Format', values.format ?? STANDARD_FORMAT, FORMATE),
		druckprofil: waehleWert('Druckprofil', values.druckprofil, DRUCKPROFILE),
		vorlage: values.vorlage,
		druckhinweise: (values.druckhinweis ?? []).map((h) => h.trim()).filter(Boolean),
	};
	const { id, pfad } = await neuesDokument(konfig.materialDir, mappe, angaben);
	const hinweis =
		(await leseMappe(konfig.materialDir, mappe)).klasse === 'gemischt'
			? '\nHinweis: Mappe für gemischte Klassen. Klassenstufe (kl1–kl4) bitte selbst am <body> setzen.'
			: '';
	return {
		daten: { id: `${mappe}/${id}`, pfad },
		text: `Dokument angelegt: ${mappe}/${id}\nQuelle: ${pfad}${hinweis}`,
	};
};

const befehlEntwuerfe = async (konfig: Konfig, argumente: string[]): Promise<Ergebnis> => {
	const { positionals } = lies(argumente, {});
	const ziel = mitDokument(zerlegeZiel(positionals[0], true));
	const dateien = positionals.slice(1).map((d) => path.resolve(d));
	const entwuerfe = await registriereEntwuerfe(konfig.materialDir, ziel, dateien);
	const zeilen = entwuerfe.map((e) => `  ${e.name} · ${e.titel}${e.idee ? ` – ${e.idee}` : ''}`);
	return { daten: { entwuerfe }, text: `Entwürfe registriert:\n${zeilen.join('\n')}` };
};

const befehlWaehle = async (konfig: Konfig, argumente: string[]): Promise<Ergebnis> => {
	const { positionals } = lies(argumente, {});
	const ziel = mitDokument(zerlegeZiel(positionals[0], true));
	const { entwurf } = await waehleEntwurf(konfig.materialDir, ziel, pflicht(positionals[1], 'Entwurf (A, B, C)'));
	return {
		daten: { entwurf },
		text: `Entwurf ${entwurf.name} („${entwurf.titel}“) ist jetzt material.html von ${ziel.mappe}/${ziel.dok}.`,
	};
};

const befehlFertig = async (konfig: Konfig, argumente: string[]): Promise<Ergebnis> => {
	const { positionals } = lies(argumente, {});
	const ziel = mitDokument(zerlegeZiel(positionals[0], true));
	const { ausgabe, bericht, hinweiseBau, meta } = await fertigstellen(konfig, ziel);
	const link = linkZu(konfig, ziel);
	const pruefung = meta.pruefung ?? { fehler: 0, warnungen: 0, hinweise: 0 };
	const meldungen = bericht.meldungen.map((m) => `${m.stufe.padEnd(8)} ${m.seite ? `S. ${m.seite}: ` : ''}${m.text}`);
	const warnung = pruefung.fehler > 0 ? ' Die Schoolbox zeigt beim Drucken eine Warnung an.' : '';
	const text = [
		...meldungen,
		`Prüfung: ${pruefung.fehler} Fehler, ${pruefung.warnungen} Warnungen, ${pruefung.hinweise} Hinweise.${warnung}`,
		`Seiten: ${meta.seiten}${meta.hatLoesung ? ', mit Lösungsblatt' : ''}`,
		`Ausgabe: ${ausgabe}`,
		`Link: ${link}`,
	].join('\n');
	return {
		code: pruefung.fehler > 0 ? 1 : 0,
		daten: { link, meta, meldungen: bericht.meldungen, hinweiseBau, ausgabe },
		text,
	};
};

const befehlLink = async (konfig: Konfig, argumente: string[]): Promise<Ergebnis> => {
	const { positionals } = lies(argumente, {});
	const ziel = zerlegeZiel(positionals[0], false);
	await (ziel.dok ? leseMeta(konfig.materialDir, ziel.mappe, ziel.dok) : leseMappe(konfig.materialDir, ziel.mappe));
	const link = linkZu(konfig, ziel);
	return { daten: { link }, text: link };
};

const befehlListe = async (konfig: Konfig, argumente: string[]): Promise<Ergebnis> => {
	const { values } = lies(argumente, { fach: { type: 'string' }, suche: { type: 'string' } });
	const fach = values.fach === undefined ? undefined : waehleWert('Fach', values.fach, FAECHER);
	const eintraege = await listeMappen(konfig.materialDir, { fach, suche: values.suche });
	const zeilen = eintraege.flatMap(({ dokumente, mappe }) => [
		`${mappe.id}  ${mappe.titel} · ${mappe.fach} · Kl. ${mappe.klasse} · ${mappe.status} · geändert ${mappe.geaendert.slice(0, 10)}`,
		...dokumente.map(({ id, meta }) => `    ${id}  ${meta.titel} · ${meta.art} · ${meta.format} · ${meta.status}`),
	]);
	return {
		daten: { mappen: eintraege },
		text: zeilen.length > 0 ? zeilen.join('\n') : 'Keine Mappen gefunden.',
	};
};

const befehlWunsch = async (konfig: Konfig, argumente: string[]): Promise<Ergebnis> => {
	const { positionals } = lies(argumente, {});
	const datei = await notiereWunsch(konfig.materialDir, positionals.join(' '));
	return { daten: { datei }, text: `Wunsch notiert in ${datei}` };
};

const befehlStatus = async (konfig: Konfig): Promise<Ergebnis> => {
	if (!konfig.schoolboxUrl) {
		throw new SchoolboxFehler('SCHOOLBOX_URL fehlt in der .env im Repo-Hauptordner.');
	}
	const url = `${konfig.schoolboxUrl}/healthz`;
	const antwort = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null);
	const erreichbar = antwort?.ok === true;
	return {
		code: erreichbar ? 0 : 1,
		daten: { erreichbar, url, http: antwort?.status ?? null },
		text: erreichbar ? 'Die Schoolbox ist erreichbar.' : `Die Schoolbox ist nicht erreichbar (${url}).`,
	};
};

/** Liest ohne Echo vom Terminal. Strg+C bzw. Strg+D brechen ab. */
const leseVerdeckt = (frage: string) =>
	new Promise<string>((resolve, reject) => {
		const { stderr, stdin } = process;
		let eingabe: string[] = [];
		const ende = (fehler?: Error) => {
			stdin.removeAllListeners('data');
			stdin.setRawMode(false);
			stdin.pause();
			stderr.write('\n');
			if (fehler) {
				reject(fehler);
			} else {
				resolve(eingabe.join(''));
			}
		};
		const beiDaten = (teil: string) => {
			for (const zeichen of teil) {
				if (zeichen === '\r' || zeichen === '\n') {
					ende();
					return;
				}
				if (zeichen === '\u0003' || zeichen === '\u0004') {
					ende(new SchoolboxFehler('Abgebrochen, nichts geändert.'));
					return;
				}
				if (zeichen === '\u007f' || zeichen === '\b') {
					eingabe = eingabe.slice(0, -1);
				} else if (zeichen >= ' ') {
					eingabe.push(zeichen);
				}
			}
		};
		stderr.write(frage);
		stdin.setEncoding('utf8');
		stdin.setRawMode(true);
		stdin.on('data', beiDaten);
		stdin.resume();
	});

/** Ohne Terminal (Skripte, Tests) gilt die erste Zeile der Standardeingabe. */
const leseZeile = async () => {
	let text = '';
	for await (const teil of process.stdin) {
		text += String(teil);
	}
	return text.split(/\r?\n/)[0] ?? '';
};

const befehlPasswort = async (konfig: Konfig, argumente: string[]): Promise<Ergebnis> => {
	lies(argumente, {});
	let passwort: string;
	if (process.stdin.isTTY) {
		passwort = await leseVerdeckt('Neues Passwort für die Schoolbox: ');
		pruefeNeuesPasswort(passwort);
		if ((await leseVerdeckt('Noch einmal zur Kontrolle: ')) !== passwort) {
			throw new SchoolboxFehler('Die beiden Eingaben stimmen nicht überein, nichts geändert.');
		}
	} else {
		passwort = await leseZeile();
		pruefeNeuesPasswort(passwort);
	}
	const datei = path.join(konfig.wurzel, '.env');
	const werte: Record<string, string> = { PASSWORT_HASH: await erzeugePasswortHash(passwort) };
	const geheimnisNeu = !konfig.sitzungGeheimnis;
	if (geheimnisNeu) {
		werte.SITZUNG_GEHEIMNIS = erzeugeGeheimnis();
	}
	await setzeEnvWerte(datei, werte);
	const text = [
		`Passwort gespeichert (PASSWORT_HASH in ${datei}).`,
		...(geheimnisNeu ? ['SITZUNG_GEHEIMNIS fehlte und wurde zufällig erzeugt.'] : []),
		'Es gilt nach dem nächsten Neustart der Schoolbox (z. B. „pm2 reload schoolbox“).',
		'Danach sind alle bisherigen Anmeldungen ungültig.',
	].join('\n');
	return { daten: { datei, geheimnisNeu }, text };
};

const BEFEHLE: Record<string, (konfig: Konfig, argumente: string[]) => Promise<Ergebnis>> = {
	neu: befehlNeu,
	dokument: befehlDokument,
	entwuerfe: befehlEntwuerfe,
	waehle: befehlWaehle,
	fertig: befehlFertig,
	link: befehlLink,
	liste: befehlListe,
	wunsch: befehlWunsch,
	status: befehlStatus,
	passwort: befehlPasswort,
};

const main = async (argv: string[]): Promise<number> => {
	const json = argv.includes('--json');
	const [befehl, ...argumente] = argv.filter((a) => a !== '--json');
	try {
		if (!befehl || ['hilfe', '--hilfe', '--help', '-h'].includes(befehl)) {
			console.log(HILFE);
			return befehl ? 0 : 2;
		}
		const ausfuehren = BEFEHLE[befehl];
		if (!ausfuehren) {
			throw new SchoolboxFehler(`Unbekannter Befehl „${befehl}“.\n\n${HILFE}`);
		}
		const { code = 0, daten, text } = await ausfuehren(ladeKonfig(), argumente);
		console.log(json ? JSON.stringify(daten, null, '\t') : text);
		return code;
	} catch (fehler) {
		if (!(fehler instanceof SchoolboxFehler)) {
			throw fehler;
		}
		if (json) {
			console.log(JSON.stringify({ fehler: fehler.message }, null, '\t'));
		} else {
			console.error(fehler.message);
		}
		return fehler.exitCode;
	}
};

main(process.argv.slice(2))
	.then((code) => {
		process.exitCode = code;
	})
	.catch((fehler: unknown) => {
		console.error(fehler);
		process.exitCode = 3;
	});

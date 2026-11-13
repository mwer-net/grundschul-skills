/**
 * Unterrichtseinheit (139): Angaben aus dem Assistenten, der Auftrag an Claude und der Plan, den Claude in
 * `einheit.json` schreibt. Eine Einheit ist ein Ordner mit einem Behälter, keine neue `Art` (140).
 */
import { SchoolboxFehler } from './fehler';
import { FACH_NAME } from './namen';
import { ID_MUSTER } from './schema';
import type { Art, Fach, Format, Klasse } from './werte';
import { ARTEN, FAECHER, FORMATE, KLASSEN } from './werte';

export const EINHEIT_PLAN = 'einheit.json';
export const EINHEIT_THEMA = 'thema.css';
export const EINHEIT_ZEICHEN = { thema: 200, ziel: 200, frei: 1500, idee: 300, titel: 120 };
export const EINHEIT_MAX_DOKUMENTE = 24;
/** Auftrag „Als Text bearbeiten“ im Assistenten (140). */
export const EINHEIT_AUFTRAG_ZEICHEN = 6000;
/** Kasten „Verbrauch“ vor dem Start (140); Werte aus dem Messlauf in 139. */
export const EINHEIT_VERBRAUCH =
	'Zuerst zeigt Claude dir den Plan: die Geschichte und alle Materialien. Das dauert einige Minuten. Nach deiner Freigabe baut Claude jedes Material, prüft es und sieht es sich an; je nach Umfang dauert das eine bis drei Stunden und verbraucht sehr viel von deinem Limit. Du kannst weiterarbeiten; die Materialien erscheinen im Ordner, sobald sie fertig sind.';
const SLUG = new RegExp(ID_MUSTER);
const MAX_SLUG = 60;

export const EINHEIT_DAUER = ['1 Woche', '2 Wochen', '3–4 Wochen'] as const;
export const EINHEIT_MENGE = ['claude', 'etwa 6', 'etwa 12', 'etwa 16'] as const;
export const EINHEIT_LEITFIGUR = ['willi', 'wilma', 'beide', 'keine'] as const;
/** Ein eigenes Thema von Claude oder schlicht. */
export const EINHEIT_AUSSEHEN = ['eigen', 'schlicht'] as const;

export interface EinheitAngaben {
	titel: string;
	fach: Fach;
	klasse: Klasse;
	thema: string;
	ziele: string[];
	vorwissen: string;
	dauer: string;
	stundenJeWoche: number;
	menge: (typeof EINHEIT_MENGE)[number];
	bestandteile: string[];
	nochEtwas: string;
	rahmen: boolean;
	idee: string;
	leitfigur: (typeof EINHEIT_LEITFIGUR)[number];
	aussehen: (typeof EINHEIT_AUSSEHEN)[number];
	/** Neue Bilder mit Canva (138). */
	bilder: boolean;
	bausteine: { selbsteinschaetzung: boolean; niveaus: boolean; sternchen: boolean };
	lerngruppe: string[];
	klasseText: string;
}

const fehler = (text: string) => new SchoolboxFehler(text);

const text = (wert: unknown, max: number, name: string, pflicht = false) => {
	if (wert === undefined || wert === null) {
		if (pflicht) {
			throw fehler(`Es fehlt: ${name}.`);
		}
		return '';
	}
	if (typeof wert !== 'string' || wert.length > max) {
		throw fehler(`${name} ist zu lang oder ungültig (höchstens ${max} Zeichen).`);
	}
	const t = wert.trim();
	if (pflicht && t === '') {
		throw fehler(`Es fehlt: ${name}.`);
	}
	return t;
};

const liste = (wert: unknown, max: number, laenge: number, name: string) => {
	if (wert === undefined) {
		return [];
	}
	if (!Array.isArray(wert) || wert.length > laenge) {
		throw fehler(`${name} ist ungültig.`);
	}
	return wert.map((w) => text(w, max, name)).filter(Boolean);
};

const eins = <T extends string | number>(wert: unknown, erlaubt: readonly T[], name: string, standard?: T): T => {
	if (wert === undefined && standard !== undefined) {
		return standard;
	}
	if (!erlaubt.includes(wert as T)) {
		throw fehler(`${name} ist ungültig.`);
	}
	return wert as T;
};

const ja = (wert: unknown) => wert === true;

/** Prüft die Angaben aus dem Assistenten (140). Was fehlt, bekommt die Empfehlung. */
export const pruefeEinheitAngaben = (roh: unknown): EinheitAngaben => {
	const b = (roh ?? {}) as Record<string, unknown>;
	const thema = text(b.thema, EINHEIT_ZEICHEN.thema, 'Thema', true);
	const klasse = eins(b.klasse, KLASSEN, 'Die Klasse');
	const stunden = b.stundenJeWoche === undefined ? 4 : Number(b.stundenJeWoche);
	if (!Number.isInteger(stunden) || stunden < 1 || stunden > 10) {
		throw fehler('Stunden je Woche ist ungültig.');
	}
	const z = (b.bausteine ?? {}) as Record<string, unknown>;
	return {
		titel: text(b.titel, EINHEIT_ZEICHEN.titel, 'Titel') || thema,
		fach: eins(b.fach, FAECHER, 'Das Fach'),
		klasse,
		thema,
		ziele: liste(b.ziele, EINHEIT_ZEICHEN.ziel, 8, 'Ziele'),
		vorwissen: text(b.vorwissen, EINHEIT_ZEICHEN.frei, 'Vorwissen'),
		dauer: text(b.dauer, 60, 'Dauer') || '2 Wochen',
		stundenJeWoche: stunden,
		menge: eins(b.menge, EINHEIT_MENGE, 'Die Zahl der Materialien', 'claude'),
		bestandteile: liste(b.bestandteile, 60, 20, 'Bestandteile'),
		nochEtwas: text(b.nochEtwas, EINHEIT_ZEICHEN.frei, 'Noch etwas'),
		rahmen: b.rahmen === undefined ? true : ja(b.rahmen),
		idee: text(b.idee, EINHEIT_ZEICHEN.idee, 'Idee'),
		leitfigur: eins(b.leitfigur, EINHEIT_LEITFIGUR, 'Die Leitfigur', 'beide'),
		aussehen: eins(b.aussehen, EINHEIT_AUSSEHEN, 'Das Aussehen', 'eigen'),
		bilder: b.bilder === undefined ? true : ja(b.bilder),
		bausteine: {
			selbsteinschaetzung: ja(z.selbsteinschaetzung),
			niveaus: ja(z.niveaus),
			sternchen: ja(z.sternchen),
		},
		lerngruppe: liste(b.lerngruppe, 80, 10, 'Lerngruppe'),
		klasseText: text(b.klasseText, EINHEIT_ZEICHEN.frei, 'Deine Klasse'),
	};
};

const KLASSE_NAME = (k: Klasse) => (k === 'gemischt' ? 'jahrgangsgemischt' : `Klasse ${k}`);
const FIGUR = { willi: 'Willi', wilma: 'Wilma', beide: 'Willi und Wilma', keine: '' };

/** Der Teil der Lehrkraft am Auftrag, lesbar und in Sätzen (wie 131). Der feste Teil steht in `vorlagen/ki/einheit.md`. */
const aussehenSatz = (wert: EinheitAngaben['aussehen']) =>
	wert === 'eigen' ? 'Aussehen: Gestalte ein eigenes Thema in thema.css.' : 'Aussehen: schlicht, ohne thema.css.';

export const einheitAuftragAus = (a: EinheitAngaben): string => {
	const saetze = [
		`Erstelle eine Unterrichtseinheit „${a.titel}“ für ${FACH_NAME[a.fach]}, ${KLASSE_NAME(a.klasse)}, zum Thema „${a.thema}“.`,
		`Dauer: ${a.dauer}, ${a.stundenJeWoche} Stunden je Woche. Zahl der Materialien: ${a.menge === 'claude' ? 'entscheide du' : a.menge}.`,
		a.ziele.length ? `Ich-kann-Ziele: ${a.ziele.join(' · ')}` : 'Formuliere die Ich-kann-Ziele selbst.',
		a.vorwissen ? `Vorwissen der Klasse: ${a.vorwissen}` : '',
		a.bestandteile.length ? `Bestandteile: ${a.bestandteile.join(', ')}.` : '',
		a.nochEtwas ? `Außerdem als Bestandteil: ${a.nochEtwas}` : '',
		a.rahmen ? `Mit Rahmengeschichte${a.idee ? `, Idee: ${a.idee}` : ''}.` : 'Ohne Rahmengeschichte.',
		a.leitfigur === 'keine' ? 'Ohne Leitfigur.' : `Leitfigur: ${FIGUR[a.leitfigur]}.`,
		aussehenSatz(a.aussehen),
		a.bilder
			? 'Neue Bilder mit Canva sind erlaubt (bilder.json).'
			: 'Keine neuen Bilder: nur Willi, Wilma und berechnete Abbildungen.',
		[
			a.bausteine.selbsteinschaetzung ? 'Selbsteinschätzung' : '',
			a.bausteine.niveaus ? 'drei Niveaus' : '',
			a.bausteine.sternchen ? 'Sternchenaufgabe' : '',
		].filter(Boolean).length
			? `Auf allen Blättern: ${[
					a.bausteine.selbsteinschaetzung ? 'Selbsteinschätzung' : '',
					a.bausteine.niveaus ? 'drei Niveaus' : '',
					a.bausteine.sternchen ? 'Sternchenaufgabe' : '',
				]
					.filter(Boolean)
					.join(', ')}.`
			: '',
		a.lerngruppe.length ? `Lerngruppe: ${a.lerngruppe.join(', ')}.` : '',
		a.klasseText ? `Zur Klasse: ${a.klasseText}` : '',
	];
	return saetze.filter(Boolean).join('\n');
};

export interface PlanDokument {
	slug: string;
	titel: string;
	art: Art;
	format: Format;
	zweck: string;
	fertig: boolean;
}

export interface EinheitPlan {
	titel: string;
	annahmen: string[];
	dokumente: PlanDokument[];
}

const kurz = (wert: unknown, max: number) => (typeof wert === 'string' ? wert.trim().slice(0, max) : '');

/**
 * Liest `einheit.json`. Ein ungültiger Eintrag fällt heraus, statt den ganzen Plan zu verwerfen: Claude schreibt die
 * Datei oft und ein Tippfehler darf keine fertigen Dokumente verstecken. Der Slug ist der einzige Pfadteil, der aus
 * dem Lauf kommt; er passt auf `ID_MUSTER` oder fällt heraus.
 */
export const lesePlan = (roh: unknown, max = EINHEIT_MAX_DOKUMENTE): EinheitPlan | null => {
	if (typeof roh !== 'object' || roh === null) {
		return null;
	}
	const p = roh as Record<string, unknown>;
	const gesehen = new Set<string>();
	const dokumente = (Array.isArray(p.dokumente) ? p.dokumente : [])
		.map((d): PlanDokument | null => {
			const x = (d ?? {}) as Record<string, unknown>;
			const slug = typeof x.slug === 'string' ? x.slug : '';
			if (!SLUG.test(slug) || slug.length > MAX_SLUG || gesehen.has(slug)) {
				return null;
			}
			if (!ARTEN.includes(x.art as Art) || !FORMATE.includes(x.format as Format)) {
				return null;
			}
			gesehen.add(slug);
			return {
				slug,
				titel: kurz(x.titel, EINHEIT_ZEICHEN.titel) || slug,
				art: x.art as Art,
				format: x.format as Format,
				zweck: kurz(x.zweck, 300),
				fertig: x.fertig === true,
			};
		})
		.filter((d): d is PlanDokument => d !== null)
		.slice(0, max);
	return {
		titel: kurz(p.titel, EINHEIT_ZEICHEN.titel),
		annahmen: (Array.isArray(p.annahmen) ? p.annahmen : [])
			.map((a) => kurz(a, 300))
			.filter(Boolean)
			.slice(0, 12),
		dokumente,
	};
};

/**
 * Was ein Thema der Einheit nicht darf: andere Dateien laden oder aus dem Stil ausbrechen. Die Regeln für Variablen
 * und Eigenschaften prüft `pruefung.js` beim Bauen jedes Dokuments; das hier ist die Sperre davor.
 */
export const themaBefund = (css: string): string | null => {
	if (css.length > 64 * 1024) {
		return 'thema.css ist zu groß.';
	}
	if (/@import|url\s*\(|expression\s*\(|<\/?style|<\/?script|javascript:/i.test(css)) {
		return 'thema.css lädt fremde Inhalte (@import, url() oder Skript).';
	}
	return null;
};

// ——— Stand (Server und Oberfläche) ———

/** `plan`: Claude hat den Plan gezeigt und wartet auf die Freigabe der Lehrkraft. */
export type EinheitStatus = 'laeuft' | 'plan' | 'fertig' | 'unvollstaendig' | 'verworfen';

export interface EinheitBefund {
	slug: string;
	dok: string | null;
	texte: string[];
}

/** Liegt in `stand.json` neben dem Arbeitsordner, wo Claude nicht schreiben darf; `GET /api/einheiten` liefert ihn. */
export interface EinheitStand {
	id: string;
	titel: string;
	ordner: string;
	mappe: string;
	status: EinheitStatus;
	grund: string | null;
	start: string;
	ende: string | null;
	sitzung: string | null;
	plan: EinheitPlan | null;
	importiert: Record<string, { dok: string; kennung: string }>;
	befunde: EinheitBefund[];
	korrigiert: boolean;
	/** Der Teil der Lehrkraft am Auftrag, wie er an Claude ging. */
	auftrag: string;
	bilder: boolean;
	geladeneBilder: number;
	fehlgeschlageneBilder: number;
	/** Claudes Plan als Text: Geschichte, Rätselkette, Materialien. Die Lehrkraft gibt ihn frei, bevor gebaut wird. */
	planText?: string | null;
	freigegeben?: boolean;
}

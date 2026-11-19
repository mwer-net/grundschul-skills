/**
 * Assistent „Material anlegen“ (131, Entwurf A1): Schritte, Antworten, Empfehlungen, Freitext und der Auftrag an
 * Claude als Daten. Die Oberfläche (132) braucht keine eigene Liste, der Server baut daraus den Auftrag selbst.
 * Die Didaktik steht im Skill: Start-Abfrage und Ablauf 2.3 und 2.4 in `grundschul-didaktik/references/rueckfragen.md`.
 * Ohne Node-Abhängigkeiten, damit auch die Oberfläche sie nutzen kann.
 */
import type { EinheitAngaben } from './einheit';
import { EINHEIT_AUSSEHEN, EINHEIT_BESTANDTEILE, EINHEIT_DAUER, EINHEIT_ZEICHEN } from './einheit';
import type { EinheitLeitfigur } from './einheit-figuren';
import { FIGUR_ZEICHEN, leitfigurKurz, leitfigurSatz, leitfigurStandard, leseLeitfigur } from './einheit-figuren';
import { SchoolboxFehler } from './fehler';
import { ART_NAME, FACH_NAME } from './namen';
import type { Art, Fach, Format, Klasse } from './werte';
import { ART_ANGABEN, ARTEN, FAECHER, FORMAT_NAME, formateVon, KLASSEN } from './werte';

export const WEGE = ['claude', 'leer'] as const;
export type Weg = (typeof WEGE)[number];

interface Wert<T extends string> {
	wert: T;
	name: string;
}

/** Wie in A1 S. 2. */
export const WEG_WAHL: readonly (Wert<Weg> & { hinweis: string })[] = [
	{
		wert: 'claude',
		name: 'Claude erstellt einen Entwurf',
		hinweis:
			'Du beantwortest ein paar Fragen. Claude zeigt dir zuerst den Aufgabenplan; nach deiner Freigabe baut es das Blatt.',
	},
	{
		wert: 'leer',
		name: 'Leeres Blatt',
		hinweis:
			'Du baust selbst, mit Bausteinen, Formen und Figuren. Nur wenige Fragen: Art, Format, Titel. Claude bleibt aus.',
	},
];

/** Kacheln in A1 S. 3; `klein`: als Chip darunter. Die Beschreibung ist `ART_KURZ`. */
export const ART_WAHL: readonly { art: Art; name: string; klein?: boolean }[] = [
	{ art: 'arbeitsblatt', name: ART_NAME.arbeitsblatt },
	{ art: 'lesetext', name: ART_NAME.lesetext },
	{ art: 'praesentation', name: ART_NAME.praesentation },
	{ art: 'lernspiel', name: ART_NAME.lernspiel },
	{ art: 'karten', name: 'Bild- und Wortkarten' },
	{ art: 'lernplakat', name: ART_NAME.lernplakat },
	{ art: 'stationen', name: 'Stationenlernen' },
	{ art: 'lernzielkontrolle', name: ART_NAME.lernzielkontrolle },
	{ art: 'klassenarbeit', name: ART_NAME.klassenarbeit },
	{ art: 'unterrichtsplanung', name: ART_NAME.unterrichtsplanung, klein: true },
	{ art: 'sonstiges', name: 'Etwas anderes', klein: true },
];

/** Für Sätze wie „Erstelle ein Arbeitsblatt“ und „Für ein Arbeitsblatt passen …“. */
const ART_AKKUSATIV: Record<Art, string> = {
	arbeitsblatt: 'ein Arbeitsblatt',
	klassenarbeit: 'eine Klassenarbeit',
	lernzielkontrolle: 'eine Lernzielkontrolle',
	lesetext: 'einen Lesetext',
	lernspiel: 'ein Lernspiel',
	karten: 'Bild- und Wortkarten',
	lernplakat: 'ein Lernplakat',
	praesentation: 'eine Präsentation',
	stationen: 'ein Stationenlernen',
	unterrichtsplanung: 'eine Unterrichtsplanung',
	sonstiges: 'ein Material',
};

/** Ablauf 2.3 in `rueckfragen.md`. */
export const FUNKTIONEN = [
	{ wert: 'einfuehrung', name: 'Einführung', satz: 'zur Einführung' },
	{ wert: 'uebung', name: 'Übung', satz: 'zum Üben' },
	{ wert: 'vertiefung', name: 'Vertiefung', satz: 'zur Vertiefung' },
	{ wert: 'ueberpruefung', name: 'Überprüfung', satz: 'zur Überprüfung' },
] as const satisfies readonly (Wert<string> & { satz: string })[];
export type Funktion = (typeof FUNKTIONEN)[number]['wert'];

/** Ablauf 2.4 in `rueckfragen.md` (Leistungsspanne, DaZ, Förderbedarfe). */
export const LERNGRUPPE = [
	{ wert: 'leistungsspanne', name: 'Große Leistungsspanne', satz: 'große Leistungsspanne' },
	{ wert: 'daz', name: 'Kinder mit Deutsch als Zweitsprache', satz: 'Kinder mit Deutsch als Zweitsprache' },
	{ wert: 'lrs', name: 'Lese-Rechtschreib-Schwierigkeiten', satz: 'Kinder mit Lese-Rechtschreib-Schwierigkeiten' },
	{ wert: 'foerderbedarf', name: 'Förderbedarf Lernen', satz: 'Kinder mit Förderbedarf Lernen' },
	{ wert: 'leistungsstark', name: 'Sehr leistungsstark', satz: 'sehr leistungsstarke Kinder' },
] as const satisfies readonly (Wert<string> & { satz: string })[];
export type Lerngruppe = (typeof LERNGRUPPE)[number]['wert'];

/** Das Zeitziel: wie lange ein Kind am Material arbeitet. Daraus folgt die Menge (`druck-und-platz.md`). */
export const UMFAENGE = [
	{ wert: '10', name: '10 min', satz: 'Arbeitszeit je Kind 10 Minuten' },
	{ wert: '15', name: '15 min', satz: 'Arbeitszeit je Kind 15 Minuten' },
	{ wert: '20', name: '20 min', satz: 'Arbeitszeit je Kind 20 Minuten' },
	{ wert: '30', name: '30 min', satz: 'Arbeitszeit je Kind 30 Minuten' },
	{ wert: '45', name: '45 min', satz: 'Arbeitszeit je Kind 45 Minuten' },
	{ wert: 'claude', name: 'Claude entscheidet', satz: 'Arbeitszeit je Kind nicht festgelegt, entscheide du' },
] as const satisfies readonly (Wert<string> & { satz: string })[];
export type Umfang = (typeof UMFAENGE)[number]['wert'];

/**
 * Fragen 3 bis 5 der Start-Abfrage; ob sie kommen, sagt `ART_ANGABEN[art].bausteine`. `mit` und `ohne` sagen im
 * Auftrag, was die Wahl bewirkt (`rueckfragen.md`): Ohne den Satz griffe die Empfehlung des Skills (210).
 */
export const ZUSATZ_BAUSTEINE = [
	{
		wert: 'selbsteinschaetzung',
		name: 'Selbsteinschätzung',
		kurz: 'Selbsteinschätzung',
		satz: 'Selbsteinschätzung',
		mit: ': Wachstumsstufen Samen → Keimling → Pflanze → Blume zum Ankreuzen und eine Reflexionsfrage.',
		ohne: ': keine Wachstumsstufen (Samen bis Blume), keine Reflexionsfrage dazu, keine Lernlandkarte; der Platz geht an Aufgaben.',
		hinweis: 'Unten: Samen → Keimling → Pflanze → Blume und eine Reflexionsfrage',
	},
	{
		wert: 'niveaus',
		name: 'Drei Niveaus zur Wahl',
		kurz: 'Niveaus',
		satz: 'drei Niveaus zur Wahl',
		mit: ': ● Grundlage, ●● Kern, ●●● Herausforderung, die Kinder wählen.',
		ohne: ': alle Kinder bearbeiten dieselben Aufgaben, steigend im Anspruch; keine Niveau-Punkte ● ●● ●●●, keine Wahlhilfe.',
		hinweis: '● Grundlage · ●● Kern · ●●● Herausforderung (Churer Modell)',
	},
	{
		wert: 'sternchen',
		name: 'Sternchenaufgabe ★',
		kurz: 'Sternchen',
		satz: 'Sternchenaufgabe',
		mit: ': eine Knobelaufgabe ★ als letzte Aufgabe, freiwillig für alle.',
		ohne: ' ★.',
		hinweis: 'Eine Knobelaufgabe für alle, die mögen. Mit Niveaus nicht nötig, weil ●●● schon fordert.',
	},
] as const;
export type BausteinName = (typeof ZUSATZ_BAUSTEINE)[number]['wert'];

/** Satzanfänge für das Ich-kann-Ziel (A1 S. 6): ohne Claude, die Lehrkraft ergänzt. */
export const ZIEL_ANFAENGE = ['Ich kann ', 'Ich weiß, ', 'Ich kann erklären, '] as const;

/** Freitext je Stelle (Entscheidung 49, Festlegung F7). Nicht bei Klasse und Fach, nicht beim Format des leeren Blatts. */
export const FREITEXT = {
	artText: { name: 'Etwas anderes …', platz: 'z. B. Rätselheft, Urkunde, Elternbrief', zeichen: 80 },
	formatText: { name: 'Anderes Format …', platz: 'z. B. A4 quer mit vier Karten', zeichen: 80 },
	thema: { name: 'Thema', platz: 'z. B. Uhrzeit: volle und halbe Stunden', zeichen: 200 },
	ziel: { name: 'Ich-kann-Ziel', platz: 'Wenn leer, formuliert Claude das Ziel aus dem Thema.', zeichen: 200 },
	funktionText: { name: 'Anders …', platz: 'z. B. Wiederholung nach den Ferien', zeichen: 80 },
	umfangText: { name: 'Anders …', platz: 'z. B. zwei Schulstunden', zeichen: 80 },
	sonst: { name: 'Sonst noch etwas für Claude?', platz: 'z. B. Bitte keine Digitaluhren.', zeichen: 1000 },
	titel: { name: 'Titel', platz: '', zeichen: 120 },
} as const;
export type FreitextFeld = keyof typeof FREITEXT;

/**
 * Höchstlänge des Auftrags aus dem Assistenten, alle Freitexte voll. Der Server hängt ihn an
 * `vorlagen/ki/neu-entwurf.md`, beides zusammen bleibt unter `KI_GRENZEN.auftragZeichen` (ein Test wacht darüber).
 */
export const AUFTRAG_ZEICHEN = 3000;

// ——— Unterrichtseinheit (140) ———

/** Ein eigenes Thema von Claude oder schlicht, als Segment wie die Leitfigur. */
export const EINHEIT_AUSSEHEN_WAHL: readonly { wert: (typeof EINHEIT_AUSSEHEN)[number]; name: string }[] = [
	{ wert: 'eigen', name: 'Eigenes Thema' },
	{ wert: 'schlicht', name: 'Schlicht' },
];

export interface EinheitWahl {
	ziele: string[];
	vorwissen: string;
	dauer: (typeof EINHEIT_DAUER)[number];
	/** „Anders …“ bei der Dauer; geht vor `dauer`. */
	dauerText: string;
	stunden: number;
	/** `null`: die Empfehlung. */
	bestandteile: string[] | null;
	nochEtwas: string;
	idee: string;
	/** 242: eine Figur der Bibliothek (oder Willi und Wilma), eine eigene oder keine. */
	leitfigur: EinheitLeitfigur;
	aussehen: (typeof EINHEIT_AUSSEHEN)[number];
	bilder: boolean;
	verkauf: boolean;
	autor: string;
}

export const leereEinheit = (): EinheitWahl => ({
	ziele: [],
	vorwissen: '',
	dauer: '2 Wochen',
	dauerText: '',
	stunden: 4,
	bestandteile: null,
	nochEtwas: '',
	idee: '',
	leitfigur: leitfigurStandard(),
	aussehen: 'eigen',
	bilder: true,
	verkauf: false,
	autor: '',
});

export const EINHEIT_FELDER = {
	vorwissen: {
		name: 'Vorwissen der Klasse',
		platz: 'z. B. Zahlen bis 12 sicher, Uhr noch neu',
		zeichen: EINHEIT_ZEICHEN.frei,
	},
	dauerText: { name: 'Anders …', platz: 'z. B. 5 Wochen, je 2 Stunden', zeichen: 60 },
	nochEtwas: { name: 'Noch etwas …', platz: 'z. B. ein Elternbrief', zeichen: EINHEIT_ZEICHEN.frei },
	autor: { name: 'Name auf dem Deckblatt', platz: 'z. B. dein Name bei Eduki', zeichen: EINHEIT_ZEICHEN.autor },
	idee: {
		name: 'Idee für die Geschichte',
		platz: 'z. B. Detektive lösen Fälle rund um die Uhr',
		zeichen: EINHEIT_ZEICHEN.idee,
	},
	ziel: { name: 'Ich-kann-Ziel', platz: 'z. B. Ich kann volle Stunden ablesen.', zeichen: EINHEIT_ZEICHEN.ziel },
} as const;

/** Die eigene Leitfigur (242); dieselben Felder in „Neues Material“ (253). */
export const LEITFIGUR_FELDER = {
	name: { name: 'Name der Figur', platz: 'z. B. Luna', zeichen: FIGUR_ZEICHEN.name },
	aussehen: {
		name: 'Aussehen',
		platz: 'z. B. braune Eule mit hellen Tupfen und grünem Strickschal',
		zeichen: FIGUR_ZEICHEN.aussehen,
	},
} as const;

export const einheitBestandteile = (e: EinheitWahl): string[] =>
	e.bestandteile ?? EINHEIT_BESTANDTEILE.filter((b) => b.empfohlen).map((b) => b.name);

export interface Antworten {
	weg: Weg;
	art: Art;
	/** „Etwas anderes …“; zählt nur bei Art `sonstiges`. */
	artText: string;
	/** Name der gewählten Option aus `formatOptionen`; leer: die Empfehlung. */
	format: string;
	/** Nur im Weg mit Claude; ein Text geht vor der Option. */
	formatText: string;
	fach: Fach;
	klasse: Klasse;
	thema: string;
	ziel: string;
	/** `null`: die Empfehlung. */
	funktion: Funktion | null;
	funktionText: string;
	/** Fehlt ein Schalter, gilt die Empfehlung. So folgt ★ den Niveaus, bis man es selbst schaltet. */
	bausteine: Partial<Record<BausteinName, boolean>>;
	umfang: Umfang | null;
	umfangText: string;
	lerngruppe: Lerngruppe[];
	sonst: string;
	titel: string;
	/** Materialart „Unterrichtseinheit“ (140): ein Ordner statt eines Blatts, nur mit Claude. */
	einheit: boolean;
	eh: EinheitWahl;
	/** 253: die Leitfigur eines einzelnen Materials, eine Figur der Bibliothek oder keine; Vorgabe Willi. */
	leitfigur: EinheitLeitfigur;
}

/** 253: Die Vorgabe in „Neues Material“; mit ihr bleibt der Auftrag wie vor 253. */
export const blattLeitfigurStandard = (): EinheitLeitfigur => ({
	art: 'bibliothek',
	figuren: [{ id: 'willi', name: 'Willi' }],
});

const istBlattStandard = (l: EinheitLeitfigur) =>
	l.art === 'bibliothek' && l.figuren.length === 1 && l.figuren[0]?.id === 'willi';

/** Prüft die Leitfigur eines einzelnen Materials: höchstens eine Figur der Bibliothek, keine eigene. */
const pruefeBlattLeitfigur = (roh: unknown): EinheitLeitfigur => {
	if (roh === undefined) {
		return blattLeitfigurStandard();
	}
	const l = leseLeitfigur(roh);
	if (l.art === 'neu' || (l.art === 'bibliothek' && l.figuren.length !== 1)) {
		throw new SchoolboxFehler('Die Leitfigur ist ungültig.');
	}
	return l;
};

export const leereAntworten = (vorbelegt: { fach: Fach; klasse: Klasse }): Antworten => ({
	weg: 'claude',
	art: 'arbeitsblatt',
	artText: '',
	format: '',
	formatText: '',
	fach: vorbelegt.fach,
	klasse: vorbelegt.klasse,
	thema: '',
	ziel: '',
	funktion: null,
	funktionText: '',
	bausteine: {},
	umfang: null,
	umfangText: '',
	lerngruppe: [],
	sonst: '',
	titel: '',
	einheit: false,
	eh: leereEinheit(),
	leitfigur: blattLeitfigurStandard(),
});

const voll = (text: string) => text.trim() !== '';

// ——— Format ———

export interface FormatWahl {
	/** Steht in `Antworten.format`. */
	wert: string;
	name: string;
	hinweis?: string;
	format: Format;
	vorlage?: string;
	empfohlen: boolean;
}

/**
 * Mit Claude die Fassungen der Start-Abfrage, denn ihr Name sagt Claude etwas. Beim leeren Blatt nur, was sich als
 * Dokument unterscheidet: jedes Format einmal, dazu Gerüste wie das Mini-Book.
 */
export const formatOptionen = (a: Pick<Antworten, 'art' | 'weg'>): FormatWahl[] => {
	const { optionen } = ART_ANGABEN[a.art];
	if (a.weg === 'claude' && optionen.length > 0) {
		return optionen.map((o, i) => ({
			wert: o.name,
			name: o.name,
			...(o.hinweis ? { hinweis: o.hinweis } : {}),
			format: o.format,
			...(o.vorlage ? { vorlage: o.vorlage } : {}),
			empfohlen: i === 0,
		}));
	}
	const formate = formateVon(a.art).map((f, i) => ({ wert: f, name: FORMAT_NAME[f], format: f, empfohlen: i === 0 }));
	const geruest = optionen.flatMap((o) =>
		o.vorlage ? [{ wert: o.name, name: o.name, format: o.format, vorlage: o.vorlage, empfohlen: false }] : [],
	);
	return [...formate, ...geruest];
};

/** Die gewählte Option, sonst die Empfehlung. */
export const formatWahl = (a: Pick<Antworten, 'art' | 'format' | 'weg'>): FormatWahl => {
	const optionen = formatOptionen(a);
	const wahl = optionen.find((o) => o.wert === a.format) ?? optionen.find((o) => o.empfohlen) ?? optionen[0];
	if (!wahl) {
		throw new SchoolboxFehler(`Für ${ART_NAME[a.art]} gibt es kein Format.`);
	}
	return wahl;
};

const formatFrei = (a: Pick<Antworten, 'art' | 'weg'>) => a.weg === 'claude' && !ART_ANGABEN[a.art].nichtFragen;

/** Freitext „Anderes Format …“ zählt nur, wo der Schritt ihn anbietet. */
const formatTextWirksam = (a: Antworten) => (formatFrei(a) ? a.formatText.trim() : '');

// ——— Bausteine ———

export interface BausteinSchalter {
	wert: BausteinName;
	name: string;
	hinweis: string;
	/** Was die Tabelle hinter „ja“ einschränkt, z. B. „vor der Abgabe, nie benotet“. */
	bedingung: string;
	empfohlen: boolean;
	an: boolean;
}

/** Nur was die Tabelle je Art mit „ja“ anbietet. */
const angeboteneBausteine = (art: Art) => {
	const b = ART_ANGABEN[art].bausteine;
	return b ? ZUSATZ_BAUSTEINE.filter((x) => b[x.wert].startsWith('ja')) : [];
};

/**
 * Empfehlungen aus `rueckfragen.md`: Selbsteinschätzung und Niveaus „ja“; die Sternchenaufgabe „ja“, wenn Niveaus
 * „nein“ oder nicht gefragt sind, sonst „nein“.
 */
export const bausteinSchalter = (a: Pick<Antworten, 'art' | 'bausteine'>): BausteinSchalter[] => {
	const angeboten = angeboteneBausteine(a.art);
	const niveausGefragt = angeboten.some((x) => x.wert === 'niveaus');
	const niveausAn = niveausGefragt && (a.bausteine.niveaus ?? true);
	const tabelle = ART_ANGABEN[a.art].bausteine;
	return angeboten.map((x) => {
		const empfohlen = x.wert === 'sternchen' ? !niveausAn : true;
		const rest = (tabelle?.[x.wert] ?? '').replace(/^ja[\s,]*/, '').replace(/^\((.*)\)$/, '$1');
		return {
			wert: x.wert,
			name: x.name,
			hinweis: x.hinweis,
			bedingung: rest,
			empfohlen,
			an: a.bausteine[x.wert] ?? empfohlen,
		};
	});
};

/** `null`: Die Art fragt nicht nach dem Umfang. */
export const umfangEmpfehlung = (art: Art): Umfang | null => ART_ANGABEN[art].umfang ?? null;

/** Ohne Schalter fällt der Schritt weg; die Arbeitszeit steht im Schritt „Thema und Ziel“ (190-38). */
const bausteineGefragt = (art: Art) => angeboteneBausteine(art).length > 0;

/** Prüfungen dienen der Überprüfung, alles andere zuerst dem Üben (A1 S. 6). */
export const funktionEmpfehlung = (art: Art): Funktion =>
	art === 'klassenarbeit' || art === 'lernzielkontrolle' ? 'ueberpruefung' : 'uebung';

// ——— Schritte ———

export const SCHRITT_IDS = [
	'start',
	'art',
	'format',
	'fuerWen',
	'thema',
	'eThema',
	'eUmfang',
	'eBestandteile',
	'eRahmen',
	'bausteine',
	'klasse',
	'titel',
] as const;

export type AssistentSchrittId = (typeof SCHRITT_IDS)[number];

export interface AssistentSchritt {
	id: AssistentSchrittId;
	/** In der Schrittleiste. */
	name: string;
	frage: (a: Antworten) => string;
	hilfe: (a: Antworten) => string;
	wege: readonly Weg[];
	/** `nur`: nur bei der Unterrichtseinheit; `ohne`: nicht bei ihr (140). */
	einheit?: 'nur' | 'ohne';
	/** Darf übersprungen werden (A1 S. 8). */
	optional?: boolean;
	/** `false`: Der Schritt fällt weg und verschwindet aus der Schrittleiste (A1 S. 4). */
	gilt?: (a: Antworten) => boolean;
	/** Die Antwort in Grau unter dem Namen in der Schrittleiste. */
	antwort: (a: Antworten) => string;
	/** Was fehlt, damit „Weiter“ geht; `null`: alles da. */
	fehlt?: (a: Antworten) => string | null;
}

const ZAHLWORT = ['', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs'];

const funktionName = (a: Antworten) =>
	voll(a.funktionText)
		? `Anders: ${a.funktionText.trim()}`
		: (FUNKTIONEN.find((f) => f.wert === (a.funktion ?? funktionEmpfehlung(a.art)))?.name ?? '');

const artName = (a: Antworten) =>
	a.art === 'sonstiges' && voll(a.artText)
		? `Anders: ${a.artText.trim()}`
		: (ART_WAHL.find((w) => w.art === a.art)?.name ?? ART_NAME[a.art]);

const klasseText = (klasse: Klasse) => (klasse === 'gemischt' ? 'jahrgangsgemischt' : `Klasse ${klasse}`);

/** Thema und Titel stehen im selben Schritt (190-37); der Titel folgt dem Thema, bis man ihn selbst ändert. */
const themaFehlt = (a: Antworten) => {
	if (!voll(a.thema)) {
		return 'Bitte schreib, worum es geht.';
	}
	return voll(a.titel) ? null : 'Bitte gib einen Titel ein.';
};

/** Die Arbeitszeit in der Schrittleiste (190-38); leer, wo die Art sie nicht fragt. */
const umfangName = (a: Antworten) => {
	if (umfangEmpfehlung(a.art) === null) {
		return '';
	}
	if (voll(a.umfangText)) {
		return `Anders: ${a.umfangText.trim()}`;
	}
	const umfang = a.umfang ?? umfangEmpfehlung(a.art);
	return umfang === 'claude' ? '' : (UMFAENGE.find((u) => u.wert === umfang)?.name ?? '');
};

const angaben = (zahl: number) => {
	if (zahl === 0) {
		return '';
	}
	return zahl === 1 ? '1 Angabe' : `${zahl} Angaben`;
};

export const ASSISTENT_SCHRITTE: readonly AssistentSchritt[] = [
	{
		id: 'start',
		name: 'Start',
		frage: () => 'Wie möchtest du anfangen?',
		hilfe: () => 'Beides lässt sich danach im Editor frei bearbeiten.',
		wege: WEGE,
		antwort: (a) => (a.weg === 'claude' ? 'Mit Claude' : 'Leeres Blatt'),
	},
	{
		id: 'art',
		name: 'Materialart',
		frage: () => 'Was für ein Material?',
		hilfe: (a) =>
			a.weg === 'claude'
				? 'Davon hängt ab, welcher Skill das Blatt baut und welche Fragen noch kommen.'
				: 'Davon hängt ab, welche Formate passen.',
		wege: WEGE,
		antwort: (a) => (a.einheit ? 'Unterrichtseinheit' : artName(a)),
	},
	{
		id: 'format',
		name: 'Format',
		frage: () => 'Welches Format?',
		hilfe: (a) => {
			const n = formatOptionen(a).length;
			const zahl = ZAHLWORT[n] ?? String(n);
			const rest = formatFrei(a) ? ' Oder beschreib ein anderes.' : '';
			return n === 1
				? `Für ${ART_AKKUSATIV[a.art]} passt dieses.${rest}`
				: `Für ${ART_AKKUSATIV[a.art]} passen diese ${zahl}.${rest}`;
		},
		wege: WEGE,
		einheit: 'ohne',
		gilt: (a) => !ART_ANGABEN[a.art].nichtFragen && formatOptionen(a).length + (formatFrei(a) ? 1 : 0) > 1,
		antwort: (a) => (formatTextWirksam(a) ? `Anders: ${formatTextWirksam(a)}` : formatWahl(a).name),
	},
	{
		id: 'fuerWen',
		name: 'Für wen',
		frage: () => 'Für welche Klasse und welches Fach?',
		hilfe: () => 'Davon hängen Zahlenraum, Schriftgröße und Lineatur ab.',
		wege: ['claude'],
		antwort: (a) => `${klasseText(a.klasse)} · ${FACH_NAME[a.fach]}`,
	},
	{
		id: 'thema',
		name: 'Thema und Ziel',
		frage: () => 'Worum geht es?',
		hilfe: () => 'Ein paar Wörter reichen. Claude ergänzt, was fehlt, und nennt es danach.',
		wege: ['claude'],
		einheit: 'ohne',
		antwort: (a) =>
			voll(a.thema)
				? [a.thema.trim(), funktionName(a), umfangName(a), istBlattStandard(a.leitfigur) ? '' : leitfigurKurz(a.leitfigur)]
						.filter(voll)
						.join(' · ')
				: '',
		fehlt: themaFehlt,
	},
	{
		id: 'eThema',
		name: 'Thema und Ziele',
		frage: () => 'Worum geht es in der Einheit?',
		hilfe: () => 'Das Thema reicht. Ziele und Vorwissen helfen Claude, die Reihe zu planen.',
		wege: ['claude'],
		einheit: 'nur',
		antwort: (a) => (voll(a.thema) ? a.thema.trim() : ''),
		fehlt: themaFehlt,
	},
	{
		id: 'eUmfang',
		name: 'Umfang',
		frage: () => 'Wie lang ist die Einheit?',
		hilfe: () => 'Daraus plant Claude, wie viele Materialien es braucht.',
		wege: ['claude'],
		einheit: 'nur',
		antwort: (a) => `${voll(a.eh.dauerText) ? a.eh.dauerText.trim() : a.eh.dauer} · ${a.eh.stunden} Std. je Woche`,
	},
	{
		id: 'eBestandteile',
		name: 'Bestandteile',
		frage: () => 'Was gehört zur Einheit?',
		hilfe: () =>
			'Vorgewählt ist, was eine Reihe meist braucht. Claude legt je Bestandteil ein oder mehrere Materialien an.',
		wege: ['claude'],
		einheit: 'nur',
		antwort: (a) =>
			`${einheitBestandteile(a.eh).length + (voll(a.eh.nochEtwas) ? 1 : 0)} Bestandteile${a.eh.verkauf ? ' · für Eduki' : ''}`,
	},
	{
		id: 'eRahmen',
		name: 'Geschichte und Aussehen',
		frage: () => 'Geschichte und Aussehen',
		hilfe: () => 'Eine Geschichte und ein Aussehen halten die Materialien zusammen.',
		wege: ['claude'],
		einheit: 'nur',
		fehlt: (a) =>
			a.eh.leitfigur.art === 'neu' && !voll(a.eh.leitfigur.name)
				? 'Bitte gib der eigenen Figur einen Namen.'
				: null,
		antwort: (a) =>
			[leitfigurKurz(a.eh.leitfigur), EINHEIT_AUSSEHEN_WAHL.find((w) => w.wert === a.eh.aussehen)?.name].join(
				' · ',
			),
	},
	{
		id: 'bausteine',
		name: 'Bausteine',
		frage: () => 'Was soll mit aufs Blatt?',
		hilfe: () => 'Vorgewählt ist die Empfehlung aus dem Skill.',
		wege: ['claude'],
		gilt: (a) => a.einheit || bausteineGefragt(a.art),
		antwort: (a) => {
			const an = bausteinSchalter(a).filter((s) => s.an);
			const kurz = an.map((s) => ZUSATZ_BAUSTEINE.find((b) => b.wert === s.wert)?.kurz ?? s.name);
			return kurz.length > 0 ? kurz.join(', ') : 'ohne Zusätze';
		},
	},
	{
		id: 'klasse',
		name: 'Deine Klasse',
		frage: () => 'Gibt es etwas zu deiner Klasse?',
		hilfe: () => 'Hilft Claude bei Sprache, Hilfen und Schwierigkeit. Mehrere möglich.',
		wege: ['claude'],
		optional: true,
		antwort: (a) => angaben(a.lerngruppe.length + (voll(a.sonst) ? 1 : 0)),
	},
	{
		id: 'titel',
		name: 'Titel',
		frage: () => 'Wie soll es heißen?',
		hilfe: () => 'Den Titel kannst du später im Editor ändern.',
		wege: ['leer'],
		einheit: 'ohne',
		antwort: (a) => a.titel.trim(),
		fehlt: (a) => (voll(a.titel) ? null : 'Bitte gib einen Titel ein.'),
	},
];

/** Die Schritte des gewählten Wegs, ohne die, die für die Antworten nicht gelten. */
export const schritteFuer = (a: Antworten): AssistentSchritt[] =>
	ASSISTENT_SCHRITTE.filter(
		(s) =>
			s.wege.includes(a.weg) &&
			(s.einheit === undefined || (s.einheit === 'nur') === (a.einheit && a.weg === 'claude')) &&
			(s.gilt?.(a) ?? true),
	);

/** Titel eines leeren Blatts, bis die Lehrkraft einen schreibt (132). */
const NEU_TITEL: Record<Art, string> = {
	arbeitsblatt: 'Neues Arbeitsblatt',
	klassenarbeit: 'Neue Klassenarbeit',
	lernzielkontrolle: 'Neue Lernzielkontrolle',
	lesetext: 'Neuer Lesetext',
	lernspiel: 'Neues Lernspiel',
	karten: 'Neue Bild- und Wortkarten',
	lernplakat: 'Neues Lernplakat',
	praesentation: 'Neue Präsentation',
	stationen: 'Neues Stationenlernen',
	unterrichtsplanung: 'Neue Unterrichtsplanung',
	sonstiges: 'Neues Material',
};

/** Vorschlag für den Titel: mit Claude das Thema, sonst „Neues Arbeitsblatt“ und so weiter. */
export const titelVorschlag = (a: Pick<Antworten, 'art' | 'thema' | 'weg'>) => {
	const thema = a.thema.trim();
	return (a.weg === 'claude' && thema ? thema : NEU_TITEL[a.art]).slice(0, FREITEXT.titel.zeichen);
};

// ——— Auftrag ———

/** `antwort`: aus einer festen Wahl; `freitext`: wörtlich von der Lehrkraft, im Text in „…“. */
export interface Teil {
	text: string;
	art: 'fest' | 'antwort' | 'freitext';
}

const fest = (text: string): Teil => ({ text, art: 'fest' });
const antwort = (text: string): Teil => ({ text, art: 'antwort' });
const frei = (text: string): Teil => ({ text: text.trim(), art: 'freitext' });

const umfangTeile = (a: Antworten): Teil[] => {
	if (umfangEmpfehlung(a.art) === null) {
		return [];
	}
	if (voll(a.umfangText)) {
		return [fest(', Arbeitszeit je Kind: '), frei(a.umfangText)];
	}
	const satz = UMFAENGE.find((u) => u.wert === (a.umfang ?? umfangEmpfehlung(a.art)))?.satz;
	return satz ? [fest(', '), antwort(satz)] : [];
};

const ersterSatz = (a: Antworten): Teil[] => {
	const was =
		a.art === 'sonstiges' && voll(a.artText)
			? [fest('Erstelle dieses Material: '), frei(a.artText)]
			: [fest('Erstelle '), antwort(ART_AKKUSATIV[a.art])];
	const wahl = formatWahl(a);
	const formatText = formatTextWirksam(a);
	const format = formatText
		? [fest(', Format: '), frei(formatText), fest(' (angelegt als '), antwort(FORMAT_NAME[wahl.format]), fest(')')]
		: [fest(', Format '), antwort(wahl.name)];
	const umfang = umfangTeile(a);
	return [
		...was,
		fest(' für '),
		antwort(`${FACH_NAME[a.fach]}, ${klasseText(a.klasse)}`),
		...format,
		...umfang,
		fest('.'),
	];
};

/** Kein zweites Satzzeichen hinter einem Freitext, der schon mit einem endet (190-21). */
const punkt = (text: string) => (/[.!?…]$/.test(text.trim()) ? '' : '.');

const themaSatz = (a: Antworten): Teil[] => {
	const funktion = FUNKTIONEN.find((f) => f.wert === (a.funktion ?? funktionEmpfehlung(a.art)));
	return [
		fest('Thema: '),
		frei(a.thema),
		fest(`${punkt(a.thema)} `),
		...(voll(a.ziel)
			? [fest('Ich-kann-Ziel: '), frei(a.ziel), fest(punkt(a.ziel))]
			: [fest('Formuliere das Ich-kann-Ziel selbst.')]),
		...(voll(a.funktionText)
			? [fest(' Funktion in der Reihe: '), frei(a.funktionText), fest(punkt(a.funktionText))]
			: [fest(' Das Material dient '), antwort(funktion?.satz ?? ''), fest('.')]),
	];
};

/** Je angebotenem Baustein ein Satz, an wie aus, mit seiner Wirkung (210). */
const bausteinSaetze = (a: Antworten): Teil[][] =>
	bausteinSchalter(a).map((s) => {
		const b = ZUSATZ_BAUSTEINE.find((x) => x.wert === s.wert);
		return [fest(s.an ? 'Mit ' : 'Ohne '), antwort(b?.satz ?? s.name), fest((s.an ? b?.mit : b?.ohne) ?? '.')];
	});

/** Der Auftrag aus A1 S. 9, Satz für Satz. Fett in der Vorschau ist, was aus den Fragen kommt. */
export const auftragSaetze = (a: Antworten): Teil[][] => {
	const lerngruppe = LERNGRUPPE.filter((l) => a.lerngruppe.includes(l.wert)).map((l) => l.satz);
	const saetze: Teil[][] = [
		ersterSatz(a),
		themaSatz(a),
		// 253: Mit der Vorgabe Willi bleibt der Auftrag wie vorher.
		istBlattStandard(a.leitfigur) ? [] : [fest(leitfigurSatz(a.leitfigur))],
		...bausteinSaetze(a),
		[
			fest('Lerngruppe: '),
			antwort(lerngruppe.length > 0 ? lerngruppe.join(', ') : 'keine Besonderheiten angegeben'),
			fest('.'),
		],
		voll(a.sonst) ? [fest('Außerdem: '), frei(a.sonst)] : [],
	];
	return saetze.filter((satz) => satz.length > 0);
};

const teilText = (t: Teil) => (t.art === 'freitext' ? `„${t.text}“` : t.text);

/** Genau dieser Text geht an Claude; die Vorschau zeigt ihn mit Hervorhebungen. */
export const auftragAus = (a: Antworten): string =>
	auftragSaetze(a)
		.map((s) => s.map(teilText).join(''))
		.join('\n');

/** Was der Assistent an `POST /api/einheiten` schickt; der Server prüft es mit `pruefeEinheitAngaben`. */
export const einheitAngabenAus = (a: Antworten): EinheitAngaben => {
	const schalter = bausteinSchalter({ art: 'arbeitsblatt', bausteine: a.bausteine });
	const an = (wert: BausteinName) => schalter.find((s) => s.wert === wert)?.an ?? false;
	return {
		titel: a.titel.trim(),
		fach: a.fach,
		klasse: a.klasse,
		thema: a.thema.trim(),
		ziele: a.eh.ziele.map((z) => z.trim()).filter(voll),
		vorwissen: a.eh.vorwissen.trim(),
		dauer: voll(a.eh.dauerText) ? a.eh.dauerText.trim() : a.eh.dauer,
		stundenJeWoche: a.eh.stunden,
		bestandteile: einheitBestandteile(a.eh),
		nochEtwas: a.eh.nochEtwas.trim(),
		idee: a.eh.idee.trim(),
		leitfigur:
			a.eh.leitfigur.art === 'neu'
				? { art: 'neu', name: a.eh.leitfigur.name.trim(), aussehen: a.eh.leitfigur.aussehen.trim() }
				: a.eh.leitfigur,
		aussehen: a.eh.aussehen,
		bilder: a.eh.bilder,
		verkauf: a.eh.verkauf,
		autor: a.eh.verkauf ? a.eh.autor.trim() : '',
		bausteine: {
			selbsteinschaetzung: an('selbsteinschaetzung'),
			niveaus: an('niveaus'),
			sternchen: an('sternchen'),
		},
		lerngruppe: LERNGRUPPE.filter((l) => a.lerngruppe.includes(l.wert)).map((l) => l.satz),
		klasseText: a.sonst.trim(),
	};
};

// ——— Prüfen (Server) ———

const AUFTRAG_FELDER = Object.keys(leereAntworten({ fach: 'deutsch', klasse: 1 }));
/** Felder, die es nicht mehr gibt: In gespeicherten Antworten zählen sie nicht (190-43). */
const ALTE_FELDER = ['bausteineText'];

const fehler = (text: string) => new SchoolboxFehler(text);

const pruefeText = (roh: Record<string, unknown>, feld: FreitextFeld): string => {
	const wert = roh[feld] ?? '';
	if (typeof wert !== 'string') {
		throw fehler(`„${FREITEXT[feld].name}“ ist kein Text.`);
	}
	if (wert.length > FREITEXT[feld].zeichen) {
		throw fehler(`„${FREITEXT[feld].name}“ darf höchstens ${FREITEXT[feld].zeichen} Zeichen haben.`);
	}
	return wert;
};

const eins = <T>(feld: string, wert: unknown, gueltig: readonly T[]): T => {
	const treffer = gueltig.find((g) => g === wert);
	if (treffer === undefined) {
		throw fehler(`Die Antwort „${feld}“ ist ungültig.`);
	}
	return treffer;
};

/** Das Format aus dem Browser: `''` ohne Angabe (die Empfehlung gilt), `null`, wenn es kein Text ist. */
const formatRoh = (wert: unknown) => {
	if (wert === undefined) {
		return '';
	}
	return typeof wert === 'string' ? wert : null;
};

/**
 * Prüft Antworten aus dem Browser gegen diese Daten: nur bekannte Felder und Werte, Freitext als Text mit
 * Höchstlänge. Fehlende Felder bekommen den Wert von `leereAntworten`, die Empfehlung gilt dann.
 */
/** Gespeicherte Antworten kennen noch „1 Seite“ und „2 Seiten“: Sie fallen auf die Empfehlung zurück. */
const UMFANG_ALT: unknown[] = ['1', '2'];

const pruefeUmfang = (roh: unknown) =>
	roh === null || roh === undefined || UMFANG_ALT.includes(roh)
		? null
		: eins(
				'umfang',
				roh,
				UMFAENGE.map((u) => u.wert),
			);

export const pruefeAntworten = (roh: unknown, vorbelegt: { fach: Fach; klasse: Klasse }): Antworten => {
	if (typeof roh !== 'object' || roh === null || Array.isArray(roh)) {
		throw fehler('Die Antworten fehlen.');
	}
	const r = roh as Record<string, unknown>;
	const fremd = Object.keys(r).find((k) => !AUFTRAG_FELDER.includes(k) && !ALTE_FELDER.includes(k));
	if (fremd !== undefined) {
		throw fehler(`Die Antwort „${fremd}“ gibt es nicht.`);
	}
	const basis = leereAntworten(vorbelegt);
	const art = eins('art', r.art ?? basis.art, ARTEN);
	const weg = eins('weg', r.weg ?? basis.weg, WEGE);
	const format = formatRoh(r.format);
	if (format === null || (format !== '' && !formatOptionen({ art, weg }).some((o) => o.wert === format))) {
		throw fehler('Dieses Format passt nicht zu dieser Art.');
	}
	const bausteine = r.bausteine ?? {};
	if (typeof bausteine !== 'object' || bausteine === null || Array.isArray(bausteine)) {
		throw fehler('Die Antwort „bausteine“ ist ungültig.');
	}
	const schalter: Partial<Record<BausteinName, boolean>> = {};
	for (const [name, an] of Object.entries(bausteine)) {
		const baustein = eins(
			'bausteine',
			name,
			ZUSATZ_BAUSTEINE.map((b) => b.wert),
		);
		if (typeof an !== 'boolean') {
			throw fehler('Die Antwort „bausteine“ ist ungültig.');
		}
		schalter[baustein] = an;
	}
	const lerngruppe = r.lerngruppe ?? [];
	if (!Array.isArray(lerngruppe)) {
		throw fehler('Die Antwort „lerngruppe“ ist ungültig.');
	}
	const gruppen = LERNGRUPPE.map((l) => l.wert);
	return {
		weg,
		art,
		artText: pruefeText(r, 'artText'),
		format,
		formatText: pruefeText(r, 'formatText'),
		fach: eins('fach', r.fach ?? basis.fach, FAECHER),
		klasse: eins('klasse', r.klasse ?? basis.klasse, KLASSEN),
		thema: pruefeText(r, 'thema'),
		ziel: pruefeText(r, 'ziel'),
		funktion:
			r.funktion === null || r.funktion === undefined
				? null
				: eins(
						'funktion',
						r.funktion,
						FUNKTIONEN.map((f) => f.wert),
					),
		funktionText: pruefeText(r, 'funktionText'),
		bausteine: schalter,
		umfang: pruefeUmfang(r.umfang),
		umfangText: pruefeText(r, 'umfangText'),
		lerngruppe: [...new Set(lerngruppe.map((l: unknown) => eins('lerngruppe', l, gruppen)))],
		sonst: pruefeText(r, 'sonst'),
		titel: pruefeText(r, 'titel'),
		// Eine Einheit geht an `/api/einheiten`; ein einzelnes Blatt nimmt sie nicht mit.
		einheit: false,
		eh: leereEinheit(),
		leitfigur: pruefeBlattLeitfigur(r.leitfigur),
	};
};

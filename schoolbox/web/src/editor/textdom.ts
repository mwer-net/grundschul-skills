import type { Baustein, Zeilen } from '@schoolbox/kern/src/bausteine';
import { GESCHUETZT, zeilenVon } from '@schoolbox/kern/src/bausteine';
import type { Knoten, Zerlegung } from '@schoolbox/kern/src/quelltext';
import {
	eingesetzt,
	ersetzeFolge,
	MARKE,
	nummerNach,
	quelleVon,
	schuetzeText,
	wendeAn,
	zerlege,
} from '@schoolbox/kern/src/quelltext';

import { nrVon } from './darstellung';

const TEXT = 3;
const ELEMENT = 1;
const KOMMENTAR = 8;

/** Eingaben, die der Browser selbst ausführen darf. Alles andere (Kursiv, Listen, Ablegen …) bleibt draußen. */
const ERLAUBT = new Set([
	'insertText',
	'insertReplacementText',
	'insertCompositionText',
	'insertFromComposition',
	'deleteCompositionText',
	'deleteByComposition',
	'insertFromYank',
	'deleteContentBackward',
	'deleteContentForward',
	'deleteWordBackward',
	'deleteWordForward',
	'deleteSoftLineBackward',
	'deleteSoftLineForward',
	'deleteHardLineBackward',
	'deleteHardLineForward',
	'deleteEntireSoftLine',
	'deleteByCut',
	'historyUndo',
	'historyRedo',
	'formatBold',
	'formatUnderline',
]);

export type Format = 'bold' | 'underline';

export interface TextZustand {
	fett: boolean;
	unterstrichen: boolean;
	/** Überschriften sind schon fett; dort gibt es kein Fett-Umschalten. */
	fettMoeglich: boolean;
}

export interface TextErgebnis {
	quelle: string;
	/** Nummer eines Elements der alten Darstellung in der neuen. */
	umrechnen: (nr: number) => number;
}

interface Optionen {
	doc: Document;
	element: HTMLElement;
	baustein: Baustein;
	zerlegung: Zerlegung;
	beginnt: () => void;
	/** Getippt oder Auswahl bewegt: Panel und Rahmen auffrischen. */
	aendert: () => void;
	/** `null`: nichts geändert. */
	endet: (ergebnis: TextErgebnis | null) => void;
}

export interface TextSteuerung {
	aktiv: () => boolean;
	beende: () => void;
	/** Bearbeitung von außen starten, Cursor ans Ende. */
	fokussiere: () => void;
	formatiere: (format: Format) => void;
	zustand: () => TextZustand;
	abbauen: () => void;
}

interface Sitzung {
	/** In Dokumentreihenfolge; beim Teilen kommen neue Elemente dazu, beim Zusammenführen fallen welche weg. */
	elemente: HTMLElement[];
	/** Die Quellelemente, deren Bereich am Ende ersetzt wird, auch wenn sie inzwischen zusammengeführt sind. */
	originale: Knoten[];
	oeffner: Map<HTMLElement, string>;
	letztes: HTMLElement;
}

const istElement = (n: Node | null | undefined): n is Element => n?.nodeType === ELEMENT;

const geschuetzt = (el: Element) => el.matches(GESCHUETZT);

/** Liegt `el` in einem der Elemente (nicht: ist es eines davon)? */
const darin = (elemente: HTMLElement[], el: Element) => elemente.some((e) => e !== el && e.contains(el));

/** Das Geschwister in der Quelle, wenn zwischen beiden nur Leerraum steht. */
const nebenan = (z: Zerlegung, k: Knoten, richtung: 'vor' | 'nach') => {
	const geschwister = k.eltern?.kinder ?? z.wurzeln;
	const anderes = geschwister[geschwister.indexOf(k) + (richtung === 'vor' ? -1 : 1)];
	if (!anderes) {
		return null;
	}
	const zwischen = richtung === 'vor' ? z.quelle.slice(anderes.ende, k.start) : z.quelle.slice(k.ende, anderes.start);
	return zwischen.trim() ? null : anderes;
};

const zeichen = (c: string | undefined) => c !== undefined && !/\s/.test(c);

/**
 * Beim Tippen macht der Browser aus Leerzeichen am Rand oder doppelten Leerzeichen `&nbsp;`. Ein geschütztes
 * Leerzeichen zwischen zwei Zeichen (5&nbsp;cm) war gewollt, alle anderen werden wieder normale Leerzeichen.
 */
const normaleTexte = (wurzel: Element) => {
	const texte: Text[] = [];
	const sammle = (n: Node) => {
		for (const kind of n.childNodes) {
			if (kind.nodeType === TEXT) {
				texte.push(kind as Text);
			} else if (istElement(kind) && !geschuetzt(kind)) {
				sammle(kind);
			}
		}
	};
	sammle(wurzel);
	const alles = texte.map((t) => t.data).join('');
	const ergebnis = new Map<Node, string>();
	let pos = 0;
	for (const t of texte) {
		const ab = pos;
		ergebnis.set(
			t,
			t.data.replace(/\u00a0/g, (nbsp: string, i: number) =>
				zeichen(alles[ab + i - 1]) && zeichen(alles[ab + i + 1]) ? nbsp : ' ',
			),
		);
		pos += t.data.length;
	}
	return ergebnis;
};

const oeffnerVon = (z: Zerlegung, k: Knoten) => z.quelle.slice(k.start, k.oeffnerEnde);

/** Quelltext für den Inhalt eines bearbeiteten Elements: Text, `<b>`, `<u>`, `<br>`, Geschütztes wörtlich. */
export const textHtml = (element: Element, z: Zerlegung, zeilen: Zeilen) => {
	const texte = normaleTexte(element);
	const knoten = (n: Node, fett: boolean, unter: boolean): string => {
		const kinder = (f: boolean, u: boolean) => [...n.childNodes].map((kind) => knoten(kind, f, u)).join('');
		if (n.nodeType === TEXT) {
			return schuetzeText(texte.get(n) ?? (n as Text).data).replace(/\u00a0/g, '&nbsp;');
		}
		if (n.nodeType === KOMMENTAR) {
			return `<!--${(n as Comment).data}-->`;
		}
		if (!istElement(n)) {
			return '';
		}
		const tag = n.localName;
		const nr = nrVon(n);
		const original = nr === null ? undefined : z.knoten[nr];
		const passt = original?.tag === tag ? original : undefined;
		if (geschuetzt(n)) {
			return passt ? quelleVon(z, passt) : '';
		}
		if (tag === 'br') {
			return zeilen === 'eine' ? ' ' : '<br>';
		}
		if (tag === 'b' || tag === 'strong') {
			return fett ? kinder(fett, unter) : `<b>${kinder(true, unter)}</b>`;
		}
		if (tag === 'u') {
			return unter ? kinder(fett, unter) : `<u>${kinder(fett, true)}</u>`;
		}
		// Was schon in der Quelle stand (z. B. `<span class="aufdecken">`), bleibt; was der Browser erfunden hat, fällt weg.
		return passt ? `${oeffnerVon(z, passt)}${kinder(fett, unter)}</${tag}>` : kinder(fett, unter);
	};
	let html = [...element.childNodes].map((n) => knoten(n, false, false)).join('');
	for (let vorher = ''; vorher !== html;) {
		vorher = html;
		html = html.replace(/<(b|u)><\/\1>/g, '').replace(/<\/(b|u)><\1>/g, '');
	}
	// Ein leeres Feld hält der Browser mit einem `<br>` offen.
	return html.replace(/(<br>\s*)+$/, '');
};

const istLeer = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '').trim() === '';

const bereich = (doc: Document, s: AbstractRange) => {
	const r = doc.createRange();
	r.setStart(s.startContainer, s.startOffset);
	r.setEnd(s.endContainer, s.endOffset);
	return r;
};

/**
 * Macht einen gewählten Textträger im Material bearbeitbar. Der Browser setzt beim nächsten Antippen den Cursor
 * selbst; nur so öffnet das iPad zuverlässig die Tastatur. Am Ende wird aus dem DOM **eine** neue Quelle: Nur die
 * bearbeiteten Elemente ändern sich, Geschütztes kommt wörtlich aus der alten Quelle.
 */
export const ruesteText = ({
	aendert,
	baustein,
	beginnt,
	doc,
	element,
	endet,
	zerlegung: z,
}: Optionen): TextSteuerung => {
	const zeilen = zeilenVon(baustein);
	const nr = nrVon(element);
	const original = nr === null ? undefined : z.knoten[nr];
	let sitzung: Sitzung | null = null;
	let intern = false;
	const geruestet = new Set<HTMLElement>();
	const sprache = new Set<HTMLElement>();

	const ruesteElement = (el: HTMLElement) => {
		if (geruestet.has(el)) {
			return;
		}
		geruestet.add(el);
		el.setAttribute('contenteditable', 'true');
		el.setAttribute('spellcheck', 'true');
		if (!el.hasAttribute('lang')) {
			el.setAttribute('lang', 'de');
			sprache.add(el);
		}
		el.querySelectorAll(GESCHUETZT).forEach((g) => g.setAttribute('contenteditable', 'false'));
	};

	const imSitzung = (n: Node | null) => Boolean(n && sitzung?.elemente.some((el) => el === n || el.contains(n)));

	const traeger = (n: Node | null) => sitzung?.elemente.find((el) => n && (el === n || el.contains(n))) ?? null;

	const auswahl = () => {
		const s = doc.getSelection();
		return s && s.rangeCount > 0 ? s.getRangeAt(0) : null;
	};

	const setzeCursor = (knoten: Node, offset: number) => {
		const s = doc.getSelection();
		const r = doc.createRange();
		r.setStart(knoten, offset);
		r.collapse(true);
		s?.removeAllRanges();
		s?.addRange(r);
	};

	const still = <T>(arbeit: () => T): T => {
		intern = true;
		try {
			return arbeit();
		} finally {
			intern = false;
		}
	};

	const wechsle = (ziel: HTMLElement, knoten: Node, offset: number) => {
		ruesteElement(ziel);
		still(() => ziel.focus({ preventScroll: true }));
		setzeCursor(knoten, offset);
		if (sitzung) {
			sitzung.letztes = ziel;
		}
	};

	const fuelle = (el: HTMLElement) => {
		if (!el.textContent && !el.querySelector('*')) {
			el.append(doc.createElement('br'));
		}
	};

	const entferneFuellung = (el: HTMLElement) => {
		const letztes = el.lastChild;
		if (istElement(letztes) && letztes.localName === 'br' && nrVon(letztes) === null) {
			letztes.remove();
		}
	};

	/** Der Knoten direkt vor bzw. hinter dem Cursor, auch über Grenzen von `<b>` und `<u>` hinweg. */
	const neben = (r: Range, richtung: 'vor' | 'nach'): Node | null => {
		const grenze = traeger(r.startContainer);
		let n: Node | null = r.startContainer;
		const offset = r.startOffset;
		if (n.nodeType === TEXT) {
			if (richtung === 'vor' ? offset > 0 : offset < (n as Text).length) {
				return null;
			}
		} else {
			const kind: Node | null = n.childNodes[richtung === 'vor' ? offset - 1 : offset] ?? null;
			if (kind) {
				return kind;
			}
		}
		while (n && n !== grenze) {
			const anderes: Node | null = richtung === 'vor' ? n.previousSibling : n.nextSibling;
			if (anderes) {
				return anderes;
			}
			n = n.parentNode;
		}
		return null;
	};

	const beruehrtGeschuetztes = (bereiche: Range[]) => {
		const schutz = sitzung?.elemente.flatMap((el) => [...el.querySelectorAll(GESCHUETZT)]) ?? [];
		return bereiche.some((r) => !r.collapsed && schutz.some((g) => r.intersectsNode(g)));
	};

	const starte = () => {
		if (sitzung || !original) {
			return;
		}
		sitzung = {
			elemente: [element],
			originale: [original],
			oeffner: new Map([[element, oeffnerVon(z, original)]]),
			letztes: element,
		};
		beginnt();
	};

	const beende = () => {
		const s = sitzung;
		if (!s) {
			return;
		}
		sitzung = null;
		if (s.elemente.some((el) => el === doc.activeElement)) {
			still(() => (doc.activeElement as HTMLElement).blur());
		}
		const fassungen = s.elemente
			.map((el) => ({ el, html: textHtml(el, z, zeilen), neu: !s.originale.some((k) => nrVon(el) === k.nr) }))
			.filter((t, i, alle) => !t.neu || !istLeer(t.html) || alle.length === 1);
		const tag = s.originale[0]?.tag ?? element.localName;
		const aenderung = ersetzeFolge(
			z,
			s.originale,
			fassungen.map((t) => `${s.oeffner.get(t.el) ?? `<${tag}>`}${t.html}</${tag}>`),
		)[0];
		const quelle = aenderung ? wendeAn(z.quelle, [aenderung]) : z.quelle;
		if (!aenderung || quelle === z.quelle) {
			endet(null);
			return;
		}
		const neu = zerlege(quelle);
		const nach = nummerNach(z, neu, aenderung);
		const nummern = eingesetzt(neu, aenderung).map((k) => k.nr);
		const fokus =
			nummern[
				Math.max(
					0,
					fassungen.findIndex((t) => t.el === s.letztes),
				)
			] ??
			nummern[0] ??
			0;
		// Die alte Darstellung bleibt sichtbar, bis die neue geladen ist. Antippen darin muss schon die neuen Nummern
		// liefern, deshalb wird sie hier umnummeriert.
		for (const el of doc.querySelectorAll(`[${MARKE}]`)) {
			const alt = nrVon(el);
			const i = fassungen.findIndex((t) => t.el === el);
			if (i >= 0) {
				el.setAttribute(MARKE, String(nummern[i]));
			} else if (alt === null || darin(s.elemente, el)) {
				el.removeAttribute(MARKE);
			} else {
				const n = nach(alt);
				if (n === null) {
					el.removeAttribute(MARKE);
				} else {
					el.setAttribute(MARKE, String(n));
				}
			}
		}
		endet({ quelle, umrechnen: (alt) => nach(alt) ?? fokus });
	};

	/** Enter in einem Absatz: alles hinter dem Cursor in ein neues, gleiches Element dahinter. */
	const teile = () => {
		const r = auswahl();
		const aktuell = traeger(r?.startContainer ?? null);
		if (!r || !aktuell || !sitzung) {
			return;
		}
		if (!r.collapsed) {
			if (beruehrtGeschuetztes([r])) {
				return;
			}
			r.deleteContents();
		}
		const rest = doc.createRange();
		rest.setStart(r.startContainer, r.startOffset);
		rest.setEnd(aktuell, aktuell.childNodes.length);
		const inhalt = rest.extractContents();
		const neu = doc.createElement(aktuell.localName);
		for (const a of aktuell.attributes) {
			if (a.name !== MARKE) {
				neu.setAttribute(a.name, a.value);
			}
		}
		neu.append(inhalt);
		aktuell.after(neu);
		entferneFuellung(aktuell);
		fuelle(aktuell);
		fuelle(neu);
		sitzung.oeffner.set(neu, sitzung.oeffner.get(aktuell) ?? '');
		sitzung.elemente.splice(sitzung.elemente.indexOf(aktuell) + 1, 0, neu);
		wechsle(neu, neu, 0);
		aendert();
	};

	const nachbar = (el: HTMLElement, richtung: 'vor' | 'nach'): HTMLElement | null => {
		let n = richtung === 'vor' ? el.previousSibling : el.nextSibling;
		while (n && n.nodeType === TEXT && !(n as Text).data.trim()) {
			n = richtung === 'vor' ? n.previousSibling : n.nextSibling;
		}
		if (!istElement(n) || n.localName !== el.localName || !n.matches(baustein.selektor) || !sitzung) {
			return null;
		}
		if (imSitzung(n)) {
			return n as HTMLElement;
		}
		// Ein Absatz außerhalb der Sitzung kommt nur dazu, wenn er auch in der Quelle direkt daneben steht.
		const rand = richtung === 'vor' ? sitzung.originale[0] : sitzung.originale.at(-1);
		const k = rand && nebenan(z, rand, richtung);
		return k && k.nr === nrVon(n) && k.tag === n.localName ? (n as HTMLElement) : null;
	};

	/** Rücktaste am Anfang bzw. Entf am Ende eines Absatzes: zwei Absätze werden einer. */
	const fuehreZusammen = (vorne: HTMLElement, hinten: HTMLElement) => {
		const s = sitzung;
		if (!s) {
			return;
		}
		for (const el of [vorne, hinten]) {
			if (!imSitzung(el)) {
				const k = z.knoten[nrVon(el) ?? -1];
				if (!k) {
					return;
				}
				if (el === vorne) {
					s.elemente.unshift(el);
					s.originale.unshift(k);
				} else {
					s.elemente.push(el);
					s.originale.push(k);
				}
				s.oeffner.set(el, oeffnerVon(z, k));
			}
		}
		entferneFuellung(vorne);
		entferneFuellung(hinten);
		const letztes = vorne.lastChild;
		const cursor =
			letztes?.nodeType === TEXT
				? { knoten: letztes, offset: (letztes as Text).length }
				: { knoten: vorne as Node, offset: vorne.childNodes.length };
		vorne.append(...hinten.childNodes);
		hinten.remove();
		s.elemente = s.elemente.filter((el) => el !== hinten);
		fuelle(vorne);
		wechsle(vorne, cursor.knoten, cursor.offset);
		aendert();
	};

	const amRand = (el: HTMLElement, r: Range, rand: 'anfang' | 'ende') => {
		if (!r.collapsed) {
			return false;
		}
		const davor = doc.createRange();
		if (rand === 'anfang') {
			davor.setStart(el, 0);
			davor.setEnd(r.startContainer, r.startOffset);
		} else {
			davor.setStart(r.endContainer, r.endOffset);
			davor.setEnd(el, el.childNodes.length);
		}
		return !davor.toString().trim() && !davor.cloneContents().querySelector(`${GESCHUETZT}, br`);
	};

	/**
	 * Hängt an `keydown`, nicht an `beforeinput`: WebKit meldet am Anfang eines Feldes keine Eingabe, weil es dort
	 * nichts zu löschen gibt.
	 */
	const loescheAmRand = (e: KeyboardEvent, rueckwaerts: boolean) => {
		const r = auswahl();
		const el = traeger(r?.startContainer ?? null);
		if (zeilen !== 'absatz' || !r || !el || !amRand(el, r, rueckwaerts ? 'anfang' : 'ende')) {
			return;
		}
		const anderes = nachbar(el, rueckwaerts ? 'vor' : 'nach');
		e.preventDefault();
		if (anderes) {
			fuehreZusammen(rueckwaerts ? anderes : el, rueckwaerts ? el : anderes);
		}
	};

	const befehl = (name: string, wert?: string) => still(() => doc.execCommand(name, false, wert));

	const fettMoeglich = () => {
		const gewicht = doc.defaultView?.getComputedStyle(element).fontWeight ?? '400';
		return gewicht !== 'bold' && Number(gewicht) < 600;
	};

	const formatiere = (format: Format) => {
		if (!sitzung || (format === 'bold' && !fettMoeglich())) {
			return;
		}
		befehl(format);
		aendert();
	};

	const beiEingabe = (e: InputEvent) => {
		if (intern || !imSitzung(e.target as Node)) {
			return;
		}
		if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
			e.preventDefault();
			if (zeilen === 'eine') {
				beende();
			} else if (zeilen === 'umbruch' || e.inputType === 'insertLineBreak') {
				befehl('insertLineBreak');
			} else {
				teile();
			}
			return;
		}
		if (!ERLAUBT.has(e.inputType) || (e.inputType === 'formatBold' && !fettMoeglich())) {
			e.preventDefault();
			return;
		}
		const ziele = e.getTargetRanges().map((s) => bereich(doc, s));
		const r = auswahl();
		// Chromium meldet beim Löschen neben einem geschützten Element nicht immer einen Bereich, der es enthält.
		const daneben =
			r?.collapsed && e.inputType.startsWith('delete')
				? neben(r, e.inputType.includes('Backward') ? 'vor' : 'nach')
				: null;
		if (
			(istElement(daneben) && geschuetzt(daneben)) ||
			beruehrtGeschuetztes(ziele.length > 0 ? ziele : [r].filter((x): x is Range => x !== null))
		) {
			e.preventDefault();
		}
	};

	const beiTaste = (e: KeyboardEvent) => {
		if (!sitzung || !imSitzung(e.target as Node)) {
			return;
		}
		const mod = e.metaKey || e.ctrlKey;
		const taste = e.key.toLowerCase();
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			beende();
		} else if (mod && (taste === 'b' || taste === 'u')) {
			e.preventDefault();
			formatiere(taste === 'b' ? 'bold' : 'underline');
		} else if (mod && taste === 'i') {
			e.preventDefault();
		} else if ((e.key === 'Backspace' || e.key === 'Delete') && !mod && !e.altKey && !e.isComposing) {
			loescheAmRand(e, e.key === 'Backspace');
		}
	};

	const beiEinfuegen = (e: ClipboardEvent) => {
		if (!sitzung || !imSitzung(e.target as Node)) {
			return;
		}
		e.preventDefault();
		const r = auswahl();
		if (r && beruehrtGeschuetztes([r])) {
			return;
		}
		const text = (e.clipboardData?.getData('text/plain') ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
		const stuecke = zeilen === 'eine' ? [text.replace(/\s*\n\s*/g, ' ')] : text.split('\n');
		stuecke.forEach((stueck, i) => {
			if (i > 0) {
				if (zeilen === 'absatz') {
					teile();
				} else {
					befehl('insertLineBreak');
				}
			}
			if (stueck) {
				befehl('insertText', stueck);
			}
		});
		aendert();
	};

	const beiFokus = (e: FocusEvent) => {
		if (e.target === element) {
			starte();
		}
		const el = traeger(e.target as Node);
		if (sitzung && el) {
			sitzung.letztes = el;
		}
	};

	const beiFokusWeg = (e: FocusEvent) => {
		if (!intern && sitzung && imSitzung(e.target as Node) && !imSitzung(e.relatedTarget as Node | null)) {
			beende();
		}
	};

	/** Antippen neben das Feld beendet, auch wenn Safari auf dem iPad den Fokus dabei nicht wegnimmt. */
	const beiDruck = (e: PointerEvent) => {
		if (sitzung && !imSitzung(e.target as Node)) {
			beende();
		}
	};

	const beiAuswahl = () => {
		if (sitzung) {
			aendert();
		}
	};

	const ablegen = (e: Event) => {
		if (imSitzung(e.target as Node)) {
			e.preventDefault();
		}
	};

	const hoerer: [string, (e: never) => void, boolean][] = [
		['beforeinput', beiEingabe, false],
		['keydown', beiTaste, true],
		['paste', beiEinfuegen, false],
		['focusin', beiFokus, false],
		['focusout', beiFokusWeg, false],
		['pointerdown', beiDruck, true],
		['selectionchange', beiAuswahl, false],
		['input', beiAuswahl, false],
		['drop', ablegen, false],
	];
	for (const [typ, fn, capture] of hoerer) {
		doc.addEventListener(typ, fn as EventListener, capture);
	}
	ruesteElement(element);

	return {
		aktiv: () => sitzung !== null,
		beende,
		fokussiere: () => {
			const ziel = element.lastChild?.nodeType === TEXT ? element.lastChild : element;
			element.focus({ preventScroll: true });
			starte();
			setzeCursor(ziel, ziel.nodeType === TEXT ? (ziel as Text).length : element.childNodes.length);
		},
		formatiere,
		zustand: () => ({
			fett: sitzung !== null && doc.queryCommandState('bold'),
			unterstrichen: sitzung !== null && doc.queryCommandState('underline'),
			fettMoeglich: fettMoeglich(),
		}),
		abbauen: () => {
			beende();
			for (const [typ, fn, capture] of hoerer) {
				doc.removeEventListener(typ, fn as EventListener, capture);
			}
			for (const el of geruestet) {
				for (const name of ['contenteditable', 'spellcheck', ...(sprache.has(el) ? ['lang'] : [])]) {
					el.removeAttribute(name);
				}
				el.querySelectorAll('[contenteditable="false"]').forEach((g) => g.removeAttribute('contenteditable'));
			}
		},
	};
};

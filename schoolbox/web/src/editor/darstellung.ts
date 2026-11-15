import { abbildungsName } from '@schoolbox/kern/src/abbildungen';
import type { Baustein, Sicht } from '@schoolbox/kern/src/bausteine';
import {
	bausteinNach,
	bausteinUeber,
	FREI_TITEL,
	FREIES_ELEMENT,
	liegtFrei,
	nameFreiesElement,
} from '@schoolbox/kern/src/bausteine';
import { nameDerGestaltung } from '@schoolbox/kern/src/gestaltung-arten';
import { darstellungsHtml } from '@schoolbox/kern/src/html';
import type { LetzterSchritt, Zerlegung } from '@schoolbox/kern/src/quelltext';
import { MARKE, markiere, stelleDesSchritts } from '@schoolbox/kern/src/quelltext';
import { SEITEN_TEILE } from '@schoolbox/kern/src/seitengestaltung';
import type { Druckprofil } from '@schoolbox/kern/src/werte';

import { gestaltungsText, teileVon, titelDerGestaltung } from './gestaltung-titel';

/**
 * Nur im Editor: kein Markieren von Text, kein Lupen-Menü beim langen Drücken auf dem iPad. Ausnahme ist der Text,
 * der gerade bearbeitet wird. Aufziehen zoomt das Blatt, nicht die Seite (184). In der Lösungsansicht sind
 * Antwortlinien ohne Lösung gelb gestreift mit „?“ (019).
 */
/** 206-07: Beim Tippen rücken die Blöcke hinter dem getippten Block schon im Bild weiter. `false`: erst am Ende. */
export const MITLAUFEN = true;

const EDITOR_STIL =
	'<style data-editor data-grau-roh>html,body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;' +
	'touch-action:pan-x pan-y}' +
	'img{-webkit-user-drag:none}' +
	'[contenteditable=true]{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default;cursor:text;' +
	'outline:none}[contenteditable=true] [contenteditable=false]{-webkit-user-select:none;user-select:none}' +
	'body.loesung .antwort:not([data-l]),body.loesung .antwort[data-l=""]{border-bottom:2px dashed #d97706;' +
	'background:repeating-linear-gradient(135deg,#fef3c7 0 5px,transparent 5px 10px)}' +
	'body.loesung .antwort:not([data-l])::after,body.loesung .antwort[data-l=""]::after{content:"?";' +
	'color:#b45309;font-weight:700}' +
	'@media screen{body{background:transparent!important;padding:12px 0!important}}' +
	// Gestaltung: Gesperrtes, Seitenfläche, Seitenrahmen und Kopfband lassen Klicks durch; Gestaltung zieht man.
	`[data-gesperrt],[data-gesperrt] *,${SEITEN_TEILE.map((t) => `.${t},.${t} *`).join(',')}` +
	'{pointer-events:none!important}[data-lage="frei"]:not(:focus){cursor:move}' +
	// Fläche im Stapel: nur im Editor ein gestrichelter Umriss (leer ist sie sonst nicht zu sehen); beim Ziehen
	// eines Elements schneidet sie nicht ab, damit es beim Herausziehen zu sehen ist (`flaeche-ziel.ts`)
	// 194-18: Ein geleerter Text behält im Editor eine Zeile Höhe und bleibt anklickbar.
	':is(h1,h2,h3,h4,p):empty{min-height:1em;min-height:1lh}' +
	'.flaeche{outline:1px dashed rgba(0,0,0,.3);outline-offset:-1px}' +
	`[data-flaeche-offen] .flaeche{overflow:visible!important}${
	// 206-07: Die Seite schneidet den Block, in dem getippt wird, nicht ab; die Schreibmarke bleibt zu sehen.
	MITLAUFEN ? 'body>.seite:has([contenteditable=true]){overflow:visible!important}' : ''
	}</style>`;

/** Die Prüfung aus blatt.py, hier ohne Selbststart: Der Editor ruft `pruefeBlatt` nach jeder Änderung (020). */
const PRUEFUNG = '<script src="pruefung.js" data-manuell defer></script>';

/**
 * Das Material für das `iframe` des Editors, aus der Quelle im Speicher: wie `/ansicht` (Seitengröße, Lösung), mit
 * `data-sb` in jedem Element und einer `<base>`, damit Bilder, Schriften und blatt.css wie dort geladen werden. Diese
 * Fassung wird nie gespeichert.
 */
export const editorHtml = (
	zerlegung: Zerlegung,
	{ basis, loesung, profil }: { basis: string; loesung: boolean; profil?: Druckprofil | undefined },
) => {
	const html = darstellungsHtml(markiere(zerlegung), { loesung, profil });
	const kopf = `<base href="${basis}">${EDITOR_STIL}${PRUEFUNG}`;
	const offen = /<head[^>]*>/i.exec(html);
	return offen ? html.replace(offen[0], `${offen[0]}${kopf}`) : `${kopf}${html}`;
};

/** Ein Befehl hat das Material geändert; bis die neue Fassung steht, nimmt die alte nichts mehr an. */
export const VERALTET = 'data-veraltet';

/** Ein Element der Darstellung mit seinem Eintrag im Register und der Nummer seines Quellelements. */
export interface Treffer {
	nr: number;
	baustein: Baustein;
	element: Element;
}

export const nrVon = (element: Element) => {
	const wert = element.getAttribute(MARKE);
	return wert === null ? null : Number(wert);
};

/**
 * S-19: Der Lösungstext (`.nur-loesung` ohne eigene Art) ist auch auf dem Arbeitsblatt ein Baustein, dort unsichtbar:
 * So hat er in den Ebenen eine blasse Zeile „nur in der Lösung“, und gewählt bietet der Inspektor „Zur Lösung“.
 */
const LOESUNGSTEXT = bausteinNach('loesungstext')?.selektor;

const SICHT: Sicht<Element> = {
	passt: (e, selektor) => e.matches(selektor === LOESUNGSTEXT ? '.nur-loesung' : selektor),
	tag: (e) => e.localName,
	eltern: (e) => e.parentElement,
	kinder: (e) => [...e.children],
	eigenerText: (e) => [...e.childNodes].some((n) => n.nodeType === 3 && /[^\s\u00a0]/.test((n as Text).data)),
	attribut: (e, name) => e.getAttribute(name),
};

export const bausteinVon = (element: Element) => (nrVon(element) === null ? undefined : bausteinUeber(SICHT, element));

/** Direkt auf der Seite oder in einem einfachen Rahmen: ein Block zwischen seinen Geschwistern (054). */
export const liegtAlsBlock = (element: Element) => liegtFrei(SICHT, element);

/** Der innerste Baustein an dieser Stelle, auch aus einer gezeichneten Abbildung heraus (deren SVG trägt keine Nummer). */
export const trefferAn = (start: Element | null): Treffer | null => {
	for (let element = start; element; element = element.parentElement) {
		const baustein = bausteinVon(element);
		const nr = nrVon(element);
		if (baustein && nr !== null) {
			return { nr, baustein, element };
		}
	}
	return null;
};

export const elementZu = (doc: Document, nr: number) => doc.querySelector(`[${MARKE}="${nr}"]`);

/** Wie der Baustein in Pfad und Gliederung heißt; `umgebung` ist der Baustein darum, in dem gezählt wird. */
export const nameVon = ({ baustein, element }: Treffer, umgebung: Element | null) => {
	const { sonderfall } = baustein;
	if (sonderfall && element.matches(sonderfall.selektor)) {
		return sonderfall.name;
	}
	if (baustein.art === 'abbildung') {
		return abbildungsName(element.localName) ?? baustein.name;
	}
	if (FREIES_ELEMENT.has(baustein.art)) {
		return nameFreiesElement(element.getAttribute(FREI_TITEL));
	}
	const gestaltung = nameDerGestaltung(baustein, (n) => element.getAttribute(n));
	if (gestaltung) {
		// 196-15, 205-03: derselbe Name wie in den Ebenen, für Schild, Inspektor, Pfad und Leiste.
		return titelDerGestaltung({
			art: baustein.art,
			name: gestaltung,
			wert: (n) => element.getAttribute(n),
			text: gestaltungsText(element),
			teile: teileVon(element, baustein.art),
		});
	}
	// Eine Seite einer Präsentation heißt Folie (192-12).
	const name =
		baustein.art === 'seite' && element.ownerDocument.body.classList.contains('folie') ? 'Folie' : baustein.name;
	if (!baustein.zaehlen) {
		return name;
	}
	// N08: Eine Aufgabe heißt wie ihre Nummer im Blatt; die zählt `nummeriere` über Seitengrenzen hinweg.
	const nummer = element.querySelector(':scope > .nr')?.textContent?.trim() ?? '';
	if (/^\d+$/.test(nummer)) {
		return `${name} ${nummer}`;
	}
	const orte = umgebung ? blattSeitenZu(umgebung) : [element.ownerDocument];
	const geschwister = orte
		.flatMap((ort) => [...ort.querySelectorAll(baustein.selektor)])
		.filter((e) => !(sonderfall && e.matches(sonderfall.selektor)) && bausteinVon(e) === baustein);
	return `${name} ${geschwister.indexOf(element) + 1}`;
};

const istAeussereSeite = (e: Element | null): e is Element =>
	e !== null && e.matches('.seite') && e.parentElement === e.ownerDocument.body;
const istAutomatisch = (e: Element | null) => istAeussereSeite(e) && e.getAttribute('data-weiter') === 'auto';

/** 206: Ist `umgebung` eine Seite, gezählt wird im ganzen Blatt (die feste Seite und die automatischen dahinter). */
const blattSeitenZu = (umgebung: Element): Element[] => {
	if (!istAeussereSeite(umgebung)) {
		return [umgebung];
	}
	let erste = umgebung;
	while (istAutomatisch(erste) && istAeussereSeite(erste.previousElementSibling)) {
		erste = erste.previousElementSibling;
	}
	const seiten = [erste];
	for (let n = erste.nextElementSibling; n && istAutomatisch(n); n = n.nextElementSibling) {
		seiten.push(n);
	}
	return seiten;
};

export interface PfadTeil {
	nr: number;
	name: string;
	baustein: Baustein;
}

/** Vom äußersten Baustein bis zum gewählten, z. B. „Seite 1 › Aufgabe 2 › Eintrag 3“. */
export const pfadZu = (doc: Document, nr: number): PfadTeil[] => {
	const kette: Treffer[] = [];
	for (let treffer = trefferAn(elementZu(doc, nr)); treffer; treffer = trefferAn(treffer.element.parentElement)) {
		kette.unshift(treffer);
	}
	// Die Ebene kann nichts (092): Esc geht vom Gestaltungselement zur Seite, der Pfad heißt „Seite 1 › Wilma“ (097).
	return kette
		.filter((treffer) => treffer.baustein.art !== 'ebene')
		.map((treffer, i, ohneEbene) => ({
			nr: treffer.nr,
			baustein: treffer.baustein,
			name: nameVon(treffer, ohneEbene[i - 1]?.element ?? null),
		}));
};

/**
 * Welcher Baustein nach Rückgängig oder Wiederholen gewählt ist. Der innerste Baustein um die Änderung, oder der darum,
 * wenn es ihn nicht mehr gibt. Steht die gemerkte Auswahl auf derselben Seite, gilt sie: Wer eine Aufgabe verschoben hat,
 * meint diese Aufgabe, nicht die ganze Seite, die der geänderte Bereich umschließt.
 */
export const zielNachSchritt = (doc: Document, z: Zerlegung, letzter: LetzterSchritt) => {
	let stelle: Treffer | null = null;
	for (let k = stelleDesSchritts(z, letzter); k && !stelle; k = k.eltern) {
		stelle = trefferAn(elementZu(doc, k.nr));
	}
	const { auswahlNachher, auswahlVorher } = letzter.schritt;
	const nr = letzter.richtung === 'zurueck' ? auswahlVorher : auswahlNachher;
	const gemerkt = nr === null || nr === undefined ? null : trefferAn(elementZu(doc, nr));
	const gleicheSeite = gemerkt && stelle && gemerkt.element.closest('.seite') === stelle.element.closest('.seite');
	return (gemerkt && (!stelle || gleicheSeite) ? gemerkt : stelle)?.nr ?? null;
};

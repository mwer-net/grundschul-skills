import type { Baustein } from '@schoolbox/kern/src/bausteine';
import { BAUSTEINE } from '@schoolbox/kern/src/bausteine';
import { darstellungsHtml } from '@schoolbox/kern/src/html';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { MARKE, markiere } from '@schoolbox/kern/src/quelltext';

/**
 * Nur im Editor: kein Markieren von Text, kein Lupen-Menü beim langen Drücken auf dem iPad. Ausnahme ist der Text,
 * der gerade bearbeitet wird.
 */
const EDITOR_STIL =
	'<style data-editor>html,body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}' +
	'img{-webkit-user-drag:none}' +
	'[contenteditable=true]{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default;cursor:text;' +
	'outline:none}[contenteditable=true] [contenteditable=false]{-webkit-user-select:none;user-select:none}</style>';

/**
 * Das Material für das `iframe` des Editors, aus der Quelle im Speicher: wie `/ansicht` (Seitengröße, Lösung), mit
 * `data-sb` in jedem Element und einer `<base>`, damit Bilder, Schriften und blatt.css wie dort geladen werden. Diese
 * Fassung wird nie gespeichert.
 */
export const editorHtml = (zerlegung: Zerlegung, { basis, loesung }: { basis: string; loesung: boolean }) => {
	const html = darstellungsHtml(markiere(zerlegung), { loesung });
	const kopf = `<base href="${basis}">${EDITOR_STIL}`;
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

export const bausteinVon = (element: Element) =>
	nrVon(element) === null ? undefined : BAUSTEINE.find((b) => element.matches(b.selektor));

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

const name = ({ baustein, element }: Treffer, umgebung: Element | null) => {
	const { sonderfall } = baustein;
	if (sonderfall && element.matches(sonderfall.selektor)) {
		return sonderfall.name;
	}
	if (!baustein.zaehlen) {
		return baustein.name;
	}
	const geschwister = [...(umgebung ?? element.ownerDocument).querySelectorAll(baustein.selektor)].filter(
		(e) => !(sonderfall && e.matches(sonderfall.selektor)) && bausteinVon(e) === baustein,
	);
	return `${baustein.name} ${geschwister.indexOf(element) + 1}`;
};

export interface PfadTeil {
	nr: number;
	name: string;
	baustein: Baustein;
}

/** Vom äußersten Baustein bis zum gewählten, z. B. „Seite 1 › Aufgabe 2 › Item 3“. */
export const pfadZu = (doc: Document, nr: number): PfadTeil[] => {
	const kette: Treffer[] = [];
	for (let treffer = trefferAn(elementZu(doc, nr)); treffer; treffer = trefferAn(treffer.element.parentElement)) {
		kette.unshift(treffer);
	}
	return kette.map((treffer, i) => ({
		nr: treffer.nr,
		baustein: treffer.baustein,
		name: name(treffer, kette[i - 1]?.element ?? null),
	}));
};

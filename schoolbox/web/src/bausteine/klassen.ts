type Teil = string | false | null | undefined;
type Gruppe = string | ((treffer: RegExpMatchArray) => string | undefined);

/**
 * Gruppen von Tailwind-Klassen, die dieselbe Eigenschaft setzen. Die erste passende Regel gilt. Unbekannte Klassen
 * haben keine Gruppe und bleiben immer stehen.
 */
const GRUPPEN: [RegExp, Gruppe][] = [
	[/^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents|table|flow-root)$/, 'display'],
	[/^(static|fixed|absolute|relative|sticky)$/, 'position'],
	[/^(visible|invisible|collapse)$/, 'visibility'],
	[/^(underline|no-underline|line-through|overline)$/, 'text-decoration'],
	[/^text-(xs|sm|base|lg|\d?xl|\[length:.+\]|\(length:.+\)|\[[\d.]+(px|rem|em)\])$/, 'font-size'],
	[/^text-(left|center|right|justify|start|end)$/, 'text-align'],
	[/^text-(ellipsis|clip)$/, 'text-overflow'],
	[/^text-(wrap|nowrap|balance|pretty)$/, 'text-wrap'],
	[/^text-/, 'text-color'],
	[/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/, 'font-weight'],
	[/^font-(sans|serif|mono)$/, 'font-family'],
	[/^bg-(clip|origin|repeat|no-repeat|linear|radial|conic|gradient|blend)/, (t) => t[0]],
	[/^bg-(fixed|local|scroll|auto|cover|contain|top|bottom|left|right|center|none)$/, (t) => t[0]],
	[/^bg-/, 'bg-color'],
	[/^border-(solid|dashed|dotted|double|hidden|none)$/, 'border-style'],
	[/^border(-[xytrblse])?(-\d+|-\[length:.+\])?$/, (t) => `border-width${t[1] ?? ''}`],
	[/^border(-[xytrblse])?-/, (t) => `border-color${t[1] ?? ''}`],
	[/^rounded(?:-(tl|tr|br|bl|ss|se|es|ee|t|r|b|l|s|e)(?=-|$))?/, (t) => `rounded-${t[1] ?? 'alle'}`],
	[/^(p|m)([xytrblse]?)-/, (t) => `${t[1]}${t[2]}`],
	[/^gap(-[xy])?-/, (t) => `gap${t[1] ?? ''}`],
	[/^space-([xy])-/, (t) => `space-${t[1]}`],
	[/^size-knopf(-klein|-status|-feld)?$/, 'min-size'],
	[/^h-(knopf|knopf-klein|knopf-status|feld|zeile|menue)$/, 'min-h'],
	[/^(min-w|min-h|max-w|max-h|size|w|h)-/, (t) => t[1]],
	[/^inset(-[xy])?-/, (t) => `inset${t[1] ?? ''}`],
	[/^(top|right|bottom|left|start|end)-/, (t) => t[1]],
	[/^z-/, 'z'],
	[/^opacity-/, 'opacity'],
	[/^shadow(-(none|xs|sm|md|lg|xl|2xl|\d+|\[.+\]))?$/, 'shadow'],
	[/^cursor-/, 'cursor'],
	[/^overflow(-[xy])?-/, (t) => `overflow${t[1] ?? ''}`],
	[/^items-/, 'align-items'],
	[/^justify-(start|end|center|between|around|evenly|stretch|normal)$/, 'justify-content'],
	[/^self-/, 'align-self'],
	[/^flex-(row|row-reverse|col|col-reverse)$/, 'flex-direction'],
	[/^flex-(wrap|wrap-reverse|nowrap)$/, 'flex-wrap'],
	[/^flex-/, 'flex'],
	[/^(grow|shrink)(-|$)/, (t) => t[1]],
	[/^basis-/, 'basis'],
	[/^order-/, 'order'],
	[/^grid-cols-/, 'grid-cols'],
	[/^grid-rows-/, 'grid-rows'],
	[/^pointer-events-/, 'pointer-events'],
	[/^select-/, 'user-select'],
	[/^whitespace-/, 'whitespace'],
	[/^leading-/, 'line-height'],
	[/^tracking-/, 'letter-spacing'],
	[/^outline-offset-/, 'outline-offset'],
	[/^outline(-(none|hidden|\d+))?$/, 'outline'],
	[/^outline-/, 'outline-color'],
	[/^ring-offset-/, 'ring-offset'],
	[/^ring(-\d+)?$/, 'ring'],
	[/^ring-/, 'ring-color'],
	[/^duration-/, 'duration'],
	[/^object-(contain|cover|fill|none|scale-down)$/, 'object-fit'],
];

const seiten = (vorne: string, ...teile: string[]) => teile.map((t) => `${vorne}${t}`);

/** Eine spätere Klasse dieser Gruppe nimmt auch die genannten früheren weg (`p-2` nach `px-3`). */
const UMFASST: Record<string, string[]> = {
	p: seiten('p', 'x', 'y', 't', 'r', 'b', 'l', 's', 'e'),
	px: seiten('p', 'l', 'r', 's', 'e'),
	py: seiten('p', 't', 'b'),
	m: seiten('m', 'x', 'y', 't', 'r', 'b', 'l', 's', 'e'),
	mx: seiten('m', 'l', 'r', 's', 'e'),
	my: seiten('m', 't', 'b'),
	gap: ['gap-x', 'gap-y'],
	size: ['w', 'h'],
	'min-size': ['min-w', 'min-h'],
	inset: ['inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end'],
	'inset-x': ['left', 'right', 'start', 'end'],
	'inset-y': ['top', 'bottom'],
	overflow: ['overflow-x', 'overflow-y'],
	'border-width': seiten('border-width-', 'x', 'y', 't', 'r', 'b', 'l', 's', 'e'),
	'border-color': seiten('border-color-', 'x', 'y', 't', 'r', 'b', 'l', 's', 'e'),
	'rounded-alle': seiten('rounded-', 't', 'r', 'b', 'l', 'tl', 'tr', 'br', 'bl', 's', 'e', 'ss', 'se', 'es', 'ee'),
};

/** Varianten (`hover:`, `md:`, `data-[x]:`) und die eigentliche Klasse; Doppelpunkte in `[…]` und `(…)` zählen nicht. */
const zerlege = (klasse: string) => {
	const varianten: string[] = [];
	let tiefe = 0;
	let anfang = 0;
	for (const [i, zeichen] of [...klasse].entries()) {
		if (zeichen === '[' || zeichen === '(') {
			tiefe++;
		} else if (zeichen === ']' || zeichen === ')') {
			tiefe--;
		} else if (zeichen === ':' && tiefe === 0) {
			varianten.push(klasse.slice(anfang, i));
			anfang = i + 1;
		}
	}
	const kern = klasse
		.slice(anfang)
		.replace(/^!|!$/g, '')
		.replace(/^-/, '');
	return { kern, varianten: varianten.sort().join(':') };
};

const gruppeVon = (kern: string) => {
	for (const [muster, gruppe] of GRUPPEN) {
		const treffer = kern.match(muster);
		if (treffer) {
			return (typeof gruppe === 'string' ? gruppe : gruppe(treffer)) ?? kern;
		}
	}
	return null;
};

/**
 * Hängt Klassen aneinander und löst Widersprüche auf: Setzen zwei Klassen mit denselben Varianten dieselbe
 * Eigenschaft, gilt die spätere (`klassen('text-leise', aktiv && 'text-brand-700')`). Ohne das entschiede die
 * Reihenfolge im CSS, nicht die im Aufruf. Kennt nur die Gruppen oben; alles andere bleibt stehen, wie es ist.
 */
export const klassen = (...teile: Teil[]) => {
	const liste = teile
		.filter(Boolean)
		.join(' ')
		.split(/\s+/)
		.filter((k) => k !== '');
	const vergeben = new Set<string>();
	const ergebnis: string[] = [];
	for (const klasse of liste.reverse()) {
		const { kern, varianten } = zerlege(klasse);
		const gruppe = gruppeVon(kern);
		const schluessel = gruppe === null ? `=${klasse}` : `${varianten}|${gruppe}`;
		if (vergeben.has(schluessel)) {
			continue;
		}
		vergeben.add(schluessel);
		for (const teil of gruppe === null ? [] : (UMFASST[gruppe] ?? [])) {
			vergeben.add(`${varianten}|${teil}`);
		}
		ergebnis.push(klasse);
	}
	return ergebnis.reverse().join(' ');
};

export type KnopfArt = 'haupt' | 'zweit' | 'leise' | 'gefahr';
export type KnopfGroesse = 'standard' | 'klein';

/** `data-[popup-open]`: Der Auslöser eines Menüs oder Popovers bleibt gedrückt, solange es offen ist (187-13). */
const KNOPF_ART: Record<KnopfArt, string> = {
	haupt: 'border-transparent bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 data-[popup-open]:bg-brand-600',
	zweit: 'border-rand-feld bg-flaeche text-tinte hover:bg-flaeche-2 active:bg-rand data-[popup-open]:bg-flaeche-2',
	leise: 'border-transparent text-tinte hover:bg-flaeche-2 active:bg-rand data-[popup-open]:bg-flaeche-2',
	gefahr: 'border-transparent text-fehler hover:bg-red-50 active:bg-red-100 data-[popup-open]:bg-red-50',
};

const KNOPF_GROESSE: Record<KnopfGroesse, string> = {
	standard: 'h-knopf px-2.5 text-sm',
	klein: 'h-knopf-klein px-2 text-sm',
};

/** Am Mac 26 px (Leisten 24 px), mit Finger 44 px: Die Höhen stehen als Variablen in `stil.css`. */
export const knopfKlassen = (art: KnopfArt = 'haupt', zusatz?: string, groesse: KnopfGroesse = 'standard') =>
	klassen(
		'inline-flex flex-none items-center justify-center gap-1.5 rounded-md border font-medium whitespace-nowrap no-underline',
		'transition-colors duration-[120ms] select-none disabled:cursor-default disabled:opacity-50',
		KNOPF_GROESSE[groesse],
		KNOPF_ART[art],
		zusatz,
	);

/** Kachel einer bildhaften Wahl im Raster `grid grid-cols-N gap-1`. Gewählt: Rand in Tinte, der Grund bleibt weiß. */
export const KACHEL =
	'flex min-h-7 min-w-0 items-center justify-center gap-1 rounded-md border border-rand bg-flaeche px-1 text-sm text-tinte disabled:opacity-50 aria-pressed:border-tinte aria-pressed:ring-1 aria-pressed:ring-tinte enabled:not-aria-pressed:hover:bg-flaeche-2 [@media(any-pointer:coarse)]:min-h-11';

/** Eingabefelder und Selects: gleiche Höhe, 1 px Rand. */
export const FELD_KLASSEN =
	'h-feld w-full rounded-md border border-rand-feld bg-flaeche px-1.5 text-sm font-normal text-tinte placeholder:text-dezent focus:border-brand-500 focus:outline-none disabled:opacity-50';

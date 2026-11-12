/**
 * Besitzer: 167. Ein Aufbau für alle Schubladen (146): Kopf, feste Steuerzeile, Inhalt mit Abschnitten. Andere Tickets
 * nutzen die Teile und überschreiben keine Klassen.
 */
// >> 168
import type { ReactNode, Ref } from 'react';
// << 168

import { klassen } from './klassen';
import { Symbol } from './Symbol';

/** Name im Kopf: 14 px, am iPad 18 px. */
export const KOPF_TITEL = 'min-w-0 flex-1 truncate text-lg font-semibold [@media(any-pointer:coarse)]:text-2xl';

/** Überschrift eines Abschnitts: 13 px, am iPad 16 px. */
export const ABSCHNITT_TITEL = 'text-base font-semibold [@media(any-pointer:coarse)]:text-xl';

/** Zahl oder Zusatz rechts neben einer Überschrift, Zahl in einer Zeile. */
export const NOTIZ = 'text-xs font-normal text-dezent tabular-nums';

/** Nur das Aussehen einer Kachel. Größe und Ausrichtung gibt der Aufrufer dazu. */
export const SCHUBLADENKACHEL = 'overflow-hidden rounded-lg bg-flaeche-2 hover:bg-brand-50 disabled:opacity-50';

/** Eine Zeile Unterschrift unter einer Vorschau. */
export const KACHELNAME = 'w-full truncate text-center text-xs text-leise';

// >> 168
/**
 * Name eines Bausteins in der Stufe „Eintrag“, bis zu zwei Zeilen. Die Vorschau eines Bausteins ist ein abstrakter
 * Ausschnitt eines Blatts, erst der Name sagt, was sie zeigt (147, Annahme 4).
 */
export const KACHELNAME_ZWEIZEILIG = 'line-clamp-2 w-full text-center text-sm break-words hyphens-auto';
// << 168

/** Eine Zeile mit Symbol, Name, Zahl. */
export const SCHUBLADENZEILE = 'flex h-zeile w-full items-center gap-2 rounded-md px-2 text-left hover:bg-flaeche-2';

/** Liste von Zeilen; ihr Symbol steht auf der Kante der Überschrift. */
export const ZEILENLISTE = '-mx-2 flex flex-col';

/** Jeder `Segment` in der Steuerzeile. */
export const STEUER_SEGMENT = 'flex w-full *:flex-1 *:px-1 *:text-xs';

/** Ausgeschrieben, damit Tailwind jede Klasse findet. */
const SPALTEN = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5' } as const;

/** Raster für Kacheln, 8 px Abstand. Wird die Schublade breiter, wachsen die Kacheln; die Spaltenzahl bleibt. */
export const raster = (spalten: keyof typeof SPALTEN) => `grid gap-2 ${SPALTEN[spalten]}`;

/** Der eine Wortlaut nach einer Suche ohne Treffer. */
export const nichtsPasst = (suche: string) => `Nichts passt zu „${suche.trim()}“.`;

type Daten = Readonly<Record<`data-${string}`, string>>;

/** Kopf einer Schublade: der Name, rechts höchstens Knöpfe wie „Alle einklappen“ der Ebenen. Kein ⋯ und kein X. */
export const Schubladenkopf = ({ children, titel }: { titel: string; children?: ReactNode }) => (
	<div className="flex h-10 flex-none items-center gap-1 border-b border-rand pr-1 pl-3" data-schubladenkopf>
		<h2 className={KOPF_TITEL}>{titel}</h2>
		{children}
	</div>
);

/** Suchfeld in der Steuerzeile; `beschriftung` ist der zugängliche Name, der Kopf nennt die Schublade schon. */
export const Schubladensuche = ({
	beschriftung,
	setWert,
	wert,
}: {
	beschriftung: string;
	wert: string;
	setWert: (wert: string) => void;
}) => (
	<label className="relative block">
		<span className="sr-only">{beschriftung}</span>
		<Symbol
			name="suche"
			className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-leise"
		/>
		<input
			// Wie `EIGENE_GESCHICHTE`: ⌘Z im Feld gehört dem Feld.
			data-eigene-geschichte=""
			type="search"
			className="h-knopf w-full rounded-lg border border-rand bg-papier pr-2 pl-8 text-sm placeholder:text-leise focus:border-brand-500 focus:bg-flaeche focus:outline-none"
			placeholder="Suchen …"
			autoComplete="off"
			spellCheck={false}
			value={wert}
			onChange={(e) => setWert(e.target.value)}
		/>
	</label>
);

/**
 * Eine Schublade: Kopf, darunter fest die Steuerzeile (Suche, dann Umschalter, dann höchstens eine Aktion), dann der
 * Inhalt, der allein rollt.
 */
export const Schublade = ({
	children,
	daten,
	// >> 168
	inhaltRef,
	// << 168
	kopf,
	steuerung,
	titel,
}: {
	titel: string;
	/** Knöpfe rechts im Kopf. */
	kopf?: ReactNode;
	steuerung?: ReactNode;
	children: ReactNode;
	/** `data-*` an der Wurzel, etwa `data-bibliothek`. */
	daten?: Daten;
	// >> 168
	/** Am rollenden Inhalt, etwa um den Rollstand zurückzusetzen. */
	inhaltRef?: Ref<HTMLDivElement>;
	// << 168
}) => (
	<div className="flex min-h-0 flex-1 flex-col" {...daten}>
		<Schubladenkopf titel={titel}>{kopf}</Schubladenkopf>
		{steuerung && (
			<div className="flex flex-none flex-col gap-2 px-3 pt-3" data-schublade-steuerung>
				{steuerung}
			</div>
		)}
		{/* >> 168 */}
		<div
			ref={inhaltRef}
			className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-4"
			data-schublade-inhalt
		>
			{/* << 168 */}
			{children}
		</div>
	</div>
);

/** Ein Abschnitt: fette Überschrift, getrennt nur durch Abstand. Keine Nummer, keine Linie, kein Einklappen. */
export const Schubladenabschnitt = ({
	children,
	daten,
	notiz,
	titel,
}: {
	titel?: string;
	/** Rechts neben der Überschrift, etwa eine Zahl. */
	notiz?: string;
	children: ReactNode;
	daten?: Daten;
}) => (
	<section className="flex flex-col gap-2" data-schublade-abschnitt {...daten}>
		{titel && (
			<h3 className={klassen(ABSCHNITT_TITEL, 'flex items-baseline gap-2')}>
				<span className="min-w-0 flex-1 truncate">{titel}</span>
				{notiz && <span className={NOTIZ}>{notiz}</span>}
			</h3>
		)}
		{children}
	</section>
);

/** Ein grauer Satz, wenn nichts zu zeigen ist; darunter höchstens eine Aktion. */
export const Schubladenleer = ({ aktion, children }: { children: ReactNode; aktion?: ReactNode }) => (
	<div className="flex flex-col items-start gap-2" data-schublade-leer>
		<p className="text-sm text-leise">{children}</p>
		{aktion}
	</div>
);

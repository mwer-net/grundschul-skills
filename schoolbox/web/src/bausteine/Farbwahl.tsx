import { useEffect, useId, useRef } from 'react';

import { klassen } from './klassen';

/**
 * Farben des Blatts als Variablen (Briefing 3.9): Sie folgen Palette und Thema. Weiß und eine eigene Farbe kommen als
 * Hex dazu. 104, 105 und 108 benutzen diesen Baustein; 108 ergänzt Verläufe.
 */
export const BLATT_FARBEN = [
	{ wert: 'var(--haupt)', name: 'Hauptfarbe', variable: '--haupt' },
	{ wert: 'var(--akzent)', name: 'Akzentfarbe', variable: '--akzent' },
	{ wert: 'var(--dunkel)', name: 'Dunkel', variable: '--dunkel' },
	{ wert: 'var(--linie)', name: 'Linienfarbe', variable: '--linie' },
	{ wert: 'var(--fuell)', name: 'Füllfarbe', variable: '--fuell' },
] as const;

export const WEISS = '#ffffff';

const HEX = /^#[0-9a-f]{6}$/i;

/** `#abc` → `#aabbcc`, für `<input type="color">`, das nur sechs Stellen kennt. */
const sechsStellen = (wert: string) => {
	const kurz = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(wert);
	return kurz ? `#${kurz[1]}${kurz[1]}${kurz[2]}${kurz[2]}${kurz[3]}${kurz[3]}` : wert.slice(0, 7);
};

const istWeiss = (wert: string | null) => wert !== null && ['#fff', '#ffffff'].includes(wert.toLowerCase());

/** Wie die Variable im Material gerade aussieht; ohne Material ein neutrales Grau. */
const sichtbar = (doc: Document | null, variable: string) => {
	const body = doc?.body;
	const fenster = doc?.defaultView;
	return (body && fenster?.getComputedStyle(body).getPropertyValue(variable).trim()) || '#999999';
};

interface Eigenschaften {
	/** Name der Gruppe, z. B. „Farbe 1“. */
	beschriftung: string;
	/** `var(--haupt)` …, Hex oder `null` (nichts gewählt). */
	wert: string | null;
	setze: (wert: string) => void;
	/** Während der Farbwähler des Systems offen ist: nur ansehen, noch nicht schreiben. */
	zeige?: (wert: string) => void;
	/** Das Material, um die Farben der Palette zu zeigen, wie sie dort aussehen. */
	doc: Document | null;
	aus?: boolean;
	/** `data-farbwahl`, für Tests. */
	name?: string;
}

const RUND =
	'flex size-knopf-klein flex-none items-center justify-center rounded-full border border-rand p-0.5 aria-pressed:border-tinte aria-pressed:ring-1 aria-pressed:ring-tinte disabled:opacity-50';

/** Fünf Farben des Blatts, Weiß und „Eigene Farbe“. Ein Klick wählt, ein Schritt im Verlauf. */
export const Farbwahl = ({ aus, beschriftung, doc, name, setze, wert, zeige }: Eigenschaften) => {
	const eigeneId = useId();
	const eingabe = useRef<HTMLInputElement>(null);
	const setzeJetzt = useRef(setze);
	useEffect(() => {
		setzeJetzt.current = setze;
	});
	// `change` erst beim Schließen des Systemfensters; React meldet mit onChange jedes Zwischenbild.
	useEffect(() => {
		const element = eingabe.current;
		if (!element) {
			return undefined;
		}
		const fertig = () => setzeJetzt.current(element.value.toLowerCase());
		element.addEventListener('change', fertig);
		return () => element.removeEventListener('change', fertig);
	}, []);

	const eigen = wert !== null && HEX.test(sechsStellen(wert)) && !istWeiss(wert) ? sechsStellen(wert) : null;
	return (
		<div
			role="group"
			aria-label={beschriftung}
			className="flex flex-wrap items-center gap-1"
			data-farbwahl={name ?? beschriftung}
		>
			{BLATT_FARBEN.map((f) => (
				<button
					key={f.wert}
					type="button"
					className={RUND}
					aria-pressed={wert === f.wert}
					aria-label={f.name}
					title={f.name}
					disabled={aus}
					data-farbe={f.wert}
					onClick={() => setze(f.wert)}
				>
					<span
						aria-hidden
						className="block size-full min-h-4 rounded-full border border-black/10"
						style={{ background: sichtbar(doc, f.variable) }}
					/>
				</button>
			))}
			<button
				type="button"
				className={RUND}
				aria-pressed={istWeiss(wert)}
				aria-label="Weiß"
				title="Weiß"
				disabled={aus}
				data-farbe={WEISS}
				onClick={() => setze(WEISS)}
			>
				<span aria-hidden className="block size-full min-h-4 rounded-full border border-black/10 bg-white" />
			</button>
			<label
				htmlFor={eigeneId}
				title="Eigene Farbe"
				data-gewaehlt={eigen !== null || undefined}
				className={klassen(
					RUND,
					'relative cursor-pointer',
					eigen !== null && 'border-tinte ring-1 ring-tinte',
					aus && 'pointer-events-none opacity-50',
				)}
			>
				<span
					aria-hidden
					className="block size-full min-h-4 rounded-full"
					style={{
						background:
							eigen ?? 'conic-gradient(#e76f51, #ffbe0b, #43aa8b, #3a86ff, #6a4c93, #e76f51)',
					}}
				/>
				<input
					ref={eingabe}
					id={eigeneId}
					type="color"
					aria-label="Eigene Farbe"
					data-farbe="eigen"
					disabled={aus}
					className="absolute inset-0 size-full cursor-pointer opacity-0"
					value={eigen ?? '#ffe0b8'}
					onChange={(e) => zeige?.(e.target.value.toLowerCase())}
				/>
			</label>
		</div>
	);
};

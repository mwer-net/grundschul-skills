import { BLATT_FARBEN, WEISS } from '@schoolbox/kern/src/blatt-farben';
import type { ButtonHTMLAttributes } from 'react';
import { useEffect, useId, useRef } from 'react';

import { klassen } from './klassen';
import { sichtbar } from './verlauf';

export const SCHWARZ = '#000000';

/** „Keine“: weiß mit rotem Schrägstrich. */
export const KEINE_FARBE = 'linear-gradient(135deg, #fff 45%, #e11d48 45% 55%, #fff 55%)';

const FARBKREIS = 'conic-gradient(#e76f51, #ffbe0b, #43aa8b, #3a86ff, #6a4c93, #e76f51)';

const HEX = /^#[0-9a-f]{6}$/i;

/** `#abc` → `#aabbcc`, für `<input type="color">`, das nur sechs Stellen kennt. */
const sechsStellen = (wert: string) => {
	const kurz = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(wert);
	const lang = kurz ? `#${kurz[1]}${kurz[1]}${kurz[2]}${kurz[2]}${kurz[3]}${kurz[3]}` : wert.slice(0, 7);
	return lang.toLowerCase();
};

/** Feste Trefferfläche, damit der Punkt in einer Reihe mit `items-center` nicht oval wird. */
const FLAECHE =
	'group/punkt relative flex size-6 flex-none items-center justify-center rounded-full disabled:opacity-50 [@media(any-pointer:coarse)]:size-11';

const punktKlassen = (gewaehlt: boolean, aus: boolean | undefined) =>
	klassen(
		'pointer-events-none block size-[18px] flex-none rounded-full border border-black/10 ring-offset-1 [@media(any-pointer:coarse)]:size-7',
		gewaehlt && 'ring-2 ring-tinte',
		!gewaehlt && !aus && 'group-hover/punkt:ring-2 group-hover/punkt:ring-rand-feld',
	);

interface Eigene {
	/** Die eigene Farbe als Hex, `null`, wenn keine eigene gewählt ist. */
	wert: string | null;
	setze: (wert: string) => void;
	zeige?: (wert: string) => void;
}

interface PunktEigenschaften extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'style'> {
	/** `title` und `aria-label`. */
	name: string;
	/** CSS-Hintergrund des Punkts: Farbe, Verlauf oder Muster. */
	farbe: string;
	/** Ohne Angabe ein Punkt, der nur handelt (Wortfarbe in der Textleiste): kein `aria-pressed`. */
	gewaehlt?: boolean;
	aus?: boolean;
}

/** Der Farbkreis mit dem Farbwähler des Systems darin. */
const EigenerPunkt = ({ aus, eigen }: { aus?: boolean; eigen: Eigene }) => {
	const id = useId();
	const eingabe = useRef<HTMLInputElement>(null);
	const setzeJetzt = useRef(eigen.setze);
	useEffect(() => {
		setzeJetzt.current = eigen.setze;
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
	return (
		<label
			htmlFor={id}
			title="Eigene Farbe"
			data-gewaehlt={eigen.wert !== null || undefined}
			className={klassen(FLAECHE, 'cursor-pointer', aus && 'pointer-events-none opacity-50')}
		>
			<span
				aria-hidden
				className={punktKlassen(eigen.wert !== null, aus)}
				style={{ background: eigen.wert ?? FARBKREIS }}
			/>
			<input
				ref={eingabe}
				id={id}
				type="color"
				aria-label="Eigene Farbe"
				data-farbe="eigen"
				disabled={aus}
				className="absolute inset-0 size-full cursor-pointer opacity-0"
				value={eigen.wert ?? '#ffe0b8'}
				onChange={(e) => eigen.zeige?.(e.target.value.toLowerCase())}
			/>
		</label>
	);
};

/** Ein Farbpunkt: 24 px Trefferfläche, darin 18 px Farbe; mit dem Finger 44 und 28 px. Gewählt: Ring in Tinte. */
export const Farbpunkt = ({ aus, farbe, gewaehlt, name, ...rest }: PunktEigenschaften) => (
	<button
		type="button"
		className={FLAECHE}
		aria-pressed={gewaehlt}
		aria-label={name}
		title={name}
		disabled={aus}
		{...rest}
	>
		<span aria-hidden className={punktKlassen(gewaehlt === true, aus)} style={{ background: farbe }} />
	</button>
);

interface Gemeinsam {
	/** Name der Gruppe, z. B. „Füllung“ oder „Farbe 1“. */
	beschriftung: string;
	/** `var(--haupt)` …, Hex oder `null` (keine oder nichts gewählt). */
	wert: string | null;
	/** Während der Farbwähler des Systems offen ist: nur ansehen, noch nicht schreiben. */
	zeige?: (wert: string) => void;
	/** Das Material, um die Farben der Palette zu zeigen, wie sie dort aussehen. */
	doc: Document | null;
	aus?: boolean;
	/** `data-farbwahl`, für Tests. */
	name?: string;
	/** „Schwarz“ nach „Keine“ anbieten. */
	schwarz?: boolean;
	/** Mehrfachauswahl mit verschiedenen Werten: Kein Punkt trägt einen Ring. */
	gemischt?: boolean;
}

export type FarbreiheEigenschaften = Gemeinsam &
	(
		| {
				/** Name des Punkts „Keine“, z. B. „Keine Füllung“; ohne gibt es keinen. */
				keine: string;
				setze: (wert: string | null) => void;
		  }
		| { keine?: undefined; setze: (wert: string) => void }
	);

const gleich = (a: string | null, b: string) => a !== null && sechsStellen(a) === b;

/** Eine Reihe ohne Abstand: „Keine“, „Schwarz“, die fünf Farben des Blatts, „Weiß“, „Eigene Farbe“. */
export const Farbreihe = (e: FarbreiheEigenschaften) => {
	const { aus, beschriftung, doc, gemischt, name, schwarz, wert, zeige } = e;
	const keine = e.keine === undefined ? null : { name: e.keine, setze: e.setze };
	const an = (gewaehlt: boolean) => !gemischt && gewaehlt;
	const bekannt =
		wert === null ||
		BLATT_FARBEN.some((f) => f.wert === wert) ||
		gleich(wert, WEISS) ||
		(Boolean(schwarz) && gleich(wert, SCHWARZ));
	const eigen = wert !== null && !bekannt && !gemischt && HEX.test(sechsStellen(wert)) ? sechsStellen(wert) : null;
	return (
		<div
			role="group"
			aria-label={beschriftung}
			className="flex flex-wrap items-center"
			data-farbwahl={name ?? beschriftung}
		>
			{keine && (
				<Farbpunkt
					name={keine.name}
					farbe={KEINE_FARBE}
					gewaehlt={an(wert === null)}
					aus={aus}
					data-farbe="keine"
					onClick={() => keine.setze(null)}
				/>
			)}
			{schwarz && (
				<Farbpunkt
					name="Schwarz"
					farbe={SCHWARZ}
					gewaehlt={an(gleich(wert, SCHWARZ))}
					aus={aus}
					data-farbe={SCHWARZ}
					onClick={() => e.setze(SCHWARZ)}
				/>
			)}
			{BLATT_FARBEN.map((f) => (
				<Farbpunkt
					key={f.wert}
					name={f.name}
					farbe={sichtbar(doc, f.variable)}
					gewaehlt={an(wert === f.wert)}
					aus={aus}
					data-farbe={f.wert}
					onClick={() => e.setze(f.wert)}
				/>
			))}
			<Farbpunkt
				name="Weiß"
				farbe={WEISS}
				gewaehlt={an(gleich(wert, WEISS))}
				aus={aus}
				data-farbe={WEISS}
				onClick={() => e.setze(WEISS)}
			/>
			<EigenerPunkt aus={aus} eigen={{ wert: eigen, setze: (w) => e.setze(w), zeige }} />
		</div>
	);
};

import type { Verlauf } from '@schoolbox/kern/src/aussehen';
import { BLATT_FARBEN, WEISS } from '@schoolbox/kern/src/blatt-farben';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

import { klassen } from './klassen';
import { Segment } from './Segment';
import { Stepper } from './Stepper';
import { sichtbar, verlaufCss } from './verlauf';

/**
 * Farben des Blatts als Variablen (Briefing 3.9): Sie folgen Palette und Thema. Weiß und eine eigene Farbe kommen als
 * Hex dazu. 104, 105 und 108 benutzen diesen Baustein; 108 ergänzt Verläufe (Feld `verlauf`).
 */
const HEX = /^#[0-9a-f]{6}$/i;

/** `#abc` → `#aabbcc`, für `<input type="color">`, das nur sechs Stellen kennt. */
const sechsStellen = (wert: string) => {
	const kurz = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(wert);
	return kurz ? `#${kurz[1]}${kurz[1]}${kurz[2]}${kurz[2]}${kurz[3]}${kurz[3]}` : wert.slice(0, 7);
};

const istWeiss = (wert: string | null) => wert !== null && ['#fff', '#ffffff'].includes(wert.toLowerCase());

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
	/**
	 * 108: Mit diesem Feld zeigt der Wähler oben „Farbe / Verlauf“. Beim Verlauf: linear oder radial, zwei Farben und
	 * (nur linear) den Winkel. Jede Änderung ist ein Schritt; „Farbe“ setzt die erste Farbe einfarbig über `setze`.
	 */
	verlauf?: VerlaufWahl;
	/** Knöpfe vor den Farben in derselben Reihe, z. B. „Keine“ und „Schwarz“ (104); beim Verlauf ausgeblendet. */
	vor?: ReactNode;
}

export interface VerlaufWahl {
	wert: Verlauf | null;
	setze: (verlauf: Verlauf) => void;
}

const RUND =
	'flex size-knopf-klein flex-none items-center justify-center rounded-full border border-rand p-0.5 aria-pressed:border-tinte aria-pressed:ring-1 aria-pressed:ring-tinte disabled:opacity-50';

/** Ein neuer Verlauf geht von der bisherigen Farbe aus, nach unten (90°). */
const ersterVerlauf = (wert: string | null): Verlauf => {
	const f1 = wert ?? 'var(--haupt)';
	return { art: 'linear', f1, f2: f1 === 'var(--akzent)' ? 'var(--haupt)' : 'var(--akzent)', winkel: 90 };
};

/** Fünf Farben des Blatts, Weiß und „Eigene Farbe“ in einer Reihe. */
const Farben = ({ aus, beschriftung, doc, name, setze, vor, wert, zeige }: Eigenschaften) => {
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
			{vor}
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
						background: eigen ?? 'conic-gradient(#e76f51, #ffbe0b, #43aa8b, #3a86ff, #6a4c93, #e76f51)',
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

const MitVerlauf = ({ verlauf, ...e }: Eigenschaften & { verlauf: VerlaufWahl }) => {
	const { aus, beschriftung, doc, name, setze, wert } = e;
	const v = verlauf.wert;
	// Kein eigener Zustand: „Verlauf“ legt sofort einen an, „Farbe“ setzt die erste Farbe einfarbig.
	const modus = v ? 'verlauf' : 'farbe';
	const waehle = (neu: 'farbe' | 'verlauf') => {
		if (neu === 'verlauf' && !v) {
			verlauf.setze(ersterVerlauf(wert));
		} else if (neu === 'farbe' && v) {
			setze(v.f1);
		}
	};
	return (
		<div className="flex flex-col gap-1.5" data-farbwahl-verlauf={name ?? beschriftung}>
			<Segment
				beschriftung={`${beschriftung}: Farbe oder Verlauf`}
				werte={[
					{ wert: 'farbe', titel: 'Farbe' },
					{ wert: 'verlauf', titel: 'Verlauf' },
				]}
				wert={modus}
				waehle={waehle}
				aus={aus}
			/>
			{!v ? (
				<Farben {...e} />
			) : (
				<div className="flex flex-col gap-1.5" data-verlauf={v.art}>
					<div className="flex items-center gap-2">
						<Segment
							beschriftung="Art des Verlaufs"
							werte={[
								{ wert: 'linear', titel: 'Linear' },
								{ wert: 'radial', titel: 'Radial' },
							]}
							wert={v.art}
							waehle={(art) => verlauf.setze({ ...v, art })}
							aus={aus}
						/>
						<span
							aria-hidden
							className="ml-auto block h-5 w-10 flex-none rounded-sm border border-black/10"
							style={{ background: verlaufCss(doc, v) }}
							data-verlauf-vorschau
						/>
					</div>
					{(['f1', 'f2'] as const).map((f, i) => (
						<div key={f} className="flex flex-col gap-0.5">
							<span className="text-leise">{`Farbe ${i + 1}`}</span>
							<Farben
								beschriftung={`${beschriftung}, Farbe ${i + 1}`}
								name={`${name ?? beschriftung}-${f}`}
								doc={doc}
								aus={aus}
								wert={v[f]}
								setze={(farbe) => verlauf.setze({ ...v, [f]: farbe })}
							/>
						</div>
					))}
					{v.art === 'linear' && (
						<div className="flex items-center gap-2" data-verlauf-winkel>
							<span className="w-12 flex-none text-leise">Winkel</span>
							<Stepper
								name="Winkel des Verlaufs"
								wert={v.winkel}
								min={0}
								max={345}
								schritt={15}
								aus={aus}
								setze={(winkel) => verlauf.setze({ ...v, winkel })}
							/>
							<span className="text-leise">°</span>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

/** Fünf Farben des Blatts, Weiß und „Eigene Farbe“. Ein Klick wählt, ein Schritt im Verlauf. Mit `verlauf` auch Verläufe. */
export const Farbwahl = (e: Eigenschaften) =>
	e.verlauf ? <MitVerlauf {...e} verlauf={e.verlauf} /> : <Farben {...e} />;

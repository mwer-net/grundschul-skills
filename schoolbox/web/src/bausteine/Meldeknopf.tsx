import { domToCanvas } from 'modern-screenshot';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { ANMELDE_SEITE, meldung, sende } from '../api';
import { useHinweis } from './hinweis';
import { Knopf } from './Knopf';
import { Symbol } from './Symbol';

type Art = 'fehler' | 'wunsch' | 'aussehen';
type Phase = 'ruhe' | 'auswahl' | 'formular';
interface Rechteck {
	x: number;
	y: number;
	b: number;
	h: number;
}

const MELDE_UI = 'data-melde-ui';
const MIN_AUSWAHL = 8;
const ARTEN: { art: Art; titel: string }[] = [
	{ art: 'fehler', titel: 'Funktioniert nicht' },
	{ art: 'aussehen', titel: 'Sieht nicht gut aus' },
	{ art: 'wunsch', titel: 'Wunsch / fehlt' },
];

const letzteFehler: string[] = [];
const merkeFehler = (text: string) => {
	letzteFehler.push(`${new Date().toISOString()} ${text}`.slice(0, 500));
	letzteFehler.splice(0, Math.max(0, letzteFehler.length - 20));
};
if (typeof window !== 'undefined') {
	window.addEventListener('error', (e) => merkeFehler(`${e.message} (${e.filename}:${e.lineno})`));
	window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) =>
		merkeFehler(`unhandledrejection: ${String(e.reason instanceof Error ? e.reason.message : e.reason)}`),
	);
}

const beschreibeElement = (el: Element) => {
	const id = el.id ? `#${el.id}` : '';
	const klassen = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 6) : [];
	const daten = [...el.attributes]
		.filter((a) => a.name.startsWith('data-') || a.name === 'aria-label' || a.name === 'role' || a.name === 'title')
		.map((a) => `[${a.name}="${a.value.slice(0, 60)}"]`)
		.join('');
	const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
	return `${el.tagName.toLowerCase()}${id}${klassen.length ? `.${klassen.join('.')}` : ''}${daten}${text ? ` „${text}“` : ''}`;
};

const elementeIm = (r: Rechteck) => {
	const punkte: [number, number][] = [
		[r.x + r.b / 2, r.y + r.h / 2],
		[r.x + 4, r.y + 4],
		[r.x + r.b - 4, r.y + r.h - 4],
	];
	const gesehen = new Set<Element>();
	const ergebnis: string[] = [];
	for (const [x, y] of punkte) {
		for (const el of document.elementsFromPoint(x, y)) {
			if (
				gesehen.has(el) ||
				el.closest(`[${MELDE_UI}]`) ||
				el === document.documentElement ||
				el === document.body
			) {
				continue;
			}
			gesehen.add(el);
			ergebnis.push(beschreibeElement(el));
			if (ergebnis.length >= 15) {
				return ergebnis;
			}
		}
	}
	return ergebnis;
};

const sammleUmgebung = (r: Rechteck | null) => ({
	adresse: window.location.href,
	pfad: window.location.pathname + window.location.search + window.location.hash,
	titel: document.title,
	browser: navigator.userAgent,
	sprache: navigator.language,
	fenster: { breite: window.innerWidth, hoehe: window.innerHeight, pixelverhaeltnis: window.devicePixelRatio },
	bildlauf: { x: window.scrollX, y: window.scrollY },
	auswahl: r,
	elementeImAusschnitt: r ? elementeIm(r) : [],
	fokus:
		document.activeElement && document.activeElement !== document.body
			? beschreibeElement(document.activeElement)
			: null,
	offeneDialoge: [...document.querySelectorAll('[role="dialog"], dialog[open]')]
		.filter((el) => !el.closest(`[${MELDE_UI}]`))
		.map(beschreibeElement)
		.slice(0, 5),
	letzteFehler: [...letzteFehler],
	zeit: new Date().toString(),
});

const nimmAusschnitt = async (r: Rechteck | null) => {
	const skala = window.devicePixelRatio || 1;
	const ganz = await domToCanvas(document.documentElement, {
		scale: skala,
		// Bilder mit loading="lazy" außerhalb des Fensters laden nie; der Standard (30 s) ließe die Lehrkraft warten.
		timeout: 2000,
		width: window.innerWidth,
		height: window.innerHeight,
		style: { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)` },
		filter: (node) => !(node instanceof Element && node.hasAttribute(MELDE_UI)),
	});
	if (!r) {
		return ganz.toDataURL('image/png');
	}
	const ziel = document.createElement('canvas');
	ziel.width = Math.round(r.b * skala);
	ziel.height = Math.round(r.h * skala);
	ziel.getContext('2d')?.drawImage(
		ganz,
		r.x * skala,
		r.y * skala,
		ziel.width,
		ziel.height,
		0,
		0,
		ziel.width,
		ziel.height,
	);
	return ziel.toDataURL('image/png');
};

const normiere = (a: { x: number; y: number }, b: { x: number; y: number }): Rechteck => ({
	x: Math.min(a.x, b.x),
	y: Math.min(a.y, b.y),
	b: Math.abs(a.x - b.x),
	h: Math.abs(a.y - b.y),
});

/** Käferknopf (unten links, Alt+Shift+K): Ausschnitt aufziehen, beschreiben, absenden. Ablage für Claude. */
export const Meldeknopf = () => {
	const { pathname } = useLocation();
	const zeige = useHinweis();
	const [phase, setPhase] = useState<Phase>('ruhe');
	const [start, setStart] = useState<{ x: number; y: number } | null>(null);
	const [rechteck, setRechteck] = useState<Rechteck | null>(null);
	const [bild, setBild] = useState<string | null>(null);
	const [umgebung, setUmgebung] = useState<ReturnType<typeof sammleUmgebung> | null>(null);
	const [text, setText] = useState('');
	const [art, setArt] = useState<Art>('fehler');
	const [laeuft, setLaeuft] = useState(false);
	const [nimmt, setNimmt] = useState(false);
	const textfeld = useRef<HTMLTextAreaElement>(null);
	const verborgen = pathname === ANMELDE_SEITE || pathname.startsWith('/f/');

	const zuruecksetzen = () => {
		setPhase('ruhe');
		setStart(null);
		setRechteck(null);
		setBild(null);
		setUmgebung(null);
		setText('');
		setArt('fehler');
	};

	useEffect(() => {
		const taste = (e: KeyboardEvent) => {
			if (e.altKey && e.shiftKey && e.code === 'KeyK') {
				e.preventDefault();
				setPhase((p) => (p === 'ruhe' ? 'auswahl' : p));
			} else if (e.key === 'Escape') {
				setPhase((p) => {
					if (p === 'auswahl') {
						setStart(null);
						setRechteck(null);
						return 'ruhe';
					}
					return p;
				});
			}
		};
		window.addEventListener('keydown', taste, true);
		return () => window.removeEventListener('keydown', taste, true);
	}, []);

	useEffect(() => {
		if (phase === 'formular') {
			textfeld.current?.focus();
		}
	}, [phase]);

	const ausschnittFertig = async (r: Rechteck | null) => {
		setNimmt(true);
		setUmgebung(sammleUmgebung(r));
		// Den Rahmen der Auswahl erst entfernen lassen, dann aufnehmen.
		await new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(fertig)));
		try {
			setBild(await nimmAusschnitt(r));
		} catch (fehler) {
			merkeFehler(`Bildschirmausschnitt: ${meldung(fehler)}`);
			setBild(null);
		}
		setNimmt(false);
		setPhase('formular');
	};

	const zeigerRunter = (e: ReactPointerEvent<HTMLDivElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId);
		setStart({ x: e.clientX, y: e.clientY });
		setRechteck({ x: e.clientX, y: e.clientY, b: 0, h: 0 });
	};
	const zeigerZug = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (start) {
			setRechteck(normiere(start, { x: e.clientX, y: e.clientY }));
		}
	};
	const zeigerHoch = () => {
		const r = rechteck && rechteck.b >= MIN_AUSWAHL && rechteck.h >= MIN_AUSWAHL ? rechteck : null;
		setStart(null);
		setRechteck(null);
		void ausschnittFertig(r);
	};

	const absenden = async () => {
		if (!text.trim() || laeuft) {
			return;
		}
		setLaeuft(true);
		try {
			await sende('/api/meldungen', { art, text, bild, umgebung });
			zuruecksetzen();
			zeige({ text: 'Danke! Die Meldung ist gespeichert.' });
		} catch (fehler) {
			zeige({ text: meldung(fehler), art: 'fehler' });
		} finally {
			setLaeuft(false);
		}
	};

	if (verborgen) {
		return null;
	}

	return (
		<div {...{ [MELDE_UI]: '' }} className="print:hidden">
			{phase === 'ruhe' && (
				<button
					type="button"
					title="Problem melden oder Wunsch äußern (Alt+Shift+K)"
					aria-label="Problem melden"
					onClick={() => setPhase('auswahl')}
					className="fixed bottom-3 left-3 flex size-9 items-center justify-center rounded-full border border-rand bg-flaeche text-leise opacity-70 shadow-md hover:text-tinte hover:opacity-100"
					style={{ zIndex: 60 }}
				>
					<Symbol name="kaefer" className="size-5" />
				</button>
			)}
			{nimmt && (
				<div
					{...{ [MELDE_UI]: '' }}
					className="fixed bottom-3 left-3 rounded-md bg-tinte px-3 py-2 text-sm text-flaeche shadow-lg"
					style={{ zIndex: 60 }}
				>
					Ausschnitt wird aufgenommen …
				</div>
			)}
			{phase === 'auswahl' && !nimmt && (
				<div
					className="fixed inset-0 cursor-crosshair select-none"
					style={{ zIndex: 60, background: rechteck ? 'transparent' : 'rgba(0,0,0,0.08)' }}
					onPointerDown={zeigerRunter}
					onPointerMove={zeigerZug}
					onPointerUp={zeigerHoch}
				>
					{!start && (
						<div className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 rounded-md bg-tinte px-3 py-2 text-sm text-flaeche shadow-lg">
							Bereich aufziehen, der gemeint ist. Klick ohne Ziehen: ganzes Fenster. Esc: abbrechen.
						</div>
					)}
					{rechteck && (
						<div
							className="pointer-events-none fixed border-2 border-brand-500"
							style={{
								left: rechteck.x,
								top: rechteck.y,
								width: rechteck.b,
								height: rechteck.h,
								boxShadow: '0 0 0 9999px rgba(0,0,0,0.25)',
							}}
						/>
					)}
				</div>
			)}
			{phase === 'formular' && (
				<div
					className="fixed inset-0 flex items-center justify-center bg-black/30 p-4"
					style={{ zIndex: 60 }}
					onKeyDown={(e) => {
						if (e.key === 'Escape') {
							zuruecksetzen();
						}
					}}
				>
					<form
						className="flex max-h-full w-[560px] max-w-full flex-col gap-3 overflow-auto rounded-lg bg-flaeche p-4 shadow-xl"
						onSubmit={(e) => {
							e.preventDefault();
							void absenden();
						}}
					>
						<h2 className="text-base font-semibold">Problem melden</h2>
						{bild ? (
							<img
								src={bild}
								alt="Ausgewählter Bildschirmausschnitt"
								className="max-h-[280px] self-start rounded border border-rand object-contain"
							/>
						) : (
							<p className="text-sm text-leise">
								Kein Bild möglich – Text und Seite werden trotzdem gesendet.
							</p>
						)}
						<div className="flex flex-wrap gap-2">
							{ARTEN.map((a) => (
								<Knopf
									key={a.art}
									art={art === a.art ? 'haupt' : 'zweit'}
									groesse="klein"
									onClick={() => setArt(a.art)}
								>
									{a.titel}
								</Knopf>
							))}
						</div>
						<textarea
							ref={textfeld}
							value={text}
							onChange={(e) => setText(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
									e.preventDefault();
									void absenden();
								}
							}}
							rows={5}
							placeholder="Was ist los? Z. B. „Hier hätte ich gern stattdessen …“"
							className="w-full rounded-md border border-rand bg-flaeche p-2 text-sm focus:outline-1 focus:outline-brand-500"
						/>
						<div className="flex items-center justify-end gap-2">
							<span className="mr-auto text-xs text-leise">⌘/Strg + Enter sendet</span>
							<Knopf art="leise" onClick={zuruecksetzen}>
								Abbrechen
							</Knopf>
							<Knopf type="submit" disabled={!text.trim() || laeuft}>
								{laeuft ? 'Wird gesendet …' : 'Absenden'}
							</Knopf>
						</div>
					</form>
				</div>
			)}
		</div>
	);
};

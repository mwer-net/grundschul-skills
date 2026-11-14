import { domToCanvas } from 'modern-screenshot';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { ANMELDE_SEITE, meldung, sende } from '../api';
import { kuerzelText, kuerzelVon } from '../editor/befehle';
import { Dialog } from './Dialog';
import { useHinweis } from './hinweis';
import { klassen } from './klassen';
import { Knopf } from './Knopf';
import { gemerkteFehler, MELDUNG_STARTEN, merkeFehler } from './melden';
import { Segment } from './Segment';
import { Symbol } from './Symbol';
import { Tooltip } from './Tooltip';

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
const ARTEN: { wert: Art; titel: string }[] = [
	{ wert: 'fehler', titel: 'Funktioniert nicht' },
	{ wert: 'aussehen', titel: 'Sieht nicht gut aus' },
	{ wert: 'wunsch', titel: 'Wunsch / fehlt' },
];

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

const sammleUmgebung = (r: Rechteck | null, fokus: Element | null) => ({
	adresse: window.location.href,
	pfad: window.location.pathname + window.location.search + window.location.hash,
	titel: document.title,
	browser: navigator.userAgent,
	sprache: navigator.language,
	fenster: { breite: window.innerWidth, hoehe: window.innerHeight, pixelverhaeltnis: window.devicePixelRatio },
	bildlauf: { x: window.scrollX, y: window.scrollY },
	auswahl: r,
	elementeImAusschnitt: r ? elementeIm(r) : [],
	fokus: fokus && fokus !== document.body ? beschreibeElement(fokus) : null,
	offeneDialoge: [...document.querySelectorAll('[role="dialog"], dialog[open]')]
		.filter((el) => !el.closest(`[${MELDE_UI}]`))
		.map(beschreibeElement)
		.slice(0, 5),
	letzteFehler: gemerkteFehler(),
	zeit: new Date().toString(),
});

/** `instanceof Element` gilt im Rahmen nicht: Er hat seine eigenen Klassen. */
const istElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE;

const imRahmen = (element: Element, fenster: Window) => {
	const ort = element.getBoundingClientRect();
	const leer = ort.width === 0 && ort.height === 0;
	return leer || (ort.bottom >= 0 && ort.right >= 0 && ort.top <= fenster.innerHeight && ort.left <= fenster.innerWidth);
};

/** Sichtbar und nicht der Rahmen, der gerade im Hintergrund lädt. */
const sichtbarerRahmen = (rahmen: HTMLIFrameElement) => {
	const stil = getComputedStyle(rahmen);
	return stil.visibility !== 'hidden' && stil.display !== 'none' && Number(stil.opacity) > 0;
};

/**
 * Das Blatt liegt in einem `iframe` mit eigenen Schriften und Bildern; beim Nachzeichnen des ganzen Fensters kämen
 * sie nicht mit (193-30). Darum wird jeder sichtbare Rahmen für sich aufgenommen und an seiner Stelle eingesetzt.
 */
const zeichneRahmen = async (ganz: HTMLCanvasElement, skala: number) => {
	const stift = ganz.getContext('2d');
	for (const rahmen of document.querySelectorAll('iframe')) {
		const doc = rahmen.contentDocument;
		const fenster = rahmen.contentWindow;
		const ort = rahmen.getBoundingClientRect();
		const imFenster = ort.right > 0 && ort.bottom > 0 && ort.left < window.innerWidth && ort.top < window.innerHeight;
		if (!stift || !doc?.documentElement || !fenster || !imFenster || !sichtbarerRahmen(rahmen)) {
			continue;
		}
		try {
			await doc.fonts.ready;
			const breite = rahmen.clientWidth;
			const hoehe = rahmen.clientHeight;
			const bild = await domToCanvas(doc.documentElement, {
				scale: skala * (breite > 0 ? (ort.width - rahmen.clientLeft * 2) / breite : 1),
				timeout: 2000,
				width: breite,
				height: hoehe,
				style: { transform: `translate(${-fenster.scrollX}px, ${-fenster.scrollY}px)` },
				// Nur, was im Rahmen zu sehen ist: Ein langes Blatt hätte sonst jedes Bild aller Seiten zu laden.
				filter: (node) => !istElement(node) || imRahmen(node, fenster),
			});
			stift.drawImage(
				bild,
				(ort.left + rahmen.clientLeft) * skala,
				(ort.top + rahmen.clientTop) * skala,
				(ort.width - rahmen.clientLeft * 2) * skala,
				(ort.height - rahmen.clientTop * 2) * skala,
			);
		} catch (fehler) {
			merkeFehler(`Bildschirmausschnitt, Blatt: ${meldung(fehler)}`);
		}
	}
};

const nimmAusschnitt = async (r: Rechteck | null) => {
	const skala = window.devicePixelRatio || 1;
	const ganz = await domToCanvas(document.documentElement, {
		scale: skala,
		// Bilder mit loading="lazy" außerhalb des Fensters laden nie; der Standard (30 s) ließe die Lehrkraft warten.
		timeout: 2000,
		width: window.innerWidth,
		height: window.innerHeight,
		style: { transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)` },
		// Die Rahmen kommen getrennt (`zeichneRahmen`); hier nur ihr Platz.
		filter: (node) =>
			!(node instanceof Element && (node.hasAttribute(MELDE_UI) || node.tagName === 'IFRAME')),
	});
	await zeichneRahmen(ganz, skala);
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

/** Auswahl über allem, auch über einem offenen Dialog (193-41): ein eigenes `<dialog>` im Top Layer. */
const AuswahlFlaeche = ({
	abbrechen,
	fertig,
}: {
	abbrechen: () => void;
	fertig: (r: Rechteck | null) => void;
}) => {
	const flaeche = useRef<HTMLDialogElement>(null);
	const [start, setStart] = useState<{ x: number; y: number } | null>(null);
	const [rechteck, setRechteck] = useState<Rechteck | null>(null);

	useEffect(() => {
		const element = flaeche.current;
		if (element && !element.open) {
			element.showModal();
		}
	}, []);

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
		fertig(r);
	};

	return (
		<dialog
			ref={flaeche}
			{...{ [MELDE_UI]: '' }}
			className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 outline-none backdrop:bg-transparent"
			aria-label="Bereich für die Meldung wählen"
			onCancel={(e) => {
				// Esc gehört nur dem Käfer: Ein Dialog darunter bleibt offen (193-41).
				e.preventDefault();
				abbrechen();
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape') {
					e.preventDefault();
					e.stopPropagation();
					abbrechen();
				}
			}}
		>
			<div
				className="fixed inset-0 cursor-crosshair select-none"
				style={{ background: rechteck ? 'transparent' : 'rgba(0,0,0,0.08)' }}
				onPointerDown={zeigerRunter}
				onPointerMove={zeigerZug}
				onPointerUp={zeigerHoch}
			>
				{!start && (
					<div className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 rounded-md bg-tinte px-3 py-2 text-sm text-flaeche shadow-lg">
						Bereich aufziehen, der gemeint ist. Klick ohne Ziehen: ganzes Fenster.
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
		</dialog>
	);
};

/**
 * Käferknopf: Ausschnitt aufziehen, beschreiben, absenden. Ablage für Claude. Die Taste steht im Register des Editors
 * (`dokument.melden`), damit sie auch aus dem Blatt wirkt; außerhalb des Editors hört der Knopf selbst auf sie.
 * Text und Art bleiben bis zum erfolgreichen Senden stehen (193-33).
 */
export const Meldeknopf = () => {
	const { pathname } = useLocation();
	const zeige = useHinweis();
	const [phase, setPhase] = useState<Phase>('ruhe');
	const [bild, setBild] = useState<string | null>(null);
	const [umgebung, setUmgebung] = useState<ReturnType<typeof sammleUmgebung> | null>(null);
	const [text, setText] = useState('');
	const [art, setArt] = useState<Art>('fehler');
	const [laeuft, setLaeuft] = useState(false);
	const [nimmt, setNimmt] = useState(false);
	/** Wo der Fokus vor der Meldung stand: Dorthin kehrt er zurück. */
	const vorher = useRef<Element | null>(null);
	const verborgen = pathname === ANMELDE_SEITE || pathname.startsWith('/f/');
	// Im Editor steht der Käfer am Fuß der Schubladenleiste, über der Statusleiste (193-27).
	const imEditor = pathname.endsWith('/bearbeiten');

	const starte = () => {
		setPhase((p) => {
			if (p === 'ruhe') {
				vorher.current = document.activeElement;
				return 'auswahl';
			}
			return p;
		});
	};

	const zurueck = () => {
		setPhase('ruhe');
		const ziel = vorher.current;
		vorher.current = null;
		requestAnimationFrame(() => {
			if (ziel instanceof HTMLElement && ziel.isConnected) {
				ziel.focus();
			}
		});
	};

	useEffect(() => {
		const taste = (e: KeyboardEvent) => {
			if (e.altKey && e.shiftKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyK') {
				e.preventDefault();
				starte();
			}
		};
		window.addEventListener('keydown', taste, true);
		window.addEventListener(MELDUNG_STARTEN, starte);
		return () => {
			window.removeEventListener('keydown', taste, true);
			window.removeEventListener(MELDUNG_STARTEN, starte);
		};
	}, []);

	const ausschnittFertig = async (r: Rechteck | null) => {
		setNimmt(true);
		// Die Auswahl erst verschwinden lassen, dann aufnehmen.
		await new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(fertig)));
		setUmgebung(sammleUmgebung(r, vorher.current));
		try {
			setBild(await nimmAusschnitt(r));
		} catch (fehler) {
			merkeFehler(`Bildschirmausschnitt: ${meldung(fehler)}`);
			setBild(null);
		}
		setNimmt(false);
		setPhase('formular');
	};

	const absenden = async () => {
		if (!text.trim() || laeuft) {
			return;
		}
		setLaeuft(true);
		try {
			await sende('/api/meldungen', { art, text, bild, umgebung });
			setText('');
			setArt('fehler');
			setBild(null);
			setUmgebung(null);
			zurueck();
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

	const ort = imEditor ? 'bottom-8 left-[18px]' : 'bottom-3 left-3';
	return (
		<div {...{ [MELDE_UI]: '' }} className="print:hidden">
			{phase === 'ruhe' && (
				<Tooltip text="Problem melden" kuerzel={kuerzelVon('dokument.melden')}>
					<button
						type="button"
						aria-label="Problem melden"
						data-meldeknopf
						onClick={starte}
						className={klassen(
							'fixed flex size-9 items-center justify-center rounded-full border border-rand bg-flaeche text-leise opacity-70 shadow-md hover:text-tinte hover:opacity-100',
							ort,
						)}
						style={{ zIndex: 60 }}
					>
						<Symbol name="kaefer" className="size-5" />
					</button>
				</Tooltip>
			)}
			{nimmt && (
				<div
					className={klassen('fixed rounded-md bg-tinte px-3 py-2 text-sm text-flaeche shadow-lg', ort)}
					style={{ zIndex: 60 }}
				>
					Ausschnitt wird aufgenommen …
				</div>
			)}
			{phase === 'auswahl' && !nimmt && (
				<AuswahlFlaeche abbrechen={zurueck} fertig={(r) => void ausschnittFertig(r)} />
			)}
			{phase === 'formular' && (
				<Dialog
					titel="Problem melden"
					schliessen={zurueck}
					fuss={
						<>
							<Knopf art="leise" onClick={zurueck}>
								Abbrechen
							</Knopf>
							<Tooltip text="Absenden" kuerzel={kuerzelText({ code: 'Enter', befehl: true })}>
								<Knopf data-hauptaktion disabled={!text.trim() || laeuft} onClick={() => void absenden()}>
									{laeuft ? 'Wird gesendet …' : 'Absenden'}
								</Knopf>
							</Tooltip>
						</>
					}
				>
					{bild ? (
						<img
							src={bild}
							alt="Ausgewählter Bildschirmausschnitt"
							className="max-h-[280px] self-start rounded border border-rand object-contain"
						/>
					) : (
						<p className="text-sm text-leise">Kein Bild möglich – Text und Seite werden trotzdem gesendet.</p>
					)}
					<Segment beschriftung="Art der Meldung" werte={ARTEN} wert={art} waehle={setArt} className="self-start" />
					<textarea
						value={text}
						onChange={(e) => setText(e.target.value)}
						rows={5}
						aria-label="Beschreibung"
						placeholder="Was ist los? Z. B. „Hier hätte ich gern stattdessen …“"
						className="w-full rounded-md border border-rand-feld bg-flaeche p-2 text-sm focus:border-brand-500 focus:outline-none"
					/>
				</Dialog>
			)}
		</div>
	);
};

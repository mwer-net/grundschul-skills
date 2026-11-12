import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { begrenzeZoom, radFaktor, rasteZoom } from './zoom';

/** Safari am Mac und am iPad schickt beim Aufziehen `gesture*`. Die DOM-Typen kennen `GestureEvent` nicht. */
type GestenEreignis = Event & { scale: number; clientX: number; clientY: number };

interface Punkt {
	x: number;
	y: number;
}

interface Lauf {
	/** Aufziehen in Safari; `imBlatt` gilt ab dem Start. */
	geste: { von: number; imBlatt: boolean } | null;
	/** Strg+Rad, wie Chrome und Firefox das Aufziehen schicken; endet nach `RAD_ENDE_MS` ohne Rad. */
	rad: { von: number; uhr: number } | null;
	/** Was das nächste Bild zeigt und wo der Zeiger stand, im Fenster. */
	ziel: { wert: number; punkt: Punkt } | null;
	bild: number;
}

const RAD_ENDE_MS = 150;
const NICHT_PASSIV = { passive: false } as const;

/** Ist die Oberfläche schon gezoomt (Intelligentes Zoomen, iPad), gehört das Aufziehen dem Browser: So kommt man zurück. */
const uebergeben = () => (window.visualViewport?.scale ?? 1) > 1.01;

interface Optionen {
	/** Die Leinwand. Ihr Elternelement `main` ist die Fläche des Blatts. */
	behaelter: RefObject<HTMLElement | null>;
	/** Der Maßstab des letzten Bilds. */
	skalaJetzt: RefObject<number>;
	/** Am Ende einer Geste, mit eingerastetem Wert. */
	setzeZoom: ((wert: number) => void) | undefined;
}

/**
 * Aufziehen und Strg+Rad zoomen nur das Blatt, nie die Oberfläche (184, Entscheidung 56): über dem Blatt stufenlos um
 * die Stelle unter dem Zeiger, sonst nur abgefangen. Während der Geste zeigt die Leinwand `vorschau`; erst am Ende geht
 * der Wert an `setzeZoom`, damit der Editor nicht bei jedem Bild neu rendert (171). `anker` ist die Stelle unter dem
 * Zeiger, im Fenster; die Leinwand hält sie beim nächsten Bild fest und leert sie.
 */
export const useBlattZoom = ({ behaelter, setzeZoom, skalaJetzt }: Optionen) => {
	const [vorschau, setVorschau] = useState<number | null>(null);
	const anker = useRef<Punkt | null>(null);
	const lauf = useRef<Lauf>({ geste: null, rad: null, ziel: null, bild: 0 });
	const setzen = useRef(setzeZoom);
	setzen.current = setzeZoom;

	/** Trackpads schicken bis zu 120 Ereignisse je Sekunde; gezeichnet wird einmal je Bild. */
	const zeige = useCallback((wert: number, punkt: Punkt) => {
		const l = lauf.current;
		l.ziel = { wert, punkt };
		if (l.bild) {
			return;
		}
		l.bild = requestAnimationFrame(() => {
			l.bild = 0;
			if (l.ziel) {
				anker.current = l.ziel.punkt;
				setVorschau(l.ziel.wert);
			}
		});
	}, []);

	/** Eingerastet an den Editor, in derselben Aufgabe wie das Ende der Vorschau; der Anker gilt fürs letzte Bild. */
	const ende = useCallback(() => {
		const l = lauf.current;
		cancelAnimationFrame(l.bild);
		l.bild = 0;
		if (l.ziel) {
			anker.current = l.ziel.punkt;
			setzen.current?.(rasteZoom(l.ziel.wert));
		}
		l.ziel = null;
		setVorschau(null);
	}, []);

	/** Beim Ziehen (Leinwand, Schublade, Ebenen) und während einer Geste an einer Gestaltung zoomt nichts. */
	const gesperrt = useCallback(
		(doc?: Document) => {
			const blatt =
				doc ??
				behaelter.current?.querySelector<HTMLIFrameElement>('[data-editor-rahmen="sichtbar"]')?.contentDocument;
			return (
				Boolean(behaelter.current?.dataset.zieht) ||
				document.body.hasAttribute('data-zieht') ||
				Boolean(blatt?.documentElement.hasAttribute('data-geste-laeuft'))
			);
		},
		[behaelter],
	);

	/** `punkt` rechnet ins Fenster um; `imBlatt` sagt, ob das Ereignis über der Fläche des Blatts liegt. */
	const lausche = useCallback(
		(
			ort: EventTarget,
			punkt: (e: GestenEreignis | WheelEvent) => Punkt,
			imBlatt: (e: Event) => boolean,
			doc?: Document,
		) => {
			const l = lauf.current;
			const rad = (ereignis: Event) => {
				const e = ereignis as WheelEvent;
				if (!e.ctrlKey || uebergeben()) {
					return;
				}
				e.preventDefault();
				// Safari kann dasselbe Aufziehen zusätzlich als Rad schicken: Während einer Geste nur abfangen.
				if (l.geste || !imBlatt(e) || gesperrt(doc)) {
					return;
				}
				const r = (l.rad ??= { von: skalaJetzt.current, uhr: 0 });
				window.clearTimeout(r.uhr);
				r.uhr = window.setTimeout(() => {
					l.rad = null;
					ende();
				}, RAD_ENDE_MS);
				const jetzt = l.ziel?.wert ?? skalaJetzt.current;
				zeige(begrenzeZoom(jetzt * radFaktor(e.deltaY, e.deltaMode), r.von), punkt(e));
			};
			const start = (ereignis: Event) => {
				if (uebergeben()) {
					return;
				}
				ereignis.preventDefault();
				if (l.rad) {
					window.clearTimeout(l.rad.uhr);
					l.rad = null;
					ende();
				}
				l.geste = { von: skalaJetzt.current, imBlatt: imBlatt(ereignis) && !gesperrt(doc) };
			};
			const wechsel = (ereignis: Event) => {
				const g = l.geste;
				if (!g) {
					return;
				}
				ereignis.preventDefault();
				if (g.imBlatt) {
					const e = ereignis as GestenEreignis;
					zeige(begrenzeZoom(g.von * e.scale, g.von), punkt(e));
				}
			};
			const schluss = (ereignis: Event) => {
				const g = l.geste;
				if (!g) {
					return;
				}
				ereignis.preventDefault();
				l.geste = null;
				if (g.imBlatt) {
					ende();
				}
			};
			ort.addEventListener('wheel', rad, NICHT_PASSIV);
			ort.addEventListener('gesturestart', start, NICHT_PASSIV);
			ort.addEventListener('gesturechange', wechsel, NICHT_PASSIV);
			ort.addEventListener('gestureend', schluss, NICHT_PASSIV);
			return () => {
				ort.removeEventListener('wheel', rad);
				ort.removeEventListener('gesturestart', start);
				ort.removeEventListener('gesturechange', wechsel);
				ort.removeEventListener('gestureend', schluss);
			};
		},
		[ende, gesperrt, skalaJetzt, zeige],
	);

	// Am Fenster: über `main` zoomt das Blatt, über Schubladen, Inspektor, Leisten und Dialogen nichts.
	useEffect(
		() =>
			lausche(
				window,
				(e) => ({ x: e.clientX, y: e.clientY }),
				(e) => Boolean(behaelter.current?.parentElement?.contains(e.target as Node | null)),
			),
		[behaelter, lausche],
	);

	useEffect(() => {
		const l = lauf.current;
		return () => {
			cancelAnimationFrame(l.bild);
			window.clearTimeout(l.rad?.uhr);
		};
	}, []);

	/** Für jedes neue Rahmen-Dokument: Seine Koordinaten sind unskaliert, wie beim Kontextmenü. */
	const verbinde = useCallback(
		(doc: Document, frame: HTMLIFrameElement) => {
			lausche(
				doc,
				(e) => {
					const r = frame.getBoundingClientRect();
					return { x: r.left + e.clientX * skalaJetzt.current, y: r.top + e.clientY * skalaJetzt.current };
				},
				() => true,
				doc,
			);
		},
		[lausche, skalaJetzt],
	);

	return { anker, verbinde, vorschau };
};

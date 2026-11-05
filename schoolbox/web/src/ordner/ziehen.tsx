import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { folgeZeiger, rolleAmRand, schluckeKlick } from '../bausteine/zeigerzug';
import { FINGER_WEG, HALTEN_MS, MAUS_WEG } from '../editor/ziehen';
import type { AuswahlStand } from './auswahl';
import { Geist } from './Geist';
import { useAblage } from './kontext';
import { bewegtText, geloeschtText, kopiertText } from './meldungen';
import { nachkommen, ortName, zielGueltig } from './objekte';
import type { Objekt } from './typen';

const FEDERN_MS = 700;
const RAND = 40;
const ROLLEN = 12;
const AKTIV = 'data-ziel-aktiv';
const LASSO_WEG = 4;

interface Optionen {
	objekteZuZiehen: (schluessel: string) => Objekt[];
	klappeListe: (id: string, an?: boolean) => void;
	klappeBaum: (id: string, an?: boolean) => void;
	reihenfolge: readonly string[];
	auswahl: AuswahlStand;
	setAuswahl: (a: AuswahlStand) => void;
	inhalt: RefObject<HTMLDivElement | null>;
	/** Im Auswahlmodus am iPad zieht nichts. */
	aktiv: boolean;
}

interface Zug {
	objekte: Objekt[];
	finger: boolean;
	startAdresse: string;
	ziel: HTMLElement | null;
	/** Ordner-Id, `null` für die Wurzel, `papierkorb`, oder `undefined`, wenn hier nichts abgelegt werden kann. */
	zielId: string | null | undefined;
	kopiert: boolean;
	/** Ein Ordner über sich selbst oder einem seiner Nachkommen: Das steht schon vor dem Loslassen in der Statuszeile. */
	inSichSelbst: boolean;
	federn: number | null;
	x: number;
	y: number;
}

const zielVon = (el: HTMLElement) => {
	const roh = el.dataset.ablageZiel;
	return roh === 'wurzel' ? null : (roh as string);
};

const zielAn = (x: number, y: number) =>
	document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-ablage-ziel]') ?? null;

/** Ziehen und Lasso. Beides lauscht an `window`: Beim Federn verschwindet die Kachel, an der das Ziehen begann. */
export const useZiehen = (o: Optionen) => {
	const { stand, tu } = useAblage();
	const navigate = useNavigate();
	const { pathname, search } = useLocation();
	const [zug, setZug] = useState<{ objekte: Objekt[]; x: number; y: number } | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [lasso, setLasso] = useState<{ x: number; y: number; b: number; h: number } | null>(null);
	const lauf = useRef<Zug | null>(null);
	const aufraeumen = useRef<(() => void) | null>(null);
	const neu = useRef({ o, stand, tu, navigate, adresse: `${pathname}${search}` });
	neu.current = { o, stand, tu, navigate, adresse: `${pathname}${search}` };

	useEffect(() => () => aufraeumen.current?.(), []);

	const zeigeStatus = (z: Zug) => {
		const { stand: s } = neu.current;
		if (!s) {
			return;
		}
		const was = z.objekte.length === 1 ? `„${z.objekte[0]?.name ?? ''}“` : `${z.objekte.length} Objekte`;
		if (z.inSichSelbst) {
			setStatus('Ein Ordner kann nicht in sich selbst liegen.');
		} else if (z.zielId === undefined) {
			setStatus(`${was} ${z.kopiert ? 'kopieren' : 'bewegen'}: Ziel wählen`);
		} else if (z.zielId === 'papierkorb') {
			setStatus(`${was} in den Papierkorb legen`);
		} else {
			setStatus(`${was} nach „${ortName(s, z.zielId)}“ ${z.kopiert ? 'kopieren' : 'bewegen'}`);
		}
	};

	const setzeZeiger = (z: Zug) => {
		const gezogen = z.kopiert ? 'copy' : 'grabbing';
		document.documentElement.style.cursor = z.zielId === undefined ? 'not-allowed' : gezogen;
	};

	const federe = (z: Zug) => {
		const el = z.ziel;
		if (!el || z.zielId === 'papierkorb' || z.zielId === undefined || z.zielId === null) {
			return;
		}
		const id = z.zielId;
		const { klappeBaum, klappeListe } = neu.current.o;
		if (el.closest('[data-baum-ordner]')) {
			klappeBaum(id, true);
		} else if (el.closest('[data-art="ordner"]')?.tagName === 'LI') {
			// Am Finger gehen die Ereignisse an das Ursprungselement: Verschwindet die Kachel, kommen keine mehr.
			if (!z.finger) {
				void neu.current.navigate(`/o/${id}`);
			}
		} else if (el.closest('[data-art="ordner"]')) {
			klappeListe(id, true);
		}
	};

	const waehleZiel = (z: Zug) => {
		const { stand: s } = neu.current;
		const el = zielAn(z.x, z.y);
		const roh = el?.dataset.ablageZiel;
		const id = el ? zielVon(el) : undefined;
		const gueltig = el && s && (roh === 'papierkorb' || (id !== undefined && zielGueltig(s, z.objekte, id)));
		const neuesZiel = gueltig ? el : null;
		const neueId = gueltig ? (id as string | null) : undefined;
		if (neuesZiel !== z.ziel) {
			z.ziel?.removeAttribute(AKTIV);
			neuesZiel?.setAttribute(AKTIV, '');
			if (z.federn !== null) {
				window.clearTimeout(z.federn);
				z.federn = null;
			}
			z.ziel = neuesZiel;
			// Über einem Ordner federt es, auch wenn er als Ziel gerade nicht gilt: Darunter kann eines liegen.
			if (neuesZiel && neueId !== null && neueId !== 'papierkorb') {
				z.federn = window.setTimeout(() => {
					z.federn = null;
					federe(z);
				}, FEDERN_MS);
			}
		}
		z.zielId = neueId;
		z.inSichSelbst = Boolean(s && id && z.objekte.some((x) => x.istOrdner && nachkommen(s, x.ordner.id).has(id)));
		zeigeStatus(z);
		setzeZeiger(z);
	};

	const rolle = (x: number, y: number) => {
		const leiste = document.querySelector<HTMLElement>('[data-baum-roll]');
		const r = leiste?.getBoundingClientRect();
		if (leiste && r && x >= r.left && x <= r.right) {
			rolleAmRand(leiste, y);
			return;
		}
		if (y < RAND + 60) {
			window.scrollBy(0, -ROLLEN);
		} else if (y > window.innerHeight - RAND) {
			window.scrollBy(0, ROLLEN);
		}
	};

	const beendeZug = (ablegen: boolean) => {
		const z = lauf.current;
		if (!z) {
			return;
		}
		lauf.current = null;
		if (z.federn !== null) {
			window.clearTimeout(z.federn);
		}
		z.ziel?.removeAttribute(AKTIV);
		document.documentElement.style.cursor = '';
		document.body.removeAttribute('data-zieht');
		setZug(null);
		setStatus(null);
		const { adresse, navigate: nav, stand: s, tu: machen } = neu.current;
		if (!ablegen) {
			if (adresse !== z.startAdresse) {
				void nav(z.startAdresse, { replace: true });
			}
			return;
		}
		if (z.zielId === undefined || !s) {
			return;
		}
		const knoten = z.objekte.map((x) => x.knoten);
		if (z.zielId === 'papierkorb') {
			void machen({ art: 'papierkorb', knoten }, { text: () => geloeschtText(z.objekte) });
			return;
		}
		const ziel = z.zielId;
		if (z.kopiert) {
			void machen({ art: 'kopieren', knoten, ziel }, { text: (a) => kopiertText(s, z.objekte, ziel, a) });
		} else {
			void machen({ art: 'bewegen', knoten, ziel }, { text: (a) => bewegtText(s, z.objekte, ziel, a) });
		}
	};

	const beginneZug = (schluessel: string, finger: boolean, x: number, y: number, kopiert: boolean) => {
		const objekte = neu.current.o.objekteZuZiehen(schluessel);
		if (objekte.length === 0) {
			return false;
		}
		const z: Zug = {
			objekte,
			finger,
			startAdresse: neu.current.adresse,
			ziel: null,
			zielId: undefined,
			kopiert,
			inSichSelbst: false,
			federn: null,
			x,
			y,
		};
		lauf.current = z;
		document.body.setAttribute('data-zieht', '');
		window.getSelection()?.removeAllRanges();
		setZug({ objekte, x, y });
		waehleZiel(z);
		return true;
	};

	const unten = (e: ReactPointerEvent) => {
		const ziel = e.target as HTMLElement;
		if (e.button !== 0 || !o.aktiv || ziel.closest('button, input, a, [data-namensfeld]')) {
			return;
		}
		const finger = e.pointerType === 'touch';
		const objekt = ziel.closest<HTMLElement>('[data-objekt]')?.dataset.objekt;
		if (!objekt && finger) {
			return;
		}
		const startX = e.clientX;
		const startY = e.clientY;
		const scrollStart = window.scrollY;
		let x = startX;
		let y = startY;
		let bewegtSich = false;
		let halten: number | null = null;
		const basis = e.metaKey || e.shiftKey ? o.auswahl.gewaehlt : [];

		const zeichneLasso = () => {
			const links = Math.min(startX, x);
			const oben = Math.min(startY - (window.scrollY - scrollStart), y);
			const breite = Math.abs(x - startX);
			const hoehe = Math.abs(y - (startY - (window.scrollY - scrollStart)));
			setLasso({ x: links, y: oben, b: breite, h: hoehe });
			const treffer = [...(neu.current.o.inhalt.current?.querySelectorAll<HTMLElement>('[data-objekt]') ?? [])]
				.filter((el) => {
					const r = el.getBoundingClientRect();
					return r.left < links + breite && r.right > links && r.top < oben + hoehe && r.bottom > oben;
				})
				.flatMap((el) => el.dataset.objekt ?? []);
			const gewaehlt = neu.current.o.reihenfolge.filter((s) => basis.includes(s) || treffer.includes(s));
			neu.current.o.setAuswahl({ gewaehlt, anker: gewaehlt[0] ?? null });
		};

		const jedesBild = () => {
			if (lauf.current) {
				rolle(x, y);
				lauf.current.x = x;
				lauf.current.y = y;
				waehleZiel(lauf.current);
			} else if (bewegtSich && !objekt) {
				rolle(x, y);
				zeichneLasso();
			}
		};

		const bewegen = (m: PointerEvent) => {
			x = m.clientX;
			y = m.clientY;
			const weg = Math.hypot(x - startX, y - startY);
			if (lauf.current) {
				lauf.current.kopiert = m.altKey;
				setZug((alt) => alt && { ...alt, x, y });
				return;
			}
			if (finger) {
				// Wer vor dem Halten wischt, rollt.
				if (weg > FINGER_WEG && halten !== null) {
					window.clearTimeout(halten);
					halten = null;
				}
				return;
			}
			if (objekt) {
				if (weg >= MAUS_WEG) {
					beginneZug(objekt, false, x, y, m.altKey);
				}
			} else if (weg >= LASSO_WEG) {
				bewegtSich = true;
			}
		};

		const raeumeAuf = () => {
			hoereAuf();
			if (halten !== null) {
				window.clearTimeout(halten);
			}
			setLasso(null);
			aufraeumen.current = null;
		};

		const hoch = (m: PointerEvent) => {
			const warZug = lauf.current !== null;
			// Es zählt, wo losgelassen wird: Die Schleife kann ein Bild hinterher sein.
			if (lauf.current) {
				lauf.current.x = m.clientX;
				lauf.current.y = m.clientY;
				waehleZiel(lauf.current);
			}
			raeumeAuf();
			if (warZug) {
				schluckeKlick();
				beendeZug(true);
			} else if (bewegtSich) {
				schluckeKlick();
			}
		};
		const abbruch = () => {
			raeumeAuf();
			beendeZug(false);
		};
		const taste = (k: KeyboardEvent) => {
			const z = lauf.current;
			if (k.key === 'Escape' && (z || bewegtSich)) {
				k.preventDefault();
				k.stopPropagation();
				abbruch();
			} else if (z && k.key === 'Alt') {
				z.kopiert = true;
				waehleZiel(z);
			} else if (z && k.key === ' ') {
				k.preventDefault();
				k.stopPropagation();
				if (z.federn !== null) {
					window.clearTimeout(z.federn);
					z.federn = null;
				}
				federe(z);
			}
		};
		const tasteLos = (k: KeyboardEvent) => {
			const z = lauf.current;
			if (z && k.key === 'Alt') {
				z.kopiert = false;
				waehleZiel(z);
			}
		};

		const hoereAuf = folgeZeiger({
			bewegen,
			los: hoch,
			abbruch,
			taste,
			tasteLos,
			bild: jedesBild,
			sperrtRollen: () => lauf.current !== null,
		});
		aufraeumen.current = abbruch;
		if (finger && objekt) {
			halten = window.setTimeout(() => {
				halten = null;
				if (beginneZug(objekt, true, x, y, false)) {
					navigator.vibrate?.(10);
				}
			}, HALTEN_MS);
		}
	};

	const gezogen = new Set(zug?.objekte.map((x) => x.schluessel) ?? []);
	const lassoAnzeige: ReactNode = lasso && (
		<div
			data-lasso
			className="pointer-events-none fixed z-ueberlagerung rounded-sm border border-brand-500 bg-brand-500/10"
			style={{ left: lasso.x, top: lasso.y, width: lasso.b, height: lasso.h }}
		/>
	);
	return {
		unten,
		gezogen,
		status,
		lasso: (
			<>
				{lassoAnzeige}
				{zug && <Geist objekte={zug.objekte} x={zug.x} y={zug.y} />}
			</>
		),
	};
};

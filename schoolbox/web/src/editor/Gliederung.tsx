import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import type { Ablage } from '@schoolbox/kern/src/struktur';
import { hatNamenszeile } from '@schoolbox/kern/src/struktur';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { AmZeiger } from '../bausteine/AmZeiger';
import { Griff } from '../bausteine/Griff';
import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import { folgeZeiger, rolleAmRand, schluckeKlick } from '../bausteine/zeigerzug';
import type { GliederungSeite, GliederungZeile } from './gliederung-modell';
import { gliederungVon, zeileZurAuswahl } from './gliederung-modell';
import type { GliederungStand } from './gliederung-stand';
import { leistenHtml } from './leiste';
import type { Struktur } from './struktur';
import { MAUS_WEG } from './ziehen';

const SPEICHER_SEITE = 'schoolbox-neue-seite';
const MINIATUR_BREITE = 96;
const FEDERN_MS = 600;
const ETWA_A4 = 1.414;
/** Griff und Pfeil: So weit rücken Miniatur und Zeilen ein. */
const EINZUG = 'pl-5 [@media(any-pointer:coarse)]:pl-11';

const ART_KNOPF = (
	<Knopf art="zweit" className="size-knopf rounded-l-none border-l-0 px-0">
		<Symbol name="runter" className="size-3 flex-none" />
	</Knopf>
);

interface Masse {
	breite: number;
	hoehen: number[];
}

interface Rahmen {
	nr: number;
	html: string;
	doc: Document | null;
	masse: Masse | null;
}

const quellSeiten = (doc: Document) => [...doc.querySelectorAll<HTMLElement>('.seite:not([data-erzeugt])')];

const miss = (doc: Document): Masse => ({
	breite: Math.max(1, ...quellSeiten(doc).map((s) => s.offsetWidth)),
	hoehen: quellSeiten(doc).map((s) => s.offsetHeight),
});

const setzeStil = (el: HTMLElement, name: string, wert: string | null) => {
	if (wert === null) {
		el.style.removeProperty(name);
	} else if (el.style.getPropertyValue(name) !== wert) {
		el.style.setProperty(name, wert, 'important');
	}
};

/**
 * Ein einziges `iframe` unter der ganzen Liste, seine Seiten liegen dort, wo in der Liste die Plätze der Miniaturen sind.
 * So entsteht das Material bei einer Änderung nur einmal und nicht einmal je Seite. Erzeugte Seiten zeigt es nicht: Die
 * Miniatur steht für die Quelle, „läuft über“ meldet die Prüfung.
 */
const legeSeitenAus = (frame: HTMLIFrameElement, inhalt: HTMLElement, doc: Document, skala: number) => {
	const aussen = inhalt.getBoundingClientRect();
	const miniaturen = [...inhalt.querySelectorAll<HTMLElement>('[data-seite-miniatur]')];
	const plaetze = new Map(
		miniaturen.map((m) => [Number(m.dataset.seiteMiniatur) - 1, m.getBoundingClientRect().top - aussen.top]),
	);
	const erste = miniaturen[0]?.getBoundingClientRect();
	const links = `${(erste?.left ?? aussen.left) - aussen.left}px`;
	if (frame.style.left !== links) {
		frame.style.left = links;
	}
	for (const s of doc.querySelectorAll<HTMLElement>('.seite[data-erzeugt]')) {
		setzeStil(s, 'display', 'none');
	}
	quellSeiten(doc).forEach((s, i) => {
		const platz = plaetze.get(i);
		if (platz === undefined) {
			setzeStil(s, 'display', 'none');
			return;
		}
		setzeStil(s, 'display', null);
		setzeStil(s, 'position', 'absolute');
		setzeStil(s, 'left', '0px');
		setzeStil(s, 'top', `${platz / skala}px`);
	});
	const hoehe = `${inhalt.scrollHeight / skala}px`;
	if (frame.style.height !== hoehe) {
		frame.style.height = hoehe;
	}
};

const useMiniaturen = (html: string | null, an: boolean, inhalt: RefObject<HTMLDivElement | null>) => {
	const leiste = useMemo(() => (html === null || !an ? null : leistenHtml(html)), [html, an]);
	const naechste = useRef(0);
	const [rahmen, setRahmen] = useState<Rahmen[]>([]);
	const sichtbarFrame = useRef<HTMLIFrameElement>(null);

	useEffect(() => {
		if (leiste === null) {
			setRahmen([]);
			return;
		}
		const nr = naechste.current;
		naechste.current += 1;
		setRahmen((alt) => [...alt.filter((r) => r.masse).slice(-1), { nr, html: leiste, doc: null, masse: null }]);
	}, [leiste]);

	const fertig = ({ nr }: Rahmen, frame: HTMLIFrameElement) => {
		const doc = frame.contentDocument;
		if (!doc) {
			return;
		}
		const zeigen = () => {
			const masse = miss(doc);
			setRahmen((alt) => alt.filter((r) => r.nr >= nr).map((r) => (r.nr === nr ? { ...r, doc, masse } : r)));
		};
		void doc.fonts.ready.then(zeigen, zeigen);
	};

	const sichtbar = rahmen.findLast((r) => r.masse !== null);
	const skala = sichtbar?.masse ? MINIATUR_BREITE / sichtbar.masse.breite : 0;

	// Jede Änderung der Liste verschiebt die Plätze; der Vergleich in `setzeStil` hält das billig.
	useLayoutEffect(() => {
		if (sichtbar?.doc && sichtbarFrame.current && inhalt.current && skala) {
			legeSeitenAus(sichtbarFrame.current, inhalt.current, sichtbar.doc, skala);
		}
	});

	const rahmenAnzeige = rahmen.map((r) => {
		const istSichtbar = r === sichtbar && r.masse;
		return (
			<iframe
				key={r.nr}
				ref={istSichtbar ? sichtbarFrame : undefined}
				srcDoc={r.html}
				title="Miniaturen"
				tabIndex={-1}
				aria-hidden
				scrolling="no"
				data-miniaturen-rahmen
				className="pointer-events-none absolute top-0 border-0"
				style={
					istSichtbar && r.masse
						? {
								width: r.masse.breite,
								transform: `scale(${skala})`,
								transformOrigin: 'top left',
							}
						: { left: 0, width: 1600, height: 800, visibility: 'hidden' }
				}
				onLoad={(e) => fertig(r, e.currentTarget)}
			/>
		);
	});

	return {
		rahmenAnzeige,
		hoeheVon: (i: number) => {
			const h = sichtbar?.masse?.hoehen[i];
			return h === undefined ? MINIATUR_BREITE * ETWA_A4 : h * skala;
		},
	};
};

interface Zug {
	seite: boolean;
	nr: number;
	name: string;
	x: number;
	y: number;
	/** Oben und Einzug der Linie, in Pixeln der Liste. */
	marke: { oben: number; links: number } | null;
	/** Die Seite, ans Ende derer das Gezogene käme; sie färbt sich. */
	inSeite: number | null;
}

interface Lauf {
	seite: boolean;
	nr: number;
	art: string;
	quelle: string;
	ablage: Ablage | null;
	geprueft: Map<string, boolean>;
	feder: number | null;
	federId: number | null;
}

interface Eigenschaften {
	doc: Document | null;
	zerlegung: Zerlegung | null;
	/** Das Material wie im Editor. */
	html: string | null;
	auswahl: number | null;
	struktur: Struktur;
	stand: GliederungStand;
	/** Im Mini-Book steht die Zahl der Seiten fest, und sie bleiben, wo sie sind. */
	festeSeiten: boolean;
	kontextmenue: (nr: number, art: 'baustein' | 'miniatur', punkt: { x: number; y: number }) => void;
}

const naechsteZeile = (liste: Element, y: number, nurSeiten: boolean) => {
	let beste: HTMLElement | null = null;
	let abstand = Infinity;
	for (const el of liste.querySelectorAll<HTMLElement>(nurSeiten ? '[data-ziel="seite"]' : '[data-ziel]')) {
		const r = el.getBoundingClientRect();
		const d = Math.max(r.top - y, 0, y - r.bottom);
		if (d < abstand) {
			abstand = d;
			beste = el;
		}
	}
	return beste;
};

/** Hätte die Ablage hier keine Wirkung? Die Nachbarn in der Liste, und ans Ende, wer dort schon steht. */
const ohneWirkung = (modell: GliederungSeite[], nr: number, ablage: Ablage, seite: boolean) => {
	if (seite) {
		const i = modell.findIndex((s) => s.nr === nr);
		return (
			'nr' in ablage &&
			((ablage.wo === 'vor' && modell[i + 1]?.nr === ablage.nr) ||
				(ablage.wo === 'nach' && modell[i - 1]?.nr === ablage.nr))
		);
	}
	if ('in' in ablage) {
		const ziel = modell.find((s) => s.nr === ablage.in);
		return ziel?.zeilen.filter((z) => !z.fest).at(-1)?.nr === nr;
	}
	const zeilen = modell.find((s) => s.zeilen.some((z) => z.nr === nr))?.zeilen ?? [];
	const i = zeilen.findIndex((z) => z.nr === nr);
	return (
		(ablage.wo === 'vor' && zeilen[i + 1]?.nr === ablage.nr) ||
		(ablage.wo === 'nach' && zeilen[i - 1]?.nr === ablage.nr)
	);
};

/**
 * Der linke Reiter: alle Seiten und ihre Bausteine als Baum. Klick wählt und springt, das Menü ordnet, gezogen wird am
 * Griff, mit der Maus auch von überall in der Zeile. Jede Ablage ist ein Befehl und ein Schritt im Verlauf.
 */
export const Gliederung = ({
	auswahl,
	doc,
	festeSeiten,
	html,
	kontextmenue,
	stand,
	struktur,
	zerlegung,
}: Eigenschaften) => {
	const liste = useRef<HTMLDivElement>(null);
	const inhalt = useRef<HTMLDivElement>(null);
	const { hoeheVon, rahmenAnzeige } = useMiniaturen(html, stand.miniaturen, inhalt);
	const [zug, setZug] = useState<Zug | null>(null);
	const lauf = useRef<Lauf | null>(null);
	const hoereAuf = useRef<(() => void) | null>(null);
	const aufraeumen = useRef<(() => void) | null>(null);

	// Ohne aktuelle Darstellung bleibt die letzte Liste stehen, sonst flackert sie bei jedem Befehl; sie nimmt dann nichts an.
	const letzte = useRef<GliederungSeite[]>([]);
	const frisch = useMemo(
		() => (doc && zerlegung ? gliederungVon(doc, zerlegung, stand.ids) : null),
		[doc, zerlegung, stand.ids],
	);
	if (frisch) {
		letzte.current = frisch;
	}
	const modell = letzte.current;
	const aktuell = struktur.aktiv && frisch !== null;
	const zeilenNr = useMemo(() => new Set(modell.flatMap((s) => [s.nr, ...s.zeilen.map((z) => z.nr)])), [modell]);
	const aktiveZeile = frisch ? zeileZurAuswahl(zerlegung, auswahl, zeilenNr) : null;
	const seiteDerAuswahl = struktur.werte?.seite ?? null;

	const neu = useRef({ struktur, modell, zerlegung, stand, aktuell });
	neu.current = { struktur, modell, zerlegung, stand, aktuell };

	const [mitNamenszeile, setMitNamenszeile] = useState(() => localStorage.getItem(SPEICHER_SEITE) !== 'leer');
	const namenszeile = useMemo(() => (zerlegung ? hatNamenszeile(zerlegung) : false), [zerlegung]);
	const neueSeiteMit = (mit: boolean) => {
		setMitNamenszeile(mit);
		localStorage.setItem(SPEICHER_SEITE, mit ? 'namenszeile' : 'leer');
		void struktur.neueSeite(mit);
	};

	useEffect(() => {
		if (aktiveZeile !== null && !lauf.current) {
			liste.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
		}
	}, [aktiveZeile]);

	useEffect(() => () => aufraeumen.current?.(), []);

	const beendeFeder = (l: Lauf) => {
		if (l.feder !== null) {
			window.clearTimeout(l.feder);
		}
		l.feder = null;
		l.federId = null;
	};

	const federe = (l: Lauf, id: number | null) => {
		if (l.federId === id) {
			return;
		}
		beendeFeder(l);
		if (id !== null) {
			l.federId = id;
			l.feder = window.setTimeout(() => {
				l.feder = null;
				neu.current.stand.klappe(id, true);
			}, FEDERN_MS);
		}
	};

	/** Fragt den Kern einmal je Stelle, ob er dort ablegen würde. */
	const erlaubt = (l: Lauf, ablage: Ablage) => {
		const schluessel = JSON.stringify(ablage);
		const bekannt = l.geprueft.get(schluessel);
		if (bekannt !== undefined) {
			return bekannt;
		}
		const ok = neu.current.struktur.kannVerschieben(l.nr, ablage);
		l.geprueft.set(schluessel, ok);
		return ok;
	};

	/** Liest die Stelle unter dem Zeiger: Linie, gefärbte Seite oder ungültig. */
	const waehleZiel = (l: Lauf, x: number, y: number) => {
		const rolle = liste.current;
		const flaeche = inhalt.current;
		const setze = (
			ablage: Ablage | null,
			marke: Zug['marke'],
			inSeite: number | null,
			ungueltig: boolean,
			federId: number | null,
		) => {
			l.ablage = ablage;
			federe(l, federId);
			document.documentElement.style.cursor = ungueltig ? 'not-allowed' : 'grabbing';
			setZug((alt) => {
				if (!alt) {
					return alt;
				}
				const gleich =
					alt.x === x &&
					alt.y === y &&
					alt.inSeite === inSeite &&
					alt.marke?.oben === marke?.oben &&
					alt.marke?.links === marke?.links;
				return gleich ? alt : { ...alt, x, y, marke, inSeite };
			});
		};
		if (!rolle || !flaeche) {
			setze(null, null, null, true, null);
			return;
		}
		const r = rolle.getBoundingClientRect();
		const zeile = x >= r.left && x <= r.right ? naechsteZeile(rolle, y, l.seite) : null;
		const art = zeile?.dataset.ziel;
		const nr = Number(zeile?.dataset.nr);
		if (!zeile || art === 'fest' || Number.isNaN(nr)) {
			setze(null, null, null, true, null);
			return;
		}
		if (nr === l.nr) {
			setze(null, null, null, false, null);
			return;
		}
		const z = zeile.getBoundingClientRect();
		const federId =
			!l.seite && art === 'seite' && zeile.dataset.zu !== undefined ? Number(zeile.dataset.seiteId) : null;
		let ablage: Ablage;
		if (art === 'seite' && !l.seite) {
			ablage = { in: nr };
		} else {
			ablage = { nr, wo: y < z.top + z.height / 2 ? 'vor' : 'nach' };
		}
		const { modell: m } = neu.current;
		if (ohneWirkung(m, l.nr, ablage, l.seite)) {
			setze(null, null, null, false, federId);
		} else if (!erlaubt(l, ablage)) {
			setze(null, null, null, true, null);
		} else if ('in' in ablage) {
			setze(ablage, null, nr, false, federId);
		} else {
			const f = flaeche.getBoundingClientRect();
			setze(
				ablage,
				{
					oben: (ablage.wo === 'vor' ? z.top : z.bottom) - f.top,
					links: z.left - f.left,
				},
				null,
				false,
				null,
			);
		}
	};

	const beende = (ablegen: boolean) => {
		const l = lauf.current;
		if (!l) {
			return;
		}
		lauf.current = null;
		beendeFeder(l);
		document.documentElement.style.cursor = '';
		document.body.removeAttribute('data-zieht');
		setZug(null);
		const jetzt = neu.current;
		// `aktuell`: Hat sich die Quelle beim Ziehen geändert, stimmen die Nummern nicht mehr.
		if (!ablegen || !l.ablage || !jetzt.aktuell || jetzt.zerlegung?.quelle !== l.quelle) {
			return;
		}
		jetzt.stand.eigene.current = { bleibtZu: l.seite, leuchten: true };
		if (!jetzt.struktur.verschiebe(l.nr, l.ablage, true, `${l.art} verschoben`)) {
			jetzt.stand.eigene.current = { bleibtZu: false, leuchten: false };
		}
	};

	const beginne = (seite: boolean, zeile: { nr: number; name: string; art: string }, x: number, y: number) => {
		const quelle = neu.current.zerlegung?.quelle;
		if (quelle === undefined || !neu.current.aktuell) {
			return;
		}
		lauf.current = {
			seite,
			nr: zeile.nr,
			art: zeile.art,
			quelle,
			ablage: null,
			geprueft: new Map(),
			feder: null,
			federId: null,
		};
		document.body.setAttribute('data-zieht', '');
		// Steht der Fokus im Blatt, käme Esc dort an und nicht hier.
		if (document.activeElement instanceof HTMLIFrameElement) {
			document.activeElement.blur();
		}
		setZug({ seite, nr: zeile.nr, name: zeile.name, x, y, marke: null, inSeite: null });
	};

	const druecke = (
		e: ReactPointerEvent,
		seite: boolean,
		zeile: { nr: number; name: string; art: string },
		griff: boolean,
	) => {
		const ziel = e.target as Element;
		const maus = e.pointerType === 'mouse';
		const amGriff = ziel.closest('[data-griff-zeile]') !== null;
		if (
			!griff ||
			lauf.current ||
			!e.isPrimary ||
			!aktuell ||
			ziel.closest('[data-nicht-ziehen]') ||
			(maus && (e.button !== 0 || e.ctrlKey)) ||
			(!maus && !amGriff)
		) {
			return;
		}
		const startX = e.clientX;
		const startY = e.clientY;
		let x = startX;
		let y = startY;
		const fertig = () => {
			hoereAuf.current?.();
			hoereAuf.current = null;
			aufraeumen.current = null;
		};
		hoereAuf.current?.();
		aufraeumen.current = () => {
			beende(false);
			fertig();
		};
		hoereAuf.current = folgeZeiger({
			bewegen: (m) => {
				x = m.clientX;
				y = m.clientY;
				if (!lauf.current && Math.hypot(x - startX, y - startY) >= MAUS_WEG) {
					beginne(seite, zeile, x, y);
				}
			},
			los: (m) => {
				const l = lauf.current;
				if (l) {
					// Es zählt, wo losgelassen wird: Das letzte Bild kann hinterher sein.
					waehleZiel(l, m.clientX, m.clientY);
					schluckeKlick();
					beende(true);
				}
				fertig();
			},
			abbruch: () => {
				beende(false);
				fertig();
			},
			taste: (k) => {
				if (k.key === 'Escape' && lauf.current) {
					k.preventDefault();
					k.stopPropagation();
					schluckeKlick();
					beende(false);
					fertig();
				}
			},
			bild: () => {
				const l = lauf.current;
				if (l) {
					if (liste.current) {
						rolleAmRand(liste.current, y);
					}
					waehleZiel(l, x, y);
				}
			},
			sperrtRollen: () => lauf.current !== null,
		});
	};

	const menue = (e: ReactMouseEvent, nr: number, art: 'baustein' | 'miniatur') => {
		e.preventDefault();
		if (aktuell && !lauf.current) {
			kontextmenue(nr, art, { x: e.clientX, y: e.clientY });
		}
	};

	/** Die Auswahl aus der Liste ist kein Klick im Blatt: Eine eingeklappte Seite bleibt zu. */
	const waehle = (nr: number, klapptAuf: boolean) => {
		if (!aktuell) {
			return;
		}
		if (!klapptAuf && auswahl !== nr) {
			stand.eigene.current = { bleibtZu: true, leuchten: false };
		}
		struktur.zeigeAn(nr);
	};

	const alleZu = modell.length > 0 && modell.every((s) => stand.zu.has(s.id));

	const zeigeZeile = (z: GliederungZeile, seite: GliederungSeite) => (
		<li
			key={z.nr}
			className={klassen(
				'flex items-stretch rounded-md transition-colors duration-500',
				z.fest && 'text-dezent',
				stand.leuchtet === z.nr && 'bg-brand-100',
			)}
			style={zug?.nr === z.nr ? { opacity: 0.35 } : undefined}
			data-ziel={z.fest ? 'fest' : 'zeile'}
			data-nr={z.nr}
			data-seite-id={seite.id}
			{...(z.aufgabe ? { 'data-gliederung-aufgabe': true } : {})}
			{...(z.fest ? { 'data-gliederung-fest': true } : { 'data-gliederung-zeile': true })}
			onPointerDown={(e) => druecke(e, false, z, !z.fest)}
			onContextMenu={(e) => menue(e, z.nr, 'baustein')}
		>
			{z.fest ? (
				<span className="w-5 flex-none [@media(any-pointer:coarse)]:w-11" />
			) : (
				<Griff beschriftung={`${z.art} ziehen`} tabIndex={-1} data-griff-zeile />
			)}
			<Tooltip text={z.titel}>
				<button
					type="button"
					className="flex h-zeile min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-left select-none hover:bg-flaeche-2 aria-[current=true]:bg-flaeche-2"
					style={{ WebkitTouchCallout: 'none' }}
					data-gliederung-titel
					aria-current={aktiveZeile === z.nr}
					onClick={() => waehle(z.nr, true)}
				>
					{z.nummer && <span className="w-3.5 flex-none text-center font-medium text-leise">{z.nummer}</span>}
					<span className="truncate">{z.titel}</span>
				</button>
			</Tooltip>
		</li>
	);

	const zeigeSeite = (s: GliederungSeite, i: number) => {
		const name = `Seite ${i + 1}`;
		const zugeklappt = stand.zu.has(s.id) || zug?.seite === true;
		const griffDaten = { nr: s.nr, name, art: 'Seite' };
		const anzahl = s.zeilen.filter((z) => !z.fest).length;
		return (
			<div key={s.id} style={zug?.nr === s.nr ? { opacity: 0.35 } : undefined} data-gliederung-seite={i + 1}>
				<div
					className={klassen(
						'flex items-stretch rounded-md font-medium transition-colors duration-500',
						zug?.inSeite === s.nr && 'bg-brand-50 outline-2 -outline-offset-2 outline-brand-500',
						stand.leuchtet === s.nr && 'bg-brand-100',
					)}
					data-ziel="seite"
					data-nr={s.nr}
					data-seite-id={s.id}
					{...(zugeklappt ? { 'data-zu': true } : {})}
					data-seite-zeile={i + 1}
					onPointerDown={(e) => druecke(e, true, griffDaten, !festeSeiten)}
					onContextMenu={(e) => menue(e, s.nr, 'miniatur')}
				>
					{!festeSeiten && <Griff beschriftung="Seite ziehen" tabIndex={-1} data-griff-zeile />}
					<button
						type="button"
						className="flex w-5 flex-none items-center justify-center rounded-sm text-leise hover:bg-flaeche-2 hover:text-tinte [@media(any-pointer:coarse)]:w-11"
						aria-label={zugeklappt ? 'Aufklappen' : 'Einklappen'}
						aria-expanded={!zugeklappt}
						data-nicht-ziehen
						onClick={() => stand.klappe(s.id, zugeklappt)}
					>
						<Symbol name={zugeklappt ? 'rechts' : 'runter'} className="size-3 flex-none" />
					</button>
					<button
						type="button"
						className="flex h-zeile min-w-0 flex-1 items-center justify-between gap-1 rounded-md px-1 text-left select-none hover:bg-flaeche-2 aria-[current=true]:bg-flaeche-2"
						style={{ WebkitTouchCallout: 'none' }}
						aria-current={aktiveZeile === s.nr}
						onClick={() => waehle(s.nr, false)}
					>
						{name}
						{zugeklappt && (
							<span className="font-normal text-leise" data-seite-anzahl>
								{anzahl}
							</span>
						)}
					</button>
				</div>
				{!zugeklappt && (
					<>
						{stand.miniaturen && (
							<div
								className={klassen(EINZUG, 'py-1')}
								data-ziel="seite"
								data-nr={s.nr}
								data-seite-id={s.id}
								onPointerDown={(e) => druecke(e, true, griffDaten, !festeSeiten)}
								onContextMenu={(e) => menue(e, s.nr, 'miniatur')}
							>
								<button
									type="button"
									className={klassen(
										'relative z-10 block rounded-sm border shadow-1 select-none',
										s.nr === seiteDerAuswahl
											? 'border-brand-500 ring-2 ring-brand-500'
											: 'border-rand',
									)}
									style={{
										width: MINIATUR_BREITE,
										height: hoeheVon(i),
										WebkitTouchCallout: 'none',
									}}
									aria-label={`Miniatur ${i + 1}`}
									data-seite-miniatur={i + 1}
									onClick={() => waehle(s.nr, false)}
								/>
							</div>
						)}
						<ul className="flex flex-col pl-5 [@media(any-pointer:coarse)]:pl-3">
							{s.zeilen.map((z) => zeigeZeile(z, s))}
						</ul>
					</>
				)}
			</div>
		);
	};

	return (
		<nav aria-label="Gliederung" className="flex min-h-0 flex-1 flex-col" data-seitenleiste data-gliederung>
			<div className="flex flex-none items-center justify-end gap-1 border-b border-rand px-1 py-1">
				<Knopf
					art="leise"
					groesse="klein"
					className="text-xs"
					aria-pressed={stand.miniaturen}
					onClick={() => stand.setzeMiniaturen(!stand.miniaturen)}
				>
					{stand.miniaturen ? 'Miniaturen aus' : 'Miniaturen an'}
				</Knopf>
				<Knopf art="leise" groesse="klein" className="text-xs" onClick={() => stand.klappeAlle(!alleZu)}>
					{alleZu ? 'Alle aufklappen' : 'Alle einklappen'}
				</Knopf>
			</div>
			<div ref={liste} className="min-h-0 flex-1 overflow-y-auto" data-gliederung-liste>
				<div ref={inhalt} className="relative isolate flex flex-col gap-0.5 p-1">
					{stand.miniaturen && rahmenAnzeige}
					{modell.map(zeigeSeite)}
					{zug?.marke && (
						<div
							className="pointer-events-none absolute right-1 z-20 h-0.5 -translate-y-px bg-brand-500"
							style={{ top: zug.marke.oben, left: zug.marke.links }}
							data-einfuegemarke
						>
							<span className="absolute top-1/2 -left-1 size-2 -translate-y-1/2 rounded-full bg-brand-500" />
						</div>
					)}
				</div>
			</div>
			<div className="flex-none border-t border-rand p-2">
				{festeSeiten ? (
					<p className="text-xs text-leise" data-feste-seiten>
						Ein Mini-Book hat immer acht Seiten.
					</p>
				) : (
					<div className="flex">
						<Knopf
							art="zweit"
							className={klassen('flex-1 px-2', namenszeile && 'rounded-r-none')}
							aria-label="Seite hinzufügen"
							disabled={!struktur.aktiv}
							onClick={() => void struktur.neueSeite(namenszeile && mitNamenszeile)}
						>
							<Symbol name="plus" />
							Seite
						</Knopf>
						{namenszeile && (
							<Menue
								name="Art der neuen Seite"
								disabled={!struktur.aktiv}
								ausloeser={ART_KNOPF}
								eintraege={[
									{
										titel: 'Leere Seite',
										aktiv: !mitNamenszeile,
										waehle: () => neueSeiteMit(false),
									},
									{
										titel: 'Seite mit Namenszeile',
										aktiv: mitNamenszeile,
										waehle: () => neueSeiteMit(true),
									},
								]}
							/>
						)}
					</div>
				)}
			</div>
			{zug && (
				<AmZeiger x={zug.x + 10} y={zug.y + 10} data-zug>
					<span className="block rounded-lg bg-tinte px-3 py-2 font-medium whitespace-nowrap text-white shadow-2">
						{zug.name}
					</span>
				</AmZeiger>
			)}
		</nav>
	);
};

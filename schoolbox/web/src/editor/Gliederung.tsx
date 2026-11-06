import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import type { Ablage } from '@schoolbox/kern/src/struktur';
import { hatNamenszeile } from '@schoolbox/kern/src/struktur';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { AmZeiger } from '../bausteine/AmZeiger';
import { Griff } from '../bausteine/Griff';
import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import { folgeZeiger, rolleAmRand, schluckeKlick } from '../bausteine/zeigerzug';
import { bausteinVon, elementZu, nrVon } from './darstellung';
import type { GliederungKnoten, GliederungSeite } from './gliederung-modell';
import { alleSchluessel, gliederungVon, ketteZu, ohneWirkung, zeileZurAuswahl } from './gliederung-modell';
import type { GliederungStand } from './gliederung-stand';
import type { Struktur } from './struktur';
import { MAUS_WEG } from './ziehen';
import { ordnungVon } from './ziele';

const SPEICHER_SEITE = 'schoolbox-neue-seite';
const FEDERN_MS = 600;
/** So weit rückt jede Ebene des Baums ein. */
const EINZUG_PX = 12;

const ART_KNOPF = (
	<Knopf art="zweit" className="size-knopf rounded-l-none border-l-0 px-0">
		<Symbol name="runter" className="size-3 flex-none" />
	</Knopf>
);

const LUECKE = <span className="w-5 flex-none [@media(any-pointer:coarse)]:w-11" />;

interface Zug {
	seite: boolean;
	nr: number;
	name: string;
	x: number;
	y: number;
	/** Oben und Einzug der Linie, in Pixeln der Liste. */
	marke: { oben: number; links: number } | null;
	/** Die Zeile, ans Ende derer das Gezogene käme; sie färbt sich. */
	hinein: number | null;
}

interface Lauf {
	seite: boolean;
	nr: number;
	art: string;
	quelle: string;
	/** Neben wen das Gezogene darf und in wen hinein (ans Ende). */
	nebenZiele: ReadonlySet<number>;
	inZiele: ReadonlySet<number>;
	ablage: Ablage | null;
	geprueft: Map<string, boolean>;
	feder: number | null;
	federSchluessel: string | null;
}

interface Eigenschaften {
	doc: Document | null;
	zerlegung: Zerlegung | null;
	auswahl: number | null;
	struktur: Struktur;
	stand: GliederungStand;
	/** Im Mini-Book steht die Zahl der Seiten fest, und sie bleiben, wo sie sind. */
	festeSeiten: boolean;
	/** Wählt den Baustein, rollt das Blatt dorthin und zeigt rechts seine Einstellungen. */
	zeigeAn: (nr: number) => void;
	kontextmenue: (nr: number, art: 'baustein' | 'miniatur', punkt: { x: number; y: number }) => void;
}

const naechsteZeile = (liste: Element, y: number, nurSeiten: boolean) => {
	let beste: HTMLElement | null = null;
	let abstand = Infinity;
	for (const el of liste.querySelectorAll<HTMLElement>(nurSeiten ? '[data-seite-zeile]' : '[data-zeile-nr]')) {
		const r = el.getBoundingClientRect();
		const d = Math.max(r.top - y, 0, y - r.bottom);
		if (d < abstand) {
			abstand = d;
			beste = el;
		}
	}
	return beste;
};

const liegtIn = (z: Zerlegung, innen: number, aussen: number) => {
	for (let k = z.knoten[innen] ?? null; k; k = k.eltern) {
		if (k.nr === aussen) {
			return true;
		}
	}
	return false;
};

const alleKnoten = (k: readonly GliederungKnoten[]): GliederungKnoten[] =>
	k.flatMap((x) => [x, ...alleKnoten(x.kinder)]);

/**
 * Wohin ein Baustein in der Liste darf: dieselben Plätze wie beim Ziehen im Blatt (`ordnungVon`), dazu als Block der Seite
 * neben alles, was auf einer Seite liegt, und ans Ende jeder Seite. Feste Teile und das eigene Innere nie.
 */
const zieleFuer = (doc: Document, z: Zerlegung, modell: readonly GliederungSeite[], nr: number) => {
	const element = elementZu(doc, nr);
	const baustein = element ? bausteinVon(element) : undefined;
	const neben = new Set<number>();
	const hinein = new Set<number>();
	if (!element || !baustein) {
		return { neben, hinein };
	}
	const ordnung = ordnungVon(element, baustein);
	for (const g of ordnung.gruppen) {
		const bereich = nrVon(g.bereich);
		if (bereich !== null) {
			hinein.add(bereich);
		}
		for (const e of g.glieder) {
			const n = nrVon(e);
			if (n !== null) {
				neben.add(n);
			}
		}
	}
	if (element.parentElement?.matches('.seite') || baustein.ordnenIn === '.seite') {
		for (const s of modell) {
			hinein.add(s.nr);
			for (const k of s.kinder) {
				neben.add(k.nr);
			}
		}
	}
	const fest = new Set(
		modell
			.flatMap((s) => alleKnoten(s.kinder))
			.filter((k) => k.fest)
			.map((k) => k.nr),
	);
	for (const n of [...neben]) {
		if (n === nr || fest.has(n) || liegtIn(z, n, nr)) {
			neben.delete(n);
		}
	}
	for (const n of [...hinein]) {
		if (liegtIn(z, n, nr)) {
			hinein.delete(n);
		}
	}
	return { neben, hinein };
};

/**
 * Von der Zeile unter dem Zeiger nach außen, bis zur ersten, neben oder in die das Gezogene darf. Ans Ende einer Seite
 * nur über ihrer eigenen Zeile; `selbst` heißt: über dem Gezogenen, das ist weder ein Ziel noch verboten.
 */
const zielAb = (
	l: Pick<Lauf, 'nr' | 'nebenZiele' | 'inZiele'>,
	start: HTMLElement,
	y: number,
): { ablage: Ablage; huelle: HTMLElement } | 'selbst' | null => {
	for (let w: HTMLElement | null = start; w; w = w.parentElement?.closest<HTMLElement>('[data-knoten]') ?? null) {
		const nr = Number(w.dataset.knoten);
		const istSeite = w.dataset.seiteKnoten !== undefined;
		if (nr === l.nr) {
			return 'selbst';
		}
		if (l.nebenZiele.has(nr)) {
			const b = w.getBoundingClientRect();
			return { ablage: { nr, wo: y < b.top + b.height / 2 ? 'vor' : 'nach' }, huelle: w };
		}
		if (l.inZiele.has(nr) && (!istSeite || w === start)) {
			return { ablage: { in: nr }, huelle: w };
		}
		if (istSeite) {
			return null;
		}
	}
	return null;
};

/**
 * Der linke Reiter: alle Seiten und alles, was sich im Blatt wählen lässt, als Baum. Klick wählt und springt, das Menü
 * ordnet, gezogen wird am Griff, mit der Maus auch von überall in der Zeile. Was im Blatt gewählt ist, ist hier markiert
 * und aufgeklappt. Jede Ablage ist ein Befehl und ein Schritt im Verlauf.
 */
export const Gliederung = ({
	auswahl,
	doc,
	festeSeiten,
	kontextmenue,
	stand,
	struktur,
	zeigeAn,
	zerlegung,
}: Eigenschaften) => {
	const liste = useRef<HTMLDivElement>(null);
	const inhalt = useRef<HTMLDivElement>(null);
	const [zug, setZug] = useState<Zug | null>(null);
	const lauf = useRef<Lauf | null>(null);
	const hoereAuf = useRef<(() => void) | null>(null);
	const aufraeumen = useRef<(() => void) | null>(null);
	const rollen = useRef(false);

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
	const zeilenNr = useMemo(
		() => new Set(modell.flatMap((s) => [s.nr, ...alleKnoten(s.kinder).map((k) => k.nr)])),
		[modell],
	);
	const aktiveZeile = frisch ? zeileZurAuswahl(zerlegung, auswahl, zeilenNr) : null;

	const neu = useRef({ struktur, modell, zerlegung, stand, aktuell, doc });
	neu.current = { struktur, modell, zerlegung, stand, aktuell, doc };

	const [mitNamenszeile, setMitNamenszeile] = useState(() => localStorage.getItem(SPEICHER_SEITE) !== 'leer');
	const namenszeile = useMemo(() => (zerlegung ? hatNamenszeile(zerlegung) : false), [zerlegung]);
	const neueSeiteMit = (mit: boolean) => {
		setMitNamenszeile(mit);
		localStorage.setItem(SPEICHER_SEITE, mit ? 'namenszeile' : 'leer');
		void struktur.neueSeite(mit);
	};

	// Was gewählt ist, liegt offen: Alles darüber klappt auf, die Zeile selbst bleibt, wie sie ist.
	useEffect(() => {
		if (aktiveZeile === null || lauf.current) {
			return;
		}
		const { modell: m, stand: s } = neu.current;
		s.oeffne(ketteZu(m, aktiveZeile).slice(0, -1));
		rollen.current = true;
	}, [aktiveZeile]);

	useLayoutEffect(() => {
		if (!rollen.current || lauf.current) {
			return;
		}
		const zeile = liste.current?.querySelector('[aria-current="true"]');
		if (zeile) {
			rollen.current = false;
			zeile.scrollIntoView({ block: 'nearest' });
		}
	});

	useEffect(() => () => aufraeumen.current?.(), []);

	const beendeFeder = (l: Lauf) => {
		if (l.feder !== null) {
			window.clearTimeout(l.feder);
		}
		l.feder = null;
		l.federSchluessel = null;
	};

	const federe = (l: Lauf, schluessel: string | null) => {
		if (l.federSchluessel === schluessel) {
			return;
		}
		beendeFeder(l);
		if (schluessel !== null) {
			l.federSchluessel = schluessel;
			l.feder = window.setTimeout(() => {
				l.feder = null;
				neu.current.stand.klappe(schluessel, true);
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

	/** Liest die Stelle unter dem Zeiger: Linie, gefärbte Zeile oder ungültig. */
	const waehleZiel = (l: Lauf, x: number, y: number) => {
		const rolle = liste.current;
		const flaeche = inhalt.current;
		const setze = (
			ablage: Ablage | null,
			marke: Zug['marke'],
			hinein: number | null,
			ungueltig: boolean,
			feder: string | null,
		) => {
			l.ablage = ablage;
			federe(l, feder);
			document.documentElement.style.cursor = ungueltig ? 'not-allowed' : 'grabbing';
			setZug((alt) => {
				if (!alt) {
					return alt;
				}
				const gleich =
					alt.x === x &&
					alt.y === y &&
					alt.hinein === hinein &&
					alt.marke?.oben === marke?.oben &&
					alt.marke?.links === marke?.links;
				return gleich ? alt : { ...alt, x, y, marke, hinein };
			});
		};
		const { zerlegung: z } = neu.current;
		if (!rolle || !flaeche || !z) {
			setze(null, null, null, true, null);
			return;
		}
		const r = rolle.getBoundingClientRect();
		const zeile = x >= r.left && x <= r.right ? naechsteZeile(rolle, y, l.seite) : null;
		const start = zeile?.closest<HTMLElement>('[data-knoten]') ?? null;
		if (!zeile || !start) {
			setze(null, null, null, true, null);
			return;
		}
		// Eine eingeklappte Zeile geht nach kurzer Zeit auf, damit man hineinziehen kann.
		const feder = !l.seite && zeile.dataset.zu !== undefined ? (zeile.dataset.schluessel ?? null) : null;
		const treffer = zielAb(l, start, y);
		if (treffer === 'selbst') {
			setze(null, null, null, false, null);
			return;
		}
		if (!treffer) {
			setze(null, null, null, true, null);
			return;
		}
		const { ablage, huelle } = treffer;
		const b = huelle.getBoundingClientRect();
		if (ohneWirkung(z, l.nr, ablage)) {
			setze(null, null, null, false, feder);
		} else if (!erlaubt(l, ablage)) {
			setze(null, null, null, true, null);
		} else if ('in' in ablage) {
			setze(ablage, null, ablage.in, false, feder);
		} else {
			const f = flaeche.getBoundingClientRect();
			const eigene = huelle.querySelector(':scope > [data-zeile-nr]')?.getBoundingClientRect() ?? b;
			setze(
				ablage,
				{ oben: (ablage.wo === 'vor' ? b.top : b.bottom) - f.top, links: eigene.left - f.left },
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
		jetzt.stand.eigene.current = { leuchten: true };
		if (!jetzt.struktur.verschiebe(l.nr, l.ablage, true, `${l.art} verschoben`)) {
			jetzt.stand.eigene.current = { leuchten: false };
		}
	};

	const beginne = (seite: boolean, zeile: { nr: number; name: string; art: string }, x: number, y: number) => {
		const { aktuell: bereit, doc: d, modell: m, zerlegung: z } = neu.current;
		if (!z || !d || !bereit) {
			return;
		}
		const ziele = seite
			? { neben: new Set(m.map((s) => s.nr).filter((n) => n !== zeile.nr)), hinein: new Set<number>() }
			: zieleFuer(d, z, m, zeile.nr);
		lauf.current = {
			seite,
			nr: zeile.nr,
			art: zeile.art,
			quelle: z.quelle,
			nebenZiele: ziele.neben,
			inZiele: ziele.hinein,
			ablage: null,
			geprueft: new Map(),
			feder: null,
			federSchluessel: null,
		};
		document.body.setAttribute('data-zieht', '');
		// Steht der Fokus im Blatt, käme Esc dort an und nicht hier.
		if (document.activeElement instanceof HTMLIFrameElement) {
			document.activeElement.blur();
		}
		setZug({ seite, nr: zeile.nr, name: zeile.name, x, y, marke: null, hinein: null });
	};

	const druecke = (
		e: ReactPointerEvent,
		seite: boolean,
		zeile: { nr: number; name: string; art: string },
		griff: boolean,
	) => {
		const ziel = e.target as Element;
		const maus = e.pointerType === 'mouse';
		// Nur die eigene Zeile: Das Ereignis steigt sonst durch alle Zeilen darüber.
		const eigen = ziel.closest('[data-zeile-nr]') === e.currentTarget;
		const amGriff = ziel.closest('[data-griff-zeile]') !== null;
		if (
			!eigen ||
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
		e.stopPropagation();
		if (aktuell && !lauf.current) {
			kontextmenue(nr, art, { x: e.clientX, y: e.clientY });
		}
	};

	const waehle = (nr: number) => {
		if (aktuell) {
			zeigeAn(nr);
		}
	};

	const alleZu = modell.length > 0 && modell.every((s) => !stand.offen(s.schluessel));

	const pfeil = (schluessel: string, zugeklappt: boolean) => (
		<button
			type="button"
			className="flex w-5 flex-none items-center justify-center rounded-sm text-leise hover:bg-flaeche-2 hover:text-tinte [@media(any-pointer:coarse)]:w-11"
			aria-label={zugeklappt ? 'Aufklappen' : 'Einklappen'}
			aria-expanded={!zugeklappt}
			data-nicht-ziehen
			onClick={() => stand.klappe(schluessel, zugeklappt)}
		>
			<Symbol name={zugeklappt ? 'rechts' : 'runter'} className="size-3 flex-none" />
		</button>
	);

	const zeigeKnoten = (k: GliederungKnoten, tiefe: number) => {
		const hatKinder = k.kinder.length > 0;
		const zugeklappt = hatKinder && !stand.offen(k.schluessel);
		const gezogen = zug?.nr === k.nr ? { opacity: 0.35 } : undefined;
		const tooltip = k.titel === k.name ? k.titel : `${k.name}: ${k.titel}`;
		return (
			<div key={k.schluessel} data-knoten={k.nr}>
				<div
					className={klassen(
						'flex items-stretch rounded-md transition-colors duration-500',
						k.fest && 'text-dezent',
						stand.leuchtet === k.nr && 'bg-brand-100',
						zug?.hinein === k.nr && 'bg-brand-50 outline-2 -outline-offset-2 outline-brand-500',
					)}
					style={{ ...gezogen, marginLeft: tiefe * EINZUG_PX }}
					data-zeile-nr={k.nr}
					data-nr={k.nr}
					data-schluessel={k.schluessel}
					{...(zugeklappt ? { 'data-zu': true } : {})}
					{...(k.aufgabe ? { 'data-gliederung-aufgabe': true } : {})}
					{...(k.fest ? { 'data-gliederung-fest': true } : { 'data-gliederung-zeile': true })}
					{...(k.ziehbar ? { 'data-ziehbar': true } : {})}
					onPointerDown={(e) => druecke(e, false, k, k.ziehbar)}
					onContextMenu={(e) => menue(e, k.nr, 'baustein')}
				>
					{k.ziehbar ? <Griff beschriftung={`${k.art} ziehen`} tabIndex={-1} data-griff-zeile /> : LUECKE}
					{hatKinder ? pfeil(k.schluessel, zugeklappt) : LUECKE}
					<Tooltip text={tooltip}>
						<button
							type="button"
							className="flex h-zeile min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-left select-none hover:bg-flaeche-2 aria-[current=true]:bg-brand-100 aria-[current=true]:text-tinte"
							style={{ WebkitTouchCallout: 'none' }}
							data-gliederung-titel
							aria-current={aktiveZeile === k.nr}
							onClick={() => waehle(k.nr)}
						>
							{k.nummer && (
								<span className="w-3.5 flex-none text-center font-medium text-leise">{k.nummer}</span>
							)}
							<span className="truncate">{k.titel}</span>
						</button>
					</Tooltip>
				</div>
				{hatKinder && !zugeklappt && (
					<div style={gezogen}>{k.kinder.map((c) => zeigeKnoten(c, tiefe + 1))}</div>
				)}
			</div>
		);
	};

	const zeigeSeite = (s: GliederungSeite, i: number) => {
		const name = `Seite ${i + 1}`;
		const zugeklappt = !stand.offen(s.schluessel) || zug?.seite === true;
		const griffDaten = { nr: s.nr, name, art: 'Seite' };
		const anzahl = s.kinder.filter((k) => !k.fest).length;
		return (
			<div
				key={s.id}
				style={zug?.nr === s.nr ? { opacity: 0.35 } : undefined}
				data-knoten={s.nr}
				data-seite-knoten
				data-gliederung-seite={i + 1}
			>
				<div
					className={klassen(
						'flex items-stretch rounded-md font-medium transition-colors duration-500',
						zug?.hinein === s.nr && 'bg-brand-50 outline-2 -outline-offset-2 outline-brand-500',
						stand.leuchtet === s.nr && 'bg-brand-100',
					)}
					data-zeile-nr={s.nr}
					data-nr={s.nr}
					data-schluessel={s.schluessel}
					data-seite-id={s.id}
					{...(zugeklappt ? { 'data-zu': true } : {})}
					data-seite-zeile={i + 1}
					onPointerDown={(e) => druecke(e, true, griffDaten, !festeSeiten)}
					onContextMenu={(e) => menue(e, s.nr, 'miniatur')}
				>
					{festeSeiten ? LUECKE : <Griff beschriftung="Seite ziehen" tabIndex={-1} data-griff-zeile />}
					{pfeil(s.schluessel, zugeklappt)}
					<button
						type="button"
						className="flex h-zeile min-w-0 flex-1 items-center justify-between gap-1 rounded-md px-1 text-left select-none hover:bg-flaeche-2 aria-[current=true]:bg-brand-100"
						style={{ WebkitTouchCallout: 'none' }}
						aria-current={aktiveZeile === s.nr}
						onClick={() => waehle(s.nr)}
					>
						{name}
						{zugeklappt && (
							<span className="font-normal text-leise" data-seite-anzahl>
								{anzahl}
							</span>
						)}
					</button>
				</div>
				{!zugeklappt && s.kinder.map((k) => zeigeKnoten(k, 1))}
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
					onClick={() => stand.setzeAlle(alleSchluessel(modell), alleZu)}
				>
					{alleZu ? 'Alle aufklappen' : 'Alle einklappen'}
				</Knopf>
			</div>
			<div ref={liste} className="min-h-0 flex-1 overflow-y-auto" data-gliederung-liste>
				<div ref={inhalt} className="relative isolate flex flex-col gap-0.5 p-1">
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

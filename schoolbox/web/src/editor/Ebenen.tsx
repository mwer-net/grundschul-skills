import {
	istGestaltung,
	kopiereGestaltungNach,
	leseLage,
	ordneInEbene,
	setzeName,
	verschiebeAufSeite,
	wechsleEbene,
} from '@schoolbox/kern/src/gestaltung';
import type { EbenenName } from '@schoolbox/kern/src/gestaltung-arten';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import { klassenVon, zerlege } from '@schoolbox/kern/src/quelltext';
import type { Ablage, StrukturErgebnis } from '@schoolbox/kern/src/struktur';
import { hatNamenszeile } from '@schoolbox/kern/src/struktur';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { AmZeiger } from '../bausteine/AmZeiger';
import { Griff } from '../bausteine/Griff';
import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Schubladenkopf } from '../bausteine/Schubladenkopf';
import type { SymbolName } from '../bausteine/Symbol';
import { Symbol } from '../bausteine/Symbol';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import { Tooltip } from '../bausteine/Tooltip';
import { folgeZeiger, rolleAmRand, schluckeKlick } from '../bausteine/zeigerzug';
import { bausteinVon, elementZu, nrVon } from './darstellung';
import { EBENEN_ZEICHEN } from './gestaltung/ebenen-zeichen';
import type { GliederungKnoten, GliederungSeite } from './gliederung-modell';
import { alleSchluessel, gliederungVon, ketteZu, ohneWirkung, stapelVon, zeileZurAuswahl } from './gliederung-modell';
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

/** Wohin Gestaltung in den Ebenen kommt: Seite (Nummer der `.seite`), Ebene und wie viele andere davor liegen. */
interface EbenenZiel {
	seite: number;
	ebene: EbenenName;
	platz: number;
}

/** Symbol je Art in den Ebenen (1-ebenen.md, „Beschriftung“); Bausteine haben keins. */
const SYMBOL_DER_ART: Record<string, SymbolName> = {
	figurfrei: 'figuren',
	bildfrei: 'bild',
	form: 'formen',
	formtext: 'sprechblase',
	schmuck: 'schrift',
	schmuckbogen: 'schrift',
	streuung: 'streuung',
	gruppe: 'gruppe',
	stapel: 'stapel',
	hauptstapel: 'stapel',
	seitenrahmen: 'rahmen',
	seitenflaeche: 'flaeche',
	gestaltung: 'funken',
};

const seiteUm = (z: Zerlegung, nr: number) => {
	for (let k = z.knoten[nr]?.eltern ?? null; k; k = k.eltern) {
		if (klassenVon(k).includes('seite')) {
			return k.nr;
		}
	}
	return null;
};

/** Ebene und Platz von vorne des Gestaltungselements `nr`. */
const stelleVon = (quelle: string, nr: number) => {
	const k = zerlege(quelle).knoten[nr];
	const eltern = k?.eltern;
	const geschwister = (eltern?.kinder ?? []).filter(istGestaltung);
	const ebene: EbenenName | null =
		eltern && klassenVon(eltern).includes('ebene')
			? klassenVon(eltern).includes('vorne')
				? 'vorne'
				: 'hinten'
			: null;
	return { ebene, platz: k ? geschwister.length - 1 - geschwister.indexOf(k) : 0 };
};

/**
 * Ziehen in den Ebenen als ein Schritt (101): erst auf die Seite (`verschiebeAufSeite`, die Lage bleibt), dann in die
 * Ebene (`wechsleEbene`, dort ganz vorne), dann Platz für Platz nach hinten (`ordneInEbene`). Mit `kopie` bleibt das
 * Original, und die Kopie liegt an derselben Stelle im Blatt.
 */
export const legeInEbenen = (quelle: string, nr: number, ziel: EbenenZiel, kopie: boolean): StrukturErgebnis => {
	const z = zerlege(quelle);
	const seite = seiteUm(z, nr);
	let r: StrukturErgebnis = { quelle, nr };
	if (kopie) {
		const { x, y } = leseLage(quelle, nr);
		r = kopiereGestaltungNach(
			quelle,
			nr,
			{ x: x ?? null, y: y ?? null },
			ziel.seite === seite ? undefined : ziel.seite,
		);
	} else if (ziel.seite !== seite) {
		r = verschiebeAufSeite(quelle, nr, ziel.seite, {});
	}
	if (r.nr === null) {
		return r;
	}
	if (stelleVon(r.quelle, r.nr).ebene !== ziel.ebene) {
		r = wechsleEbene(r.quelle, r.nr, ziel.ebene);
	}
	for (let i = 0; r.nr !== null && i < 500; i += 1) {
		const { platz } = stelleVon(r.quelle, r.nr);
		if (platz === ziel.platz) {
			break;
		}
		const weiter = ordneInEbene(r.quelle, r.nr, platz < ziel.platz ? 'zurueck' : 'vor');
		// Eine Kopie gleicht dem Original Zeichen für Zeichen: Tauschen die beiden, bleibt die Quelle, nur die Nummer wandert.
		if (weiter.quelle === r.quelle && weiter.nr === r.nr) {
			break;
		}
		r = weiter;
	}
	return r;
};

interface Zug {
	seite: boolean;
	nr: number;
	name: string;
	/** ⌥ beim Ziehen von Gestaltung: Kopie statt Verschieben. */
	kopie: boolean;
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
	/** Nur Gestaltung: wo sie liegt und wohin sie käme (101). */
	gestaltung: (EbenenZiel & { name: string }) | null;
	ziel: EbenenZiel | null;
	kopie: boolean;
}

/** Was das Ziehen von einer Zeile wissen muss. */
interface ZugZeile {
	nr: number;
	name: string;
	art: string;
	zeile?: GliederungKnoten['zeile'];
	lage?: GliederungKnoten['lage'];
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
	/** Stecknadel im Kopf: angeheftet teilen sich die Ebenen die Spalte mit der offenen Schublade. */
	angeheftet: boolean;
	schalteAnheften: () => void;
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
			for (const k of stapelVon(s)) {
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
 * Die Schublade „Ebenen“ (⌥1, bis 093 „Gliederung“): alle Seiten und alles, was sich im Blatt wählen lässt, als Baum. Klick wählt und springt, das Menü
 * ordnet, gezogen wird am Griff, mit der Maus auch von überall in der Zeile. Was im Blatt gewählt ist, ist hier markiert
 * und aufgeklappt. Jede Ablage ist ein Befehl und ein Schritt im Verlauf.
 */
export const Ebenen = ({
	angeheftet,
	auswahl,
	doc,
	festeSeiten,
	kontextmenue,
	schalteAnheften,
	stand,
	struktur,
	zeigeAn,
	zerlegung,
}: Eigenschaften) => {
	const liste = useRef<HTMLDivElement>(null);
	const inhalt = useRef<HTMLDivElement>(null);
	const [zug, setZug] = useState<Zug | null>(null);
	const [umbenennen, setUmbenennen] = useState<number | null>(null);
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

	/**
	 * Wohin Gestaltung unter dem Zeiger käme (101, 1-ebenen.md „Ziehen in den Ebenen“): zwischen zwei Zeilen einer Ebene,
	 * über dem Hauptstapel ganz hinten in „vorne“, darunter ganz vorne in „hinten“, über Rahmen und Fläche ganz hinten in
	 * „hinten“, auf eine andere Seite ganz vorne in derselben Ebene. Bausteine sind (noch) kein Ziel: Anker baut 106.
	 * `null` heißt ungültig, `ziel: null` ohne Wirkung.
	 */
	const gestaltungZiel = (
		l: Lauf,
		von: EbenenZiel,
		zeile: HTMLElement,
		y: number,
	): { ziel: EbenenZiel | null; linie: number | null; hinein: number | null } | null => {
		const nichts = { ziel: null, linie: null, hinein: null };
		const { modell: m } = neu.current;
		const zahl = (seite: number, ebene: EbenenName) =>
			m.find((s) => s.nr === seite)?.kinder.filter((k) => k.zeile === ebene).length ?? 0;
		const b = zeile.getBoundingClientRect();
		const oben = y < b.top + b.height / 2;
		const seite = Number(zeile.dataset.ebeneSeite);
		let ziel: EbenenZiel;
		let linie: number | null;
		let hinein: number | null = null;
		const art = zeile.dataset.zeilenArt;
		if (Number(zeile.dataset.zeileNr) === l.nr) {
			return nichts;
		}
		if (zeile.dataset.seiteZeile !== undefined) {
			const nr = Number(zeile.dataset.zeileNr);
			if (nr === von.seite && !l.kopie) {
				return nichts;
			}
			ziel = { seite: nr, ebene: von.ebene, platz: 0 };
			linie = null;
			hinein = nr;
		} else if (art === 'vorne' || art === 'hinten') {
			const platz = Number(zeile.dataset.platz);
			ziel = { seite, ebene: art, platz: oben ? platz : platz + 1 };
			linie = oben ? b.top : b.bottom;
		} else if (art === 'hauptstapel') {
			const block = zeile.closest<HTMLElement>('[data-knoten]')?.getBoundingClientRect() ?? b;
			ziel = oben ? { seite, ebene: 'vorne', platz: zahl(seite, 'vorne') } : { seite, ebene: 'hinten', platz: 0 };
			linie = oben ? b.top : block.bottom;
		} else if (art === 'seitenrahmen' || art === 'seitenflaeche') {
			const erste = zeile.closest('[data-seite-knoten]')?.querySelector('[data-zeilen-art^="seiten"]') ?? zeile;
			ziel = { seite, ebene: 'hinten', platz: zahl(seite, 'hinten') };
			linie = erste.getBoundingClientRect().top;
		} else {
			return nichts;
		}
		// Ohne sich selbst gezählt: Wer weiter hinten in derselben Ebene landet, rückt um einen Platz auf.
		const gleich = !l.kopie && ziel.seite === von.seite && ziel.ebene === von.ebene;
		if (gleich && ziel.platz > von.platz) {
			ziel = { ...ziel, platz: ziel.platz - 1 };
		}
		if (gleich && ziel.platz === von.platz) {
			return nichts;
		}
		return { ziel, linie, hinein };
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
		if (l.gestaltung) {
			const f = flaeche.getBoundingClientRect();
			const t = gestaltungZiel(l, l.gestaltung, zeile, y);
			l.ziel = t?.ziel ?? null;
			setze(
				null,
				t?.linie === undefined || t.linie === null
					? null
					: { oben: t.linie - f.top, links: zeile.getBoundingClientRect().left - f.left },
				t?.hinein ?? null,
				t === null,
				null,
			);
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
		if (l.gestaltung) {
			if (ablegen) {
				beendeGestaltung(l);
			}
			return;
		}
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

	/** Gestaltung ablegen: ein Schritt, gewählt ist danach das Verschobene bzw. die Kopie. */
	const beendeGestaltung = (l: Lauf) => {
		const jetzt = neu.current;
		const ziel = l.ziel;
		if (!ziel || !jetzt.aktuell || jetzt.zerlegung?.quelle !== l.quelle) {
			return;
		}
		jetzt.stand.eigene.current = { leuchten: true };
		const beschreibung = `${l.gestaltung?.name ?? l.art} ${l.kopie ? 'kopiert' : 'verschoben'}`;
		if (!jetzt.struktur.fuehreAus(beschreibung, (q) => legeInEbenen(q, l.nr, ziel, l.kopie), false, true)) {
			jetzt.stand.eigene.current = { leuchten: false };
		}
	};

	const beginne = (seite: boolean, zeile: ZugZeile, x: number, y: number, alt: boolean) => {
		const { aktuell: bereit, doc: d, modell: m, zerlegung: z } = neu.current;
		if (!z || !d || !bereit) {
			return;
		}
		const ebene = zeile.zeile === 'vorne' || zeile.zeile === 'hinten' ? zeile.zeile : null;
		const gestaltung = ebene && zeile.lage ? { ...zeile.lage, ebene, name: zeile.name } : null;
		const ziele =
			seite || gestaltung
				? {
						neben: new Set(gestaltung ? [] : m.map((s) => s.nr).filter((n) => n !== zeile.nr)),
						hinein: new Set<number>(),
					}
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
			gestaltung,
			ziel: null,
			kopie: Boolean(gestaltung) && alt,
		};
		document.body.setAttribute('data-zieht', '');
		// Steht der Fokus im Blatt, käme Esc dort an und nicht hier.
		if (document.activeElement instanceof HTMLIFrameElement) {
			document.activeElement.blur();
		}
		setZug({ seite, nr: zeile.nr, name: zeile.name, kopie: Boolean(gestaltung) && alt, x, y, marke: null, hinein: null });
	};

	/** ⌥ kopiert Gestaltung; drücken oder loslassen schaltet mitten im Zug um. */
	const schalteKopie = (alt: boolean) => {
		const l = lauf.current;
		if (l?.gestaltung && l.kopie !== alt) {
			l.kopie = alt;
			setZug((z) => (z ? { ...z, kopie: alt } : z));
		}
	};

	const druecke = (
		e: ReactPointerEvent,
		seite: boolean,
		zeile: ZugZeile,
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
					beginne(seite, zeile, x, y, m.altKey);
				}
				schalteKopie(m.altKey);
			},
			los: (m) => {
				const l = lauf.current;
				if (l) {
					schalteKopie(m.altKey);
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
				if (k.key === 'Alt') {
					schalteKopie(true);
				}
				if (k.key === 'Escape' && lauf.current) {
					k.preventDefault();
					k.stopPropagation();
					schluckeKlick();
					beende(false);
					fertig();
				}
			},
			tasteLos: (k) => {
				if (k.key === 'Alt') {
					schalteKopie(false);
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

	/** Umbenennen (101): `data-name`; leer entfernt ihn, dann gilt wieder der Name aus der Art. */
	const benenne = (k: GliederungKnoten, text: string) => {
		setUmbenennen(null);
		const neuerName = text.trim();
		if (neuerName === (k.eigenerName ?? '') || (!k.eigenerName && neuerName === k.titel)) {
			return;
		}
		struktur.aendereAttribute(neuerName ? 'Umbenannt' : 'Name entfernt', (q) =>
			setzeName(q, k.nr, neuerName || null),
		);
	};

	/** Auge, Schloss und was spätere Tickets eintragen (`EBENEN_ZEICHEN`), rechts in der Zeile. */
	const zeichenVon = (k: GliederungKnoten, aktiv: boolean) => {
		const element = doc && (k.zeile === 'vorne' || k.zeile === 'hinten') ? elementZu(doc, k.nr) : null;
		if (!element) {
			return null;
		}
		const zeichen = EBENEN_ZEICHEN.filter((z) => z.fuer(element)).map((z) => ({ z, an: z.gesetzt(element) }));
		const kontext = { nr: k.nr, element, struktur, zeigeAn };
		const schalter = zeichen.filter(({ z }) => z.schalter);
		return (
			<span className="flex flex-none items-center pr-0.5" data-nicht-ziehen>
				{zeichen
					.filter(({ an, z }) => an || z.schalter)
					.map(({ an, z }) => (
						<Tooltip key={z.id} text={z.titel(an)}>
							<button
								type="button"
								className={klassen(
									'flex size-6 items-center justify-center rounded-sm text-leise hover:bg-flaeche-2 hover:text-tinte focus-visible:opacity-100 [@media(any-pointer:coarse)]:pointer-events-none',
									!an && !aktiv && 'opacity-0 group-hover:opacity-100',
									!an && '[@media(any-pointer:coarse)]:hidden',
								)}
								aria-label={z.titel(an)}
								aria-pressed={z.schalter ? an : undefined}
								data-ebenen-zeichen={z.id}
								{...(an ? { 'data-gesetzt': true } : {})}
								disabled={!aktuell}
								onClick={() => z.klick(kontext, an)}
							>
								<Symbol name={z.symbol(an)} className="size-3.5 flex-none" />
							</button>
						</Tooltip>
					))}
				{schalter.length > 0 && (
					<span className="hidden [@media(any-pointer:coarse)]:flex" data-ebenen-mehr>
						<Menue
							name={`${k.name}: mehr`}
							disabled={!aktuell}
							ausloeser={
								<button
									type="button"
									className="flex size-11 items-center justify-center rounded-sm text-leise"
								>
									<Symbol name="mehr" className="size-4 flex-none" />
								</button>
							}
							eintraege={schalter.map(({ an, z }) => ({
								titel: z.titel(an),
								symbol: z.symbol(!an),
								waehle: () => z.klick(kontext, an),
							}))}
						/>
					</span>
				)}
			</span>
		);
	};

	const zeigeKnoten = (k: GliederungKnoten, tiefe: number, seite: number): ReactNode => {
		const hatKinder = k.kinder.length > 0;
		const zugeklappt = hatKinder && !stand.offen(k.schluessel);
		const gezogen = zug?.nr === k.nr ? { opacity: 0.35 } : undefined;
		const tooltip = k.titel === k.name ? k.titel : `${k.name}: ${k.titel}`;
		const symbol = k.zeile === 'baustein' ? undefined : SYMBOL_DER_ART[k.kennung];
		const istGestaltungZeile = k.zeile === 'vorne' || k.zeile === 'hinten';
		const aktiv = aktiveZeile === k.nr;
		const hauptstapel = k.zeile === 'hauptstapel';
		// Der Hauptstapel hat kein eigenes Element: Sein Klick wählt die Seite.
		const waehleZeile = () => waehle(hauptstapel ? seite : k.nr);
		return (
			<div key={k.schluessel} data-knoten={k.nr}>
				<div
					className={klassen(
						'group flex items-stretch rounded-md transition-colors duration-500',
						k.fest && 'text-dezent',
						stand.leuchtet === k.nr && 'bg-brand-100',
						zug?.hinein === k.nr && 'bg-brand-50 outline-2 -outline-offset-2 outline-brand-500',
					)}
					style={{ ...gezogen, marginLeft: tiefe * EINZUG_PX }}
					data-zeile-nr={k.nr}
					data-nr={k.nr}
					data-schluessel={k.schluessel}
					data-zeilen-art={k.zeile}
					{...(k.zeile === 'baustein' ? {} : { 'data-ebene-seite': seite })}
					{...(k.lage ? { 'data-platz': k.lage.platz } : {})}
					{...(k.aus ? { 'data-aus': true } : {})}
					{...(k.gesperrt ? { 'data-gesperrt': true } : {})}
					{...(zugeklappt ? { 'data-zu': true } : {})}
					{...(k.aufgabe ? { 'data-gliederung-aufgabe': true } : {})}
					{...(k.fest ? { 'data-gliederung-fest': true } : { 'data-gliederung-zeile': true })}
					{...(k.ziehbar ? { 'data-ziehbar': true } : {})}
					onPointerDown={(e) => druecke(e, false, k, k.ziehbar)}
					onContextMenu={(e) => (hauptstapel ? e.preventDefault() : menue(e, k.nr, 'baustein'))}
				>
					{k.ziehbar ? <Griff beschriftung={`${k.art} ziehen`} tabIndex={-1} data-griff-zeile /> : LUECKE}
					{hatKinder ? pfeil(k.schluessel, zugeklappt) : LUECKE}
					{umbenennen === k.nr ? (
						<input
							autoFocus
							className="h-zeile min-w-0 flex-1 rounded-md border border-brand-500 bg-white px-1 outline-none"
							aria-label="Name in den Ebenen"
							defaultValue={k.eigenerName ?? k.titel}
							data-nicht-ziehen
							data-umbenennen
							onFocus={(e) => e.currentTarget.select()}
							onBlur={(e) => benenne(k, e.currentTarget.value)}
							onKeyDown={(e) => {
								e.stopPropagation();
								if (e.key === 'Enter') {
									e.preventDefault();
									e.currentTarget.blur();
								} else if (e.key === 'Escape') {
									e.preventDefault();
									setUmbenennen(null);
								}
							}}
						/>
					) : (
						<Tooltip text={istGestaltungZeile ? `${tooltip} · Doppelklick benennt um` : tooltip}>
							<button
								type="button"
								className="flex h-zeile min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 text-left select-none hover:bg-flaeche-2 aria-[current=true]:bg-brand-100 aria-[current=true]:text-tinte"
								style={{ WebkitTouchCallout: 'none' }}
								data-gliederung-titel
								aria-current={aktiv}
								onClick={waehleZeile}
								onDoubleClick={() => {
									if (istGestaltungZeile && aktuell) {
										setUmbenennen(k.nr);
									}
								}}
							>
								{k.nummer && (
									<span className="w-3.5 flex-none text-center font-medium text-leise">{k.nummer}</span>
								)}
								{symbol && (
									<Symbol
										name={symbol}
										className={klassen('size-3.5 flex-none text-leise', k.aus && 'opacity-50')}
									/>
								)}
								<span className={klassen('truncate', k.aus && 'opacity-50')}>{k.titel}</span>
								{hauptstapel && (
									<span className="ml-auto flex-none pr-1 text-xs text-leise">fließt</span>
								)}
							</button>
						</Tooltip>
					)}
					{istGestaltungZeile && zeichenVon(k, aktiv)}
				</div>
				{hatKinder && !zugeklappt && (
					<div style={gezogen}>{k.kinder.map((c) => zeigeKnoten(c, tiefe + 1, seite))}</div>
				)}
			</div>
		);
	};

	const zeigeSeite = (s: GliederungSeite, i: number) => {
		const name = `Seite ${i + 1}`;
		const zugeklappt = !stand.offen(s.schluessel) || zug?.seite === true;
		const griffDaten = { nr: s.nr, name, art: 'Seite' };
		const anzahl = stapelVon(s).filter((k) => !k.fest).length;
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
				{!zugeklappt && s.kinder.map((k) => zeigeKnoten(k, 1, s.nr))}
			</div>
		);
	};

	return (
		<nav aria-label="Ebenen" className="flex min-h-0 flex-1 flex-col" data-seitenleiste data-gliederung>
			<Schubladenkopf titel="Ebenen">
				<Knopf
					art="leise"
					groesse="klein"
					className="text-xs"
					onClick={() => stand.setzeAlle(alleSchluessel(modell), alleZu)}
				>
					{alleZu ? 'Alle aufklappen' : 'Alle einklappen'}
				</Knopf>
				<SymbolKnopf
					symbol={angeheftet ? 'abheften' : 'anheften'}
					beschriftung={angeheftet ? 'Ebenen lösen' : 'Ebenen anheften'}
					tooltip={
						angeheftet ? 'Ebenen lösen' : 'Ebenen anheften: bleiben unter jeder anderen Schublade offen'
					}
					groesse="klein"
					aria-pressed={angeheftet}
					data-ebenen-anheften
					onClick={schalteAnheften}
				/>
			</Schubladenkopf>
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
						{zug.kopie ? `${zug.name} (Kopie)` : zug.name}
					</span>
				</AmZeiger>
			)}
		</nav>
	);
};

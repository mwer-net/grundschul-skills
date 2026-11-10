import { leseLage, setzeLage } from '@schoolbox/kern/src/gestaltung';
import { drehungImBereich } from '@schoolbox/kern/src/gestaltung-inspektor';
import type { KeyboardEvent } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

import { klassen } from '../../../bausteine/klassen';
import { Knopf } from '../../../bausteine/Knopf';
import { Menue } from '../../../bausteine/Menue';
import { Symbol } from '../../../bausteine/Symbol';
import type { PfadTeil } from '../../darstellung';
import type { Einblendung } from '../../Leinwand';
import { useSichtfeld } from '../../sichtfeld';
import type { Struktur } from '../../struktur';
import type { Befehle } from '../../useBefehle';
import { DREH_ABSTAND } from '../auswahlrahmen';
import type { GestaltungKontext } from '../inspektor/kontext-ersatz';
import { kontextFuerGestaltung, liegtFreiAuf } from '../inspektor/kontext-ersatz';
import { LEISTEN } from './index';
import { mehrEintraege } from './mehr';

interface Eigenschaften {
	e: Einblendung;
	pfad: PfadTeil[];
	quelle: string | null;
	struktur: Struktur;
	befehle: Befehle;
	/** In der Textsitzung bleibt die Bausteinleiste mit „Fertig“; diese Leiste weicht. */
	sitzung: boolean;
}

const ABSTAND = 6;

const Trenner = () => <span aria-hidden className="mx-0.5 h-4 w-px flex-none bg-rand" />;

/**
 * Über dem Element, sonst darunter, sonst oben im Sichtfeld; waagerecht mittig und immer ganz sichtbar. Oben bleibt
 * der Drehgriff des Rahmens (`DREH_ABSTAND` über dem Element) frei.
 */
const lageVon = (
	box: { links: number; rechts: number; oben: number; unten: number },
	mass: { breite: number; hoehe: number },
	sicht: { links: number; rechts: number; oben: number; unten: number },
) => {
	const oben = box.oben - DREH_ABSTAND - mass.hoehe - ABSTAND;
	const unten = box.unten + ABSTAND;
	let top = sicht.oben + ABSTAND;
	if (oben >= sicht.oben + ABSTAND) {
		top = oben;
	} else if (unten + mass.hoehe <= sicht.unten - ABSTAND) {
		top = unten;
	}
	const wunsch = (box.links + box.rechts - mass.breite) / 2;
	return { links: Math.max(sicht.links + ABSTAND, Math.min(wunsch, sicht.rechts - mass.breite - ABSTAND)), top };
};

const tasten = (ereignis: KeyboardEvent<HTMLDivElement>, doc: Document) => {
	const ziel = ereignis.target as HTMLElement;
	if (ereignis.key === 'Escape') {
		ereignis.preventDefault();
		doc.defaultView?.focus();
		return;
	}
	if (!['ArrowLeft', 'ArrowRight'].includes(ereignis.key) || ziel.tagName !== 'BUTTON') {
		return;
	}
	ereignis.preventDefault();
	const alle = [...ereignis.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select, input')];
	const schritt = ereignis.key === 'ArrowRight' ? 1 : -1;
	alle[(alle.indexOf(ziel) + schritt + alle.length) % alle.length]?.focus();
};

/** Ein Schritt um 90° nach rechts; die Geste hat der Drehgriff (097). */
const drehe = (k: GestaltungKontext) =>
	k.fuehreAus('Gedreht', (q) => ({
		quelle: setzeLage(q, k.nr, { drehen: drehungImBereich((leseLage(q, k.nr).drehen ?? 0) + 90) }),
		nr: k.nr,
	}));

const MEHR_KNOPF = (
	<Knopf art="leise" groesse="klein" className="size-knopf-klein px-0">
		<Symbol name="mehr" />
	</Knopf>
);

/**
 * Leiste am gewählten Gestaltungselement (099, Briefing 5.7): die Knöpfe der Art aus `LEISTEN`, „Drehen“, ⋯. Sie
 * ersetzt die Bausteinleiste; gedrehte Elemente nehmen das umschließende Rechteck.
 */
export const Leiste = ({ befehle, e, pfad, quelle, sitzung, struktur }: Eigenschaften) => {
	const leiste = useRef<HTMLDivElement>(null);
	const [mass, setMass] = useState({ breite: 200, hoehe: 30 });
	const sicht = useSichtfeld(e.doc);
	const k = kontextFuerGestaltung({ doc: e.doc, pfad, struktur });
	const da = Boolean(k && liegtFreiAuf(k.baustein) && e.box && sicht && quelle && struktur.aktiv && !sitzung);

	useLayoutEffect(() => {
		const element = leiste.current;
		if (!element) {
			return;
		}
		const { offsetHeight: hoehe, offsetWidth: breite } = element;
		setMass((alt) => (alt.breite === breite && alt.hoehe === hoehe ? alt : { breite, hoehe }));
	}, [da, k?.nr, quelle, e.skala]);

	if (!da || !k || !e.box || !sicht || quelle === null) {
		return null;
	}

	const box = {
		links: e.links + e.box.left * e.skala,
		rechts: e.links + e.box.right * e.skala,
		oben: e.box.top * e.skala,
		unten: e.box.bottom * e.skala,
	};
	const { links, top } = lageVon(box, mass, sicht);
	const mehrfach = k.nrn.length > 1; // 113
	const Knoepfe = LEISTEN[mehrfach ? 'mehrfach' : k.art] ?? null;
	const name = pfad.at(-1)?.name ?? k.baustein.name;

	return (
		<div
			ref={leiste}
			className={klassen(
				'absolute z-ueberlagerung flex min-h-[30px] items-center gap-0.5 rounded-[7px] border border-rand bg-flaeche px-1 whitespace-nowrap shadow-1',
				e.zieht && 'invisible',
			)}
			role="toolbar"
			aria-label={`Leiste für ${name}`}
			data-gestaltungsleiste={mehrfach ? 'mehrfach' : k.art}
			style={{ left: links, top }}
			onKeyDown={(ereignis) => tasten(ereignis, e.doc)}
		>
			{Knoepfe && (
				<>
					<Knoepfe k={k} befehle={befehle} quelle={quelle} aktiv={struktur.aktiv} />
					<Trenner />
				</>
			)}
			{/* 107: Eine Linie hat keine Drehung. */}
			{!mehrfach && !k.element.matches('svg.form[data-form="linie"]') && (
				<Knopf art="leise" groesse="klein" data-drehen onClick={() => drehe(k)}>
					<Symbol name="drehen" />
					Drehen
				</Knopf>
			)}
			<Menue name={`Mehr zu ${name}`} rechtsbuendig ausloeser={MEHR_KNOPF} eintraege={mehrEintraege(befehle)} />
		</div>
	);
};

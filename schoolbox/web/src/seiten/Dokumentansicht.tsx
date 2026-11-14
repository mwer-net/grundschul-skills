import type { Druckprofil } from '@schoolbox/kern/src/werte';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { Blattansicht } from '../bausteine/Blattansicht';
import { Gekuerzt } from '../bausteine/Gekuerzt';
import { useHinweis } from '../bausteine/hinweis';
import { Marke } from '../bausteine/Kachel';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import type { MenueEintrag } from '../bausteine/Menue';
import { Menue } from '../bausteine/Menue';
import { ProfilSchalter } from '../bausteine/ProfilSchalter';
import { Segment } from '../bausteine/Segment';
import { Symbol } from '../bausteine/Symbol';
import type { PalettenEintrag } from '../editor/palette-suche';
import { hatOffeneEntwuerfe } from '../entwuerfe/offen';
import { useEreignisse } from '../ereignisse';
import { useInhalt } from '../lib/inhalt';
import { useAnsichtsProfil } from '../lib/profil';
import { useMeldeSeitenbefehle } from '../lib/seitenbefehle';
import { anzahl, ART_NAME, FORMAT_NAME } from '../lib/text';
import { useTitel } from '../lib/titel';
import type { Zugang } from '../lib/zugang';
import {
	ansichtAdresse,
	editorSeite,
	entwuerfeSeite,
	istGeteilt,
	mappenSeite,
	praesentationSeite,
} from '../lib/zugang';
import { useOrdnerDesDokuments } from '../ordner/kontext';
import { PdfKnopf } from '../pdf/PdfKnopf';
import { dokumentWahl, materialName } from '../pdf/wahl';
import { SOFORT, vollbildFuerSofort } from '../praesentation/laufzeit';
import { TeilenDialog } from '../teilen/TeilenDialog';
import type { DokumentEintrag, Mappe } from '../typen';
import { MaterialFehlt, NICHT_GEFUNDEN } from './NichtGefunden';

interface Eigenschaften {
	zugang: Zugang;
	dok: string;
	/** Link zurück zur Mappe; nicht bei einem Teilen-Link auf genau dieses Dokument. */
	zurueckZurMappe: boolean;
}

const MEHR_KNOPF = (
	<Knopf art="zweit" className="size-knopf">
		<Symbol name="mehr" />
	</Knopf>
);

const Druckhinweise = ({ liste }: { liste: string[] }) => (
	<div className="mt-3 flex items-start gap-3 rounded-lg border border-entwurf bg-warnung-hell px-4 py-2">
		<Symbol name="drucker" className="mt-0.5 size-4 flex-none" />
		<div>
			<h2 className="sr-only">Druckhinweise</h2>
			<ul className="flex flex-col gap-1 font-medium">
				{liste.map((hinweis) => (
					<li key={hinweis}>{hinweis}</li>
				))}
			</ul>
		</div>
	</div>
);

interface KnoepfeEigenschaften {
	zugang: Zugang;
	dokument: DokumentEintrag;
	mappe: Mappe;
	profil: Druckprofil | undefined;
	/** Es gibt Entwürfe, und die Lehrkraft darf sie sehen (kein Teilen-Link). */
	entwuerfe: boolean;
	teilen: () => void;
}

/** „Bearbeiten“ sagt dem Editor, dass man aus der Ansicht kommt (191-46, 193-08). */
export const AUS_ANSICHT = { ausAnsicht: true } as const;

/** ⌘P und ⌘K → „PDF“ tun dasselbe wie ein Klick auf den Knopf (191-05). */
const klickePdf = () => document.querySelector<HTMLElement>('[data-pdf-knopf] button')?.click();

/**
 * Was sich mit dem Dokument tun lässt. Bei Folien ist Präsentieren das Wichtigste, sonst Bearbeiten. Der Teilen-Link
 * hat kein ⋯: Teilen und Hilfe gibt es dort nicht (191-42).
 */
const Knoepfe = ({ dokument, entwuerfe, mappe, profil, teilen, zugang }: KnoepfeEigenschaften) => {
	const { id: dok, meta } = dokument;
	const geteilt = istGeteilt(zugang);
	const praesentieren = meta.format === 'folie';
	const navigate = useNavigate();
	const eintraege: MenueEintrag[] = [
		...(entwuerfe
			? [
					{
						titel: 'Entwürfe',
						symbol: 'kopieren' as const,
						waehle: () => void navigate(entwuerfeSeite(zugang, dok)),
					},
				]
			: []),
		{ titel: 'Teilen', symbol: 'teilen', waehle: teilen },
		{ titel: 'Hilfe', symbol: 'hilfe', waehle: () => void navigate('/hilfe') },
	];
	return (
		<div className="ml-auto flex flex-none flex-wrap items-center gap-1.5 max-md:ml-0">
			{!geteilt && (
				<KnopfLink
					to={editorSeite(zugang, dok)}
					// 193-08: Der Zurück-Pfeil im Editor geht dann einen Schritt im Verlauf zurück.
					state={AUS_ANSICHT}
					art={praesentieren ? 'zweit' : 'haupt'}
				>
					<Symbol name="stift" />
					Bearbeiten
				</KnopfLink>
			)}
			{praesentieren && (
				<KnopfLink to={praesentationSeite(zugang, dok)} state={SOFORT} onClick={vollbildFuerSofort}>
					<Symbol name="praesentieren" />
					Präsentieren
				</KnopfLink>
			)}
			<span className="contents" data-pdf-knopf>
				<PdfKnopf
					art={geteilt && !praesentieren ? 'haupt' : 'zweit'}
					beschriftung="PDF"
					wahl={dokumentWahl(zugang, dokument, profil)}
					mappe={mappe}
					warnen={!geteilt}
					echteMasse={dokument.echteMasse}
					rechtsbuendig
				/>
			</span>
			{!geteilt && <Menue name="Weitere Aktionen" rechtsbuendig eintraege={eintraege} ausloeser={MEHR_KNOPF} />}
		</div>
	);
};

/** Die Befehle der Ansicht in ⌘K (191 Urteil 5). */
const useBefehleDerAnsicht = (zugang: Zugang, dokument: DokumentEintrag | undefined, teilen: () => void) => {
	const navigate = useNavigate();
	const geteilt = istGeteilt(zugang);
	const liste = useMemo<PalettenEintrag[]>(() => {
		if (!dokument || geteilt || hatOffeneEntwuerfe(dokument.meta)) {
			return [];
		}
		const { id: dok, meta } = dokument;
		const gruppe = 'Dieses Material';
		return [
			{
				id: 'ansicht:bearbeiten',
				titel: 'Bearbeiten',
				gruppe,
				symbol: 'stift',
				start: true,
				suchwoerter: ['editor', 'ändern'],
				aus: () => void navigate(editorSeite(zugang, dok), { state: AUS_ANSICHT }),
			},
			...(meta.format === 'folie'
				? [
						{
							id: 'ansicht:praesentieren',
							titel: 'Präsentieren',
							gruppe,
							symbol: 'praesentieren' as const,
							start: true,
							suchwoerter: ['folien', 'beamer', 'vollbild'],
							aus: () => {
								vollbildFuerSofort();
								void navigate(praesentationSeite(zugang, dok), { state: SOFORT });
							},
						},
					]
				: []),
			{
				id: 'ansicht:pdf',
				titel: 'PDF',
				gruppe,
				symbol: 'herunterladen',
				start: true,
				suchwoerter: ['drucken', 'herunterladen', 'lösung'],
				aus: klickePdf,
			},
			{
				id: 'ansicht:teilen',
				titel: 'Teilen',
				gruppe,
				symbol: 'teilen',
				start: true,
				suchwoerter: ['link', 'kollegin'],
				aus: teilen,
			},
		];
	}, [dokument, geteilt, navigate, teilen, zugang]);
	useMeldeSeitenbefehle(liste);
};

interface LeisteEigenschaften {
	zurueck: { adresse: string; name: string } | null;
	/** Titel und Angaben, links neben dem Zurück-Knopf. */
	titel?: ReactNode;
	children?: ReactNode;
}

/**
 * Die mitlaufende Leiste. Sie steht schon, bevor die Daten da sind (191-20): Zurück-Knopf und eine leere Zeile in
 * voller Höhe.
 */
const Leiste = ({ children, titel, zurueck }: LeisteEigenschaften) => (
	<div className="sticky top-[var(--kopf,0px)] z-kopf -mx-4 flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b border-rand bg-flaeche px-4 py-0.5">
		<div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
			{zurueck && (
				<>
					<KnopfLink to={zurueck.adresse} art="leise" className="-ml-2.5 max-w-52 min-w-0 flex-none text-leise">
						<Symbol name="zurueck" />
						<Gekuerzt text={zurueck.name} />
					</KnopfLink>
					<span aria-hidden className="text-dezent">
						/
					</span>
				</>
			)}
			{titel}
		</div>
		{children}
	</div>
);

/**
 * Ein Dokument ansehen, als PDF herunterladen und teilen; für die Lehrkraft und genauso hinter Teilen-Links. Ändert
 * Claude das Material, lädt die Ansicht von selbst neu.
 */
export const Dokumentansicht = ({ dok, zugang, zurueckZurMappe }: Eigenschaften) => {
	const geteilt = istGeteilt(zugang);
	const { daten, fehler, neuLaden, ortVon } = useInhalt(zugang);
	const [suche, setSuche] = useSearchParams();
	const [stand, setStand] = useState(0);
	const [teilen, setTeilen] = useState(false);
	const zeige = useHinweis();
	const dokument = daten?.dokumente.find((d) => d.id === dok);
	const zurueckOrt = useOrdnerDesDokuments(geteilt ? null : zugang.mappe, dok);
	useTitel(dokument?.meta.titel ?? (fehler || daten ? NICHT_GEFUNDEN : undefined));
	const ansicht = useAnsichtsProfil(zugang, dok, dokument?.meta);
	const oeffneTeilen = useMemo(() => () => setTeilen(true), []);
	useBefehleDerAnsicht(zugang, dokument, oeffneTeilen);

	useEreignisse(({ dok: geaendert, mappe, typ, wieder }) => {
		if (typ === 'dokument-geaendert' && mappe === zugang.mappe && geaendert === dok) {
			setStand((n) => n + 1);
			neuLaden();
			zeige({ text: 'Aktualisiert: Das Material wurde gerade geändert.' });
		} else if ((typ === 'verbunden' && wieder) || (typ === 'mappe-entfernt' && mappe === zugang.mappe)) {
			// Während die Verbindung weg war, kann sich etwas geändert haben.
			setStand((n) => n + 1);
			neuLaden();
		}
	}, !geteilt);

	// ⌘P druckt nicht die Webseite samt Leiste, sondern öffnet „PDF“ wie im Editor (191-05).
	const bereit = Boolean(dokument);
	useEffect(() => {
		if (!bereit) {
			return undefined;
		}
		const taste = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'p') {
				e.preventDefault();
				klickePdf();
			}
		};
		window.addEventListener('keydown', taste);
		return () => window.removeEventListener('keydown', taste);
	}, [bereit]);

	const geteilterOrt = zurueckZurMappe && geteilt ? ortVon(dok) : null;
	const zurueck = !zurueckZurMappe
		? null
		: geteilterOrt
			? geteilterOrt
			: zurueckOrt
				? zurueckOrt
				: daten
					? { adresse: mappenSeite(zugang), name: daten.mappe.titel }
					: { adresse: geteilt ? mappenSeite(zugang) : '/', name: '' };

	if (!daten || !dokument) {
		if (!fehler && !daten) {
			return (
				<>
					<Leiste zurueck={zurueck} />
					<div className="mt-2" data-ansicht-laedt>
						<div className="flex h-[60vh] items-center justify-center rounded-2xl bg-leinwand text-leise">
							<Symbol name="laden" className="size-6 animate-spin" />
						</div>
					</div>
				</>
			);
		}
		return <MaterialFehlt fehler={fehler} geteilt={geteilt} />;
	}

	const { mappe } = daten;
	const { meta } = dokument;
	// Offene Entwürfe sind noch kein Blatt: Die Adresse führt zur Wahl (191-02).
	if (!geteilt && hatOffeneEntwuerfe(meta)) {
		return <Navigate replace to={entwuerfeSeite(zugang, dok)} />;
	}
	const loesung = meta.hatLoesung && suche.get('fassung') === 'loesung';
	const entwuerfe = !geteilt && meta.entwuerfe.length > 0;
	const zeigeLoesung = (ja: boolean) => setSuche(ja ? { fassung: 'loesung' } : {}, { replace: true });
	const { profil } = ansicht;
	const folie = meta.format === 'folie';

	return (
		<>
			<Leiste
				zurueck={zurueck}
				titel={
					<>
						<h1
							className={`flex min-w-0 items-center gap-2 text-sm font-semibold ${zurueck ? 'ml-[11px]' : ''}`}
						>
							<Gekuerzt text={meta.titel} />
							{meta.status === 'entwurf' && <Marke>Entwurf</Marke>}
						</h1>
						<p className="ml-1 truncate text-xs text-leise max-lg:hidden">
							{[
								ART_NAME[meta.art],
								FORMAT_NAME[meta.format],
								...(meta.seiten > 0
									? [folie ? anzahl(meta.seiten, 'Folie', 'Folien') : anzahl(meta.seiten, 'Seite', 'Seiten')]
									: []),
							].join(' · ')}
						</p>
					</>
				}
			>
				<div className="flex flex-none items-center gap-1.5">
					{meta.hatLoesung && (
						<Segment
							beschriftung="Was zeigen?"
							werte={[
								{ wert: 'material', titel: materialName(dokument) },
								{ wert: 'loesung', titel: 'Lösung' },
							]}
							wert={loesung ? 'loesung' : 'material'}
							waehle={(w) => zeigeLoesung(w === 'loesung')}
						/>
					)}
					<ProfilSchalter profil={profil} waehle={ansicht.waehle} />
				</div>
				<Knoepfe
					zugang={zugang}
					dokument={dokument}
					mappe={mappe}
					profil={profil}
					entwuerfe={entwuerfe}
					teilen={oeffneTeilen}
				/>
			</Leiste>

			{meta.druckhinweise.length > 0 && <Druckhinweise liste={meta.druckhinweise} />}
			<div className="mt-2">
				<Blattansicht
					adresse={ansichtAdresse(zugang, dok, loesung, profil)}
					stand={stand}
					titel={loesung ? `${meta.titel} (Lösung)` : meta.titel}
				/>
			</div>
			{teilen && <TeilenDialog mappe={mappe} dokument={dokument} schliessen={() => setTeilen(false)} />}
		</>
	);
};

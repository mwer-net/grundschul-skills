import { gestaltungArtNach } from '@schoolbox/kern/src/gestaltung-arten';

import type { PfadTeil } from '../darstellung';
import { elementZu } from '../darstellung';
import type { Einblendung } from '../Leinwand';
import type { Struktur } from '../struktur';
import { useAblageLinien } from './ablage-linien';
import { Auswahlrahmen, MehrfachRahmen } from './auswahlrahmen';
import { Druckrand } from './druckrand';
import { Durchblick } from './durchblick';
import { griffeFuer } from './geste';
import { ZUSATZ_GRIFFE } from './griffe';
import { Hilfslinien } from './hilfslinien';
import { istGestaltungElement } from './kontext';
import { alsKasten, elementeZu, nrnFuer, rechteckVon, umschliessend, useMehrfach } from './mehrfach';
import { usePfadModus } from './pfad-modus'; // 116
import { PfadPunkte } from './pfad-punkte'; // 116
import type { Flaeche, Messung } from './useGeste';
import { messe, useGeste } from './useGeste';
import { WertAmZeiger } from './wert-am-zeiger';

interface Eigenschaften {
	e: Einblendung;
	pfad: PfadTeil[];
	struktur: Pick<Struktur, 'aktiv' | 'fuehreAus'>;
	waehle: (nr: number | null) => void;
	textsitzung: boolean;
}

/** 106: Rahmen um das Ziel eines Zusatzgriffs und eine Linie vom Griff zum Zeiger (Anker). Koordinaten des Materials. */
const ZusatzAnzeige = ({
	links,
	skala,
	von,
	zeiger,
	ziel,
}: {
	links: number;
	skala: number;
	von: { x: number; y: number } | null;
	zeiger: { x: number; y: number };
	ziel: Flaeche | null;
}) => (
	<>
		{ziel && (
			<div
				className="pointer-events-none absolute z-ueberlagerung rounded-sm outline-2 outline-offset-2 outline-brand-500"
				data-zusatz-ziel
				style={{
					left: links + ziel.links * skala,
					top: ziel.oben * skala,
					width: ziel.breite * skala,
					height: ziel.hoehe * skala,
				}}
			/>
		)}
		{von && (
			<div
				className="pointer-events-none absolute z-ueberlagerung h-0 origin-left border-t-[1.5px] border-dashed border-brand-500"
				data-zusatz-linie
				style={{
					left: links + von.x * skala,
					top: von.y * skala,
					width: Math.hypot(zeiger.x - von.x, zeiger.y - von.y) * skala,
					transform: `rotate(${Math.atan2(zeiger.y - von.y, zeiger.x - von.x)}rad)`,
				}}
			/>
		)}
	</>
);

const Aufzug = ({ flaeche, links, skala }: { flaeche: Flaeche; links: number; skala: number }) => (
	<div
		className="pointer-events-none absolute z-ueberlagerung border border-brand-500 bg-brand-500/10"
		data-aufzug
		style={{
			left: links + flaeche.links * skala,
			top: flaeche.oben * skala,
			width: flaeche.breite * skala,
			height: flaeche.hoehe * skala,
		}}
	/>
);

type Stand = NonNullable<ReturnType<typeof useGeste>['stand']>;

const GestenLinien = ({ links, skala, stand }: { links: number; skala: number; stand: Stand }) => (
	<>
		{stand.seite && <Druckrand links={links} seite={stand.seite} skala={skala} />}
		<Hilfslinien links={links} skala={skala} ursprung={stand.ursprung} linien={stand.linien} />
	</>
);

const GestenWerte = ({ links, skala, stand }: { links: number; skala: number; stand: Stand }) => (
	<>
		{stand.zusatz && <ZusatzAnzeige links={links} skala={skala} zeiger={stand.zeiger} {...stand.zusatz} />}
		<WertAmZeiger links={links} skala={skala} text={stand.text} zeiger={stand.zeiger} />
	</>
);

const mehrfachRahmen = (doc: Document, nr: number | null, kastenInGeste: Stand['kasten'] | null) => {
	const nrn = nr === null ? [] : nrnFuer(doc, nr);
	const umrisse = nrn.length > 1 ? elementeZu(doc, nrn).map(({ element: el }) => rechteckVon(el)) : [];
	const rahmen = umschliessend(umrisse);
	return rahmen ? { kasten: kastenInGeste ?? alsKasten(rahmen), umrisse } : null;
};

const zusatzGriffe = (art: string, element: Element, istFlaeche: boolean, verdreht: boolean) =>
	ZUSATZ_GRIFFE.filter((g) => g.fuer(art, element) && (!istFlaeche || g.id === 'hoehe') && !verdreht);

type Geste = ReturnType<typeof useGeste>;

/** Rahmen mit Griffen um ein Element, dazu die Punkte eines Pfads im Modus „Punkte bearbeiten“ (116). */
const EinzelRahmen = ({
	bedienbar,
	element,
	geste,
	gewaehlt,
	istFlaeche,
	lage,
	links,
	skala,
	struktur,
}: {
	bedienbar: boolean;
	element: Element;
	geste: Geste;
	gewaehlt: PfadTeil;
	istFlaeche: boolean;
	lage: Pick<Messung, 'kasten' | 'ursprung' | 'verdreht'>;
	links: number;
	skala: number;
	struktur: Eigenschaften['struktur'];
}) => {
	const pfadModus = usePfadModus();
	const { stand } = geste;
	const groesse = gestaltungArtNach(gewaehlt.baustein.art)?.groesse ?? 'frei';
	const verdreht = lage.verdreht === true;
	return (
		<>
			<Auswahlrahmen
				element={element}
				kasten={lage.kasten}
				ursprung={lage.ursprung}
				links={links}
				skala={skala}
				gesperrt={element.hasAttribute('data-gesperrt')}
				bedienbar={bedienbar}
				griffe={griffeFuer(groesse)}
				zusatz={zusatzGriffe(gewaehlt.baustein.art, element, istFlaeche, verdreht)}
				// 120: Ein Teil einer gedrehten Gruppe hat keine Griffe, auch keine Zusatz-Griffe (Gesten rechnen ohne Drehung).
				nurZusatz={istFlaeche || verdreht}
				inGeste={stand !== null}
				starteGriff={geste.starteGriff}
				starteZusatz={geste.starteZusatz}
			/>
			{bedienbar && pfadModus.nr === gewaehlt.nr && stand === null && (
				<PfadPunkte
					element={element}
					nr={gewaehlt.nr}
					kasten={lage.kasten}
					ursprung={lage.ursprung}
					links={links}
					skala={skala}
					fuehreAus={(beschreibung, rechne) => {
						struktur.fuehreAus(beschreibung, rechne);
					}}
				/>
			)}
		</>
	);
};

/**
 * Alles über dem Blatt, was zur Gestaltung gehört (097): Auswahlrahmen mit Griffen, Wert am Zeiger, Druckrand-Linie und
 * die Hilfslinien des Einrastens. Die Gesten selbst stecken in `useGeste`.
 */
export const GestaltungUeberlagerung = ({ e, pfad, struktur, textsitzung, waehle }: Eigenschaften) => {
	const { links, skala } = e;
	const geste = useGeste({ doc: e.doc, skala, pfad, struktur, waehle, textsitzung });
	const { stand } = geste;
	const ablageLinien = useAblageLinien(e.doc);
	const gewaehlt = pfad.at(-1);
	const element = gewaehlt ? elementZu(e.doc, gewaehlt.nr) : null;
	const istFrei = istGestaltungElement(element);
	// 115: Die gewählte Fläche im Stapel bekommt einen Rahmen mit dem Höhen-Griff, sonst nichts.
	const istFlaeche = Boolean(element?.matches('.flaeche'));
	const mitRahmen = istFrei || istFlaeche;
	// Während der Geste aus dem Stand, sonst gemessen: ein Element, nicht alle.
	const gemessen = mitRahmen && element ? messe(element) : null;
	const lage =
		mitRahmen && stand && stand.nr === gewaehlt?.nr ? { kasten: stand.kasten, ursprung: stand.ursprung } : gemessen;
	const bedienbar = struktur.aktiv && !textsitzung;
	// 113: Mehrfachauswahl: ein Rahmen um alle, je ein dünner Umriss. Gemessen bei jedem Zeichnen, es sind wenige.
	useMehrfach();
	const mehrfach = mehrfachRahmen(e.doc, istFrei && gewaehlt ? gewaehlt.nr : null, stand?.kasten ?? null);

	return (
		<>
			{stand && <GestenLinien links={links} skala={skala} stand={stand} />}
			{ablageLinien && <Hilfslinien links={links} skala={skala} {...ablageLinien} />}
			<Durchblick e={e} />
			{geste.aufzug && <Aufzug flaeche={geste.aufzug} links={links} skala={skala} />}
			{mehrfach && (
				<MehrfachRahmen
					kasten={mehrfach.kasten}
					umrisse={mehrfach.umrisse}
					links={links}
					skala={skala}
					bedienbar={bedienbar}
					inGeste={stand !== null}
					starteMehrfach={geste.starteMehrfach}
				/>
			)}
			{!mehrfach && element && lage && gewaehlt && (
				<EinzelRahmen
					bedienbar={bedienbar}
					element={element}
					geste={geste}
					gewaehlt={gewaehlt}
					istFlaeche={istFlaeche}
					lage={lage}
					links={links}
					skala={skala}
					struktur={struktur}
				/>
			)}
			{stand && <GestenWerte links={links} skala={skala} stand={stand} />}
		</>
	);
};

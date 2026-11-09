import { gestaltungArtNach } from '@schoolbox/kern/src/gestaltung-arten';

import type { PfadTeil } from '../darstellung';
import { elementZu } from '../darstellung';
import type { Einblendung } from '../Leinwand';
import type { Struktur } from '../struktur';
import { Auswahlrahmen, MehrfachRahmen } from './auswahlrahmen';
import { Druckrand } from './druckrand';
import { Durchblick } from './durchblick';
import type { GroessenArt } from './geste';
import { griffeFuer } from './geste';
import { ZUSATZ_GRIFFE } from './griffe';
import { Hilfslinien, useAblageLinien } from './hilfslinien';
import { istGestaltungElement } from './kontext';
import { usePfadModus } from './pfad-modus'; // 116
import { PfadPunkte } from './pfad-punkte'; // 116
import { alsKasten, elementeZu, nrnFuer, rechteckVon, umschliessend, useMehrfach } from './mehrfach';
import type { Flaeche } from './useGeste';
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
	const lage =
		mitRahmen && stand && stand.nr === gewaehlt?.nr
			? { kasten: stand.kasten, ursprung: stand.ursprung }
			: mitRahmen && element
				? messe(element)
				: null;
	const groesse = (gestaltungArtNach(gewaehlt?.baustein.art ?? '')?.groesse ?? 'frei') as GroessenArt;
	const bedienbar = struktur.aktiv && !textsitzung;
	// 113: Mehrfachauswahl: ein Rahmen um alle, je ein dünner Umriss. Gemessen bei jedem Zeichnen, es sind wenige.
	useMehrfach();
	const nrn = istFrei && gewaehlt ? nrnFuer(e.doc, gewaehlt.nr) : [];
	const umrisse = nrn.length > 1 ? elementeZu(e.doc, nrn).map(({ element: el }) => rechteckVon(el)) : [];
	const rahmen = umschliessend(umrisse);
	const mehrfach = rahmen ? { kasten: stand ? stand.kasten : alsKasten(rahmen), umrisse } : null;
	const { aufzug } = geste;
	// 116: Punkte bearbeiten am gewählten Pfad.
	const pfadModus = usePfadModus();
	const punkteZeigen = bedienbar && !mehrfach && element && lage && gewaehlt && pfadModus.nr === gewaehlt.nr;

	return (
		<>
			{stand?.seite && <Druckrand links={links} seite={stand.seite} skala={skala} />}
			{stand && <Hilfslinien links={links} skala={skala} ursprung={stand.ursprung} linien={stand.linien} />}
			{ablageLinien && <Hilfslinien links={links} skala={skala} {...ablageLinien} />}
			<Durchblick e={e} />
			{aufzug && (
				<div
					className="pointer-events-none absolute z-ueberlagerung border border-brand-500 bg-brand-500/10"
					data-aufzug
					style={{
						left: links + aufzug.links * skala,
						top: aufzug.oben * skala,
						width: aufzug.breite * skala,
						height: aufzug.hoehe * skala,
					}}
				/>
			)}
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
			{!mehrfach && mitRahmen && element && lage && (
				<Auswahlrahmen
					element={element}
					kasten={lage.kasten}
					ursprung={lage.ursprung}
					links={links}
					skala={skala}
					gesperrt={element.hasAttribute('data-gesperrt')}
					bedienbar={bedienbar}
					griffe={griffeFuer(groesse)}
					zusatz={ZUSATZ_GRIFFE.filter(
						(g) =>
							g.fuer(gewaehlt?.baustein.art ?? '', element) &&
							(!istFlaeche || g.id === 'hoehe') &&
							!('verdreht' in lage && lage.verdreht === true),
					)}
					// 120: Ein Teil einer gedrehten Gruppe hat keine Griffe, auch keine Zusatz-Griffe (Gesten rechnen ohne Drehung).
					nurZusatz={istFlaeche || ('verdreht' in lage && lage.verdreht === true)}
					inGeste={stand !== null}
					starteGriff={geste.starteGriff}
					starteZusatz={geste.starteZusatz}
				/>
			)}
			{punkteZeigen && gewaehlt && element && lage && stand === null && (
				<PfadPunkte
					element={element}
					nr={gewaehlt.nr}
					kasten={lage.kasten}
					ursprung={lage.ursprung}
					links={links}
					skala={skala}
					fuehreAus={(beschreibung, rechne) => {
						struktur.fuehreAus(beschreibung, rechne, false, true);
					}}
				/>
			)}
			{stand?.zusatz && <ZusatzAnzeige links={links} skala={skala} zeiger={stand.zeiger} {...stand.zusatz} />}
			{stand && <WertAmZeiger links={links} skala={skala} text={stand.text} zeiger={stand.zeiger} />}
		</>
	);
};

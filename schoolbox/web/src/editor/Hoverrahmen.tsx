import { pfadZu } from './darstellung';
import { nrnFuer } from './gestaltung/mehrfach';
import { messe } from './gestaltung/useGeste';
import type { Klickziel } from './klickziel';
import { sichtfeldVon } from './sichtfeld';

/** Höhe des Namensschilds; es steht direkt über dem Rahmen, ohne Lücke. */
const SCHILD = 15;
/** Wie der Auswahlrahmen: Bausteine 4,5 px außerhalb, Gestaltung bündig. */
const AUSSEN = 4.5;

interface Eigenschaften {
	ziel: Klickziel;
	doc: Document;
	auswahl: number | null;
	links: number;
	skala: number;
}

const Schild = ({ links, name, oben }: { links: number; oben: number; name: string }) => (
	<span
		className="pointer-events-none absolute flex items-center rounded-[2px] bg-brand-50 px-1 text-[11px] leading-none font-medium whitespace-nowrap text-brand-600"
		data-hover-schild
		style={{ left: links, top: oben, height: SCHILD }}
	>
		{name}
	</span>
);

/**
 * Hover-Rahmen (205): ein leichter Rahmen um genau das, was ein Klick an der Stelle des Zeigers wählen würde, mit dem
 * Namen wie in den Ebenen und im Inspektor. Er liegt unter dem Auswahlrahmen, fängt keinen Zeiger und steht nie um das
 * Gewählte. Es gibt nur dieses eine Element: Beim Wechsel des Ziels ändern sich Lage, Größe und Name.
 */
export const Hoverrahmen = ({ auswahl, doc, links, skala, ziel }: Eigenschaften) => {
	if (ziel.art === 'luecke' || ziel.element.ownerDocument !== doc || !ziel.element.isConnected) {
		return null;
	}
	const { element, nr } = ziel;
	const gewaehlt = auswahl === null ? [] : nrnFuer(doc, auswahl);
	if (gewaehlt.includes(nr) || element.getClientRects().length === 0) {
		return null;
	}
	const name = pfadZu(doc, nr).at(-1)?.name;
	const box = element.getBoundingClientRect();
	const sicht = sichtfeldVon(doc);
	const gestaltung = ziel.art === 'gestaltung' ? messe(element) : null;
	const rahmen = gestaltung
		? {
				left: links + (gestaltung.ursprung.x + gestaltung.kasten.x) * skala,
				top: (gestaltung.ursprung.y + gestaltung.kasten.y) * skala,
				width: gestaltung.kasten.b * skala,
				height: gestaltung.kasten.h * skala,
				transform: gestaltung.kasten.drehen ? `rotate(${gestaltung.kasten.drehen}deg)` : undefined,
			}
		: {
				left: links + box.left * skala - AUSSEN,
				top: box.top * skala - AUSSEN,
				width: box.width * skala + 2 * AUSSEN,
				height: box.height * skala + 2 * AUSSEN,
			};
	// Das Schild sitzt am umschließenden Rechteck, auch bei gedrehter Gestaltung: Es dreht sich nicht mit.
	const abstand = gestaltung ? 0 : AUSSEN;
	const kante = { links: links + box.left * skala - abstand, oben: box.top * skala - abstand };
	const sichtOben = sicht?.oben ?? 0;
	const schildOben = kante.oben - SCHILD >= sichtOben ? kante.oben - SCHILD : Math.max(kante.oben, sichtOben) + 1;
	return (
		<>
			<div
				className="pointer-events-none absolute rounded-[2px] border border-brand-500/55"
				data-hover-rahmen={nr}
				data-hover-art={ziel.art}
				style={rahmen}
			/>
			{name && <Schild links={kante.links + (schildOben > kante.oben ? 1 : 0)} oben={schildOben} name={name} />}
		</>
	);
};

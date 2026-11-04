import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import type { PalettenEintrag } from '../editor/palette-suche';
import { Palette } from '../editor/Palette';
import { useLaden } from '../lib/laden';
import { ART_NAME, FACH_NAME, klasseName } from '../lib/text';
import type { MappenListe } from '../typen';

interface Eigenschaften {
	schliessen: () => void;
	neueMappe: () => void;
	abmelden: () => void;
	anClaude?: ((text: string) => void) | undefined;
}

const MAPPEN_ZU_BEGINN = 5;

/** Palette außerhalb des Editors: Mappen und Dokumente aus derselben Quelle wie die Übersicht, dazu die Wege im Kopf. */
export const Seitenpalette = ({ abmelden, anClaude, neueMappe, schliessen }: Eigenschaften) => {
	const { daten } = useLaden<MappenListe>('/api/mappen');
	const navigate = useNavigate();

	const eintraege = useMemo(() => {
		const liste: PalettenEintrag[] = [
			{ id: 'seite:neue-mappe', titel: 'Neue Mappe', gruppe: 'Aktionen', symbol: 'plus', start: true, suchwoerter: ['anlegen', 'erstellen'], aus: neueMappe },
			{ id: 'seite:papierkorb', titel: 'Papierkorb', gruppe: 'Aktionen', symbol: 'papierkorb', start: true, suchwoerter: ['gelöscht', 'wiederherstellen'], aus: () => void navigate('/papierkorb') },
			{ id: 'seite:hilfe', titel: 'Hilfe', gruppe: 'Aktionen', symbol: 'hilfe', start: true, suchwoerter: ['anleitung', 'so geht'], aus: () => void navigate('/hilfe') },
			{ id: 'seite:abmelden', titel: 'Abmelden', gruppe: 'Aktionen', symbol: 'abmelden', suchwoerter: ['ausloggen'], aus: abmelden },
		];
		(daten?.mappen ?? []).forEach(({ dokumente, mappe }, stelle) => {
			const angabe = `${FACH_NAME[mappe.fach]} · ${klasseName(mappe.klasse)}`;
			const woerter = [FACH_NAME[mappe.fach], klasseName(mappe.klasse)];
			liste.push({
				id: `mappe:${mappe.id}`,
				titel: mappe.titel,
				gruppe: 'Mappen',
				symbol: 'seiten',
				notiz: angabe,
				suchwoerter: woerter,
				start: stelle < MAPPEN_ZU_BEGINN,
				aus: () => void navigate(`/m/${mappe.id}`),
			});
			for (const d of dokumente) {
				liste.push({
					id: `dokument:${mappe.id}/${d.id}`,
					titel: d.meta.titel,
					gruppe: 'Dokumente',
					symbol: 'blatt',
					notiz: `${mappe.titel} · ${klasseName(mappe.klasse)}`,
					suchwoerter: [...woerter, mappe.titel, ART_NAME[d.meta.art] ?? d.meta.art],
					aus: () => void navigate(`/m/${mappe.id}/${d.id}`),
				});
			}
		});
		return liste;
	}, [abmelden, daten, navigate, neueMappe]);

	return (
		<Palette
			platzhalter="Mappe, Dokument oder Befehl suchen"
			eintraege={eintraege}
			schliessen={schliessen}
			anClaude={anClaude}
		/>
	);
};

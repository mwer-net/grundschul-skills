import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Palette } from '../editor/Palette';
import type { PalettenEintrag } from '../editor/palette-suche';
import { ART_NAME, FACH_NAME, klasseName } from '../lib/text';
import { useAblage } from '../ordner/kontext';
import { ortName, pfadVon, WURZEL_NAME } from '../ordner/objekte';

interface Eigenschaften {
	schliessen: () => void;
	neuerOrdner: () => void;
	abmelden: () => void;
	anClaude?: ((text: string) => void) | undefined;
}

const ORDNER_ZU_BEGINN = 5;

/** Palette außerhalb des Editors: Ordner und Dokumente aus derselben Quelle wie die Ablage, dazu die Wege im Kopf. */
export const Seitenpalette = ({ abmelden, anClaude, neuerOrdner, schliessen }: Eigenschaften) => {
	const { stand } = useAblage();
	const navigate = useNavigate();

	const eintraege = useMemo(() => {
		const liste: PalettenEintrag[] = [
			{
				id: 'seite:neuer-ordner',
				titel: 'Neuer Ordner',
				gruppe: 'Aktionen',
				symbol: 'plus',
				start: true,
				suchwoerter: ['anlegen', 'erstellen'],
				aus: neuerOrdner,
			},
			{
				id: 'seite:papierkorb',
				titel: 'Papierkorb',
				gruppe: 'Aktionen',
				symbol: 'papierkorb',
				start: true,
				suchwoerter: ['gelöscht', 'wiederherstellen'],
				aus: () => void navigate('/papierkorb'),
			},
			{
				id: 'seite:hilfe',
				titel: 'Hilfe',
				gruppe: 'Aktionen',
				symbol: 'hilfe',
				start: true,
				suchwoerter: ['anleitung', 'so geht'],
				aus: () => void navigate('/hilfe'),
			},
			{
				id: 'seite:abmelden',
				titel: 'Abmelden',
				gruppe: 'Aktionen',
				symbol: 'abmelden',
				suchwoerter: ['ausloggen'],
				aus: abmelden,
			},
		];
		(stand?.ordner ?? []).forEach((o, stelle) => {
			const pfad = (stand ? pfadVon(stand, o.eltern) : []).map((p) => p.name);
			liste.push({
				id: `ordner:${o.id}`,
				titel: o.name,
				gruppe: 'Ordner',
				symbol: 'ordner',
				notiz: [WURZEL_NAME, ...pfad].join(' › '),
				suchwoerter: pfad,
				start: stelle < ORDNER_ZU_BEGINN,
				aus: () => void navigate(`/o/${o.id}`),
			});
		});
		for (const d of stand?.dokumente ?? []) {
			const ort = stand ? ortName(stand, d.ordner) : '';
			liste.push({
				id: `dokument:${d.mappe}/${d.id}`,
				titel: d.meta.titel,
				gruppe: 'Dokumente',
				symbol: 'blatt',
				notiz: ort,
				suchwoerter: [FACH_NAME[d.fach], klasseName(d.klasse), ort, ART_NAME[d.meta.art] ?? d.meta.art],
				aus: () => void navigate(`/m/${d.mappe}/${d.id}`),
			});
		}
		return liste;
	}, [abmelden, navigate, neuerOrdner, stand]);

	return (
		<Palette
			platzhalter="Ordner, Dokument oder Befehl suchen"
			eintraege={eintraege}
			schliessen={schliessen}
			anClaude={anClaude}
		/>
	);
};

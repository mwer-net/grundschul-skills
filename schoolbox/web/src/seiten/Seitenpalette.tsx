import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Palette } from '../editor/Palette';
import type { PalettenEintrag } from '../editor/palette-suche';
import { bewerte } from '../editor/palette-suche';
import { useSeitenbefehle } from '../lib/seitenbefehle';
import { materialEintraege } from '../lib/material-eintraege';
import { BEFEHLE } from '../ordner/befehle';
import { useAblage } from '../ordner/kontext';
import { pfadVon, WURZEL_NAME } from '../ordner/objekte';
import { auswahlFuerPalette } from '../ordner/palette-auswahl';

interface Eigenschaften {
	schliessen: () => void;
	neuerOrdner: () => void;
	abmelden: () => void;
	/** 136: Freitext öffnet den Assistenten mit dem Text als Thema; ohne Claude fehlt die Zeile. */
	anlegen?: ((thema: string) => void) | undefined;
	/** Der Assistent bei „Start“ im offenen Ordner (190-05). */
	materialAnlegen: () => void;
}

const MATERIAL_ANLEGEN = 'Material anlegen';

const ORDNER_ZU_BEGINN = 5;

/** `bewerte` für ein ganzes Wort oder einen Anfang im Titel oder in den Suchwörtern. */
const GANZ_WORT = 8;

/**
 * Diese Befehle der Ablage („löschen“, „umbenennen“) sind nie das Thema eines neuen Materials (S-02). „Teilen“ fehlt
 * mit Absicht: Es ist auch ein Thema in Mathematik.
 */
const NIE_THEMA = new Set(['papierkorb', 'umbenennen', 'duplizieren', 'kopieren', 'ausschneiden', 'einfuegen', 'bewegenNach']);
const istBefehlswort = (text: string) =>
	BEFEHLE.some(
		(b) =>
			NIE_THEMA.has(b.id) &&
			typeof b.titel === 'string' &&
			bewerte(text, { titel: b.titel, suchwoerter: b.suchwoerter ?? [] }) >= GANZ_WORT,
	);

/** Palette außerhalb des Editors: Ordner und Dokumente aus derselben Quelle wie die Ablage, dazu die Wege im Kopf. */
export const Seitenpalette = ({ abmelden, anlegen, materialAnlegen, neuerOrdner, schliessen }: Eigenschaften) => {
	const { stand } = useAblage();
	const navigate = useNavigate();
	const seite = useSeitenbefehle();
	// Die Auswahl der Ablage beim Öffnen: Ihre Befehle stehen oben, wie im Rechtsklick (S-02).
	const [auswahl] = useState(auswahlFuerPalette);

	const eintraege = useMemo(() => {
		const liste: PalettenEintrag[] = [
			...auswahl,
			...seite,
			{
				id: 'seite:material-anlegen',
				titel: MATERIAL_ANLEGEN,
				gruppe: 'Aktionen',
				symbol: 'plus',
				start: true,
				suchwoerter: ['neu', 'erstellen', 'blatt'],
				aus: materialAnlegen,
			},
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
		liste.push(...materialEintraege(stand, (pfad) => void navigate(pfad), 'Material'));
		return liste;
	}, [abmelden, auswahl, materialAnlegen, navigate, neuerOrdner, seite, stand]);

	return (
		<Palette
			platzhalter="Ordner, Material oder Befehl suchen"
			eintraege={eintraege}
			schliessen={schliessen}
			freitext={
				anlegen && {
					titel: (text) => `${MATERIAL_ANLEGEN}: „${text}“`,
					aus: anlegen,
					ausser: (text) =>
						MATERIAL_ANLEGEN.toLowerCase().startsWith(text.trim().toLowerCase()) || istBefehlswort(text),
				}
			}
		/>
	);
};

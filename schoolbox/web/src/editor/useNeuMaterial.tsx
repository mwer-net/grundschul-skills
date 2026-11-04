import type { Einordnung, EinordnungMappe } from '@schoolbox/kern/src/einordnung';
import { rueckfallEinordnung } from '@schoolbox/kern/src/einordnung';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { lade, meldung, sende } from '../api';
import { MaterialDialog } from '../seiten/Anlegen';
import { legeMappeAn, legeMaterialAn } from '../seiten/material-anlegen';
import { liesVerlauf, schreibeVerlauf, verlaufSchluessel } from './chat-verlauf';

interface Herkunft {
	wunsch: string;
	/** Die Mappe, in der die Nachricht entstand. Die Karte bleibt ihr treu, auch wenn man die Seite wechselt. */
	mappe: string | null;
	/** Der Verlauf, in dem die Nachricht steht. */
	schluessel: string;
	imDokument: boolean;
}

export type NeuStand =
	| (Herkunft & { phase: 'ordnet' })
	| (Herkunft & { phase: 'karte' | 'legtAn'; einordnung: Einordnung; fehler: string | null });

const mappeZu = async (id: string | null): Promise<EinordnungMappe | null> => {
	if (!id) {
		return null;
	}
	try {
		return (await lade<{ mappe: EinordnungMappe }>(`/api/mappen/${id}`)).mappe;
	} catch {
		return null;
	}
};

/**
 * Neues Material aus einer Nachricht (077): erst einordnen, dann eine Karte, erst nach ihrer Bestätigung anlegen und
 * Claude starten. Der Stand liegt im Rahmen, damit er einen Seitenwechsel übersteht.
 */
export const useNeuMaterial = () => {
	const [stand, setStand] = useState<NeuStand | null>(null);
	const [aendern, setAendern] = useState(false);
	const navigate = useNavigate();
	const lauf = useRef(0);
	const belegt = useRef(false);

	/** Der Verlauf zieht zum neuen Dokument um. Aus einem anderen Dokument kommt nur die Nachricht selbst mit. */
	const zieheUm = (h: Herkunft, mappe: string, dok: string) => {
		const alt = liesVerlauf(localStorage, h.schluessel);
		schreibeVerlauf(localStorage, verlaufSchluessel(mappe, dok), h.imDokument ? alt.slice(-1) : alt);
		if (!h.imDokument) {
			schreibeVerlauf(localStorage, h.schluessel, []);
		}
	};

	const starte = async (herkunft: Herkunft, ohneAufruf: boolean) => {
		lauf.current += 1;
		const dieser = lauf.current;
		setStand({ ...herkunft, phase: 'ordnet' });
		let einordnung: Einordnung;
		try {
			einordnung = ohneAufruf
				? rueckfallEinordnung(herkunft.wunsch, await mappeZu(herkunft.mappe))
				: await sende<Einordnung>('/api/ki/einordnen', {
						text: herkunft.wunsch,
						...(herkunft.mappe ? { mappe: herkunft.mappe } : {}),
					});
		} catch {
			einordnung = rueckfallEinordnung(herkunft.wunsch, await mappeZu(herkunft.mappe));
		}
		if (dieser === lauf.current) {
			setStand({ ...herkunft, phase: 'karte', einordnung, fehler: null });
		}
	};

	const abbrechen = () => {
		lauf.current += 1;
		setStand(null);
	};

	const anlegen = async () => {
		if (stand?.phase !== 'karte' || belegt.current) {
			return;
		}
		const { einordnung } = stand;
		// Ohne Mappe und ohne Einordnung gäbe es nur geratene Werte für Fach und Klasse.
		if (einordnung.rueckfall && 'neu' in einordnung.mappe) {
			setAendern(true);
			return;
		}
		belegt.current = true;
		setStand({ ...stand, phase: 'legtAn' });
		try {
			const mappe =
				'id' in einordnung.mappe
					? einordnung.mappe.id
					: await legeMappeAn({
							titel: einordnung.mappe.neu,
							fach: einordnung.fach,
							klasse: einordnung.klasse,
						});
			const { id, state, ziel } = await legeMaterialAn({
				mappe,
				titel: einordnung.titel,
				art: einordnung.art,
				format: einordnung.format,
				wunsch: stand.wunsch,
			});
			zieheUm(stand, mappe, id);
			setStand(null);
			void navigate(ziel, { state });
		} catch (grund) {
			setStand({ ...stand, phase: 'karte', fehler: meldung(grund) });
		} finally {
			belegt.current = false;
		}
	};

	const dialog =
		aendern && stand && stand.phase !== 'ordnet' ? (
			<MaterialDialog
				einordnung={stand.einordnung}
				wunsch={stand.wunsch}
				schliessen={() => setAendern(false)}
				vorDemSprung={(mappe, dok) => {
					zieheUm(stand, mappe, dok);
					setStand(null);
					setAendern(false);
				}}
			/>
		) : null;

	return { stand, starte, abbrechen, anlegen, aendern: () => setAendern(true), dialog };
};

export type NeuMaterial = ReturnType<typeof useNeuMaterial>;

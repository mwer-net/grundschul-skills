import type { Einordnung, EinordnungOrdner } from '@schoolbox/kern/src/einordnung';
import { rueckfallEinordnung } from '@schoolbox/kern/src/einordnung';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { meldung, sende } from '../api';
import { useAblage } from '../ordner/kontext';
import { pfadVon } from '../ordner/objekte';
import { MaterialDialog } from '../seiten/Anlegen';
import { legeMaterialAn } from '../seiten/material-anlegen';
import { beendeGespraechAufServer, neueGespraechId } from './ki';
import type { Gespraech } from './useGespraech';

interface Herkunft {
	wunsch: string;
	/** Der Ordner, in dem die Nachricht entstand. Die Karte bleibt ihm treu, auch wenn man die Seite wechselt. */
	ordner: string | null;
	imDokument: boolean;
}

type NeuOrdnet = Herkunft & { phase: 'ordnet' };
type NeuKarte = Herkunft & { phase: 'karte' | 'legtAn'; einordnung: Einordnung; fehler: string | null };

export type NeuStand = NeuOrdnet | NeuKarte;

/**
 * Neues Material aus einer Nachricht (077): erst einordnen, dann eine Karte, erst nach ihrer Bestätigung anlegen und
 * Claude starten. Der Stand liegt im Rahmen, damit er einen Seitenwechsel übersteht.
 */
export const useNeuMaterial = (gespraech: Gespraech) => {
	const [stand, setStand] = useState<NeuStand | null>(null);
	/** Die Kennung des Gesprächs, das mit dem Dialog weitergeht; `null`: Dialog zu. */
	const [aendern, setAendern] = useState<string | null>(null);
	const navigate = useNavigate();
	const lauf = useRef(0);
	const belegt = useRef(false);
	const { stand: ablage } = useAblage();

	const ordnerZu = (id: string | null): EinordnungOrdner | null => {
		const o = ablage?.ordner.find((x) => x.id === id);
		if (!o || !ablage) {
			return null;
		}
		const behaelter = o.behaelter ? ablage.dokumente.find((d) => d.mappe === o.behaelter) : undefined;
		return {
			id: o.id,
			pfad: pfadVon(ablage, o.id)
				.map((p) => p.name)
				.join(' > '),
			...(behaelter ? { fach: behaelter.fach, klasse: behaelter.klasse } : {}),
		};
	};

	/**
	 * Das Gespräch zieht zum neuen Dokument um. Aus einem anderen Dokument kommt nur die Nachricht selbst mit: Dessen
	 * Gespräch endet, und das neue Dokument bekommt ein eigenes.
	 */
	const gespraechFuer = (h: Herkunft) => (h.imDokument ? neueGespraechId() : gespraech.sichereId());

	const zieheUm = (h: Herkunft, ort: { mappe: string; dok: string }, id: string, endeVorher: number) => {
		if (gespraech.endeZahl() === endeVorher) {
			gespraech.uebernimm(ort, id, h.imDokument);
		} else {
			// Unterwegs geschlossen: Das Dokument bleibt, das Gespräch nicht. Der Lauf kannte das Ende noch nicht.
			beendeGespraechAufServer(id);
		}
	};

	// Schließen und „Neu beginnen“ nehmen die Karte mit. Wird schon angelegt, läuft das zu Ende.
	const { nummer } = gespraech;
	useEffect(() => {
		lauf.current += 1;
		setStand((alt) => (alt?.phase === 'legtAn' ? alt : null));
		setAendern(null);
	}, [nummer]);

	const starte = async (herkunft: Herkunft, ohneAufruf: boolean) => {
		lauf.current += 1;
		const dieser = lauf.current;
		setStand({ ...herkunft, phase: 'ordnet' });
		let einordnung: Einordnung;
		try {
			einordnung = ohneAufruf
				? rueckfallEinordnung(herkunft.wunsch, ordnerZu(herkunft.ordner))
				: await sende<Einordnung>('/api/ki/einordnen', {
						text: herkunft.wunsch,
						...(herkunft.ordner ? { ordner: herkunft.ordner } : {}),
					});
		} catch {
			einordnung = rueckfallEinordnung(herkunft.wunsch, ordnerZu(herkunft.ordner));
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
		// Ohne Behälter und ohne Einordnung gäbe es nur geratene Werte für Fach und Klasse.
		if (einordnung.rueckfall && !einordnung.fest) {
			setAendern(gespraechFuer(stand));
			return;
		}
		belegt.current = true;
		setStand({ ...stand, phase: 'legtAn' });
		const gespraechId = gespraechFuer(stand);
		const endeVorher = gespraech.endeZahl();
		try {
			const { id, mappe, state, ziel } = await legeMaterialAn({
				ordner: einordnung.ordner?.id ?? null,
				titel: einordnung.titel,
				art: einordnung.art,
				format: einordnung.format,
				fach: einordnung.fach,
				klasse: einordnung.klasse,
				wunsch: stand.wunsch,
				gespraechId,
			});
			zieheUm(stand, { mappe, dok: id }, gespraechId, endeVorher);
			setStand(null);
			void navigate(ziel, { state });
		} catch (grund) {
			setStand({ ...stand, phase: 'karte', fehler: meldung(grund) });
		} finally {
			belegt.current = false;
		}
	};

	const dialog =
		aendern !== null && stand && stand.phase !== 'ordnet' ? (
			<MaterialDialog
				einordnung={stand.einordnung}
				wunsch={stand.wunsch}
				gespraechId={aendern}
				schliessen={() => setAendern(null)}
				vorDemSprung={(mappe, dok) => {
					zieheUm(stand, { mappe, dok }, aendern, gespraech.endeZahl());
					setStand(null);
					setAendern(null);
				}}
			/>
		) : null;

	const oeffneDialog = () => {
		if (stand) {
			setAendern(gespraechFuer(stand));
		}
	};

	return { stand, starte, abbrechen, anlegen, aendern: oeffneDialog, dialog };
};

export type NeuMaterial = ReturnType<typeof useNeuMaterial>;

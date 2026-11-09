import { useEffect, useState } from 'react';

import type { UebernehmenVorschau } from '../../../api';
import { ApiFehler, ladeUebernehmenVorschau, meldung } from '../../../api';
import { useHinweis } from '../../../bausteine/hinweis';
import { Knopf } from '../../../bausteine/Knopf';
import { Symbol } from '../../../bausteine/Symbol';
import { UebernehmenDialog } from './UebernehmenDialog';

const OHNE_ORDNER = 'Nur für Materialien in einem Ordner';

/**
 * „Auf alle Blätter im Ordner übernehmen“ (122) unter den Reglern: kopiert die Werte des Rezepts einmal auf die anderen
 * Materialien im selben Ordner. Vorher speichert der Editor, damit der Server die aktuellen Werte liest.
 */
export const RezeptUebernehmen = ({
	adresse,
	aus,
	speichere,
}: {
	adresse: string;
	aus: boolean;
	speichere: () => Promise<unknown>;
}) => {
	const zeige = useHinweis();
	// Ob das Material in einem Ordner liegt, sagt die Vorschau. Ein frisch gewähltes Rezept ist noch nicht gespeichert
	// („kein Rezept“): Das zählt nicht, der Klick speichert vorher. `null`: noch offen.
	const [imOrdner, setImOrdner] = useState<boolean | null>(null);
	const [vorschau, setVorschau] = useState<UebernehmenVorschau | null>(null);
	const [laedt, setLaedt] = useState(false);

	useEffect(() => {
		let aktiv = true;
		ladeUebernehmenVorschau(adresse).then(
			() => aktiv && setImOrdner(true),
			(grund: unknown) =>
				aktiv && setImOrdner(!(grund instanceof ApiFehler && grund.status === 400 && /Ordner/.test(grund.message))),
		);
		return () => {
			aktiv = false;
		};
	}, [adresse]);

	const oeffne = async () => {
		setLaedt(true);
		try {
			await speichere();
			setVorschau(await ladeUebernehmenVorschau(adresse));
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
		} finally {
			setLaedt(false);
		}
	};

	return (
		<>
			<Knopf
				art="zweit"
				groesse="klein"
				disabled={aus || laedt || imOrdner !== true}
				title={imOrdner === false ? OHNE_ORDNER : undefined}
				onClick={() => void oeffne()}
				className="h-auto! min-h-knopf-klein justify-start py-1 text-left"
				data-rezept-uebernehmen
			>
				<Symbol name="kopieren" />
				{/* Die Schublade ist schmal: Der Text bricht um, statt hinauszuragen. */}
				<span className="whitespace-normal">Auf alle Blätter im Ordner übernehmen</span>
			</Knopf>
			{vorschau && <UebernehmenDialog adresse={adresse} vorschau={vorschau} schliessen={() => setVorschau(null)} />}
		</>
	);
};

import { useState } from 'react';

import type { UebernehmenVorschau } from '../../../api';
import { meldung, uebernimmAufmachung } from '../../../api';
import { Dialog } from '../../../bausteine/Dialog';
import { useHinweis } from '../../../bausteine/hinweis';
import { Knopf } from '../../../bausteine/Knopf';

const liste = (titel: string[]) => titel.map((t) => `„${t}“`).join(', ');
const materialien = (n: number) => (n === 1 ? '1 Material bekommt' : `${n} Materialien bekommen`);
const minibuecher = (n: number) => (n === 1 ? '1 Minibuch' : `${n} Minibücher`);

/** Ergebnis als eine Zeile für die Meldung unten. */
const ergebnisText = (e: { geaendert: string[]; uebersprungen: string[]; fehlgeschlagen: string[] }) =>
	[
		`Rezept auf ${e.geaendert.length === 1 ? '1 Material' : `${e.geaendert.length} Materialien`} übernommen.`,
		e.uebersprungen.length > 0 ? `Übersprungen: ${liste(e.uebersprungen)}.` : '',
		e.fehlgeschlagen.length > 0 ? `Nicht geklappt: ${liste(e.fehlgeschlagen)}.` : '',
	]
		.filter(Boolean)
		.join(' ');

/**
 * Bestätigung für „Auf alle Blätter im Ordner übernehmen“ (122): zeigt, was sich ändert, und schickt genau die Werte
 * der Vorschau. Das offene Material bleibt, wie es ist.
 */
export const UebernehmenDialog = ({
	adresse,
	schliessen,
	vorschau,
}: {
	adresse: string;
	vorschau: UebernehmenVorschau;
	schliessen: () => void;
}) => {
	const zeige = useHinweis();
	const [laeuft, setLaeuft] = useState(false);
	const v = vorschau;
	const uebernimm = async () => {
		setLaeuft(true);
		try {
			const e = await uebernimmAufmachung(adresse, v.werte);
			schliessen();
			zeige({ text: ergebnisText(e), art: e.fehlgeschlagen.length > 0 ? 'fehler' : 'info' });
		} catch (grund) {
			setLaeuft(false);
			zeige({ text: meldung(grund), art: 'fehler' });
		}
	};
	return (
		<Dialog
			titel={`Rezept ${v.rezept} auf alle Blätter im Ordner „${v.ordner}“ übernehmen?`}
			schliessen={schliessen}
		>
			<div className="flex flex-col gap-2 text-sm" data-uebernehmen-dialog>
				<p data-uebernehmen-zahl={v.aendern}>
					{v.aendern === 0
						? 'Kein anderes Material im Ordner bekommt das Rezept.'
						: `${materialien(v.aendern)} das Rezept.`}
				</p>
				{v.minibuch.length > 0 && (
					<p data-uebernehmen-minibuch>
						{`Übersprungen: ${minibuecher(v.minibuch.length)} (${liste(v.minibuch)}).`}
					</p>
				)}
				{v.anderesRezept.length > 0 && (
					<p data-uebernehmen-anderes>{`Verlieren ihr Rezept: ${liste(v.anderesRezept)}.`}</p>
				)}
				{v.gestaltungHinten.length > 0 && (
					<p data-uebernehmen-hinten>
						{`Hier liegt schon eigene Gestaltung: ${liste(v.gestaltungHinten)}. Sie bleibt stehen und kann mit dem Rezept doppelt aussehen.`}
					</p>
				)}
				<p className="text-leise">
					Jedes Material bekommt vorher eine Version. Unter „Versionen“ holst du den alten Stand zurück.
				</p>
			</div>
			<div className="flex justify-end gap-2">
				<Knopf art="zweit" onClick={schliessen}>
					Abbrechen
				</Knopf>
				<Knopf
					data-hauptaktion
					data-uebernehmen-los
					disabled={laeuft || v.aendern === 0}
					onClick={() => void uebernimm()}
				>
					Übernehmen
				</Knopf>
			</div>
		</Dialog>
	);
};

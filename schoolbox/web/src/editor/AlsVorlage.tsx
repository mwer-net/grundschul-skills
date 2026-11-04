import { useState } from 'react';

import { meldung, sende } from '../api';
import { Dialog } from '../bausteine/Dialog';
import { useHinweis } from '../bausteine/hinweis';
import { FELD_KLASSEN } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';

/** „Als Vorlage speichern“: Name; Art und Format kommen vom Dokument, Texte und Bilder bleiben (051). */
export const AlsVorlage = ({
	dok,
	mappe,
	schliessen,
	titel,
}: {
	mappe: string;
	dok: string;
	titel: string;
	schliessen: () => void;
}) => {
	const [name, setName] = useState(titel);
	const zeige = useHinweis();
	const speichere = async () => {
		try {
			await sende(`/api/eigene/vorlagen/aus/${mappe}/${dok}`, { name });
			schliessen();
			zeige({ text: `Vorlage „${name}“ gespeichert. Du findest sie beim Anlegen.` });
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
		}
	};
	return (
		<Dialog titel="Als Vorlage speichern" schliessen={schliessen}>
			<label className="block font-medium">
				Name
				<input
					className={`${FELD_KLASSEN} mt-1 w-full font-normal`}
					value={name}
					data-vorlage-name
					onChange={(e) => setName(e.target.value)}
				/>
			</label>
			<div className="flex justify-end gap-2">
				<Knopf art="zweit" onClick={schliessen}>
					Abbrechen
				</Knopf>
				<Knopf disabled={name.trim() === ''} data-vorlage-speichern onClick={() => void speichere()}>
					Speichern
				</Knopf>
			</div>
		</Dialog>
	);
};

/** Knopf samt Dialog, für Orte ohne eigenes Menü. */
export const AlsVorlageKnopf = (angaben: { mappe: string; dok: string; titel: string }) => {
	const [offen, setOffen] = useState(false);
	return (
		<>
			<Knopf art="zweit" data-als-vorlage onClick={() => setOffen(true)}>
				<Symbol name="blatt" />
				Als Vorlage
			</Knopf>
			{offen && <AlsVorlage {...angaben} schliessen={() => setOffen(false)} />}
		</>
	);
};

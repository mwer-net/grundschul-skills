import { useState } from 'react';

import { meldung, sende } from '../api';
import { Dialog } from '../bausteine/Dialog';
import { useHinweis } from '../bausteine/hinweis';
import { FELD_KLASSEN } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';

/** „Als Vorlage speichern“: Name; Art und Format kommen vom Dokument, Texte und Bilder bleiben (051). */
export const AlsVorlage = ({ dok, mappe, titel }: { mappe: string; dok: string; titel: string }) => {
	const [offen, setOffen] = useState(false);
	const [name, setName] = useState(titel);
	const zeige = useHinweis();
	const speichere = async () => {
		try {
			await sende(`/api/eigene/vorlagen/aus/${mappe}/${dok}`, { name });
			setOffen(false);
			zeige({ text: `Vorlage „${name}“ gespeichert. Du findest sie beim Anlegen.` });
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
		}
	};
	return (
		<>
			<Knopf art="zweit" data-als-vorlage onClick={() => setOffen(true)}>
				<Symbol name="blatt" />
				Als Vorlage
			</Knopf>
			{offen && (
				<Dialog titel="Als Vorlage speichern" schliessen={() => setOffen(false)}>
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
						<Knopf art="zweit" onClick={() => setOffen(false)}>
							Abbrechen
						</Knopf>
						<Knopf disabled={name.trim() === ''} data-vorlage-speichern onClick={() => void speichere()}>
							Speichern
						</Knopf>
					</div>
				</Dialog>
			)}
		</>
	);
};

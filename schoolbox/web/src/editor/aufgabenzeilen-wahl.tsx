import type { TextFeld } from '@schoolbox/kern/src/abbildungen';
import { aussagenVerlustfrei, fragenVerlustfrei } from '@schoolbox/kern/src/aufgabenzeilen';

import type { AbbildungSteuerung } from './abbildung';
import { AussagenZeilen, FragenZeilen, ZeilenOderText } from './Aufgabenzeilen';

/** Felder, die Zeilen statt Kurzschrift zeigen; sonst `null`. */
export const aufgabenZeilen = (abb: AbbildungSteuerung, feld: TextFeld) => {
	if (abb.schema?.name === 'Ankreuzen' && feld.attribut === 'fragen') {
		return (
			<ZeilenOderText
				abb={abb}
				feld={feld}
				verlustfrei={fragenVerlustfrei}
				kurzschrift="Je Frage: erst die Frage, dann ein Doppelpunkt und die Antworten mit Komma. Ein * vor der Antwort markiert die richtige. Ein Semikolon trennt die Fragen."
				liste={(u) => <FragenZeilen abb={abb} feld={feld} umschalten={u} />}
			/>
		);
	}
	if (abb.schema?.name === 'Richtig oder falsch' && feld.attribut === 'aussagen') {
		return (
			<ZeilenOderText
				abb={abb}
				feld={feld}
				verlustfrei={aussagenVerlustfrei}
				kurzschrift="Je Aussage: erst die Aussage, dann ein Doppelpunkt und r für richtig oder f für falsch. Ein Semikolon trennt die Aussagen."
				liste={(u) => <AussagenZeilen abb={abb} feld={feld} umschalten={u} />}
			/>
		);
	}
	return null;
};

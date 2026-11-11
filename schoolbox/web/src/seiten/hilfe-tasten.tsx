import type { TastenAbschnitt } from '../bausteine/Tastenliste';
import { kuerzelText } from '../editor/befehle';
import { SCHRIFT_TASTEN } from '../editor/textdom';

/**
 * Tasten ohne Befehlsregister, für den Abschnitt „Tasten“ der Hilfe (53): Textsitzung (`textdom.ts`), Präsentation
 * (`praesentation.js` im Skill), Assistent (`Anlegen.tsx`), Palette, Blase und die Gesten beim Ziehen. Ändert sich
 * eine dieser Tasten, steht es hier.
 */
export const WEITERE_TASTEN: TastenAbschnitt[] = [
	{
		titel: 'Beim Schreiben',
		zeilen: [
			{ id: 'schreiben-fett', titel: 'Fett', tasten: [kuerzelText(SCHRIFT_TASTEN.bold.kuerzel)] },
			{
				id: 'schreiben-unterstrichen',
				titel: 'Unterstrichen',
				tasten: [kuerzelText(SCHRIFT_TASTEN.underline.kuerzel)],
			},
			{ id: 'schreiben-zeile', titel: 'Neue Zeile oder Absatz, in einzeiligen Feldern fertig', tasten: ['⏎'] },
			{ id: 'schreiben-fertig', titel: 'Fertig', tasten: ['Esc'] },
		],
	},
	{
		titel: 'Präsentieren',
		zeilen: [
			{ id: 'praesentation-weiter', titel: 'Weiter', tasten: ['→', 'Leertaste', 'Klicker'] },
			{ id: 'praesentation-zurueck', titel: 'Zurück', tasten: ['←'] },
			{ id: 'praesentation-schwarz', titel: 'Folie schwarz und wieder sichtbar', tasten: ['B'] },
			{ id: 'praesentation-beenden', titel: 'Beenden', tasten: ['Esc'] },
		],
	},
	{
		titel: 'Material anlegen',
		zeilen: [
			{ id: 'anlegen-wahl', titel: 'Antwort wählen', tasten: ['1–9'] },
			{ id: 'anlegen-weiter', titel: 'Weiter', tasten: ['⏎'] },
			{ id: 'anlegen-weiter-feld', titel: 'Weiter aus einem Textfeld', tasten: ['⌘⏎'] },
			{ id: 'anlegen-zurueck', titel: 'Zurück', tasten: ['⇧⏎'] },
			{ id: 'anlegen-schliessen', titel: 'Schließen', tasten: ['Esc'] },
		],
	},
	{
		titel: 'Befehle und Claude',
		zeilen: [
			{ id: 'palette-waehlen', titel: 'Eintrag wählen', tasten: ['↑', '↓'] },
			{ id: 'palette-ausfuehren', titel: 'Ausführen', tasten: ['⏎'] },
			{ id: 'claude-senden', titel: 'Senden oder übernehmen', tasten: ['⏎'] },
			{ id: 'claude-einklappen', titel: 'Blase einklappen, Feld schließen', tasten: ['Esc'] },
		],
	},
	{
		titel: 'Ziehen und Zeichnen',
		zeilen: [
			{ id: 'ziehen-gerade', titel: 'Gerade, Quadrat, in 15°-Schritten', tasten: ['⇧'] },
			{ id: 'ziehen-mitte', titel: 'Aus der Mitte, Kopie beim Ziehen', tasten: ['⌥'] },
			{ id: 'ziehen-stapel', titel: 'In den Stapel statt frei, ohne Einrasten', tasten: ['⌘'] },
			{ id: 'ziehen-halten', titel: 'Werkzeug halten', tasten: ['⇧-Klick'] },
			{ id: 'ziehen-punkt', titel: 'Punkt löschen', tasten: ['⌥-Klick'] },
			{ id: 'ziehen-schieben', titel: 'Schieben um 1 px, um 10 px', tasten: ['Pfeile', '⇧ Pfeile'] },
			{ id: 'ziehen-abbrechen', titel: 'Abbrechen', tasten: ['Esc'] },
		],
	},
];

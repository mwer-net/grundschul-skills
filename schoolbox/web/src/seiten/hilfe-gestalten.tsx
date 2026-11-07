import { Kuerzel } from '../bausteine/Kuerzel';
import { kuerzelText } from '../editor/befehle';
import { JEDE_LAGE, SCHUBLADEN } from '../editor/schubladen';
import type { Abschnitt } from './hilfe-teile';

/** Nur bereite Schubladen; Name und Taste aus dem Register, damit die Hilfe nie etwas anderes sagt. */
const Schubladenliste = () => (
	<span data-hilfe-schubladen>
		{SCHUBLADEN.filter((s) => s.bereit(JEDE_LAGE)).map((s, i, alle) => (
			<span key={s.id} data-hilfe-schublade={s.id}>
				{`„${s.titel}“ `}
				<Kuerzel text={kuerzelText({ code: s.taste, wahl: true })} className="text-[length:inherit]" />
				{i < alle.length - 1 ? ', ' : ''}
			</span>
		))}
	</span>
);

/**
 * Abschnitt „Gestalten“ der Hilfe (Phase 12). Jedes sichtbare Ticket schreibt nur zwischen seinen Marken; 124 räumt
 * die Marken am Ende auf.
 */
export const GESTALTEN: Abschnitt = {
	id: 'gestalten',
	titel: 'Gestalten',
	inhalt: (
		<>
			<p>
				Links neben dem Blatt steht die Leiste mit den Schubladen. Jede hat ihre eigene Taste: <Schubladenliste />.
				Ein Klick öffnet eine Schublade, ein Klick auf eine andere wechselt, ein zweiter Klick schließt sie, und das
				Blatt bekommt den Platz. Mit der Stecknadel im Kopf der Ebenen bleiben sie unter jeder anderen Schublade offen;
				den Teiler dazwischen ziehst du nach oben oder unten.
			</p>
			{/* >> 094 */}
			<h3>Bausteine ziehen</h3>
			<p>
				Eine Karte in der Schublade „Bausteine“ antippen fügt den Baustein hinter der Auswahl ein, wie bisher. Du kannst
				ihn auch an die richtige Stelle ziehen: mit der Maus von der ganzen Karte, am iPad kurz halten oder gleich am Griff
				links. Schon vor dem Loslassen öffnet sich im Blatt eine Lücke, und die Nummern dahinter rücken nach. Loslassen
				fügt ein, ⌘Z nimmt es in einem Schritt zurück. Esc oder Loslassen neben der Seite bricht ab, das Blatt bleibt, wie
				es war. Dieselbe Lücke zeigt sich, wenn du einen Baustein im Blatt verschiebst.
			</p>
			{/* << 094 */}

			{/* >> 095 */}
			{/* << 095 */}

			{/* >> 096 */}
			{/* << 096 */}

			{/* >> 097 */}
			<p data-hilfe-gestaltung-bewegen>
				Was frei auf dem Blatt liegt, etwa eine Figur, eine Form oder Schmuckschrift, wählst du mit einem Klick. Dann
				ziehst du es an seinen Platz, änderst an den Ecken die Größe und drehst es am runden Griff über dem Rahmen. Mit ⇧
				bleibt es beim Ziehen auf einer Linie und dreht in 15°-Schritten; mit ⌥ wächst es beim Größe ändern von der Mitte
				aus, und beim Loslassen bleibt das Original liegen und eine Kopie kommt dazu. Ziehst du auf die nächste Seite,
				landet es dort. Esc während des Ziehens bricht ab. Solange du ziehst, zeigt eine gestrichelte Linie den Rand, den
				der Drucker nicht erreicht. Am iPad hältst du den Finger kurz, bevor du ziehst. Ein Doppelklick auf Schmuckschrift
				öffnet den Text. Was hinten liegt, wählst du mit ⌥-Klick. Gesperrtes lässt sich im Blatt nicht greifen.
			</p>
			{/* << 097 */}

			{/* >> 099 */}
			<h3>Leiste am Element und Inspektor</h3>
			<p>
				Ist ein Bild, eine Figur, eine Form oder ein anderes Gestaltungselement gewählt, steht darüber eine eigene kleine
				Leiste mit „Drehen“ und ⋯ für Duplizieren, Kopieren, Löschen und Claude fragen. Rechts im Inspektor stellst du
				Position und Größe in Pixeln, die Ebene (vorne oder hinten) und den Druck ein: ob es in s/w grau bleibt oder
				wegfällt und ob es immer, nur in der Lösung oder nicht in der Lösung erscheint.
			</p>
			{/* << 099 */}

			{/* >> 100 */}
			<h3>Einrasten, Reihenfolge, Durchblick</h3>
			<p data-hilfe-einrasten>
				Beim Ziehen und beim Größe ändern rastet das Element an der Mitte der Seite, am Innenrand, am Druckrand, an den
				Kanten und Mitten anderer Gestaltungselemente und an den Kanten der Bausteine ein; eine rosa Linie zeigt, woran.
				Hältst du dabei ⌘, rastet nichts ein. Die Pfeiltasten schieben ein gewähltes Element um 1 Pixel, mit ⇧ um 10
				Pixel; ist ein Baustein gewählt, wählen sie wie bisher den nächsten. Was vorne oder hinten liegt, ändern ⌥⇧⌘F
				(nach vorne), ⇧⌘F (ganz nach vorne), ⌥⇧⌘B (nach hinten) und ⇧⌘B (ganz nach hinten), auch im ⋯ der Leiste. Liegt
				es schon ganz vorne in der Ebene „hinten“, wechselt es nach „vorne“, und umgekehrt. Solange du G hältst, zeigt
				das Blatt seinen Aufbau: den Rand des Stapels, den Druckrand, Anker und Ausgeblendetes. Lässt du los, sieht es
				wieder aus wie gedruckt. Am iPad schaltet „Durchblick ein/aus“ in der Befehlssuche ⌘K das um.
			</p>
			{/* << 100 */}

			{/* >> 101 */}
			{/* << 101 */}

			{/* >> 102 */}
			{/* << 102 */}

			{/* >> 103 */}
			{/* << 103 */}

			{/* >> 104 */}
			{/* << 104 */}

			{/* >> 105 */}
			{/* << 105 */}

			{/* >> 106 */}
			{/* << 106 */}

			{/* >> 107 */}
			{/* << 107 */}

			{/* >> 108 */}
			{/* << 108 */}

			{/* >> 109 */}
			{/* << 109 */}

			{/* >> 110 */}
			{/* << 110 */}

			{/* >> 111 */}
			{/* << 111 */}

			{/* >> 113 */}
			{/* << 113 */}

			{/* >> 115 */}
			{/* << 115 */}

			{/* >> 116 */}
			{/* << 116 */}

			{/* >> 117 */}
			{/* << 117 */}

			{/* >> 119 */}
			{/* << 119 */}

			{/* >> 120 */}
			{/* << 120 */}

			{/* >> 121 */}
			{/* << 121 */}

			{/* >> 122 */}
			{/* << 122 */}
		</>
	),
	bilder: [],
};

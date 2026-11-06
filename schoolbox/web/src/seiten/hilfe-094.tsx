/**
 * Absatz „Bausteine ziehen“ (094) für die Hilfe „Gestalten“. Der Orchestrator setzt den Inhalt zwischen die Marken
 * `{/* >> 094 *\/}` und `{/* << 094 *\/}` in `hilfe-gestalten.tsx` (093) und löscht diese Datei danach.
 */
export const HilfeBausteineZiehen = () => (
	<>
		<h3>Bausteine ziehen</h3>
		<p>
			Eine Karte in der Schublade „Bausteine“ antippen fügt den Baustein hinter der Auswahl ein, wie bisher. Du kannst
			ihn auch an die richtige Stelle ziehen: mit der Maus von der ganzen Karte, am iPad kurz halten oder gleich am Griff
			links. Schon vor dem Loslassen öffnet sich im Blatt eine Lücke, und die Nummern dahinter rücken nach. Loslassen
			fügt ein, ⌘Z nimmt es in einem Schritt zurück. Esc oder Loslassen neben der Seite bricht ab, das Blatt bleibt, wie
			es war. Dieselbe Lücke zeigt sich, wenn du einen Baustein im Blatt verschiebst.
		</p>
	</>
);

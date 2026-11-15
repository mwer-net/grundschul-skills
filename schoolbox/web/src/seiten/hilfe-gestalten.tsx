import type { Abschnitt } from './hilfe-teile';
import { befehlName, BefehlTaste } from './hilfe-teile';
import { Schubladenliste } from './Schubladenliste';

/**
 * Abschnitt „Gestalten“ der Hilfe (Phase 12), nach der Sache geordnet: Grundlagen, Elemente, Aussehen, Seite und
 * eigene Formen. Ein Satz je Sache (53); Einzelheiten zeigt die Oberfläche selbst.
 */
export const GESTALTEN: Abschnitt = {
	id: 'gestalten',
	titel: 'Gestalten',
	inhalt: (
		<>
			<p>
				{'Links neben dem Blatt steht die Leiste mit den Schubladen, jede mit ihrer Taste: '}
				<Schubladenliste />
				{'. '}
				Ein Klick öffnet, ein Klick auf eine andere wechselt, ein zweiter schließt. Die Ebenen bleiben offen, jede
				andere Schublade öffnet daneben.
			</p>

			<h3>Wählen, ziehen, Leiste</h3>
			<p data-hilfe-gestaltung-bewegen>
				Was frei auf dem Blatt liegt, etwa eine Figur, eine Form oder ein Titel, wählst du mit einem Klick, ziehst
				es an seinen Platz, änderst an den Ecken die Größe und drehst es am runden Griff. Mit ⇧ bleibt es auf
				einer Linie und dreht in 15°-Schritten, mit ⌥ entsteht beim Ziehen eine Kopie. Was hinten liegt, wählst
				du mit ⌥-Klick. Über dem gewählten Element steht eine kleine Leiste: Claude, Duplizieren, Löschen und ⋯;
				das ⋯ ist dasselbe Menü wie der Rechtsklick. Alle Einstellungen stehen rechts im Inspektor.
			</p>
			<p data-hilfe-einrasten>
				Beim Ziehen rastet das Element an Seitenmitte, Rändern und anderen Elementen ein, eine rosa Linie zeigt
				woran; mit ⌘ rastet nichts. Die Pfeiltasten schieben um 1 Pixel, mit ⇧ um 10. Solange du G hältst, zeigt
				das Blatt seinen Aufbau: Stapel, Druckrand, Anker und Ausgeblendetes. Am iPad schaltet{' '}
				{befehlName('ansicht.durchblick')} in den Befehlen das um.
			</p>

			<h3>Mehrere Elemente</h3>
			<p data-hilfe-mehrfach>
				Mit ⇧-Klick nimmst du weitere dazu, oder du ziehst auf freier Fläche ein Rechteck auf. Gemeinsam
				verschiebst, drehst, löschst und duplizierst du sie in einem Schritt. Die Leiste zeigt dann
				„Ausrichten“, ab drei Elementen auch mit Verteilen.{' '}
				<span data-hilfe-gruppen>
					{befehlName('auswahl.gruppieren')} (⌘G) macht daraus eine Gruppe, ⇧⌘G löst sie; ein Doppelklick wählt
					ein Teil darin.
				</span>
			</p>

			<h3>Ebenen, Sperren, Anker</h3>
			<p data-hilfe-ebenen>
				Die Schublade „Ebenen“ zeigt jede Seite so, wie die Dinge übereinander liegen: vorne, dann „Bausteine“ mit
				den Aufgaben, dann hinten, ganz unten Rahmen und Fläche der Seite. Eine Zeile ziehst du an einen anderen
				Platz oder auf eine andere Seite, ein Doppelklick auf den Namen benennt um. Rechts in der Zeile blendet das
				Auge aus (dann wird es nicht gedruckt), das Schloss sperrt (
				<BefehlTaste id="auswahl.sperren" />
				). Gesperrtes lässt sich im Blatt nicht wählen; wählst du es in den Ebenen, steht im Inspektor
				„Entsperren“.
			</p>
			<p data-hilfe-anker>
				Soll ein Element bei einer Aufgabe bleiben, ziehst du den Anker ⚓ neben ihm auf die Aufgabe, oder du nimmst{' '}
				{befehlName('auswahl.anhaengen')} im ⋯. Rutscht die Aufgabe weiter oder auf die nächste Seite, geht es
				mit. Den Anker auf eine freie Stelle ziehen oder {befehlName('auswahl.loesen')} löst es wieder.
			</p>

			<h3>Figuren</h3>
			<p data-hilfe-figuren>
				In der Schublade „Figuren“ stehen Willi, Wilma und die anderen Figuren mit ihren Posen. Ein Klick legt die
				Figur an eine freie Stelle der Seite, bei wenig Platz kleiner; gezogen liegt sie, wo du loslässt. {befehlName('auswahl.spiegeln')} (
				<BefehlTaste id="auswahl.spiegeln" />) steht im ⋯ und im Inspektor, dort tauschst du auch Figur oder Pose.
				Eigene Figuren benennst du mit einem Doppelklick auf den Namen um; „Entfernen“ im ⋯ der Kachel nimmst du
				mit „Rückgängig“ zurück. Oben in der Schublade beschreibst du eine neue Figur oder Pose, Claude malt sie
				in Canva, das dauert ein bis zwei Minuten.
			</p>

			<h3>Bilder</h3>
			<p data-hilfe-bilder-frei>
				In der Schublade „Bilder“ legt ein Klick das Bild an eine freie Stelle der Seite, bei wenig Platz kleiner. Ist ein Platzhalter oder
				Bildrahmen gewählt, füllt der Klick ihn. Gezogen liegt das Bild, wo du loslässt; auf ein Bild oder einen
				Platzhalter gezogen tauscht oder füllt es, ein Wort am Zeiger sagt es vorher. Ein gewähltes Bild tauschst
				du über „Bild austauschen“ im ⋯ oder im Inspektor unter „Austauschen“. „Foto
				hochladen“ nimmt mehrere Dateien auf einmal, du kannst sie auch aus dem Finder auf die Schublade oder
				die Seite ziehen. „Entfernen“ im ⋯ einer Kachel nimmt ein Bild heraus, endgültig gelöscht ist es nach 30
				Tagen. {befehlName('auswahl.frei-legen')} holt ein Bild aus dem Stapel frei aufs Blatt.
			</p>
			<p data-hilfe-bild-beschreiben>
				Oben in der Schublade „Bilder“ beschreibst du ein neues Bild, etwa „Willi und Wilma pflanzen eine
				Sonnenblume“, und drückst Enter. Claude malt es in Canva, es steht danach unter „Dieser Ordner“. Figuren
				aus der Schublade sehen in jedem Bild gleich aus.
			</p>
			<p data-hilfe-rahmenstil>
				Im Inspektor unter „Bild“ gibt „Rahmen-Stil“ einem freien Bild einen Rahmen (Polaroid oder Kontur),
				„Form“ schneidet es in einen Kreis, Stern oder eine andere Form. Ein Doppelklick auf ein zugeschnittenes
				Bild verschiebt den Ausschnitt, „Ausschnitt zurücksetzen“ zeigt wieder das ganze Bild.
			</p>

			<h3>Werkzeuge: Text, Formen, Sprechblasen, Zeichnen</h3>
			<p data-hilfe-formen>
				In der Schublade „Werkzeuge“ liegen Titel, Stempel und Etikett, Formen wie Kreis, Rechteck, Stern, Herz,
				Wolke, Linie und Pfeil, Sprechblasen, unter „Zeichnen“ Stift, Form aus Punkten und Konfetti und leere
				Bildrahmen. Ein Klick legt das Element in die Mitte der sichtbaren Seite, gezogen liegt es, wo du
				loslässt. Die Taste eines Werkzeugs steht im Hinweis an seiner Kachel (etwa R für Rechteck, T für Titel):
				Damit ziehst du die Form direkt auf, mit ⇧ dazu oder ⇧-Klick auf die Kachel bleibt das Werkzeug für
				mehrere.
			</p>
			<p data-hilfe-text>
				Titel und Sprechblasen öffnen gleich das Schreiben, du tippst los; Esc beendet es. Schrift, Größe, Farbe,
				Kontur und Bogen stehen im Inspektor. Einzelne Wörter färbst du, indem du sie markierst und in der Leiste
				über dem Text eine Farbe wählst. Den gelben Punkt am Zipfel einer Sprechblase ziehst du zur Figur, die
				spricht.
			</p>
			<p data-hilfe-form-text>
				In einer Form steht kein Text. Für ein Schild legst du einen Titel auf die Form, wählst beide und drückst
				⌘G.
			</p>
			<p data-hilfe-aussehen>
				Füllung, Kontur, Verlauf, gestrichelte Linien, Schatten und Deckkraft stellst du im Inspektor ein. Die
				Farben des Blatts folgen dem Farbschema; Schwarz, Weiß und eigene Farben bleiben.
			</p>

			<h3>Eigene Formen</h3>
			<p data-hilfe-pfad>
				Mit dem Stift zeichnest du freihand; endet der Strich am Anfang, wird die Form gefüllt. Mit „Form aus
				Punkten“ setzt ein Klick eine Ecke, Klicken und Ziehen eine Kurve; Enter oder ein Doppelklick beendet die
				Form offen, ein Klick auf den ersten Punkt schließt sie. Ein Doppelklick auf eine eigene Form zeigt ihre
				Punkte zum Verschieben, ⌥-Klick löscht einen.
			</p>
			<p data-hilfe-kombinieren>
				Aus mehreren Formen wird eine: wählen und im Inspektor unter „Kombinieren“ {befehlName('auswahl.vereinen')}{' '}
				oder {befehlName('auswahl.abziehen')} nehmen, auch über ⌘K. Abziehen nimmt die vorderen Formen aus der
				hintersten heraus, etwa für einen Mond.
			</p>

			<h3>Seite gestalten</h3>
			<p data-hilfe-seitengestaltung>
				Im Reiter „Blatt“ rechts gibst du der Seite unter „Seitenfläche“, „Rahmen“ und „Kopfband“ eine Farbe, einen
				Verlauf oder ein Muster, eine Linie am Rand und ein Band oben. Bei mehreren Seiten wählst du, ob es für
				alle Seiten gilt oder nur für diese. In s/w fallen Fläche und Kopfband weg.
			</p>
			<p data-hilfe-flaeche>
				Platz zwischen den Aufgaben für eigene Gestaltung gibt die „Freie Fläche“ in der Schublade „Bausteine“
				unter „Blatt“. Was darin liegt, rutscht mit den Aufgaben. Ein freies Element kommt mit{' '}
				{befehlName('auswahl.in-stapel')} im ⋯ in eine Fläche.
			</p>

			<h3>Prüfung und Claude</h3>
			<p data-hilfe-pruefung-gestaltung>
				Liegt ein Element im äußersten Rand, außerhalb der Seite oder über einer Aufgabe, meldet es die Prüfung;
				ein Klick auf die Meldung wählt es. Claude kennt dieselben Formen, Figuren und Anker: „Setz Wilma neben
				Aufgabe 2 und gib ihr eine Sprechblase.“ Was Claude baut, änderst du danach wie selbst Gelegtes.
			</p>
		</>
	),
	bilder: [],
};

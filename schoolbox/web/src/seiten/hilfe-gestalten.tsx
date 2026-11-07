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
			<h3>Seite gestalten: Fläche und Rahmen</h3>
			<p data-hilfe-seitengestaltung>
				Im Reiter „Blatt“ rechts steht ganz unten der Abschnitt „Gestaltung“. Dort bekommt die Seite einen Grund: eine
				Farbe, einen Verlauf aus zwei Farben oder ein Muster aus Streifen, Punkten, Karos oder schrägen Linien. Darunter
				wählst du einen Rahmen: eine Linie, doppelt, gestrichelt oder gepunktet, mit Farbe, Stärke, Abstand zum Blattrand
				und runden Ecken. Die Farben des Blatts folgen dem Farbschema; mit dem bunten Kreis wählst du eine eigene Farbe.
				„Gilt für“ entscheidet, ob es nur die Seite betrifft, auf der du gerade bist, oder alle Seiten; eine Seite, die du
				später hinzufügst, bleibt weiß. Druckst du in Schwarz-Weiß, fällt der Grund weg und der Rahmen wird grau; beides
				lässt sich unter „In s/w“ ändern. In den Ebenen stehen Seitenrahmen und Seitenfläche zuunterst; ein Klick darauf
				öffnet diesen Abschnitt. ⌘Z nimmt jede Änderung in einem Schritt zurück.
			</p>
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
			<h3>Ebenen</h3>
			<p data-hilfe-ebenen>
				Die Schublade „Ebenen“ zeigt jede Seite von oben nach unten so, wie die Dinge übereinander liegen: zuerst, was
				vorne liegt, dann der Hauptstapel mit den Aufgaben, dann, was dahinter liegt, ganz unten Seitenrahmen und
				Seitenfläche. Oben in einer Ebene steht, was im Blatt vorne liegt. Rechts in der Zeile blendet das Auge aus
				(es wird dann auch nicht gedruckt, die Zeile wird blass), das Schloss sperrt (im Blatt geht der Klick dann
				durch, in den Ebenen bleibt die Zeile wählbar). Beides geht auch mit{' '}
				<Kuerzel text={kuerzelText({ code: 'KeyH', wahl: true, umschalt: true })} className="text-[length:inherit]" />{' '}
				und{' '}
				<Kuerzel text={kuerzelText({ code: 'KeyL', wahl: true, umschalt: true })} className="text-[length:inherit]" />{' '}
				oder im ⋯ am Element; am iPad stehen Auge und Schloss im ⋯ der Zeile. Ein Doppelklick auf den Namen benennt um,
				leer gelassen gilt wieder der alte Name. Eine Zeile ziehst du an einen anderen Platz in ihrer Ebene, über oder
				unter den Hauptstapel in die andere Ebene oder auf eine andere Seite; die Lage im Blatt bleibt. Mit ⌥ entsteht
				eine Kopie.
			</p>
			{/* << 101 */}

			{/* >> 102 */}
			<h3>Figuren</h3>
			<p data-hilfe-figuren>
				In der Schublade „Figuren“ stehen Willi und Wilma. Ein Klick legt die Figur 150 Pixel breit in die Mitte des
				sichtbaren Teils der Seite, gezogen liegt sie frei, wo du loslässt. Oben in der Schublade wählst du vorher, ob
				die nächste Figur nach links oder nach rechts schaut; das merkt sich die Schoolbox auf diesem Gerät. Danach
				spiegelst du eine gewählte Figur mit{' '}
				<Kuerzel text={kuerzelText({ code: 'KeyH', umschalt: true })} className="text-[length:inherit]" /> oder mit
				„Spiegeln“ in der Leiste darüber, drehst sie dort oder am runden Griff, und an den Ecken bleibt sie beim Größe
				ändern im Verhältnis. Rechts im Inspektor tauschst du sie gegen eine andere Figur, Platz und Größe bleiben. Hältst
				du beim Ziehen ⌘, kommt die Figur wie bisher als Tipp mit Sprechblase in den Stapel. In Schwarz-Weiß druckt Willi
				als Strichzeichnung, Wilma in Graustufen. Als Leitfigur in einer Zeile findest du beide weiter unter „Bausteine“,
				„Bilder“.
			</p>
			{/* << 102 */}

			{/* >> 103 */}
			<h3>Bilder frei aufs Blatt</h3>
			<p data-hilfe-bilder-frei>
				In der Schublade „Bilder“ setzt ein Klick auf ein Bild es ein wie bisher. Ziehst du ein Bild aufs Blatt, liegt
				es dort frei, wo du loslässt, höchstens 320 Pixel breit, und ist gleich gewählt: Dann ziehst du es zurecht,
				änderst an den Ecken die Größe und drehst es am runden Griff. Das Ziel entscheidet mit: Auf ein Bild im Blatt
				gezogen tauscht es dieses aus, Lage und Größe bleiben; in einen Bildplatzhalter gezogen füllt es ihn. Was
				passieren wird, zeigt ein blauer Rahmen und ein Wort am Zeiger. Hältst du beim Ziehen ⌘, kommt das Bild als
				Bild-Baustein in den Stapel, eine Lücke zeigt die Stelle. Ein Foto kannst du auch direkt aus dem Finder auf die
				Seite ziehen: Es wird hochgeladen und liegt dann frei. Ein Bild, das schon im Stapel steht, legst du über ⋯ am
				Baustein mit „Frei legen“ frei; es bleibt an seiner Stelle. Bei einem freien Bild stehen Austauschen und
				Beschreibung rechts im Inspektor unter „Bild“, die Größe unter „Position und Größe“. ⌘Z nimmt jeden Schritt
				zurück.
			</p>
			{/* << 103 */}

			{/* >> 104 */}
			<h3>Formen</h3>
			<p data-hilfe-formen>
				In der Schublade „Formen“ liegen Kreis, Rechteck, Dreieck, Stern, Herz, Pfeil, Wolke, Sechseck und Raute. Ein Klick
				legt die Form in die Mitte der Seite, die du gerade siehst; du kannst sie auch an ihren Platz ziehen. Danach ist sie
				gewählt. Ziehst du sie an den Ecken größer oder breiter, bleiben Rand und runde Ecken gleich dick, nichts wird
				verzerrt. Rechts im Inspektor wechselst du unter „Form“ zu einer anderen Form und stellst Zacken, Ecken, Spitze
				oder Bögen ein. Unter „Füllung und Kontur“ wählst du die Farben: Die Farben des Blatts folgen dem Farbschema, wenn
				du es wechselst; Schwarz, Weiß und eine eigene Farbe bleiben, wie sie sind. „Keine“ lässt die Form leer bzw. ohne
				Rand. Dieselben Farben erreichst du über „Füllung“ und „Kontur“ in der kleinen Leiste an der Form. Mit ⌘K und
				„Stern“ legst du einen Stern ab, ohne die Schublade zu öffnen.
			</p>
			{/* << 104 */}

			{/* >> 105 */}
			<h3>Text und Schmuckschrift</h3>
			<p data-hilfe-text>
				Die Schublade „Text“ (⌥5) zeigt zwei Arten Text, getrennt. Oben steht der Inhalt: Überschrift, Absatz, Tipp und
				Lernziel. Er rastet wie jeder Baustein im Blatt ein, rutscht mit und steht in der Lösung. Darunter steht die
				Schmuckschrift: Titel, Stempel und Etikett. Sie liegt frei wie eine Form, bleibt stehen, wenn Aufgaben rutschen,
				und gehört nicht zur Lösung. Ein Klick legt sie in die Mitte der Seite und öffnet sofort das Schreiben; der
				Platzhalter ist markiert, du tippst einfach drauflos. Esc oder ein Klick daneben beendet das Schreiben.
			</p>
			<p data-hilfe-text-werkzeug>
				Mit T (oder „Text schreiben“ in der Schublade) klickst du an die Stelle, an der der Titel stehen soll. Ziehst du
				stattdessen einen Rahmen auf, bricht der Text an dessen Breite um. Lässt du den Text leer, verschwindet er wieder.
				Anlegen und Schreiben sind zusammen ein Schritt beim Rückgängig-Machen.
			</p>
			<p data-hilfe-text-farbe>
				Ein zweifarbiger Titel geht so: Wort markieren, in der Leiste über dem Text auf den bunten Farbknopf und eine Farbe
				wählen. Das gibt es nur in Schmuckschrift; Inhaltstext bleibt bei Fett, Unterstrichen und Hervorheben. Schrift
				(Fredoka oder Andika), Größe und Farbe des ganzen Textes stellst du in der kleinen Leiste am Element oder rechts im
				Inspektor unter „Text“ ein, dort auch die Ausrichtung und beim Etikett den Hintergrund. An der Ecke ziehst du die
				Schrift größer, an der Seite nur die Breite.
			</p>
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

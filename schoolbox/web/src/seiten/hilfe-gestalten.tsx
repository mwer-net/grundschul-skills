import { Kuerzel } from '../bausteine/Kuerzel';
import { kuerzelText } from '../editor/befehle';
import type { Abschnitt } from './hilfe-teile';
import { Schubladenliste } from './Schubladenliste';

/**
 * Abschnitt „Gestalten“ der Hilfe (Phase 12), nach der Sache geordnet: Grundlagen, Seite, Elemente, Aussehen, Fläche
 * und Vektor.
 */
export const GESTALTEN: Abschnitt = {
	id: 'gestalten',
	titel: 'Gestalten',
	inhalt: (
		<>
			<p>
				{'Links neben dem Blatt steht die Leiste mit den Schubladen. Jede hat ihre eigene Taste: '}
				<Schubladenliste />
				{'. '}
				Ein Klick öffnet eine Schublade, ein Klick auf eine andere wechselt, ein zweiter Klick schließt sie, und
				das Blatt bekommt den Platz. Mit der Stecknadel im Kopf der Ebenen bleiben sie unter jeder anderen
				Schublade offen; den Teiler dazwischen ziehst du nach oben oder unten.
			</p>
			<h3>Bausteine ziehen</h3>
			<p>
				Eine Karte in der Schublade „Bausteine“ antippen fügt den Baustein hinter der Auswahl ein, wie bisher.
				Du kannst ihn auch an die richtige Stelle ziehen: mit der Maus von der ganzen Karte, am iPad kurz halten
				oder gleich am Griff links. Schon vor dem Loslassen öffnet sich im Blatt eine Lücke, und die Nummern
				dahinter rücken nach. Loslassen fügt ein, ⌘Z nimmt es in einem Schritt zurück. Esc oder Loslassen neben
				der Seite bricht ab, das Blatt bleibt, wie es war. Dieselbe Lücke zeigt sich, wenn du einen Baustein im
				Blatt verschiebst.
			</p>

			<h3>Leiste am Element und Inspektor</h3>
			<p>
				Ist ein Bild, eine Figur, eine Form oder ein anderes Gestaltungselement gewählt, steht darüber eine
				eigene kleine Leiste mit „Drehen“ und ⋯ für Duplizieren, Kopieren, Löschen und Claude fragen. Rechts im
				Inspektor stellst du Position und Größe in Pixeln, die Ebene (vorne oder hinten) und den Druck ein: ob
				es in s/w grau bleibt oder wegfällt und ob es immer, nur in der Lösung oder nicht in der Lösung
				erscheint.
			</p>

			<h3>Einrasten, Reihenfolge, Durchblick</h3>
			<p data-hilfe-einrasten>
				Beim Ziehen und beim Größe ändern rastet das Element an der Mitte der Seite, am Innenrand, am Druckrand,
				an den Kanten und Mitten anderer Gestaltungselemente und an den Kanten der Bausteine ein; eine rosa
				Linie zeigt, woran. Hältst du dabei ⌘, rastet nichts ein. Die Pfeiltasten schieben ein gewähltes Element
				um 1 Pixel, mit ⇧ um 10 Pixel; ist ein Baustein gewählt, wählen sie wie bisher den nächsten. Was vorne
				oder hinten liegt, ändern ⌥⇧⌘F (nach vorne), ⇧⌘F (ganz nach vorne), ⌥⇧⌘B (nach hinten) und ⇧⌘B (ganz
				nach hinten), auch im ⋯ der Leiste. Liegt es schon ganz vorne in der Ebene „hinten“, wechselt es nach
				„vorne“, und umgekehrt. Solange du G hältst, zeigt das Blatt seinen Aufbau: den Rand des Stapels, den
				Druckrand, Anker und Ausgeblendetes. Lässt du los, sieht es wieder aus wie gedruckt. Am iPad schaltet
				„Durchblick ein/aus“ in der Befehlssuche ⌘K das um.
			</p>

			<h3>Mehrere Elemente auf einmal</h3>
			<p data-hilfe-mehrfach>
				Mit ⇧ und Klick nimmst du weitere Elemente dazu oder wieder weg, in den Ebenen auch mit ⌘ und Klick.
				Oder du ziehst auf einer freien Stelle der Seite ein Rechteck auf: Gewählt ist, was ganz darin liegt.
				Gesperrte und ausgeblendete Elemente bleiben dabei außen vor. Gemeinsam verschiebst, drehst und
				vergrößerst du sie, die Pfeiltasten schieben alle, ⌫ löscht alle, ⌘D verdoppelt alle. Jede Aktion ist
				ein Schritt, ⌘Z nimmt sie ganz zurück. Ein Klick ohne ⇧ wählt wieder nur ein Element.
			</p>
			<p data-hilfe-ausrichten>
				Die Leiste zeigt bei mehreren „Ausrichten“ und ab drei Elementen „Verteilen“. Ausrichten bringt alle an
				eine Kante oder Mitte der gemeinsamen Auswahl, Verteilen setzt gleiche Abstände. Ein einzelnes Element
				richtest du über „Mehr“ an der Seite aus, innerhalb des Rands. Die Tasten: ⌥A links, ⌥H mittig, ⌥D
				rechts, ⌥W oben, ⌥V senkrecht mittig, ⌥S unten. Rechts im Inspektor stehen Lage und Größe der ganzen
				Auswahl; steht dort „gemischt“, haben die Elemente verschiedene Werte, und ein neuer Wert gilt für alle.
			</p>

			<h3>Ebenen</h3>
			<p data-hilfe-ebenen>
				Die Schublade „Ebenen“ zeigt jede Seite von oben nach unten so, wie die Dinge übereinander liegen:
				zuerst, was vorne liegt, dann der Hauptstapel mit den Aufgaben, dann, was dahinter liegt, ganz unten
				Seitenrahmen und Seitenfläche. Oben in einer Ebene steht, was im Blatt vorne liegt. Rechts in der Zeile
				blendet das Auge aus (es wird dann auch nicht gedruckt, die Zeile wird blass), das Schloss sperrt
				{' (im Blatt geht der Klick dann durch, in den Ebenen bleibt die Zeile wählbar). Beides geht auch mit '}
				<Kuerzel
					text={kuerzelText({ code: 'KeyH', wahl: true, umschalt: true })}
					className="text-[length:inherit]"
				/>
				{' und '}
				<Kuerzel
					text={kuerzelText({ code: 'KeyL', wahl: true, umschalt: true })}
					className="text-[length:inherit]"
				/>
				{' oder im ⋯ am Element; am iPad stehen Auge und Schloss im ⋯ der Zeile. '}
				Ein Doppelklick auf den Namen benennt um, leer gelassen gilt wieder der alte Name. Eine Zeile ziehst du
				an einen anderen Platz in ihrer Ebene, über oder unter den Hauptstapel in die andere Ebene oder auf eine
				andere Seite; die Lage im Blatt bleibt. Mit ⌥ entsteht eine Kopie.
			</p>

			<h3>Anker</h3>
			<p data-hilfe-anker>
				Soll eine Figur oder Form bei einer Aufgabe bleiben, hängst du sie an: Zieh den Anker ⚓ links oben
				neben dem gewählten Element auf die Aufgabe. Sie bekommt einen Rahmen, und am Zeiger steht, woran es
				hängt. Rutscht die Aufgabe danach weiter, weil davor eine dazukommt, oder wandert sie auf die nächste
				Seite, geht das Element mit und behält seinen Platz neben ihr. Anhängen geht an Aufgaben und andere
				Bausteine auf derselben Seite, nicht an reine Textbausteine. Zum Lösen ziehst du den Anker auf eine
				freie Stelle der Seite; das Element bleibt, wo es ist, und liegt dann vorne. Dasselbe geht rechts im
				Inspektor unter „Hängt an“, in den Ebenen durch Ziehen der Zeile auf einen Baustein oder aus ihm heraus,
				und über „Anhängen an Baustein“ bzw. „Vom Baustein lösen“ im ⋯ der Leiste. Am Anker liegt ein Element
				immer vorne. Löschst oder kopierst du die Aufgabe, gehen ihre angehängten Elemente mit; der
				Rückgängig-Knopf nennt sie („Gelöscht, mit Wilma“).
			</p>

			<h3>Prüfung und Gestaltung</h3>
			<p data-hilfe-pruefung-gestaltung>
				Was frei auf der Seite liegt, prüft die Schoolbox eigens. Liegt eine Figur, ein Bild, ein Text oder eine
				Sprechblase im äußersten Rand des Blatts, warnt sie: Dort schneidet der Drucker oft ab. Liegt mehr als
				die Hälfte eines Elements außerhalb der Seite, ist das ein Fehler; der Knopf „In die Seite holen“ bei
				der Meldung schiebt es zurück. Überdeckt etwas vorne eine Aufgabe, steht ein Hinweis da. Ist das
				gewollt, wähle im Inspektor „Darf Inhalt überdecken“. Ausgeblendete Elemente werden nicht gedruckt; auch
				daran erinnert ein Hinweis. Ein Klick auf eine Meldung wählt das Element, auch wenn es gesperrt ist.
			</p>

			<h3>Gestaltung mit Claude</h3>
			<p data-hilfe-gestaltung-claude>
				Claude kennt dieselben Formen, Figuren, Schmuckschriften und Anker wie die Schubladen. Bitte etwa: „Setz
				Wilma rechts neben Aufgabe 2, häng sie an die Aufgabe und gib ihr eine Sprechblase ‚Zähl genau!‘.“ Was
				Claude baut, wählst, ziehst und änderst du danach wie selbst Gelegtes. Bittest du Claude um etwas
				anderes, etwa „leichter“, bleibt deine Gestaltung, wie sie ist.
			</p>
			<p data-hilfe-gestaltung-bewegen>
				Was frei auf dem Blatt liegt, etwa eine Figur, eine Form oder Schmuckschrift, wählst du mit einem Klick.
				Dann ziehst du es an seinen Platz, änderst an den Ecken die Größe und drehst es am runden Griff über dem
				Rahmen. Mit ⇧ bleibt es beim Ziehen auf einer Linie und dreht in 15°-Schritten; mit ⌥ wächst es beim
				Größe ändern von der Mitte aus, und beim Loslassen bleibt das Original liegen und eine Kopie kommt dazu.
				Ziehst du auf die nächste Seite, landet es dort. Esc während des Ziehens bricht ab. Solange du ziehst,
				zeigt eine gestrichelte Linie den Rand, den der Drucker nicht erreicht. Am iPad hältst du den Finger
				kurz, bevor du ziehst. Ein Doppelklick auf Schmuckschrift öffnet den Text. Was hinten liegt, wählst du
				mit ⌥-Klick. Gesperrtes lässt sich im Blatt nicht greifen.
			</p>

			<h3>Seite gestalten: Fläche und Rahmen</h3>
			<p data-hilfe-seitengestaltung>
				Im Reiter „Blatt“ rechts steht ganz unten der Abschnitt „Gestaltung“. Dort bekommt die Seite einen
				Grund: eine Farbe, einen Verlauf aus zwei Farben oder ein Muster aus Streifen, Punkten, Karos oder
				schrägen Linien. Darunter wählst du einen Rahmen: eine Linie, doppelt, gestrichelt oder gepunktet, mit
				Farbe, Stärke, Abstand zum Blattrand und runden Ecken. Die Farben des Blatts folgen dem Farbschema; mit
				dem bunten Kreis wählst du eine eigene Farbe. „Gilt für“ entscheidet, ob es nur die Seite betrifft, auf
				der du gerade bist, oder alle Seiten; eine Seite, die du später hinzufügst, bleibt weiß. Druckst du in
				Schwarz-Weiß, fällt der Grund weg und der Rahmen wird grau; beides lässt sich unter „In s/w“ ändern. In
				den Ebenen stehen Seitenrahmen und Seitenfläche zuunterst; ein Klick darauf öffnet diesen Abschnitt. ⌘Z
				nimmt jede Änderung in einem Schritt zurück.
			</p>

			<h3>Figuren</h3>
			<p data-hilfe-figuren>
				In der Schublade „Figuren“ stehen Willi und Wilma. Ein Klick legt die Figur 150 Pixel breit in die Mitte
				des sichtbaren Teils der Seite, gezogen liegt sie frei, wo du loslässt. Oben in der Schublade wählst du
				vorher, ob die nächste Figur nach links oder nach rechts schaut; das merkt sich die Schoolbox auf diesem
				{' Gerät. Danach spiegelst du eine gewählte Figur mit '}
				<Kuerzel text={kuerzelText({ code: 'KeyH', umschalt: true })} className="text-[length:inherit]" />
				{' oder '}
				mit „Spiegeln“ in der Leiste darüber, drehst sie dort oder am runden Griff, und an den Ecken bleibt sie
				beim Größe ändern im Verhältnis. Rechts im Inspektor tauschst du sie gegen eine andere Figur, Platz und
				Größe bleiben. Hältst du beim Ziehen ⌘, kommt die Figur wie bisher als Tipp mit Sprechblase in den
				Stapel. In Schwarz-Weiß druckt Willi als Strichzeichnung, Wilma in Graustufen. Als Leitfigur in einer
				Zeile findest du beide weiter unter „Bausteine“, „Bilder“.
			</p>
			<p data-hilfe-figur-claude>
				Unten in der Figuren-Schublade steht „Figur von Claude zeichnen lassen …“. Schreib hinein, was du dir
				wünschst, etwa „eine Eule mit Brille“, und drück Enter. Claude zeichnet die Figur auf die Seite, die
				gerade gewählt oder zu sehen ist, und legt sie dir als Vorschlag vor. Nach „Annehmen“ ist sie gewählt
				und lässt sich wie jede Figur verschieben, drehen und vergrößern. Claude zeichnet einfache Figuren,
				keine Fotos oder gemalten Bilder.
			</p>

			<h3>Bilder frei aufs Blatt</h3>
			<p data-hilfe-bilder-frei>
				In der Schublade „Bilder“ setzt ein Klick auf ein Bild es ein wie bisher. Ziehst du ein Bild aufs Blatt,
				liegt es dort frei, wo du loslässt, höchstens 320 Pixel breit, und ist gleich gewählt: Dann ziehst du es
				zurecht, änderst an den Ecken die Größe und drehst es am runden Griff. Das Ziel entscheidet mit: Auf ein
				Bild im Blatt gezogen tauscht es dieses aus, Lage und Größe bleiben; in einen Bildplatzhalter gezogen
				füllt es ihn. Was passieren wird, zeigt ein blauer Rahmen und ein Wort am Zeiger. Hältst du beim Ziehen
				⌘, kommt das Bild als Bild-Baustein in den Stapel, eine Lücke zeigt die Stelle. Ein Foto kannst du auch
				direkt aus dem Finder auf die Seite ziehen: Es wird hochgeladen und liegt dann frei. Ein Bild, das schon
				im Stapel steht, legst du über ⋯ am Baustein mit „Frei legen“ frei; es bleibt an seiner Stelle. Bei
				einem freien Bild stehen Austauschen und Beschreibung rechts im Inspektor unter „Bild“, die Größe unter
				„Position und Größe“. ⌘Z nimmt jeden Schritt zurück.
			</p>

			<h3>Formen</h3>
			<p data-hilfe-formen>
				In der Schublade „Formen“ liegen Kreis, Rechteck, Dreieck, Stern, Herz, Pfeil, Wolke, Sechseck und
				Raute. Ein Klick legt die Form in die Mitte der Seite, die du gerade siehst; du kannst sie auch an ihren
				Platz ziehen. Danach ist sie gewählt. Ziehst du sie an den Ecken größer oder breiter, bleiben Rand und
				runde Ecken gleich dick, nichts wird verzerrt. Rechts im Inspektor wechselst du unter „Form“ zu einer
				anderen Form und stellst Zacken, Ecken, Spitze oder Bögen ein. Unter „Füllung und Kontur“ wählst du die
				Farben: Die Farben des Blatts folgen dem Farbschema, wenn du es wechselst; Schwarz, Weiß und eine eigene
				Farbe bleiben, wie sie sind. „Keine“ lässt die Form leer bzw. ohne Rand. Dieselben Farben erreichst du
				über „Füllung“ und „Kontur“ in der kleinen Leiste an der Form. Mit ⌘K und „Stern“ legst du einen Stern
				ab, ohne die Schublade zu öffnen.
			</p>

			<h3>Formen zeichnen, Sprechblase und Linie</h3>
			<p data-hilfe-werkzeuge>
				Oben in der Schublade „Formen“ stehen die Werkzeuge. Mit R ziehst du ein Rechteck auf, mit O eine
				Ellipse, mit Y ein Sechseck und mit L eine Linie; den Stern gibt es nur über seinen Knopf. Hältst du
				beim Aufziehen ⇧, wird es ein Quadrat, ein Kreis bzw. gleichseitig, die Linie springt in 45°-Schritten.
				Mit ⌥ ziehst du die Form aus der Mitte auf. Ein Klick ohne Ziehen legt die Form in Standardgröße an
				diese Stelle. Danach ist wieder V (Auswahl) aktiv; wer mehrere Formen hintereinander zeichnen will,
				wählt das Werkzeug mit ⇧. Esc bricht ab. Solange du in einer Blase schreibst, sind R, O, Y und L ganz
				normale Buchstaben.
			</p>
			<p data-hilfe-sprechblase>
				Unter „Blasen und Linien“ liegen Sprechblase (rund und eckig), Denkblase, Band, Linie und Pfeil. Ein
				Klick auf eine Blase legt sie ab, „Text“ ist markiert, du tippst einfach los. Den gelben Punkt an der
				Spitze des Zipfels ziehst du zur Figur, die spricht: Über Wilma oder einer anderen Figur rastet er an
				ihrer Mitte ein. Rutscht die Figur später, bleibt der Zipfel stehen. In der Leiste wechselst du unter
				„Art“ zwischen den Blasen und dem Band, der Text bleibt. Passt der Text nicht hinein, wächst die Blase
				nicht von selbst: Zieh sie größer, sonst meldet die Prüfung „abgeschnitten“.
			</p>
			<p data-hilfe-linie>
				Eine gewählte Linie hat zwei Punkte an ihren Enden statt eines Rahmens. Zieh sie, wohin die Linie zeigen
				soll (mit ⇧ in 45°-Schritten). Pfeilspitze oder Punkt am Anfang und Ende stellst du rechts im Inspektor
				unter „Form“ ein; sie haben immer die Farbe der Kontur.
			</p>

			<h3>Text und Schmuckschrift</h3>
			<p data-hilfe-text>
				Die Schublade „Text“ (⌥5) zeigt zwei Arten Text, getrennt. Oben steht der Inhalt: Überschrift, Absatz,
				Tipp und Lernziel. Er rastet wie jeder Baustein im Blatt ein, rutscht mit und steht in der Lösung.
				Darunter steht die Schmuckschrift: Titel, Stempel und Etikett. Sie liegt frei wie eine Form, bleibt
				stehen, wenn Aufgaben rutschen, und gehört nicht zur Lösung. Ein Klick legt sie in die Mitte der Seite
				und öffnet sofort das Schreiben; der Platzhalter ist markiert, du tippst einfach drauflos. Esc oder ein
				Klick daneben beendet das Schreiben.
			</p>
			<p data-hilfe-text-werkzeug>
				Mit T (oder „Text schreiben“ in der Schublade) klickst du an die Stelle, an der der Titel stehen soll.
				Ziehst du stattdessen einen Rahmen auf, bricht der Text an dessen Breite um. Lässt du den Text leer,
				verschwindet er wieder. Anlegen und Schreiben sind zusammen ein Schritt beim Rückgängig-Machen.
			</p>
			<p data-hilfe-text-farbe>
				Ein zweifarbiger Titel geht so: Wort markieren, in der Leiste über dem Text auf den bunten Farbknopf und
				eine Farbe wählen. Das gibt es nur in Schmuckschrift; Inhaltstext bleibt bei Fett, Unterstrichen und
				Hervorheben. Schrift (Fredoka oder Andika), Größe und Farbe des ganzen Textes stellst du in der kleinen
				Leiste am Element oder rechts im Inspektor unter „Text“ ein, dort auch die Ausrichtung und beim Etikett
				den Hintergrund. An der Ecke ziehst du die Schrift größer, an der Seite nur die Breite.
			</p>

			<h3>Verlauf, gestrichelte Kontur, Schatten und Deckkraft</h3>
			<p data-hilfe-aussehen>
				Bei der Füllung einer Form schaltest du oben von „Farbe“ auf „Verlauf“. Ein Verlauf hat zwei Farben;
				linear läuft er in eine Richtung, die du mit „Winkel“ drehst, radial von der Mitte nach außen. Wählst du
				wieder „Farbe“ oder eine einzelne Farbe, ist der Verlauf weg. In s/w wird auch ein Verlauf grau. Unter
				„Linie“ wird die Kontur gestrichelt oder gepunktet, mit eckigen oder runden Enden; machst du sie dicker,
				wachsen Striche und Lücken mit. „Schatten“ legt einen weichen grauen Schatten unter Formen,
				Schmuckschrift, Bilder und Figuren, leicht, mittel oder stark. Mit „Deckkraft“ wird ein Element blasser,
				bis 10 %, zum Beispiel ein Foto, das hinten als Hintergrund liegt. Bei Bildern und Figuren findest du
				Schatten und Deckkraft im Inspektor unter „Bild“. Jede Änderung nimmst du mit ⌘Z zurück, beim Regler
				zählt erst das Loslassen.
			</p>

			<h3>Konfetti, Punkte und Sterne</h3>
			<p data-hilfe-streuung>
				Mit dem Werkzeug „Streuen“ ziehst du eine Fläche voller Konfetti auf; ein Klick ohne Ziehen legt sie in
				Standardgröße an. Die Streuung liegt immer hinten, also nie über deinen Aufgaben, und fällt in s/w weg.
				Das ändert der Inspektor unter „Druck“. Im Inspektor unter „Streuung“ machst du daraus Punkte oder
				Sterne und stellst Formen, Farben, Größe und Dichte ein. Punkte werden zur nächsten Blattecke hin
				dichter. „Würfeln“ verteilt alles neu; jede Änderung ist ein Schritt, den du mit ⌘Z zurücknimmst. Eine
				Streuung hat höchstens 200 Teile.
			</p>

			<h3>Kontur und Titel im Bogen</h3>
			<p data-hilfe-kontur-bogen>
				Ein Titel bekommt eine Kontur: Titel wählen, in der Leiste am Element auf „Kontur“ und „Kontur an“. Das
				gibt 6 Pixel in Weiß, damit dunkle Buchstaben auch auf Bild oder Farbe gut lesbar bleiben. Stärke (0 bis
				16 Pixel) und Farbe änderst du dort oder rechts im Inspektor. Die Kontur liegt hinter den Buchstaben,
				sie werden also nicht dünner. In s/w bleibt eine weiße Kontur weiß. In der Schublade „Text“ gibt es
				beide Titel auch als fertige Kacheln: „Titel mit Kontur“ und „Titel im Bogen“.
			</p>
			<p data-hilfe-bogen>
				Mit „Bogen“ in der Leiste wird aus einem Titel ein Titel im Bogen, und mit „Bogen aus“ wieder ein
				gerader Titel. Lage, Farbe, Schrift, Größe und Kontur bleiben, nur Farben einzelner Wörter gehen
				verloren (der Knopf warnt vorher). Beim Titel im Bogen ändert der Regler „Krümmung“ die Wölbung, von
				nach unten bis nach oben. Den Text schreibst du in dem Feld in der Leiste: Doppelklick auf den Bogen
				springt hinein, Enter oder ein Klick daneben übernimmt, Esc verwirft.
			</p>

			<h3>Rahmen für Fotos, Bild in Form, Ausschnitt</h3>
			<p data-hilfe-rahmenstil>
				Ein freies Bild bekommt über „Rahmen-Stil“ in der Leiste oder rechts im Inspektor unter „Bild“ einen
				Rahmen: schräg mit dünnem weißem Rand, als Polaroid mit breitem Rand unten, rund oder mit Kontur wie ein
				Sticker. „Gerade“ nimmt den Rahmen wieder weg. Unter „Maske“ schneidest du das Bild in eine Form, etwa
				einen Stern, ein Herz oder eine Wolke. Maske und Rahmen-Stil schließen sich aus: Wählst du das eine, ist
				das andere weg.
			</p>
			<p data-hilfe-bildrahmen>
				In der Schublade „Formen“ liegen unter „Bildrahmen“ leere Rahmen als Kreis, Rechteck, Stern und Wolke.
				Ein leerer Rahmen ist grau und meldet in der Prüfung „Platzhalter“, damit er nicht leer in den Druck
				geht. Zieh ein Bild aus der Schublade „Bilder“ hinein, oder wähl den Rahmen und klick auf ein Bild. Auch
				auf eine Form ohne Text kannst du ein Bild ziehen: Am Zeiger steht „zuschneiden“, die Form verschwindet,
				und das Bild liegt in ihrer Form an ihrer Stelle. ⌘Z holt die Form zurück.
			</p>
			<p data-hilfe-ausschnitt>
				Ist ein Bild zugeschnitten, wählst du mit einem Doppelklick den Ausschnitt: Am Zeiger steht
				„Ausschnitt“, und du schiebst das Bild im Rahmen hin und her. Esc oder ein Klick daneben beendet das.
				„Zuschnitt zurücksetzen“ im Inspektor zeigt wieder das ganze Bild.
			</p>

			<h3>Fläche im Stapel</h3>
			<p data-hilfe-flaeche>
				Eine Fläche ist ein Stück Platz zwischen deinen Aufgaben, das du frei gestaltest. Du findest sie in der
				Schublade „Bausteine“ unter „Ordnen“. Alles, was du in die Fläche legst, bleibt beim Drucken in ihr und
				wird an ihrem Rand abgeschnitten. Wird die Fläche höher, rutscht alles darunter nach unten. Die Höhe
				änderst du am Griff in der Mitte der Unterkante oder im Inspektor.
			</p>
			<p data-hilfe-flaeche-hinein>
				Ein Element kommt auf drei Wegen in eine Fläche: Du ziehst es auf eine vorhandene Fläche, du wählst „In
				den Stapel“ im Menü ⋯ der Leiste am Element (dann entsteht eine neue Fläche passender Höhe an der
				Stelle, wo das Element liegt), oder du ziehst es mit gedrückter ⌘-Taste aus der Schublade. Zieht du ein
				Element aus der Fläche auf die Seite, liegt es danach wieder frei vor deinen Aufgaben. Es bleibt dabei
				an derselben Stelle auf dem Blatt. Passt etwas nicht ganz in die Fläche, zeigt dir die Prüfung
				„abgeschnitten“: Mach die Fläche höher oder das Element kleiner.
			</p>
			<p data-hilfe-frei-element>
				Hat Claude ein eigenes Element gebaut, etwa ein Tangram oder eine Lupe, steht es zuerst in der Reihe der
				Aufgaben. Mit „Frei legen“ im ⋯ liegt es an derselben Stelle frei auf dem Blatt. Zurück in die Reihe
				kommt es nur über „In den Stapel“, dann steht es in einer Fläche.
			</p>

			<h3>Gruppen</h3>
			<p data-hilfe-gruppen>
				Wähl mehrere Elemente mit ⇧ und drück ⌘G (oder „Gruppieren“ in der Leiste): Sie werden eine Gruppe und
				lassen sich zusammen verschieben, drehen und vergrößern. Ein Doppelklick wählt ein Teil darin, Esc
				wieder die ganze Gruppe. ⇧⌘G löst die Gruppe auf; alles bleibt an seiner Stelle. Gruppieren lassen sich
				nur Elemente derselben Ebene. In den Ebenen klappt eine Gruppe auf und zeigt ihre Teile.
			</p>

			<h3>Eigene Formen zeichnen</h3>
			<p data-hilfe-stift>
				Mit dem Stift (P) zeichnest du freihand, etwa eine Wolke nach deinem Geschmack oder den Umriss eines
				Landes. Beim Loslassen wird der Strich geglättet. Endet er dort, wo er begonnen hat, ist die Form
				geschlossen und gefüllt, sonst bleibt sie eine Linie.
			</p>
			<p data-hilfe-pfad>
				Mit dem Pfad (⇧P) setzt du Punkt für Punkt: Ein Klick setzt eine Ecke, Klicken und Ziehen eine Kurve.
				Enter beendet den Pfad offen, ein Klick auf den ersten Punkt schließt ihn. ⌫ nimmt den letzten Punkt
				zurück, Esc bricht ab.
			</p>
			<p data-hilfe-punkte>
				Ein Doppelklick auf eine eigene Form zeigt ihre Punkte, auch bei Formen, die Claude gezeichnet hat.
				Ziehst du einen Punkt, wandert er; am gewählten Punkt ziehst du die Griffe für die Kurve. ⌥ und Klick
				löscht einen Punkt. Jede Änderung ist ein Schritt, ⌘Z nimmt sie zurück. Esc oder ein Klick daneben
				beendet das Bearbeiten.
			</p>

			<h3>Formen kombinieren</h3>
			<p data-hilfe-kombinieren>
				Aus mehreren Formen wird eine: Wähl sie mit ⇧ und nimm im Inspektor unter „Form“ Vereinen, Abziehen,
				Schnitt oder Ausschluss (auch im ⋯ und mit ⌘K). Abziehen nimmt alle vorderen Formen aus der hintersten
				heraus, so entsteht zum Beispiel ein Loch. Das Ergebnis ist eine eigene Form, die du wie jeden Pfad
				bearbeitest; Ecken, Zacken und andere Einstellungen der alten Formen gibt es danach nicht mehr.
			</p>
		</>
	),
	bilder: [],
};

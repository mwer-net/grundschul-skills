# Eine Reihe als Geschichte bauen

Lesen, wenn eine ganze Unterrichtseinheit als Paket entsteht (mehrere Materialien in einem Zug). Wie die Geschichte, die Szenenbilder und die Figuren gestaltet werden, steht in `grundschul-didaktik/references/kindgerecht-gestalten.md`, Abschnitt „Geschichten-Rahmen für eine Reihe“, und in `html-materialerstellung/references/bilder.md`. Dieser Text regelt, was das Paket enthält und in welcher Reihenfolge es entsteht.

Eine Einheit ist eine Geschichte in Kapiteln, keine Sammlung von Blättern. Die Kinder wollen wissen, wie es weitergeht; jede Stunde bringt die Geschichte ein Stück voran, und nur wer das Ich-kann-Ziel der Stunde erreicht, kommt weiter. Die Geschichte ist der Standard in allen Klassen. Nur wenn die Lehrkraft „ohne Rahmengeschichte“ wählt, bleibt derselbe Aufbau ohne Erzählung: Die Stunden heißen dann nach ihrem Thema, Fall-Karte und Rätselkette entfallen.

## 1. Erst die Geschichte, dann die Blätter

Vor dem ersten Material steht der Plan der ganzen Geschichte:

- **Das Problem:** etwas ist verschwunden, kaputt, verschlossen oder rätselhaft, und es lässt sich nur mit dem lösen, was die Reihe lehrt. In Klasse 3/4 darf es eine Forschungsreise, eine Werkstatt, eine Expedition oder ein Auftrag sein statt eines Kriminalfalls.
- **Der Ort und die Figuren:** Willi und Wilma, wie im Auftrag gewählt, mit festen Rollen (einer zeigt das Beispiel und denkt laut, die andere schreibt auf und gibt Tipps), dazu höchstens zwei Nebenfiguren mit fester Beschreibung.
- **Je Stunde ein Kapitel:** ein Satz, was geschieht; das Rätsel des Kapitels ist das Ich-kann-Ziel der Stunde. Die Kapitel bauen aufeinander auf wie die Ziele (Einführung → Übung → Vertiefung → Anwendung → Überprüfung).
- **Die Rätselkette:** Jedes Kapitel endet mit einem Beweis-Rätsel, das nur löst, wer die Aufgaben der Stunde gelöst hat. Es liefert ein Stück der Lösung (Buchstabe, Zahl, Puzzleteil, Stempel), das die Kinder auf einer Sammelkarte eintragen. Alle Stücke zusammen lösen das Problem.
- **Wer dahintersteckt:** Hinter dem Problem steht jemand mit einem freundlichen Grund (die Elster sammelt Glänzendes für ihr Nest, der Uhrmacher wollte einmal ausschlafen). Die Kinder kennen ihn bis zum letzten Kapitel nicht. Jedes Kapitel bringt eine Spur näher, und in jedem Szenenbild ist diese Spur zu entdecken (eine Feder, ein Abdruck, ein offenes Fenster). Welche Spur das ist, steht auf der Seite für die Lehrkraft.
- **Die Kinder gehören dazu:** Sie sind Detektive, Forscherinnen oder Lehrlinge der Werkstatt, mit einem Namen für die Gruppe, einem Ausweis oder Pass und einem kurzen Ritual zu Beginn jeder Stunde (Ausweis zeigen, Losung sagen).
- **Je Kapitel eine eigene Idee:** Auf jedem Niveau steht mindestens eine Aufgabe, die es nur in dieser Geschichte gibt und die die Handlung voranbringt: Zeugen befragen und ihre Aussagen ordnen, eine Geheimschrift entschlüsseln, den Bauplan einer Maschine ergänzen, ein Phantombild nach Beschreibung zeichnen, eine eigene Spur für ein anderes Kind legen. Eine übliche Aufgabe mit dem Namen der Figur im Satz zählt nicht. Kein Kapitel wiederholt die Idee eines anderen. Die übrigen Aufgaben üben, wie es das Ziel verlangt.
- **Die Auflösung:** Das letzte Kapitel löst alles auf, freundlich und ohne Schuldige, die bloßgestellt werden. Es ist zugleich die Lernzielkontrolle („Prüfung der Detektive“) und endet mit einer Urkunde.

Die Rätselkette vor dem Bauen einmal durchrechnen: Ergeben die Stücke wirklich das Lösungswort? Kommt jedes Stück genau einmal vor?

## 2. Was zum Paket gehört

| Dokument | Inhalt |
|---|---|
| Einführung und Überblick | Deckblatt; für die Lehrkraft: so funktioniert die Reihe, die Figuren, der Ablauf jeder Stunde, Reihenübersicht als Tabelle (Stunde, Kapitel, Ich-kann-Ziel, Material), Bezug zum Bildungsplan, was auf keinen Fall vorab gezeigt wird |
| Je Stunde ein Dokument („Fall 1 …“, „Kapitel 1 …“) | Seite für die Lehrkraft, Fall-Karte, Arbeitsblätter der Stunde (Abschnitt 3) |
| Begleitmaterial | Sammelkarte für die Rätselkette, Ausweis oder Forscherpass, Plakate, Wort- und Bildkarten, Lernspiel, soweit der Auftrag sie nennt |
| Abschluss | Lernzielkontrolle im Gewand der Geschichte, Erwartungshorizont, Urkunde |
| Lösungen | zu allen Blättern, wenn sie nicht schon in den Dokumenten stehen |

Soll die Reihe verkauft werden, kommen Deckblatt, Handreichung, Quellenverzeichnis und Angebotstext dazu: `html-materialerstellung/references/verkauf.md`.

Wie viele Stunden die Reihe hat, folgt aus Dauer und Stunden je Woche im Auftrag. Reicht die erlaubte Zahl der Dokumente nicht für jede Stunde, fasst ein Dokument zwei Stunden zusammen; es fällt keine Stunde weg.

## 3. Ein Kapitel-Dokument

Jedes Kapitel ist ein Dokument mit denselben Seiten in derselben Reihenfolge. Die Seiten sind feste Bausteine des Kits; das geprüfte Muster mit allen vier Seitenarten ist `html-materialerstellung/assets/beispiel-reihe-kapitel.html`. Übernimm seinen Aufbau Klasse für Klasse und ändere nur Inhalt und Thema.

1. **Seite für die Lehrkraft** (`seite lk`): Titel des Kapitels, Stunde und Thema, Ich-kann-Ziel, Material, dann der Churer Ablauf mit Minuten: Kreisinput (Geschichte vorlesen, Handlung mit echtem Material, lautes Vordenken wörtlich), Lernaufgaben (die drei Blätter mit je einem Satz), Reflexion (Beweis-Rätsel, Reflexionsfrage). Dazu „Gut zu wissen“ (typische Fehlvorstellung) und „Wenn die Zeit knapp ist“.
2. **Fall-Karte** (`seite fall`) für den Kreisinput: Szenenbild randlos über die volle Breite mit der Kapitel-Marke im Bild, darunter das Kapitel der Geschichte zum Vorlesen (Kl. 1/2 etwa 60–90 Wörter, Kl. 3/4 bis 150), am Ende die Frage, die in die Stunde führt (`fall-frage`).
3. **Arbeitsblätter ●, ●●, ●●●:** je Niveau eine eigene Seite zum selben Ziel, jede mit dem ganzen Zeitziel (`grundschul-didaktik/references/druck-und-platz.md`, Abschnitt „Menge nach Arbeitszeit“; in der Reihe sind das die Minuten der Lernaufgaben-Phase, meist 20–25). Der Titel greift das Kapitel auf, die Aufgaben stehen in der Geschichte („Hilf Wilma, die Spur zu lesen“), bleiben aber ruhig: keine Szenenbilder zwischen den Aufgaben. Jede Seite trägt den gestrichelten Rahmen, die Kapitel-Marke in der Namenszeile und genau ein Anweisungs-Symbol je Aufgabe; im Tipp steht die Figur in einer Pose, die zum Kapitel passt.
4. **Beweis-Rätsel** (`aufgabe beweis`) am Ende jeder Niveau-Seite, für alle drei Niveaus mit demselben Ergebnis, damit jedes Kind sein Stück der Lösung bekommt.
5. Braucht der Kreisinput ein eigenes Material (Geheimbotschaft, Legevorlage, Bildkarten), steht es als eigene Seite vor den Arbeitsblättern.
6. **Fußzeile der Reihe** (`fuss-zeile`) auf jeder Seite: Titel der Reihe und Kapitel; die Seitenzahl setzt das Kit dazu. Auf sie beziehen sich die Seitenverweise der Lehrkraft-Seite.

Die Lösung jeder Seite entsteht wie immer mit; das Beweis-Rätsel hat seine Lösung auf der Lehrkraft-Seite.

## 4. Reihenfolge beim Bauen

1. Geschichte, Rätselkette und Liste der Dokumente planen und der Lehrkraft zeigen. Gebaut wird nach ihrer Freigabe.
2. Das gemeinsame Aussehen (Thema) und die Figuren-Beschreibungen festlegen.
3. Alle Kapitel-Texte der Geschichte schreiben, dann erst die Szenenbilder erzeugen, mit denselben Figuren-Referenzen in jeder Szene; jedes Bild gegen seinen Text prüfen.
4. Dokument für Dokument bauen, prüfen und ansehen. Erst wenn eines ohne Fehler ist, kommt das nächste.
5. Zum Schluss alle Dokumente gegeneinander lesen: Stimmen Namen, Kapitelzahlen, Seitenverweise, die Stücke der Rätselkette, das Lösungswort? Sieht jede Figur überall gleich aus?

## 5. Prüffragen

- [ ] Die Geschichte hat Anfang, Spannung und Auflösung; jedes Kapitel bringt sie voran
- [ ] Jedes Rätsel ist das Ich-kann-Ziel seiner Stunde, nicht bloß Verpackung
- [ ] Jedes Niveau jedes Kapitels hat eine Aufgabe, die es nur in dieser Geschichte gibt; keine Idee kommt zweimal vor
- [ ] Jedes Szenenbild zeigt die Spur seines Kapitels; wer dahintersteckt, erfährt man erst am Ende
- [ ] Jedes Kapitel ist aus den Bausteinen des Musters gebaut: Lehrkraft-Seite, Fall-Karte, Rahmen, Kapitel-Marke, Symbole, Beweis-Rätsel, Fußzeile
- [ ] Die Rätselkette geht auf; die Sammelkarte hat für jedes Stück einen Platz
- [ ] Jede Stunde hat Lehrkraft-Seite, Fall-Karte und drei gefüllte Niveau-Seiten
- [ ] Jede Niveau-Seite trägt das Zeitziel; kein Kind ist nach fünf Minuten fertig
- [ ] Dieselben Figuren in jedem Bild, die Auflösung wird vorher nirgends verraten
- [ ] Die Reihe deckt die Ziele aus dem Auftrag und den Bildungsplan ab

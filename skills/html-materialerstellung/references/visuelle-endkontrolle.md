# Visuelle Endkontrolle

Pflichtschritt nach dem Bauen, bevor die Lehrkraft etwas sieht. Der Prüfbericht von `blatt.py` prüft Geometrie (Ränder, Überlappung, Abstände, Schrift). Ob eine Abbildung stimmt, ein Beispiel gequetscht wirkt oder ein Kind die Aufgabe versteht, sieht nur der Blick auf das fertige Blatt. Die Endkontrolle findet solche Fehler **selbst** und behebt sie, statt sie der Lehrkraft zu überlassen.

## Ablauf

1. **Voraussetzung:** `blatt.py bauen` ohne FEHLER; WARNUNGEN zu Übersicht (zu viele Aufgaben, zu dicht) behoben.
2. **Vorschau ansehen:** `NAME-s1.png` (jede Seite) und `NAME-loesung-s1.png`.
3. **Gesamtblick** auf die ganze Seite (Abschnitt C, „Fünf-Sekunden-Test").
4. **Ausschnitte prüfen:** `NAME-s1-a1.png`, `-a2.png` … zeigen jede Aufgabe in doppelter Auflösung. **Jeden Ausschnitt einzeln ansehen** und die Checkliste A–F abarbeiten. Enthält das Material KI-Bilder, jedes Bild zusätzlich in seinen vier Vierteln und im Ausschnitt seines Platzes prüfen (Checkliste G, `bilder.md` Abschnitt 2, Schritt 5; in der Schoolbox liegen die Prüfbilder unter `ansicht/bilder/`); in der Seitenvorschau sind diese Fehler zu klein.
5. **Jeden Befund beheben** (Tabelle „Befund → Korrektur"), dann neu bauen und die betroffenen Ausschnitte erneut prüfen.
6. **Wiederholen, bis alle Punkte erfüllt sind**, höchstens drei Runden. Bleibt danach etwas offen, der Lehrkraft die Vorschau mit genau diesem Punkt zeigen.
7. **Erst dann** die Vorschau zeigen, mit einem Satz, was die Endkontrolle korrigiert hat. Weicht das Blatt dabei vom freigegebenen Aufgabenplan ab (Item oder Aufgabe gestrichen), das ausdrücklich nennen.

Die Endkontrolle bewertet streng: Im Zweifel ist es ein Befund. „Sieht im Großen und Ganzen gut aus" ist kein Ergebnis.

## Checkliste je Ausschnitt

**A. Abbildungen stimmen**
- [ ] Anzahlen stimmen mit Aufgabe und Lösung überein (nachzählen: Punkte, Murmeln, Stangen, Striche).
- [ ] Mengen geordnet (Zweierreihen, Fünferstruktur, Zehnerstange), nicht gestreut; jede Menge auf einen Blick erfassbar.
- [ ] Bündel und Markierungen umschließen genau ihre Elemente: keine Kreise, die sich schneiden, nichts halb eingekreist, nichts doppelt.
- [ ] Uhrzeiger, Zahlenstrahl-Teilungen, Stellenwerte fachlich exakt.
- [ ] Gleichartige Abbildungen in einer Reihe gleich groß, gleich ausgerichtet; nichts verzerrt oder abgeschnitten (Bildzuschnitt).

**B. Beispiel klar**
- [ ] Das vorgelöste Beispiel ist so groß wie ein Item und hat denselben Abstand zu den Nachbarn; nichts klebt daran.
- [ ] Jeder Schritt der Aufgabe ist im Beispiel sichtbar, die eingetragene Lösung hebt sich ab (fett).
- [ ] Zahlen, Einheiten und Zeichen mit normalem Abstand („2 Z 3 E = 23"), nicht zusammengeschoben.

**C. Für ein Kind dieser Klasse verständlich (Fünf-Sekunden-Test)**
- [ ] Die Seite als Kind ansehen: Wo fange ich an? Die erste Aufgabe ist sofort zu finden.
- [ ] Für jede Aufgabe: Was soll ich tun? Wohin schreibe ich? Beides in wenigen Sekunden klar.
- [ ] Eine Handlung je Schritt, Anweisung auf einen Blick erfasst, nur bekannte Begriffe und Symbole.
- [ ] Jeder Antwortplatz gehört eindeutig zu einem Item (Nähe, gleiche Spalte).
- [ ] Tipp der Leitfigur steht im Körper seiner Aufgabe über der Item-Reihe und unterbricht keine Reihe.

**D. Keine Darstellungsfehler**
- [ ] Nichts abgeschnitten, nichts überlappt, nichts ragt über Linien oder Rand.
- [ ] Keine ungewollten Umbrüche (einzelnes Wort in der letzten Zeile, „=" oder Einheit am Zeilenanfang, Anweisung über zwei Zeilen, die in eine passen soll).
- [ ] Ziffern sitzen mittig in Nummernkreisen und Kästchen; Linien sichtbar und gleich dick.
- [ ] Eine Schriftart für Text, Größen einheitlich nach Rolle.

**E. Übersicht und Menge**
- [ ] Aufgaben klar voneinander getrennt, Abstände gleich.
- [ ] Die Seite ist gefüllt: kein leerer Streifen unten, kein Kopf oder Fuß, der ein Viertel der Seite nimmt. Bleibt Platz, kommt Arbeit dazu.
- [ ] Die Menge trägt das Zeitziel: Würde ein Kind des Niveaus wirklich so lange daran arbeiten? Drei Aufgaben mit je vier Items sind nach fünf Minuten fertig.
- [ ] Keine Häufung vieler kleiner Elemente ohne Ordnung. Wirkt die Seite unruhig, wird geordnet (Reihen, gleiche Abstände) oder auf die Rückseite verteilt, nicht verkleinert.
- [ ] Das Auge wandert ruhig von oben nach unten; nichts lenkt ab (Deko, Fremdelemente).

**F. Druck und Seiten**
- [ ] Auch in der s/w-Ansicht lesbar; Information nie nur über Farbe. Die s/w-Hinweise (`kontrast-sw`, `farbwort-sw`, `bild-kontrast-sw`) stehen im Lauf der Schoolbox von selbst im Prüfbericht, in der Claude-App mit Bash über `blatt.py bauen --profil sw`; sie sind Hinweise, keine Sperre.
- [ ] Lösungsblatt hat dasselbe Layout, alle Lösungen stehen an der richtigen Stelle.
- [ ] Bilder scharf (kein dpi-Hinweis).

**G. KI-Bilder (je Bild in vier Vierteln und im Ausschnitt des Platzes, jede Figur einzeln)**
- [ ] Bildvertrag abgehakt: jedes Pflichtobjekt mit Zahl, Farbe und Lage da und im Ausschnitt des Platzes ganz zu sehen, nichts Wichtiges in den äußeren 15 %, nichts Verbotenes im Bild.
- [ ] Augen: zwei je Figur, in der Farbe ihrer Beschreibung, frei; kein Gegenstand (Lupe, Brille, Fernglas) mit dem Auge verschmolzen.
- [ ] Arme, Hände, Pfoten und Beine gezählt: keine dritte Hand, keine Pfote ohne Körper, kein Arm, der in einen Gegenstand übergeht.
- [ ] Gehaltene Gegenstände haben einen Griff und eine Pfote daran; nichts schwebt, ohne dass die Geschichte es will.
- [ ] Schwanz, Ohren, Kleidung vollständig und deckend; keine durchscheinenden Figuren, Schleier, Wischer oder Geisterbilder.
- [ ] Jede Figur genau einmal, so wie ihr Referenzbild (Kleidung, Fellfarbe, Augenfarbe, Erkennungszeichen); wiederkehrende Nebenfiguren sehen in allen Szenen der Reihe gleich aus.
- [ ] Jede Figur, die in der Geschichte spricht oder handelt, ist im Bild zu sehen; im Bild tut niemand etwas anderes, als der Text sagt.
- [ ] Schrift und Zahlen nur, wie der Vertrag sie nennt, Zeichen für Zeichen gelesen; sonst keine Buchstaben, Ziffern oder Schriftreste, auch nicht klein an Häusern, Schildern, Kisten oder Kleidung. Längerer Text trägt seinen Inhalt als Ebene (`bilder.md`, Abschnitt 3).
- [ ] Figuren in der Szene: Jede Figur steht, sitzt oder kniet auf etwas; nichts wirkt eingeklebt (anderer Stil, anderer Maßstab, kein Schatten, schwebt); keine Figur liegt als Ebene auf einer Szene.
- [ ] Die Szene füllt den Platz: Handlung in der Bildmitte, Boden oder Standfläche im unteren Drittel, im Ausschnitt keine leere Fläche größer als etwa ein Viertel.
- [ ] Ebenen im Seitenbild: Zettel liegen dort, wo sie hingehören, und verdecken kein Pflichtobjekt. Eine exakte Spur, an der das Rätsel hängt, steht groß neben oder unter dem Bild, nie winzig darauf.
- [ ] Bild und Text passen: dieselbe Figur tut, was die Geschichte sagt; jede Anzahl, die der Text nennt, ist im Bild gezählt und stimmt (Würfelaugen, Fächer, Häuser, Reihen); Gegenstände und Ort stimmen.

**H. Inhalt nachrechnen (einmal je Dokument, nicht je Ausschnitt)**

Der Prüfbericht sieht keine inhaltlichen Fehler. Deshalb jede Aussage, die man nachzählen oder nachrechnen kann, wirklich nachzählen:
- [ ] Jedes Zählwort im Text („die beiden“, „nur ein“, „drei Kinder“, „alle vier“) gegen die Items, Bilder und Karten zählen, auf die es sich bezieht.
- [ ] Jedes Beispiel auf Plakaten, Folien und Merkkästen durchrechnen; jede Lösung gegen ihre Aufgabe rechnen.
- [ ] Fachbegriffe genau so verwenden, wie das Fach-Skill sie erklärt (in Mathematik etwa „wahrscheinlich“, „gleich wahrscheinlich“, „sicher“: `fach-mathematik`).
- [ ] Zahlen, die an mehreren Stellen stehen (Seitenzahl, Anzahl der Karten, Stunden, Bestandteile auf Deckblatt und im Angebotstext), stimmen überall mit dem überein, was das Paket wirklich enthält.
- [ ] Vorder- und Rückseite eines doppelseitigen Bogens passen zueinander (gleiche Reihenfolge, gespiegelt, wo geschnitten wird).

## Befund → Korrektur

| Befund | Korrektur |
|---|---|
| Abbildung ungenau (Anzahl falsch, Kreise schneiden sich, Menge gestreut) | Attribute des `x-…`-Elements prüfen (`n`, `z`, `e`, `zeit`); fehlt eine Darstellung, ein freies Element mit `data-frei` bauen statt freihand zeichnen (`SKILL.md`, „Neues Element“) |
| Beispiel gequetscht | Beispiel auf Item-Größe bringen, Abstand zu den Nachbarn wie in der Reihe; reicht die Breite nicht, ein Item der Reihe streichen, solange `zeit-knapp` nicht meldet (`grundschul-didaktik/references/druck-und-platz.md`, Ende von „Menge nach Arbeitszeit“) |
| Hinweis `thema-layout` oder `thema-klasse` beim Bauen | Eigene Klassen durch Kit-Bausteine ersetzen, Aussehen in `thema.css` (`references/layout.md`, „Baukasten und Thema“) |
| Seite zu voll oder Aufgabe unklar | Zu voll: Reihenfolge nach `grundschul-didaktik/references/druck-und-platz.md`, Ende von „Menge nach Arbeitszeit“, auf der Rückseite (`data-weiter`) beide Seiten füllen; unklare Aufgabe vereinfachen oder ein Beispiel ergänzen; nie Schrift, Abstände oder Schreibflächen von Hand verkleinern |
| Aufgabe mit zwei Darstellungsformen in einer Reihe | Auf eine Form reduzieren, als nummerierte Schritte schreiben oder in zwei Aufgaben teilen (wenn der Richtwert es zulässt) |
| Ungewollter Umbruch | Anweisung kürzen, `--spalten` senken oder `white-space:nowrap` für Rechenzeilen (`.zeile`); nie Schrift unter die Mindestgröße |
| Tipp unterbricht die Reihe oder steht im Kopf | Tipp in den `.koerper` seiner Aufgabe über die Item-Reihe (`references/layout.md`, Abschnitt 3, Punkt 8) |
| Bild zu groß oder unscharf | Breite setzen, Original in voller Auflösung (`bilder.md`) |
| Lösung fehlt oder steht falsch | `data-l`, `loesung=`, `buendel-loesung`, `nur-loesung` im HTML ergänzen und neu bauen |
| Fehler im KI-Bild (Auge, Pfote, doppelte Figur, Schleier, Buchstabe) | Bearbeiten mit „Ändere nur …“ und „behalte alles andere genau gleich“, danach neu prüfen (`bilder.md`, Abschnitt 2a) |
| Anzahl oder Schrift im KI-Bild passt nicht zum Vertrag | Bearbeiten mit „Ändere nur …“ und dem Sollzustand, nach drei Versuchen den Text an das Bild anpassen; nicht neu würfeln, bis es zufällig passt (`bilder.md`, Abschnitt 3; mit Canva die Menge als SVG daneben) |
| Im Bild handelt eine andere Figur als im Text | Text an das Bild anpassen, wenn das Bild sonst gut ist; sonst Bild bearbeiten |
| Figur schwebt oder wirkt eingeklebt, Szene füllt den Platz nicht | Figur nicht verschieben: das Bild mit der Figur darin bearbeiten oder neu erzeugen (`bilder.md`, Abschnitt 2a) |
| Seite wirkt überladen | Zweite Figur, Symbole, Rahmen und Deko streichen (höchstens eine Figur je Arbeitsseite), dann Items kürzen |
| Zahl oder Zählwort stimmt nicht (Abschnitt H) | Text an den Inhalt anpassen, nicht umgekehrt; Lösung und alle Stellen, die dieselbe Zahl nennen, mitziehen |

## Beispiele: was nur die Nahsicht zeigt

- **Blatt ohne Prüffehler (Kl. 2, Zehner und Einer):** Die Kreise um die Zehner schnitten sich, die Murmeln lagen gestreut, das Beispiel klebte an der Abbildung, und fünf Aufgaben mit je drei Darstellungsformen überforderten ein Zweitklasskind. Das war nur im vergrößerten Ausschnitt zu sehen, der Prüfbericht meldete nichts.
- **Szenenbilder einer Reihe:** In Bildern, die in der Seitenvorschau fehlerfrei aussahen, fanden sich eine dritte Hand, ein Lupenring, der mit dem Auge verschmolzen war, eine Pfote ohne Körper und dieselbe Figur zweimal. Das zeigt erst die volle Auflösung, Viertel für Viertel.
- **Bild gegen Text:** Die Bilder zeigten falsche Würfelaugen, neun statt zehn Häuser und leere Zettel, obwohl der Text von Schrift sprach, und die Leitfigur sah in jeder Szene anders aus. Das zeigt nur der Abgleich mit dem Text; daher Bildvertrag, Format nach Platz und die abgenommene Grundpose als Referenz jeder Szene (`bilder.md`).
- **Figur über der Szene:** Eine freigestellte Pose lag als Ebene auf einem Szenenbild. Sie schwebte vor der Wand, das untere Drittel blieb leer, und die Spur des Rätsels war eine winzige Zeichnung. Daher Figuren in der Szene, eine Bühne im Bildvertrag und Spuren groß neben dem Bild (`bilder.md`, Abschnitte 2 bis 4).

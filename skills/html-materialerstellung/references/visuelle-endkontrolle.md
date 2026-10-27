# Visuelle Endkontrolle

Pflichtschritt nach dem Bauen, bevor die Lehrkraft etwas sieht. Der Prüfbericht von `blatt.py` prüft Geometrie (Ränder, Überlappung, Abstände, Schrift, Druckprofil). Ob eine Abbildung stimmt, ein Beispiel gequetscht wirkt oder ein Kind die Aufgabe versteht, sieht nur der Blick auf das fertige Blatt. Die Endkontrolle findet solche Fehler **selbst** und behebt sie, statt sie der Lehrkraft zu überlassen.

## Ablauf

1. **Voraussetzung:** `blatt.py bauen` ohne FEHLER; WARNUNGEN zu Übersicht (zu viele Aufgaben, zu dicht) behoben.
2. **Vorschau ansehen:** `NAME-s1.png` (jede Seite) und `NAME-loesung-s1.png`.
3. **Gesamtblick** auf die ganze Seite (Abschnitt C, „Fünf-Sekunden-Test").
4. **Ausschnitte prüfen:** `NAME-s1-a1.png`, `-a2.png` … zeigen jede Aufgabe in doppelter Auflösung. **Jeden Ausschnitt einzeln ansehen** und die Checkliste A–F abarbeiten. Enthält das Material KI-Bilder, jedes Bild zusätzlich als Originaldatei in Vierteln prüfen (Checkliste G, `bilder.md` Abschnitt 2, Schritt 5); in der Seitenvorschau sind diese Fehler zu klein.
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
- [ ] Eine Handlung pro Aufgabe, Anweisung in einer Zeile, nur bekannte Begriffe und Symbole.
- [ ] Jeder Antwortplatz gehört eindeutig zu einem Item (Nähe, gleiche Spalte).
- [ ] Tipp der Leitfigur steht bei seiner Aufgabe oder mit „Zu 1: …" im Kopf und unterbricht keine Item-Reihe.

**D. Keine Darstellungsfehler**
- [ ] Nichts abgeschnitten, nichts überlappt, nichts ragt über Linien oder Rand.
- [ ] Keine ungewollten Umbrüche (einzelnes Wort in der letzten Zeile, „=" oder Einheit am Zeilenanfang, Anweisung über zwei Zeilen, die in eine passen soll).
- [ ] Ziffern sitzen mittig in Nummernkreisen und Kästchen; Linien sichtbar und gleich dick.
- [ ] Eine Schriftart für Text, Größen einheitlich nach Rolle.

**E. Übersicht und Luft**
- [ ] Aufgaben klar voneinander getrennt, Abstände gleich.
- [ ] Kl. 1/2: sichtbare Luft um jede Aufgabe; keine Häufung vieler kleiner Elemente. Wirkt die Seite voll, wird gestrichen, nicht verkleinert.
- [ ] Das Auge wandert ruhig von oben nach unten; nichts lenkt ab (Deko, Fremdelemente).

**F. Druck und Seiten**
- [ ] s/w: keine Grauflächen, alles kopierfähig; Farbe: auch in Graustufen gedruckt noch lesbar (Information nie nur über Farbe).
- [ ] Lösungsblatt hat dasselbe Layout, alle Lösungen stehen an der richtigen Stelle.
- [ ] Bilder scharf (kein dpi-Hinweis) und im s/w-Profil als Strichzeichnung.

**G. KI-Bilder (je Bild in voller Auflösung, jede Figur einzeln)**
- [ ] Augen: zwei je Figur, in der Farbe ihrer Beschreibung, frei; kein Gegenstand (Lupe, Brille, Fernglas) mit dem Auge verschmolzen.
- [ ] Arme, Hände, Pfoten und Beine gezählt: keine dritte Hand, keine Pfote ohne Körper, kein Arm, der in einen Gegenstand übergeht.
- [ ] Gehaltene Gegenstände haben einen Griff und eine Pfote daran; nichts schwebt, ohne dass die Geschichte es will.
- [ ] Schwanz, Ohren, Kleidung vollständig und deckend; keine durchscheinenden Figuren, Schleier, Wischer oder Geisterbilder.
- [ ] Jede Figur genau einmal, so wie ihr Referenzbild (Kleidung, Fellfarbe, Augenfarbe, Erkennungszeichen); wiederkehrende Nebenfiguren sehen in allen Szenen der Reihe gleich aus.
- [ ] Jede Figur, die in der Geschichte spricht oder handelt, ist im Bild zu sehen; im Bild tut niemand etwas anderes, als der Text sagt.
- [ ] Keine Buchstaben, Ziffern oder Schriftreste, auch nicht klein an Häusern, Schildern, Kisten oder Kleidung.
- [ ] Bild und Text passen: dieselbe Figur tut, was die Geschichte sagt; jede Anzahl, die der Text nennt, stimmt im Bild (Würfelaugen, Fächer, Häuser, Reihen); Gegenstände und Ort stimmen.

## Befund → Korrektur

| Befund | Korrektur |
|---|---|
| Abbildung ungenau (Anzahl falsch, Kreise schneiden sich, Menge gestreut) | Attribute des `x-…`-Elements prüfen (`n`, `z`, `e`, `zeit`); fehlt eine Darstellung, `abbildungen.js` erweitern statt freihand zeichnen |
| Beispiel gequetscht | Beispiel auf Item-Größe bringen, Nachbarn auf 24–32 px Abstand; reicht die Breite nicht, ein Item der Reihe streichen |
| Seite zu voll oder Aufgabe unklar | Zuerst Items kürzen (Kl. 1/2: 3–4 je Aufgabe), dann die schwächste Aufgabe streichen, dann zweite Seite; nie Schrift oder Abstände verkleinern |
| Aufgabe mit zwei Darstellungsformen in einer Reihe | Auf eine Form reduzieren oder in zwei Aufgaben teilen (wenn der Richtwert es zulässt) |
| Ungewollter Umbruch | Anweisung kürzen, `--spalten` senken oder `white-space:nowrap` für Rechenzeilen (`.zeile`); nie Schrift unter die Mindestgröße |
| Tipp unterbricht die Reihe oder steht zwischen Anweisung und Arbeitsfläche | Tipp in den Kopf (`.kopf .tipp`, „Zu 1: …“) oder ans Reihenende |
| Bild zu groß, unscharf oder farbig im s/w-Profil | Breite setzen, Original in voller Auflösung bzw. Strich-Version (`bilder.md`) |
| Lösung fehlt oder steht falsch | `data-l`, `loesung=`, `buendel-loesung`, `nur-loesung` im HTML ergänzen und neu bauen |
| Fehler im KI-Bild (Auge, Pfote, doppelte Figur, Schleier, Buchstabe) | Bearbeiten mit dem Bild als einziger Referenz und „behalte alles andere genau gleich, korrigiere nur …“, danach neu prüfen (`bilder.md`, Abschnitt 2a) |
| Anzahl im KI-Bild passt nicht zum Text | Text an das Bild anpassen oder die Menge als SVG berechnen; nicht neu würfeln, bis es zufällig passt (`bilder.md`, Abschnitt 3) |
| Im Bild handelt eine andere Figur als im Text | Text an das Bild anpassen, wenn das Bild sonst gut ist; sonst Bild bearbeiten |
| Seite wirkt überladen | Zweite Figur, zusätzliche Symbole und Deko streichen (eine Figur je Seite, ein Symbol je Aufgabe), dann Items kürzen |

## Beispiel aus dem Test (Kl. 2, Zehner und Einer)

Ein Blatt bestand die automatische Prüfung ohne Fehler und war trotzdem unbrauchbar: Die Kreise um die Zehner schnitten sich, die Murmeln lagen gestreut, das Beispiel klebte an der Abbildung, und fünf Aufgaben mit je drei Darstellungsformen überforderten ein Zweitklasskind. Am HTML-Blatt fand die Endkontrolle danach noch sich berührende Bündelrahmen (Zeilenabstand in `x-menge` vergrößert), eine Sprechblase zwischen Anweisung und Items (in den Kopf verschoben) und eine zu breite Antwortzeile (auf zwei Zeilen verteilt). Alles das war nur im vergrößerten Ausschnitt zu sehen.

## Beispiel aus der Erprobung (Kl. 1, Reihen mit Szenenbildern)

Zwei Reihen mit je 13 Szenenbildern sahen in der Seitenvorschau fehlerfrei aus. Erst in voller Auflösung, Viertel für Viertel, fanden sich in der ersten Reihe in fünf von 13 Bildern Fehler, unter anderem ein Lupenring, der mit dem Auge verschmolzen war (die Lupe ohne Griff), eine dritte Hand, ein Arm, der in eine Feder überging, eine Pfote ohne Körper; in einem anderen Set war dieselbe Figur zweimal zu sehen, mit verschiedenen Mützen. Die zweite Reihe hatte ganz andere Fehler, die nur der Abgleich mit dem Text zeigt: falsche Würfelaugen, Eierkartons mit falscher Fächerzahl, neun statt zehn Häuser, eine durchscheinende Geisterfigur und ein „D“ an einer Hauswand. Eine Reparatur mit „Augen wie bei Wilma“ gab Willi Wilmas Augenfarbe und Wimpern; erst „dunkelbraune Augen ohne Wimpern“ war richtig.

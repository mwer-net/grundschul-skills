# Visuelle Endkontrolle

Pflichtschritt nach dem Bauen, bevor die Lehrkraft etwas sieht. `layout_check.py` prüft Geometrie (Ränder, Überlappung, Abstände, Fülle). Ob eine Abbildung stimmt, ein Beispiel gequetscht wirkt oder ein Kind die Aufgabe versteht, sieht nur der Blick auf das fertige Blatt. Die Endkontrolle findet solche Fehler **selbst** und behebt sie, statt sie der Lehrkraft zu überlassen.

## Ablauf

1. **Voraussetzung:** `layout_check.py --klasse K` (bzw. mit `--farbe`) ohne FEHLER und ohne Übersichts-Warnungen (zu viele Aufgaben, zu volle Seite, gequetscht).
2. **Vorschau holen:** `read-design` mit `filter.fields: ["thumbnails"]` (oder das Vorschaubild aus der letzten `edit-design`-Antwort), jede Seite inklusive Lösungsblatt.
3. **Gesamtblick** auf die ganze Seite (Abschnitt C, „Fünf-Sekunden-Test").
4. **Ausschnitte vergrößert prüfen.** Das Vorschaubild ist nur ca. 424 × 600 px groß; Fehler in Abbildungen fallen darin erst vergrößert auf. Liegt es als Datei vor:
   `python3 scripts/sichtpruefung.py vorschau.png --design design.json [--farbe]`
   schneidet Kopf, jede Aufgabe und Fuß einzeln aus und vergrößert sie. **Jeden Ausschnitt einzeln ansehen** und die Checkliste A–F abarbeiten. Ohne Datei die Vorschau Abschnitt für Abschnitt ansehen und Zweifelsfälle an den Koordinaten aus `design_content` nachmessen.
5. **Jeden Befund beheben** (Tabelle „Befund → Korrektur"), dann `layout_check.py` und die betroffenen Ausschnitte erneut prüfen.
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
- [ ] Tipp der Leitfigur steht bei der Aufgabe, zu der er gehört, und unterbricht keine Item-Reihe.

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
- [ ] s/w: keine Grauflächen, alles kopierfähig; Farbe: Graustufen-Fassung (`--farbe`) noch lesbar.
- [ ] Lösungsblatt hat dasselbe Layout, alle Lösungen stehen an der richtigen Stelle.

## Befund → Korrektur

| Befund | Korrektur |
|---|---|
| Abbildung ungenau (Anzahl falsch, Kreise schneiden sich, Menge gestreut) | Neu als Vektor berechnen: geordnete Anordnung (z. B. 2 × 5 je Zehner), Bündel als Kontur mit 6–8 px Abstand um genau seine Elemente; alte Teile löschen |
| Beispiel gequetscht | Beispiel auf Item-Größe bringen, Nachbarn auf 24–32 px Abstand; reicht die Breite nicht, ein Item der Reihe streichen |
| Seite zu voll oder Aufgabe unklar | Zuerst Items kürzen (Kl. 1/2: 3–4 je Aufgabe), dann die schwächste Aufgabe streichen, dann zweite Seite; nie Schrift oder Abstände verkleinern |
| Aufgabe mit zwei Darstellungsformen in einer Reihe | Auf eine Form reduzieren oder in zwei Aufgaben teilen (wenn der Richtwert es zulässt) |
| Ungewollter Umbruch | Textfeld auf Spaltenbreite (`resize_element`), Anweisung kürzen; nie Schrift unter die Mindestgröße |
| Tipp unterbricht die Reihe | Tipp neben die Anweisung oder an das Reihenende setzen |
| Ziffer nicht mittig, Linie unsichtbar, Bild versetzt | `format_text` `text_align` `"center"` und Textbox auf Kreisbreite; Linie als gefülltes Rechteck; `crop_media` auf 0/0 |
| Lösungsblatt weicht ab | Seite mit `seite_kopieren.py` neu aufbauen, dann Lösungen ergänzen |

## Beispiel aus dem Test (Kl. 2, Zehner und Einer)

Das Blatt hatte `layout_check.py` ohne Fehler bestanden und war trotzdem unbrauchbar: In Aufgabe 1 schnitten sich die Kreise um die Zehner, die Murmeln lagen gestreut, das Beispiel „2 Z 3 E = 23" klebte an der Abbildung, und fünf Aufgaben mit je drei Darstellungsformen machten die Seite für ein Zweitklasskind undurchschaubar. Jeder dieser Punkte wäre im vergrößerten Ausschnitt von Aufgabe 1 (A, B, C, E) aufgefallen. Richtig wären gewesen: Murmeln als 2 × 5-Felder je Zehner mit sauberem Bündelrahmen, das Beispiel in Item-Größe, höchstens vier Aufgaben mit je einer Darstellungsform.

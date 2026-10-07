# Layout und Bearbeitbarkeit in Canva

Ziel: Jedes Material ist **übersichtlich**, hat **keine Darstellungsfehler** (abgeschnitten, überlappend, verrutscht) und lässt sich von der Lehrkraft **ohne Canva-Kenntnisse nachbearbeiten** (Text ändern, Aufgabe tauschen, Block verschieben).

Maße gelten für Canva-Pixel (96 px pro Zoll, 1 cm ≈ 38 px). A4 = 794 × 1123 px; Canva liefert oft US-Letter 816 × 1056 px.

## 1. Satzspiegel und Raster

| Regel | Wert | Warum |
|---|---|---|
| Seitenrand für **alle** Elemente, auch farbige Flächen | 60 px (≈ 1,6 cm); zum Abheften links 76 px | Bürodrucker drucken nicht randlos (4–5 mm), beim Einpassen Letter → A4 verschiebt sich der Inhalt leicht. |
| Absolute Untergrenze | 19 px (5 mm) | Darunter wird abgeschnitten. Canva-KI legt Blöcke gern 16 px vom Rand. |
| Inhaltsspalte | eine Spalte; alle Blöcke gleiche linke Kante, gleiche Breite | Ein Raster macht das Blatt ruhig und erleichtert späteres Platzieren. |
| Abstandsskala | nur 8 / 16 / 24 / 32 / 48 px | Gleiche Abstände wirken geordnet; „fast gleich" (13 px neben 16 px) wirkt fehlerhaft. |
| Innenabstand in Flächen | 16–24 px, rundum gleich | Text klebt sonst am Rand. |
| Abstand zwischen Aufgabenblöcken | 24 px, überall gleich | Blöcke dürfen sich nie berühren. |
| Nähe-Prinzip | Anweisung → ihre Arbeitsfläche: 8–16 px; Block → nächster Block: 24–32 px | Zusammengehöriges steht näher beieinander als Getrenntes. |
| Nummernkreis | feste Spalte links im Block, Anweisung 16 px rechts davon | Kreis und Text dürfen sich nicht überschneiden. |
| Zeilenlänge | höchstens ca. 60 Zeichen | Längere Zeilen verlieren Leseanfänger. |
| Schriftgrößen | höchstens drei: Überschrift, Text, Beschriftung | Klare Hierarchie. |
| Ausrichtung | Fließtext linksbündig, nichts gedreht | Zentrierter oder gedrehter Text ist schwer lesbar und schwer zu bearbeiten. |
| Reihen gleichartiger Elemente (Uhren, Felder) | gleiche Größe, gleicher Abstand, gemeinsam zentriert in der Spalte | Kinder erkennen die Reihe als Einheit. |

**Platzbudget vor dem Bauen:** Höhe des Satzspiegels (Letter 1056 − 120 = 936 px, A4 1123 − 120 = 1003 px) auf Kopf, Blöcke, Abstände und Fußzeile verteilen. Passt es nicht, ein Item streichen oder eine zweite Seite anlegen – nie Abstände oder Ränder zusammenpressen.

## 2. Bearbeitbar bauen

1. **Text bleibt Text.** Keine Schrift in Bildern oder KI-Grafiken, kein Hintergrundbild mit eingebrannten Elementen. Zahlen am Zifferblatt sind Textfelder.
2. **Ein Textfeld pro Sinneinheit:** Anweisung, Beispielsatz, jede Beschriftung. Nicht jede Zeile einzeln, nicht das ganze Blatt in einem Feld.
3. **Kein Layout mit Leerzeichen, Tabs oder Leerzeilen.** Das verrutscht bei der ersten Änderung. Abstand entsteht durch Position, nicht durch Zeichen.
4. **Textfelder mit fester Breite** (`add_text` mit `width`, sonst wächst das Feld unkontrolliert in die Breite): so breit wie die Spalte bzw. der Block abzüglich Innenabstand, nicht auf die Textlänge zugeschnitten. Text wächst dann nach unten. Darunter mindestens eine Zeile Puffer (≥ 8 px, besser 24 px), damit eine Korrektur der Lehrkraft nichts überdeckt. `update_text_anchoring` `"start"` hält die Oberkante fest.
5. **Zusammengesetztes gruppieren** (`group_elements`): jede Uhr (Ziffernblatt, Striche, Zeiger, 12 Ziffern), Zahlenstrahl, Nummernkreis + Ziffer, Leitfigur + Sprechblase + Tipptext, Wachstumsgrafik + Beschriftung. Aufgabenflächen und Anweisungstexte **nicht** mitgruppieren, damit Text direkt anklickbar bleibt.
6. **Ebenen ordnen:** Flächen hinten (`layer_element` `"back"`), Text und Abbildungen davor. Nichts Wichtiges hinter einer Fläche verstecken.
7. **Schreiblinien als Linienform**, alle gleich lang und gleich dick. Keine Unterstrich-Ketten im Fließtext („um ________"): zu niedrig für Kinderschrift, Länge ändert sich mit der Schrift. Ausnahme: `Name: ______  Datum: ______` in der Kopfzeile.
8. **Gleiche Rolle, gleiches Format:** Alle Anweisungen gleiche Größe/Farbe/Schrift, alle Beschriftungen ebenso. Dann kann die Lehrkraft mit „Stil kopieren" oder „Alle ändern" arbeiten.
9. **Nichts sperren.** Die Lehrkraft soll alles ändern können; gesperrte Elemente lassen sich nach dem Duplizieren eines Designs nicht mehr entsperren.
10. **Keine Restelemente:** leere Textfelder, Platzhalterrahmen, unsichtbare oder außerhalb der Seite liegende Elemente, doppelte Linien löschen.
11. **Bilder mit Alternativtext** (`insert_fill` verlangt `alt_text`) und in passender Größe einsetzen, nicht über Blöcke ragen lassen.
12. **Varianten als Seiten** im selben Design (Niveau-Blätter, Lösungsblatt), Titel nach Schema `Kl2_Mathe_Uhrzeit_AB1`.

## 3. Prüfen mit `layout_check.py`

Nach dem Erstellen und nach jeder größeren Korrektur:

1. `read-design` mit `open_transaction: true` und `filter.fields: ["design_content"]` (nur so kommen Positionen und Locator-IDs).
2. Antwort als Datei speichern und prüfen:
   `python3 scripts/layout_check.py design.json --klasse 2`
3. Alle **FEHLER** beheben (abgeschnitten, Druckrand, überlappende Texte, Restelemente). **WARNUNGEN** prüfen und in der Regel beheben (Rand, Berührungen, fehlender Puffer, zu kleine Schrift, uneinheitliche Abstände). **HINWEISE** betreffen die Bearbeitbarkeit (Gruppen, Unterstrich-Linien, Layout per Leerzeichen).
4. Die vom Skript ausgegebenen `group_elements`-Operationen direkt an `edit-design` geben.
5. Erneut lesen und prüfen, bis keine FEHLER mehr bleiben. Dann die Vorschau (`thumbnails`) ansehen: Das Skript sieht Geometrie, nicht Optik.

Ohne Code-Ausführung dieselben Punkte von Hand an den Koordinaten aus `design_content` prüfen (Checkliste unten).

**Große Antworten:** `read-design` kürzt Antworten über ca. 100 000 Zeichen. Ungruppierte Uhren (16 Elemente pro Uhr) sprengen das schnell. Dann zuerst gruppieren oder mit `filter.element_ids` gezielt nachlesen. Das Skript wertet abgeschnittene Antworten bis zur Schnittstelle aus und meldet das.

## 4. Typische Fehler der Canva-KI (aus Tests)

| Befund | Korrektur |
|---|---|
| Aufgabenflächen 16 px vom Seitenrand, Leitfigur 12 px vom oberen Rand | `position_element` / `resize_element` auf den Satzspiegel (60 px) |
| Blöcke berühren sich oder überlappen um 1 px, Abstände 13 / −1 / 4 px | Blöcke neu stapeln: `top` = Ende des vorigen Blocks + 24 px |
| Anweisung beginnt im Nummernkreis | Text auf Kreis-Ende + 16 px setzen, Breite entsprechend verringern |
| Text „Name:" ragt in die eigene Schreiblinie | Linie hinter das Textende + 8 px verschieben |
| Überschrift ohne Abstand zum nächsten Element | Folgeelemente um 16–24 px nach unten |
| Seitenhintergrund als Bild | Weißen Hintergrund lassen; bei Bedarf Bild löschen |
| Aufgabenflächen als Rechtecke mit Bildfüllung | Durch `insert_shape` (Farbe, `corner_rounding` 16) ersetzen, damit die Lehrkraft die Farbe ändern kann |
| px-Angaben im Brief (Rand, Abstand, Schriftgröße) ignoriert, Text umformuliert | Brief nur als Startpunkt nutzen; Layout mit `edit-design` auf das Raster setzen, Text mit `find_and_replace_text` korrigieren |
| Letter-Format 816 × 1056, Inhalt passt nicht ins Platzbudget | `resize-design` auf A4 (neues Design, neue ID), danach Layout neu setzen |
| Uhren als 100+ lose Einzelteile | je Uhr `group_elements` |

## 5. Stolperfallen beim Nachbauen mit `edit-design`

- **Ebenen:** Jedes neue Element liegt ganz oben. Erst Flächen, dann Inhalte einfügen – oder danach `layer_element` (`"back"` für Flächen, `"front"` für verdeckte Ziffern).
- **`add_text`** setzt Canvas Standardschrift in 16 px, nicht die Schrift des Designs. Immer `format_text` nachschicken; Schriftart lässt sich nicht setzen, deshalb längeren Text lieber in vorhandene Textfelder schreiben (`replace_text`).
- **`insert_fill`** schneidet auf das angegebene Seitenverhältnis zu. Maße im Verhältnis des Originals wählen, Ergebnis in der Vorschau prüfen.
- **Textbreite:** Textfelder ohne `width` wachsen in die Breite und laufen über den Rand.
- **Gruppen** erst ganz am Ende bilden; danach sind die Einzelteile nur noch über die Gruppe zu verschieben.

## 6. Checkliste

- [ ] Alle Elemente ≥ 60 px vom Seitenrand, nichts ragt über die Seite
- [ ] Eine Spalte: Blöcke bündig, gleich breit, Abstände einheitlich (8er-Skala)
- [ ] Keine Überlappung außer „Inhalt liegt mit Innenabstand in seiner Fläche"
- [ ] Unter jedem Textfeld Puffer zum Wachsen
- [ ] Textfelder mit fester Breite, kein Layout per Leerzeichen
- [ ] Zusammengesetzte Abbildungen gruppiert, nichts gesperrt, nichts gedreht
- [ ] Schreiblinien als Linienform, gleich lang
- [ ] Keine leeren, doppelten oder unsichtbaren Elemente
- [ ] `layout_check.py` ohne FEHLER, Vorschau angesehen

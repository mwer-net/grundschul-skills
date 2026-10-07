# Visuelle Endkontrolle

Pflichtschritt nach dem Bauen, bevor die Lehrkraft etwas sieht. Der Prüfbericht von `blatt.py` prüft Geometrie (Ränder, Überlappung, Abstände, Schrift, Druckprofil). Ob eine Abbildung stimmt, ein Beispiel gequetscht wirkt oder ein Kind die Aufgabe versteht, sieht nur der Blick auf das fertige Blatt. Die Endkontrolle findet solche Fehler **selbst** und behebt sie, statt sie der Lehrkraft zu überlassen.

## Ablauf

1. **Voraussetzung:** `blatt.py bauen` ohne FEHLER; WARNUNGEN zu Übersicht (zu viele Aufgaben, zu dicht) behoben.
2. **Vorschau ansehen:** `NAME-s1.png` (jede Seite) und `NAME-loesung-s1.png`.
3. **Gesamtblick** auf die ganze Seite (Abschnitt C, „Fünf-Sekunden-Test").
4. **Ausschnitte prüfen:** `NAME-s1-a1.png`, `-a2.png` … zeigen jede Aufgabe in doppelter Auflösung. **Jeden Ausschnitt einzeln ansehen** und die Checkliste A–F abarbeiten.
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
- [ ] s/w: keine Grauflächen, alles kopierfähig; Farbe: auch in Graustufen gedruckt noch lesbar (Information nie nur über Farbe).
- [ ] Lösungsblatt hat dasselbe Layout, alle Lösungen stehen an der richtigen Stelle.
- [ ] Bilder scharf (kein dpi-Hinweis) und im s/w-Profil als Strichzeichnung.

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

## Beispiel aus dem Test (Kl. 2, Zehner und Einer)

Das Canva-Blatt hatte die automatische Layoutprüfung ohne Fehler bestanden und war trotzdem unbrauchbar: In Aufgabe 1 schnitten sich die Kreise um die Zehner, die Murmeln lagen gestreut, das Beispiel „2 Z 3 E = 23" klebte an der Abbildung, und fünf Aufgaben mit je drei Darstellungsformen machten die Seite für ein Zweitklasskind undurchschaubar. Jeder dieser Punkte wäre im vergrößerten Ausschnitt von Aufgabe 1 (A, B, C, E) aufgefallen. Richtig wären gewesen: Murmeln als 2 × 5-Felder je Zehner mit sauberem Bündelrahmen, das Beispiel in Item-Größe, höchstens vier Aufgaben mit je einer Darstellungsform.

Im HTML-Test (Oktober 2026) fand die Endkontrolle am selben Blatt: Bündelrahmen benachbarter Zehner berührten sich (Zeilenabstand in `x-menge` vergrößert), die Willi-Sprechblase stand zwischen Anweisung und Nüssen (in den Kopf verschoben) und die Antwortzeile „__ Z __ E = __“ war breiter als ihre Spalte (auf zwei Zeilen „__ Z __ E“ / „Zahl: __“ verteilt).

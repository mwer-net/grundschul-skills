# Layout-Regeln für HTML-Material

Ziel: übersichtlich, ohne Darstellungsfehler (abgeschnitten, überlappend, verrutscht), druckfertig in beiden Profilen (`grundschul-didaktik/references/druck-und-platz.md`). `blatt.css` setzt die meisten Regeln schon um; diese Datei sagt, was beim Schreiben des HTML zu beachten ist.

Maße in CSS-px (96 dpi): A4 = 794 × 1123 px, 1 cm ≈ 38 px.

## 1. Raster

| Regel | Wert | Umsetzung |
|---|---|---|
| Seitenrand | 60 px für alles (Bürodrucker drucken nicht randlos) | `.seite` hat das Padding; nichts mit negativen Rändern oder `position:absolute` hinausschieben |
| Spalte | eine Inhaltsspalte, alle Aufgaben bündig | `.aufgabe` mit hängender Nummer |
| Aufgaben | ohne Kasten, ohne Fläche | keine `background` oder `border` an Aufgaben |
| Abstand zwischen Aufgaben | Kl. 1: 36 px, Kl. 2: 28 px, Kl. 3: 28 px, Kl. 4: 24 px; optional Trennlinie (`class="trenner"` am body) | `--abstand`, nur in kleinen Schritten anpassen, nie unter 24 px |
| Nähe | Anweisung → Arbeitsfläche 12–16 px, Aufgabe → Aufgabe deutlich mehr | `.koerper` |
| Nummernkreis | 34 px, gefüllt, weiße Ziffer; ★ für die Sternchenaufgabe | `.nr`, `.nr.stern` |
| Rahmen mit Funktion | nur Sprechblase, Wortspeicher, Antwortkasten: Kontur 2 px, Ecken gerundet | `.blase`, `.box` |
| Zeilenlänge | höchstens ca. 60 Zeichen | lange Anweisungen kürzen |
| Schriftgrößen | höchstens drei: Überschrift, Text, Beschriftung; Mindestgröße der Klasse (Prüfung meldet < 80 % der Textgröße) | nur `.namenszeile` darf kleiner sein |
| Reihen gleichartiger Elemente | gleiche Größe, gleicher Abstand | `.reihe` mit `--spalten`, eine Abbildungsgröße je Reihe |

## 2. Platzbudget

Satzspiegel 1003 px Höhe: Kopf ≤ 170 px, Fuß ≤ 110 px (nur mit Selbsteinschätzung), Rest für Aufgaben. Aufgaben- und Item-Zahl nach dem Richtwert der Klasse (`druck-und-platz.md`); in Kl. 1/2 Übersicht vor Menge. `blatt.py` meldet Überlauf (FEHLER mit px) und Leerraum (HINWEIS). Passt es nicht: Item streichen oder zweite Seite. Bleibt Platz: Kl. 3/4 Item ergänzen, Kl. 1/2 `--abstand` erhöhen.

Faustwerte Kl. 2 (24 px Schrift): Aufgabenzeile 34 px, Uhr 88 px + Antwortlinie ≈ 130 px, Rechenzeile 45 px, Schreiblinie 46 px, Leitfigur mit Sprechblase im Kopf ≈ 95 px.

## 3. Sauberes HTML

1. **Text bleibt Text**, nie in Bildern. Keine Schrift, Zahlen oder Uhren in KI-Bildern.
2. **Kein Layout mit Leerzeichen, `<br>`-Ketten oder Unterstrichen.** Antwortplätze sind `.antwort` oder `.schreiblinie`; Ausnahme ist nur die Namenszeile (CSS-Linien).
3. **Abstände über CSS** (Klassen, `--abstand`, `gap`), nicht über leere Elemente.
4. **Exakte Abbildungen** als `x-…`-Element aus `abbildungen.js`. Fehlt eine Art, SVG berechnen (Python/JS), nicht freihand. Mengen geordnet (Fünferstruktur, Zehnerreihen), Bündel umschließen genau ihre Elemente.
5. **Bilder mit `alt`** und fester Breite (`style="--figur:72px"` bzw. `width`), nie über die Spalte hinaus.
6. **Lösungen im selben Dokument** (`data-l`, `loesung=`, `nur-loesung`); keine zweite Kopie pflegen.
7. **Varianten** (Niveau-Blätter) als weitere `.seite` in derselben Datei; Titel nach Schema `Kl2_Mathe_Uhrzeit_AB1`.
8. **Leitfigur** nie zwischen Anweisung und Arbeitsfläche: in den Kopf (`.kopf .tipp`, „Zu 1: …") oder neben eine Reihe, die Platz hat.

## 4. Checkliste

- [ ] `blatt.py bauen` ohne FEHLER, WARNUNGEN geprüft
- [ ] Eine Spalte, Aufgaben ohne Kasten, Abstände einheitlich
- [ ] Druckprofil eingehalten (s/w: nur Schwarz/Grau, Strichbilder; Farbe: Akzente, keine Flächen, Gelb nie für Linien oder Schrift)
- [ ] Aufgaben- und Item-Zahl im Richtwert, Kl. 1/2 mit Luft
- [ ] Lösungsblatt vollständig und deckungsgleich
- [ ] Visuelle Endkontrolle bestanden (`visuelle-endkontrolle.md`)

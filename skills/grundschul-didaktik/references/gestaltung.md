# Gestaltung von Grundschulmaterial

## Seitenaufbau (A4 Hochformat als Standard)

Die Bausteine (Selbsteinschätzung, Niveaus, Sternchenaufgabe) legt die Start-Abfrage fest (`rueckfragen.md`). Das Schema zeigt alle Bausteine; nicht gewählte entfallen. Das Layout ist kompakt: Der Platz geht an Aufgaben, nicht an Kästen. Farbe und s/w: Abschnitt „Farbe“ unten. Mindestgrößen und Platzbudget: `druck-und-platz.md`.

```
┌──────────────────────────────────────────┐
│ Name: ________   Datum: ______        ●  │  ← Kopfzeile, Niveau der Seite
│ ÜBERSCHRIFT (groß)                       │  ← max. 5 Wörter
│ Ich kann …                               │  ← Ich-kann-Ziel
│                                          │
│ ❶ Anweisung in einem Satz.     [Willi]   │  ← mit „So geht's",
│    ◷   ◷   ◷   ◷   ◷   ◷                 │    Tipp der Leitfigur hier
│ ──────────────────────────────────────── │  ← Abstand, optional dünne Linie
│ ❷ Anweisung …                            │  ← anderes Format, gleiches Ziel
│    …                                     │
│ ❸ … ❹ … ❺ …                              │  ← bis das Zeitziel erreicht ist
│ ★ Sternchenaufgabe: Wer mag, …           │  ← optional, freiwillig für alle
│ ──────────────────────────────────────── │
│ Ich kann …   Samen→Keimling→Pflanze→Blume │  ← Selbsteinschätzung zum Ankreuzen
│ Was hat dir geholfen? ☐ … ☐ … ☐ …        │  ← Reflexionsfrage
└──────────────────────────────────────────┘
```

- Ränder: 60 px (≈ 1,6 cm) rundum (`blatt.css`).
- Menge: so viel, dass ein Kind des Niveaus das Zeitziel braucht (Standard 20 Minuten), jedes Niveau auf eigener Seite, die Seite gefüllt (`druck-und-platz.md`, Abschnitt „Menge nach Arbeitszeit“).
- Lesefluss von oben nach unten, links nach rechts. Keine schräg platzierten Elemente, keine Zwei-Spalten-Texte in Klasse 1/2.
- Aufgaben **ohne Kasten**: hängende Nummer, Abstand zur nächsten Aufgabe nach Klasse (`druck-und-platz.md`). Rahmen nur, wo er eine Funktion hat (Wortspeicher, Sprechblase, Antwortkästchen, Ausschneideteile). Einheitlich im ganzen Material.
- Weißraum gezielt einsetzen: zwischen Aufgaben und als Schreibfläche, nicht als Innenabstand in Rahmen. Kein ungenutzter Leerstreifen, in keiner Klasse.

## Schrift

- Schulschrift oder kindgerechte Druckschrift: in Klasse 1/2 einstöckiges "a" und "g" (wie die Kinder schreiben), "I" (groß i) und "l" (klein L) unterscheidbar, deutliche Ober- und Unterlängen. Bewährt: Andika oder die Druckschrift des Lehrwerks der Klasse. Standard im HTML: Andika (eingebettet in `html-materialerstellung/assets/fonts/`) mit Schulziffern: 1 ohne Fuß, offene 4, 7 mit Querstrich. Für Schreibvorlagen in verbundener Schrift liegt die Vereinfachte Ausgangsschrift bei (`x-lineatur schrift="va"`). Eine andere Schulschrift der Klasse als WOFF2/TTF (Lizenz beachten) in `fonts/` legen und per `@font-face` einbinden.
- Maximal zwei Schriften: eine für Überschriften, eine für alles andere.
- Keine Großbuchstaben-Texte, kein Kursivsatz, keine Schmuckschriften für Lesetext. Hervorhebung durch Fettdruck.
- Größen siehe Tabelle im SKILL.md. Überschriften ca. 1,5-fach.
- Silbenfärbung oder Silbenbögen nur, wenn die Klasse damit arbeitet (Lehrwerk) – die Forschungslage zur generellen Wirksamkeit ist uneinheitlich.

## Lineatur und Schreibflächen

Schreibzeilen immer mit `x-lineatur` (Katalog `html-materialerstellung/references/abbildungen.md`), nie von Hand zeichnen. Originalgröße drucken.

| Klasse | Lineatur | Aufbau |
|---|---|---|
| 1 | Lineatur 1 | vier Linien, Abstand 5 mm |
| 2 | Lineatur 2 | vier Linien, Abstand 4 mm |
| 3 | Lineatur 3 | Mittelband 3,5 mm, ohne Ober- und Unterlinie |
| 4 | Lineatur 4 | einzelne Linien, Abstand 9 mm |
| Mathematik, Muster | `karo`, `karo-klein` | 5 mm, 4 mm |

**Mittelband:** Standard sind graue Linien (`#808080`), weil getönte Flächen beim Kopieren wegfallen. Das getönte Band (`mittelband="getoent"`) nur auf Wunsch der Lehrkraft.

Mathe: Kästchen 1 cm (Kl. 1) bzw. 0,5 cm (ab Kl. 2/3), passend zum Heft der Klasse; Gitter mit Figuren: `x-gitter`.
Schreibfläche immer größer als gedacht: Kinderhandschrift braucht Platz.

## Bilder und Illustrationen

- Funktional: Das Bild trägt Information (Anlaut, Mengenbild, Sachabbildung), wird zum Lösen gebraucht oder gibt als Leitfigur (Willi/Wilma Waschbär) einen Tipp. Weglass-Test und Dosierung: `kindgerecht-gestalten.md`.
- Eindeutig: Ein Bild, ein Begriff. Bei Anlautbildern Mehrdeutigkeiten vermeiden (Hund vs. Dackel, Auto vs. PKW).
- Stil: flache Illustration in der Palette, einheitlich im ganzen Material, nicht gemischt mit Fotos. Eine **Strichzeichnung** (schwarze Konturen, weiße Füllung, keine Graustufenflächen) als `name-strich.png` neben `name.png`, wenn die Kinder anmalen sollen: Der s/w-Druck nimmt sie von selbst, wenn das Seitenverhältnis gleich ist; sonst wird das Bild in Graustufen gedruckt.
- Für Ausmalaufgaben: klare schwarze Konturen, keine Graustufenflächen.
- Sachunterricht: Bei Tieren, Pflanzen, Körperteilen realistische Darstellung. Keine Comicverzerrung bei Fachinhalten.
- Alle Bilder brauchen Platz zur Beschriftung, wenn Kinder beschriften sollen.
- **Keine Hände, Finger oder anderen Körperteile als selbst gezeichnetes SVG** (auch nicht als Zeigehand an einer Aufgabe): Sie wirken unbeholfen und verderben die ganze Seite. Eine Geste zeigt die Leitfigur als fertige Grafik, einen Hinweis ein Pfeil oder ein kurzes Wort.

## Farbe

- **Jedes Material wird in Farbe angelegt** (`<body class="kl2 farbe palette-…">`): eine Palette als Akzent, Text schwarz, keine Flächen hinter Aufgaben. Details: `druck-und-platz.md`.
- **s/w ist eine Ansicht, keine eigene Fassung.** In der Schoolbox schaltet die Lehrkraft jedes Blatt per Knopf um, außerhalb baut `blatt.py bauen --profil sw` das s/w-PDF. Farben, Flächen und Bilder werden dabei umgerechnet, das Layout bleibt gleich. Deshalb nie fragen, ob farbig oder s/w gedruckt wird, und kein eigenes s/w-Blatt anlegen. Folien bleiben farbig.
- **Pflicht: Information nie nur über Farbe**, weil jedes Blatt auch in s/w funktionieren muss: zusätzlich Symbol, Muster, Linienart oder Beschriftung. In der Anweisung nie allein über die Farbe auf etwas zeigen („Kreise die rote Zahl ein“). Die s/w-Ansicht meldet schwachen Kontrast und Farbwörter als Hinweis.
- Niveaus (falls gewählt) nie farblich unterscheiden, nur mit Punkten (gleiche Optik auf allen Niveaus).
- Farbcodes der Klasse (Klassenkonvention prüfen): Wortarten (oft Nomen blau, Verben rot, Adjektive grün), Artikel (der blau, die rot, das grün, DaZ), Stellenwerte (oft Einer blau, Zehner rot, Hunderter grün). Farbcodes werden direkt farbig gesetzt; die Kategorie steht zusätzlich als Buchstabe, Wort oder Symbol dabei (E/Z/H, „Nomen"), damit sie auch in s/w lesbar bleibt.

## Arbeitsanweisungs-Symbole (Vorschlag für einheitliches Set)

| Symbol | Bedeutung |
|---|---|
| ✏️ Stift | schreiben |
| 🖍️ Buntstift | ausmalen / farbig markieren |
| 👁️ Auge / 📖 Buch | lesen |
| 👂 Ohr | zuhören |
| 💬 Sprechblase | sprechen / erzählen |
| ✂️ Schere | ausschneiden |
| 🧴 Kleber | aufkleben |
| 🔗 Linie | verbinden |
| ✔️ Kreis | ankreuzen / einkreisen |
| 👤 / 👥 / 👨‍👩‍👧 | Einzel- / Partner- / Gruppenarbeit |
| 🔢 Rechenzeichen | rechnen |
| ● ●● ●●● | Niveau: Grundlage / Kern / Herausforderung (falls Churer Modell gewählt) |
| ★ | Sternchenaufgabe, freiwillig für alle (falls gewählt) |

Grundsatz: Ist in der Klasse schon ein Symbolset eingeführt (Lehrwerk, Metacom), immer dieses verwenden. Symbole immer gleich groß, nach der Nummer direkt vor dem Anweisungstext. **Genau ein Symbol pro Aufgabe**, das für die Haupthandlung; mehrere Symbole nebeneinander machen die Anweisung unruhiger statt klarer. Im Material als schwarze Linien-Icons, nie als farbige Emojis; die Emojis oben stehen nur für die Bedeutung. Am wichtigsten sind sie in Kl. 1/2 und für leseschwache Kinder.

## Arbeitsanweisungen formulieren

- Ein Verb, eine Handlung pro Satz. Verb an den Anfang (Imperativ, Du-Form): "Male die Hunde blau an."
- Keine Verneinungen, keine Doppelaufträge in Klasse 1/2.
- Gleiche Aufgabe = gleiche Formulierung im ganzen Material.
- Bei mehrschrittigen Aufgaben: nummerierte Schritte untereinander.
- Beispiel vorgeben ("So geht's:" mit erstem gelöstem Item).

## Barrierearme Zusatzhinweise

- Leseschwache Kinder: Anweisung zusätzlich als Symbol, Text kurz, ggf. QR-Code zu einer Audio-Anweisung.
- Sehbeeinträchtigung: größere Variante (A3 oder 1,4-fach), hohe Kontraste.
- Feinmotorik: größere Schreib-/Schneideflächen, dicke Schneidelinien.

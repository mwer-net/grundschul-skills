# Layout-Regeln für HTML-Material

Ziel: übersichtlich, ohne Darstellungsfehler (abgeschnitten, überlappend, verrutscht), druckfertig in beiden Profilen (`grundschul-didaktik/references/druck-und-platz.md`). `blatt.css` setzt die meisten Regeln schon um; diese Datei sagt, was beim Schreiben des HTML zu beachten ist.

Maße in CSS-px (96 dpi): A4 = 794 × 1123 px, 1 cm ≈ 38 px.

## 1. Raster

| Regel | Wert | Umsetzung |
|---|---|---|
| Seitenrand | 60 px für alles (Bürodrucker drucken nicht randlos) | `.seite` hat das Padding; nichts mit negativen Rändern oder `position:absolute` hinausschieben |
| Spalte | eine Inhaltsspalte, alle Aufgaben bündig | `.aufgabe` mit hängender Nummer |
| Aufgaben | ohne Kasten, ohne Fläche | keine `background` oder `border` an Aufgaben |
| Abstand zwischen Aufgaben | je Klasse, Tabelle in `grundschul-didaktik/references/druck-und-platz.md` | `--abstand`, nur in kleinen Schritten anpassen, nie unter 24 px |
| Nähe | Anweisung → Arbeitsfläche 12–16 px, Aufgabe → Aufgabe deutlich mehr | `.koerper` |
| Nummernkreis | 34 px, gefüllt, weiße Ziffer; ★ für die Sternchenaufgabe | `.nr`, `.nr.stern` |
| Rahmen mit Funktion | nur Sprechblase, Wortspeicher, Antwortkasten: Kontur 2 px, Ecken gerundet | `.blase`, `.box` |
| Zeilenlänge | höchstens ca. 60 Zeichen | lange Anweisungen kürzen |
| Schriftgrößen | höchstens drei: Überschrift, Text, Beschriftung; Mindestgröße der Klasse (Prüfung meldet < 80 % der Textgröße) | nur `.namenszeile` darf kleiner sein |
| Reihen gleichartiger Elemente | gleiche Größe, gleicher Abstand | `.reihe` mit `--spalten`, eine Abbildungsgröße je Reihe |

## 2. Platzbudget

Satzspiegel 1003 px Höhe: Kopf ≤ 160 px, Fuß ≤ 110 px (nur mit Selbsteinschätzung), Rest für Aufgaben. Aufgaben- und Item-Zahl nach dem Richtwert der Klasse (`druck-und-platz.md`); in Kl. 1/2 Übersicht vor Menge. `blatt.py` meldet Überlauf (FEHLER mit px) und Leerraum (HINWEIS). Passt es nicht: Item streichen oder zweite Seite. Bleibt Platz: Kl. 3/4 Item ergänzen, Kl. 1/2 `--abstand` erhöhen.

Faustwerte Kl. 2 (24 px Schrift): Aufgabenzeile 34 px, Uhr 88 px + Antwortlinie ≈ 130 px, Rechenzeile 45 px, Schreiblinie 46 px, Leitfigur mit Sprechblase im Kopf ≈ 95 px.

**Folien** (`folie`): 1280 × 720 px, Rand 48 px, Satzspiegel 1184 × 624 px. Kopf mit Überschrift und Ziel ≈ 150 px, zweizeilige Überschrift ohne Ziel ≈ 175 px; den Rest füllt `.buehne`. Text 40 px (Kl. 1/2: 48 px), eine Textzeile ≈ 56 px, Nummernkreis 52 px, Abstand zwischen Aufgaben 32 px. Kein Fuß und keine Namenszeile; Platz bleibt frei, statt ihn zu füllen.

## 3. Sauberes HTML

1. **Text bleibt Text**, nie in Bildern. Keine Schrift, Zahlen oder Uhren in KI-Bildern.
2. **Kein Layout mit Leerzeichen, `<br>`-Ketten oder Unterstrichen.** Antwortplätze sind `.antwort` oder `.schreiblinie` (kurze Antworten in anderen Fächern), Schreibaufgaben in Deutsch `x-lineatur`; Ausnahme ist nur die Namenszeile (CSS-Linien).
3. **Abstände über CSS** (Klassen, `--abstand`, `gap`), nicht über leere Elemente.
4. **Exakte Abbildungen** als `x-…`-Element aus `abbildungen.js`. Fehlt eine Art: freies Element aus berechnetem SVG (`references/abbildungen.md`, „Freies Element“). Mengen geordnet (Fünferstruktur, Zehnerreihen), Bündel umschließen genau ihre Elemente.
5. **Bilder mit `alt`** und fester Breite (`style="--figur:72px"` bzw. `width`), nie über die Spalte hinaus.
6. **Lösungen im selben Dokument** (`data-l`, `loesung=`, `nur-loesung`); keine zweite Kopie pflegen.
7. **Varianten** (Niveau-Blätter) als weitere `.seite` in derselben Datei; Titel nach Schema `Kl2_Mathe_Uhrzeit_AB1`.
8. **Leitfigur-Tipp** neben seiner Aufgabe, wenn die Reihe Platz hat (`.tipp` ans Reihenende), sonst in den Kopf (`.kopf .tipp`, „Zu 1: …"); nie zwischen Anweisung und Arbeitsfläche.
9. **Gewollte Ausnahmen markieren**, damit die Prüfung sie nicht meldet; nur dort, wo das Blatt angesehen und für richtig befunden ist:
   - `data-rand-ok`: Element darf in den Seitenrand (Seitenzahl, Fußzeile, Deko am Rand).
   - `data-ueberlagert-ok`: Element darf andere überlagern (Würfelaugen auf einem Würfel, Etikett auf einem Bild).
   - `data-klein-ok`: Schrift darf kleiner sein als für die Klasse (Fußzeile, Hinweise für die Lehrkraft).
   - `data-flaeche-ok`: Fläche ist gewollt (Titelband, Szenenkarte), nicht hinter einer Aufgabe.

## 4. Baukasten und Thema

Kit-Bausteine (`SKILL.md`, `references/abbildungen.md`) sind Pflicht. Eine eigene Klasse ist die begründete Ausnahme, die im Aufgabenplan steht: Der Editor, die s/w-Ansicht und der Katalog kennen sie nicht.

Eine Reihe bekommt ihr eigenes Aussehen über eine Datei `thema.css` im Mappenordner:

```html
<link rel="stylesheet" href="blatt.css"><link rel="stylesheet" href="../../thema.css">
```

`thema.css` setzt nur Variablen und Schmuck an Kit-Klassen, Farben unter `body.farbe`. Struktur bleibt beim Kit; für Titel und Bänder gibt es `.thema-kopf` und `.thema-band`. Ein Beispiel steht in `assets/thema-beispiel.css`.

<!-- erzeugt: thema-regeln -->
Erlaubte Variablen: `--haupt`, `--akzent`, `--dunkel`, `--linie`, `--fuell`, `--text`, `--strich`.

Erlaubte Eigenschaften (auch ihre Unterformen wie `border-radius`): `color`, `background`, `border`, `outline`, `box-shadow`, `font-family`, `font-weight`, `font-style`, `text-decoration`, `text-shadow`, `opacity`, `fill`, `stroke`, `letter-spacing`.

Der Kit-Anteil eines Blatts soll mindestens 90 % sein.
<!-- /erzeugt: thema-regeln -->

Das Bauen meldet Abweichungen als Hinweis (`thema-layout`, `thema-klasse`, `kit-anteil`).

## 5. Checkliste

- [ ] `blatt.py bauen` ohne FEHLER, WARNUNGEN geprüft
- [ ] Eine Spalte, Aufgaben ohne Kasten, Abstände einheitlich
- [ ] Farbe nur als Akzent, keine Flächen, Gelb nie für Linien oder Schrift
- [ ] Aufgaben- und Item-Zahl im Richtwert, Kl. 1/2 mit Luft
- [ ] Lösungsblatt vollständig und deckungsgleich
- [ ] Visuelle Endkontrolle bestanden (`visuelle-endkontrolle.md`)

**Hervorheben im Text:** `<mark>…</mark>` (Palettenfarbe; in s/w fett und unterstrichen).

**Tabellen:** `<table class="kit-tabelle">` mit `thead`/`tbody`; Varianten `kopfspalte`, `schreibzeilen`, `kompakt`, `nach-inhalt`, `erste-schmal`, `ohne-linien-innen`. Lösung je Zelle über `data-l`, Beispielzeile mit `.beispiel`. Maße stehen in `blatt.css`. Muster: `assets/muster/tabellen.html`.

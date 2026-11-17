# Layout-Regeln für HTML-Material

Ziel: übersichtlich, ohne Darstellungsfehler (abgeschnitten, überlappend, verrutscht), druckfertig in Farbe und in der s/w-Ansicht (`grundschul-didaktik/references/druck-und-platz.md`). `blatt.css` setzt die meisten Regeln schon um; diese Datei sagt, was beim Schreiben des HTML zu beachten ist.

Maße in CSS-px (96 dpi): A4 = 794 × 1123 px, 1 cm ≈ 38 px.

## 1. Raster

| Regel | Wert | Umsetzung |
|---|---|---|
| Seitenrand | links und rechts 60 px (Lochung), oben 38 px, unten 49 px; Kartenseiten (`.seite` mit `.karten`), Folien und ältere Blätter ringsum 60 px (Bürodrucker drucken nicht randlos) | `.seite` hat das Padding; nichts mit negativen Rändern oder `position:absolute` hinausschieben |
| Spalte | eine Inhaltsspalte, alle Aufgaben bündig | `.aufgabe` mit hängender Nummer |
| Aufgaben | ohne Kasten, ohne Fläche | keine `background` oder `border` an Aufgaben |
| Abstand zwischen Aufgaben | je Klasse, Tabelle in `grundschul-didaktik/references/druck-und-platz.md` | `--abstand`, setzt `blatt.css`; nicht von Hand senken |
| Nähe | Anweisung → Arbeitsfläche wenige px, Aufgabe → Aufgabe deutlich mehr | `.koerper` |
| Nummernkreis | gefüllt, weiße Ziffer, so hoch wie 1,3 × Schrift (Kl. 2: 21 px); ★ für die Sternchenaufgabe | `.nr`, `.nr.stern` |
| Rahmen mit Funktion | nur Sprechblase, Wortspeicher, Antwortkasten: Kontur 2 px, Ecken gerundet | `.blase`, `.box` |
| Zeilenlänge | höchstens ca. 60 Zeichen je Zeile | breite Textblöcke schmaler setzen; die Länge der Anweisung regelt `grundschul-didaktik/references/druck-und-platz.md`, „Aufgaben auf einen Blick verständlich“ |
| Schriftgrößen | höchstens drei: Überschrift (1,5 × Text, fette Leseschrift), Text, Beschriftung; Mindestgröße der Klasse (Prüfung meldet < 80 % der Textgröße) | nur `.namenszeile` darf kleiner sein |
| Reihen gleichartiger Elemente | gleiche Größe, gleicher Abstand | `.reihe` mit `--spalten`, eine Abbildungsgröße je Reihe |

## 2. Platzbudget

Satzspiegel 1036 px Höhe: Kopf ca. 70 px, Fuß ca. 95 px (nur mit Selbsteinschätzung), Rest für Aufgaben. Eine Arbeitsseite trägt mindestens vier Aufgaben und zwölf Teilaufgaben. Die Menge folgt dem Zeitziel (`grundschul-didaktik/references/druck-und-platz.md`, Abschnitt „Menge nach Arbeitszeit“): `data-zeit` am `<body>`, `data-min` an jeder `.aufgabe`, je Niveau eine eigene `.seite`, Folgeseiten mit `data-weiter` und ohne Kopf. `blatt.py` meldet Überlauf (FEHLER mit px), zu wenig Arbeitszeit, zu wenig Inhalt (`inhalt-wenig`), zu hohen Kopf oder Fuß und Leerraum (WARNUNG). Passt es nicht: Reihenfolge nach `grundschul-didaktik/references/druck-und-platz.md`, Ende von „Menge nach Arbeitszeit“. Bleibt Platz: Item, Reihe oder Aufgabe ergänzen. Muster: `assets/beispiel-niveaublatt-kl2.html`.

Faustwerte Kl. 2 (16 px Schrift): Anweisungszeile 21 px, Uhr 84 px + Antwortlinie ≈ 120 px, Rechenzeile mit Antwortlinie 31 px, Schreiblinie 46 px, Leitfigur mit Sprechblase ≈ 64 px. Schreibflächen sind so hoch wie im älteren Satz; nur Lesetext ist kleiner. Rechenkästchen haben das Maß des Rechenhefts (`references/abbildungen.md`, `x-gitter`).

**Folien** (`folie`): 1280 × 720 px, Rand 48 px, Satzspiegel 1184 × 624 px. Kopf mit Überschrift und Ziel ≈ 150 px, zweizeilige Überschrift ohne Ziel ≈ 175 px; den Rest füllt `.buehne`. Text 40 px (Kl. 1/2: 48 px), eine Textzeile ≈ 56 px, Nummernkreis 52 px, Abstand zwischen Aufgaben 32 px. Kein Fuß und keine Namenszeile; Platz bleibt frei, statt ihn zu füllen. Ein Auftakt (`folie auftakt`) ist davon frei: Szenen über die ganze Folie bis an den Rand, Schmuckschrift frei; die Prüfung meldet dort keinen Druckrand und keinen Kit-Anteil, Überlauf und Schriftgröße prüft sie wie sonst (`praesentation/SKILL.md`, „Auftakt“).

## 3. Sauberes HTML

1. **Text bleibt Text**, nie in Bildern. Keine Schrift, Zahlen oder Uhren in KI-Bildern.
2. **Kein Layout mit Leerzeichen, `<br>`-Ketten oder Unterstrichen.** Antwortplätze sind `.antwort` oder `.schreiblinie` (kurze Antworten in anderen Fächern), Schreibaufgaben in Deutsch `x-lineatur`; Ausnahme ist nur die Namenszeile (CSS-Linien).
3. **Abstände über CSS** (Klassen, `--abstand`, `gap`), nicht über leere Elemente.
4. **Exakte Abbildungen** als `x-…`-Element aus `abbildungen.js`. Fehlt eine Art: freies Element aus berechnetem SVG (`references/abbildungen.md`, „Freies Element“). Mengen geordnet (Fünferstruktur, Zehnerreihen), Bündel umschließen genau ihre Elemente.
5. **Bilder mit `alt`** und fester Breite (`style="--figur:72px"` bzw. `width`), nie über die Spalte hinaus.
6. **Lösungen im selben Dokument** (`data-l`, `loesung=`, `nur-loesung`); keine zweite Kopie pflegen.
7. **Varianten** (Niveau-Blätter) als weitere `.seite` in derselben Datei; Titel nach Schema `Kl2_Mathe_Uhrzeit_AB1`.
8. **Leitfigur-Tipp** (`.tipp`) im `.koerper` seiner Aufgabe über der Item-Reihe, nie mitten in einer Reihe, nicht im Kopf (`grundschul-didaktik/references/druck-und-platz.md`, „Kopf und Fuß schlank“). `.kopf .tipp` gibt es nur noch für ältere Blätter.
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

Das Thema schmückt Schauseiten (Deckblatt, Fall-Karte, Plakat, Spielplan, Urkunde) und Überschriften. Auf
Arbeitsseiten setzt es keinen Rahmen um `.seite` und keine Linie direkt an Text (etwa `border-left` an `.ziel` oder
einer Überschrift): Beides kostet Platz und klebt an der Schrift. Wiedererkennung entsteht dort über Farbe der
Überschrift, `.thema-kopf` und die Figur, nicht über Rahmen. Wie viel Schmuck eine Seite verträgt, steht in
`grundschul-didaktik/references/kindgerecht-gestalten.md` (Arbeitsseite, Schauseite, Seite für die Lehrkraft).

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
- [ ] Zeitziel je Niveau erreicht, Seiten gefüllt
- [ ] Lösungsblatt vollständig und deckungsgleich
- [ ] Visuelle Endkontrolle bestanden (`visuelle-endkontrolle.md`)

**Hervorheben im Text:** `<mark>…</mark>` (Palettenfarbe; in s/w fett und unterstrichen).

**Karten und Ausschneidematerial:** `.karten` füllt die Seite mit `--spalten` × `--zeilen` gleich großen Karten; Größe und Zahl je A4 nicht frei wählen, sondern nach `grundschul-didaktik/references/druck-und-platz.md`, „Ausschneide- und Legematerial“. Den Innenabstand der Karte (5 mm zur Schnittkante) nicht überschreiben; Bilder ohne feste Größe und `x-gitter` ohne `kaestchen` füllen die Karte selbst. Muster: `assets/beispiel-kartensatz.html`.

**Tabellen:** `<table class="kit-tabelle">` mit `thead`/`tbody`; Varianten `kopfspalte`, `schreibzeilen`, `kompakt`, `nach-inhalt`, `erste-schmal`, `ohne-linien-innen`. Lösung je Zelle über `data-l`, Beispielzeile mit `.beispiel`. Maße stehen in `blatt.css`. Muster: `assets/muster/tabellen.html`.

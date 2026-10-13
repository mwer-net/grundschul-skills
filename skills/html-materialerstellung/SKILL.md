---
name: html-materialerstellung
description: Technischer Ablauf, um Grundschulmaterial (Arbeitsblätter, Klassenarbeiten, Lernzielkontrollen, Lesetexte, Karten, Plakate, Stationskarten) als HTML/CSS zu bauen, automatisch zu prüfen und als druckfertiges A4-PDF mit Lösungsblatt auszugeben. Laden für die Entwürfe (Phase 2) und die Umsetzung des freigegebenen Aufgabenplans. Bilder und Grafiken nach Bedarf mit Canva-KI.
---

# Material mit HTML erstellen

Jedes Material entsteht als **eine HTML-Datei** mit dem Gestaltungssystem aus `assets/`. Dieselbe Datei ist Entwurf, Endfassung und Quelle für PDF und Lösungsblatt. **Canva-KI** liefert Bilder und Grafiken nach Bedarf, die ins HTML eingebaut werden (`references/bilder.md`); Layout und Text entstehen nie in Canva.

Warum: In HTML bestimmen wir Schrift (Fredoka, Andika, eingebettet), Abstände und exakte Abbildungen selbst; das Ergebnis sieht aus wie die Vorschau, ohne Nacharbeit.

## Bausteine

| Datei | Zweck |
|---|---|
| `assets/blatt.css` | Gestaltungssystem: A4-Seite, 60 px Rand, Kopf, Aufgaben mit hängender Nummer, Niveau-Punkte, Punktfelder, Antwortlinien, Sprechblase, Fuß, Karten, Platzhalter. Profile über Klassen am `<body>`. |
| `assets/abbildungen.js` | Exakte Abbildungen als SVG: `x-uhr`, `x-menge` (Gegenstände in Reihen, Bündel), `x-dienes`, `x-strichpunkt`, `x-stellentafel`, `x-zwanzigerfeld`, `x-zahlenstrahl`. Aufrufe im Kopf der Datei. |
| `assets/vorlage-arbeitsblatt.html` | Muster mit allen Bausteinen (Farbprofil); Ausgangspunkt für jedes Blatt |
| `assets/beispiel-zehner-einer-kl2.html` | geprüftes Beispiel im s/w-Profil (Bündeln, Stellentafel, Sternchenaufgabe, Lösungen) |
| `assets/fonts/` | Fredoka (Überschrift), Andika (Text, einstöckiges a/g), OFL-Lizenz |
| `assets/bilder/` | Willi, Wilma, Wachstumsgrafik farbig und als Strichzeichnung (`references/bilder.md`) |
| `scripts/blatt.py` | baut, prüft, erzeugt PDF, Lösungsblatt, Vorschau und Ausschnitte; `uebersicht` für Entwürfe |
| `references/layout.md` | Raster, Platzbudget, Klassen und Regeln für sauberes HTML |
| `references/visuelle-endkontrolle.md` | Pflichtprüfung des fertigen Blatts |
| `references/bilder.md` | Leitfigur, KI-Bilder und -Grafiken mit Canva erzeugen und ins Blatt holen |

## Ablauf

### 1. Entwürfe (Phase 2 aus `grundschul-didaktik/references/entwurf-und-aufgabenplan.md`)

- Je Entwurf eine HTML-Datei aus `vorlage-arbeitsblatt.html` kopieren (`<title>` = Entwurfsname, z. B. „A · Kompakt üben"), echte Texte, 2–5 Beispiel-Items je Aufgabe. Exakte Abbildungen gleich als `x-…`-Element (kostet nichts), neue Bilder als `<div class="platzhalter" style="--h:90px">Bild: Murmeln</div>`.
- `python3 scripts/blatt.py uebersicht a.html b.html c.html -o ordner/` → `entwuerfe.png` und `entwuerfe.html` mit den Seiten nebeneinander und „passt / passt nicht auf die Seite".
- Bild der Lehrkraft zeigen. Der gewählte Entwurf wird später direkt zur Endfassung ausgebaut, nichts wird neu gebaut.

### 2. Endfassung (nach Freigabe des Aufgabenplans)

1. Im gewählten Entwurf alle Items, Beispiele und Lösungen aus dem Plan eintragen. Lösungen stehen **im selben HTML**: `data-l="46"` an Antwortlinien, `loesung="4:30"` an Uhren, `buendel-loesung="3"` an Mengen, `loesung="3 5"` an Stellentafeln, `class="nur-loesung"` für Lösungstexte, `class="nicht-loesung"` für Schreiblinien, die auf dem Lösungsblatt verschwinden. Das erste Item als `class="beispiel"` zeigt seine Lösung schon auf dem Arbeitsblatt.
2. Bilder einsetzen: vorhandene aus `assets/bilder/`, alle anderen Motive der Bildliste mit Canva-KI erzeugen und als Datei einbauen (`references/bilder.md`, Abschnitt 2).
3. Bauen und prüfen:
   `python3 scripts/blatt.py bauen Kl2_Mathe_Uhrzeit_AB1.html -o ausgabe/`
   Ergebnis: eigenständige `.html` (alles eingebettet), `.pdf`, `-loesung.pdf`, Vorschau je Seite (`-s1.png`) und Ausschnitt je Aufgabe (`-s1-a1.png` …). Der Prüfbericht meldet FEHLER (Seitenrand, abgeschnitten, Überlappung, Schrift oder Bild fehlt; Lösungsblatt wird mitgeprüft), WARNUNGEN (Schrift zu klein für die Klasse, Farbe oder Flächen im s/w-Profil, farbiges Bild im s/w-Profil, zu viele Aufgaben, Aufgaben zu dicht) und HINWEISE (unscharfe Bilder, viel Leerraum, Platzhalter).
4. FEHLER beheben und neu bauen, bis keiner bleibt. Passt der Inhalt nicht: erst `--abstand` am `<body>` um wenige px senken (nie unter 24 px), dann Item streichen, dann zweite Seite; nie Schrift oder Rand verkleinern.
5. **Visuelle Endkontrolle** (`references/visuelle-endkontrolle.md`): Seitenvorschau, jeden Aufgaben-Ausschnitt und das Lösungsblatt ansehen, Befunde beheben, neu bauen.
6. Der Lehrkraft geben: PDF (Arbeitsblatt und Lösung) und die eigenständige HTML-Datei, mit einem Satz, was die Endkontrolle korrigiert hat. Mit Schoolbox stattdessen den Link (Abschnitt „Mit Schoolbox“).

### 3. Änderungen

Änderungswünsche werden in der HTML-Quelle umgesetzt und neu gebaut (Sekunden). Die eigenständige HTML-Datei lässt sich im Browser öffnen und drucken; wer in Canva weiterarbeiten will, lädt das PDF dort hoch.

## Mit Schoolbox

Ist im Projekt eine Schoolbox eingerichtet (Ordner `schoolbox/`, Projektanweisungen), liegt das Material in **Mappen** und die Lehrkraft bekommt am Ende einen Link statt Dateien. Am Aufbau des HTML und an der Prüfung ändert sich nichts. Alle Aufrufe aus dem Hauptordner des Projekts; `schoolbox/bin/schoolbox --hilfe` nennt Befehle und gültige Werte.

1. **Mappe und Dokumente anlegen** statt eigener Ordner und Dateinamen: `schoolbox/bin/schoolbox neu --titel … --fach … --klasse …`, dann je Bestandteil `schoolbox/bin/schoolbox dokument <mappe> --titel … --art … --druckprofil sw|farbe [--format a4-quer|a3-hoch|a5-hoch|folie] [--vorlage arbeitsblatt]`. Das Dokument liegt in `materialien/<mappe>/dokumente/<dokument>/`; die Quelle heißt immer `material.html`, mit `<title>` und `<body>`-Klassen schon gesetzt. Das Format steht in den Angaben des Dokuments (`meta.json` im selben Ordner) **und** als Klasse am `<body>`; ändert es sich, beides anpassen, sonst bricht `fertig` ab.
2. **Druckhinweise** (doppelseitig, laminieren, in A3 drucken) gehören ans Dokument, die Schoolbox zeigt sie beim Drucken: `--druckhinweis "…"`, mehrfach möglich.
3. **Entwürfe** in den Ordner des Dokuments schreiben (`entwurf-a.html` …), damit Pfade wie `bilder/…` später stimmen. Prüfen mit `python3 skills/html-materialerstellung/scripts/blatt.py uebersicht <entwürfe> -o <dokumentordner>/ausgabe/`, registrieren mit `schoolbox/bin/schoolbox entwuerfe <mappe>/<dokument> <entwürfe>`, den gewählten übernehmen mit `schoolbox/bin/schoolbox waehle <mappe>/<dokument> B`.
4. **Bilder** des Dokuments in `bilder/` neben `material.html`; Bilder, die mehrere Dokumente der Mappe nutzen, in `materialien/<mappe>/bilder/` (eingebunden als `../../bilder/…`).
5. **Bauen und Endkontrolle** wie oben mit `blatt.py bauen <dokumentordner>/material.html -o <dokumentordner>/ausgabe/`. Ohne `-o` lägen PDF und Vorschauen neben der Quelle.
6. **Abschluss:** `schoolbox/bin/schoolbox fertig <mappe>/<dokument>` baut ein letztes Mal, hält den Stand als Version fest und nennt den Link. Bei FEHLERN gibt es ihn trotzdem (Exit-Code 1); erst beheben, dann erneut fertigstellen. Für eine Mappe mit mehreren Dokumenten `schoolbox/bin/schoolbox link <mappe>`.
7. **Änderungen:** Die Lehrkraft kann die Quelle in der Schoolbox selbst bearbeiten. Vor jeder Änderung `material.html` neu lesen und gezielt ändern, nie aus einem früheren Stand neu schreiben. Danach wieder `fertig`; der Link bleibt gleich.

## Gestaltungssystem kurz

- `<body class="kl2 sw">` bzw. `class="kl2 farbe palette-himmel"` (Paletten: sonnig, himmel, wiese, beere). Die Klasse setzt Schriftgröße (Kl. 1: 28 px, 2: 24, 3: 20, 4: 18) und Aufgabenabstand; das Profil Farben. Text bleibt immer schwarz.
- Seite: `<section class="seite">`, mehrere Seiten = mehrere Sections.
- Kopf: `.namenszeile`, `.kopf` mit `.titel` (h1, `.ziel`, `.wahlhilfe`) und optional `.tipp` (Leitfigur mit Sprechblase), `.loesung-marke`.
- Aufgabe: `.aufgabe` > `.nr` (oder `.nr.stern`) + `.anw` (`.text` + `.niveau` mit `<i>` je Punkt, in Klassenarbeiten stattdessen `.punkte`) + `.koerper`.
- Items: `.reihe` mit `--spalten`, darin `.zelle` (`.links` für linksbündig), `.zeile` für Rechenzeilen, `.antwort` (`.kurz`, `.breit`, `.lang`), `.schreiblinie`, `.box` (Ankreuzkästchen).
- Fuß (nur mit Selbsteinschätzung): `.fuss` mit Text, Wachstumsgrafik, `.reflexion`.
- Karten: `.karten` mit `--spalten`, `.karte`, `.kartentext`, `.ecke`.
- Eigene Gestaltung ist erlaubt (zusätzliches `<style>` im Kopf), solange `references/layout.md` und das Druckprofil eingehalten werden.

## Tokens sparen

- Entwürfe und Endfassung sind dieselbe Datei; Änderungen als gezielte Edits, nicht neu schreiben.
- Abbildungen als `x-…`-Elemente statt SVG von Hand.
- Prüfbericht statt Bild für Geometrie; Bilder (Seite, Ausschnitte) nur für die visuelle Endkontrolle ansehen.
- Höchstens drei Runden Endkontrolle; bleibt danach etwas offen, die Vorschau mit dem offenen Punkt zeigen.

## Ohne Code-Ausführung

HTML wie oben schreiben und als HTML-Artefakt zeigen (CSS aus `blatt.css` und `abbildungen.js` inline einfügen); Drucken über den Browser (A4, Ränder „keine", Hintergrundgrafiken an). Prüfung dann von Hand nach `references/layout.md`.

## Typische Probleme

| Problem | Lösung |
|---|---|
| „Kein Chromium gefunden" | `pip install playwright && playwright install chromium` oder `CHROMIUM_PATH` setzen |
| Keine PNG-Vorschau | `pip install pypdfium2` |
| Schrift nicht geladen | Quelle bindet `blatt.css` per `<link>` ein, `assets/fonts/` vorhanden |
| Bild fehlt | Pfad relativ zur Quelle oder zu `assets/` (`bilder/willi.png`) |
| Element ragt in den Rand | Inhalt kürzen, `--spalten` senken, Abbildung kleiner (`groesse`), sonst zweite Seite |
| Bild unscharf (Hinweis dpi) | Original in voller Auflösung holen (`references/bilder.md`) |
| Lösungsblatt weicht ab | Lösung immer über `data-l`/`loesung`/`nur-loesung` im selben HTML, nie als zweite Kopie |
| Gegenstände zum Bündeln | `x-menge` in Zehnerreihen mit Fünferlücke; Bündel nur in Beispiel und Lösung (`buendel-loesung`) |

---
name: html-materialerstellung
description: Technischer Ablauf, um Grundschulmaterial (Arbeitsblätter, Klassenarbeiten, Lernzielkontrollen, Lesetexte, Karten, Plakate, Stationskarten, Folien) als HTML/CSS zu bauen, automatisch zu prüfen und als druckfertiges A4-PDF mit Lösungsblatt auszugeben. Laden vor jedem Bau eines Materials: für die Entwürfe (Phase 2), die Umsetzung des freigegebenen Aufgabenplans und den Bau ohne Entwurf, etwa im Lauf der Schoolbox. Bilder und Grafiken nach Bedarf mit Canva-KI.
---

# Material mit HTML erstellen

Jedes Material entsteht als **eine HTML-Datei** mit dem Gestaltungssystem aus `assets/`. Dieselbe Datei ist Entwurf, Endfassung und Quelle für PDF und Lösungsblatt. **Canva-KI** liefert Bilder und Grafiken nach Bedarf, die ins HTML eingebaut werden (`references/bilder.md`); Layout und Text entstehen nie in Canva.

Warum: In HTML bestimmen wir Schrift (Fredoka, Andika, eingebettet), Abstände und exakte Abbildungen selbst; das Ergebnis sieht aus wie die Vorschau, ohne Nacharbeit.

## Wo du arbeitest

- **Lauf der Schoolbox:** Du baust mit dem Werkzeug `bauen`. Was der Auftrag nennt, geht vor. Rückfragen, Entwürfe und Befehle entfallen.
- **Claude-App mit Bash:** `scripts/blatt.py`, Befehle der Schoolbox in [Mit Schoolbox](references/schoolbox-befehle.md), Leseliste in [Vor dem Bau lesen](references/pflichtlektuere.md).
- **Ohne Code-Ausführung:** [Ohne Code-Ausführung](references/ohne-code.md).

## Bausteine

| Datei | Zweck |
|---|---|
| `assets/blatt.css` | Gestaltungssystem: A4-Seite, 60 px Rand (oben und unten weniger), Satz wie im Schulbuch (`data-satz="2"`), Kopf, Aufgaben mit hängender Nummer, Niveau-Punkte, Punktfelder, Antwortlinien, Sprechblase, Fuß, Karten, Platzhalter, Folien. Profile über Klassen am `<body>`. |
| `assets/praesentation.js` | Präsentationsmodus für Folien: blättern, Schritte und Aufdecken, Timer, Schwarzbild; nur mit `?praesentation=1` aktiv. `blatt.py` bettet es in die Offline-Präsentation ein und baut damit `--schritte` und `--notizen` (`references/folien.md`) |
| `assets/abbildungen.js` | Exakte Abbildungen als SVG (`x-…`-Elemente), berechnet statt gezeichnet. Welche es gibt, wie man sie schreibt und welche Mindestgrößen gelten, steht im Katalog: `references/abbildungen.md`, mit einem Index der Teil-Dateien in `references/abbildungen/`. Musterblätter: `assets/muster/`. |
| `assets/vorlage-arbeitsblatt.html` | Muster mit allen Bausteinen; Ausgangspunkt für jedes Blatt |
| `assets/vorlage-praesentation.html` | Kreisinput mit sechs Folien und allen Folien-Bausteinen; Ausgangspunkt für Präsentationen der Art „Impuls“ (`references/folien.md`) |
| `assets/beispiel-auftakt.html` | geprüfter Auftakt einer Reihe (`body.folie.auftakt`): Szenen als SVG, Schmuckschrift, Wetten und Mitmachen, Aufdecken im Bild, Bewegung, Bildfolien und Kapitelfolgen (`praesentation/SKILL.md`, „Auftakt“); zeigt die Technik, keine Schablone |
| `assets/vorlage-minibuch.html` | Faltbuch aus einem A4-Blatt, acht Seiten mit Satzmuster, Faltanleitung auf dem Lösungsblatt ([Mini-Book](references/minibuch.md)) |
| `assets/vorlage-forscherbogen-12.html`, `assets/vorlage-forscherbogen-34.html` | Forscherbogen bildgestützt (Kl. 1/2) und schriftlich (Kl. 3/4); Sicherheitshinweise als `.nur-loesung` im Kopf, Malfläche `.malfeld` |
| `assets/beispiel-zehner-einer-kl2.html` | geprüftes Beispiel in s/w (Bündeln, Stellentafel, Sternchenaufgabe, Lösungen); zeigt Bausteine, nicht die Dichte |
| `assets/beispiel-reihe-kapitel.html` | geprüftes Kapitel einer Reihe: Fall-Karte, Arbeitsblatt mit Kapitel-Marke, Beweis-Rätsel und Fußzeile; zeigt die Technik, keine Schablone |
| `assets/beispiel-lehrkraft-hinweise.html` | geprüfte Hinweise für die Lehrkraft (`body.lehrkraft`): Überblick der Reihe und je Stunde ein kurzer Block; Muster für jede Seite, die nur die Lehrkraft liest (Handreichung, Verlaufsplan) |
| `assets/beispiel-vorleseheft.html` | geprüftes Vorleseheft einer Reihe (`body.lehrkraft.vorleseheft`): Auftakt und ein Kapitel mit Marken für Bildfolie, Frage und Übergang zur Aufgabe; zeigt die Machart, keinen Text zum Übernehmen |
| `assets/beispiel-kartensatz.html` | geprüfter Kartensatz zum Ausschneiden und Legen: Deckkarte, Bildkarten mit großem Motiv, gestaltete Rückseiten mit Selbstkontrolle, Schneidebogen für die Kinder; zeigt die Machart, keine Schablone (Maße: `grundschul-didaktik/references/druck-und-platz.md`, „Ausschneide- und Legematerial“) |
| `assets/beispiel-deckblatt-formen.html` | geprüftes Deckblatt mit frei liegender Gestaltung: Seitenfläche, Formen, Schmuckschrift, Figur am Anker, Sprechblase, Konfetti (`references/gestaltung.md`) |
| `assets/fonts/` | Andika (Text und Überschriften, einstöckiges a/g, Schulziffern, l mit Bogen), Fredoka (Schmuck auf Schauseiten), Playwrite DE VA (Vereinfachte Ausgangsschrift für Schreibvorlagen), OFL-Lizenz |
| `assets/bilder/` | Willi, Wilma, Wachstumsgrafik farbig und als Strichzeichnung (`references/bilder.md`) |
| `scripts/blatt.py` | baut, prüft, erzeugt PDF, Lösungsblatt, Vorschau und Ausschnitte; bei Folien die Offline-Präsentation, auf Wunsch `--schritte` und `--notizen`; `uebersicht` für Entwürfe |
| `references/layout.md` | Raster, Platzbudget, Klassen und Regeln für sauberes HTML |
| `references/visuelle-endkontrolle.md` | Pflichtprüfung des fertigen Blatts |
| `references/bilder.md` | Leitfigur, KI-Bilder und -Grafiken mit Canva erzeugen und ins Blatt holen |
| `references/verkauf.md` | nur wenn das Material verkauft werden soll (Eduki): Deckblatt, Handreichung, Quellenverzeichnis, Angebotstext |
| `references/gestaltung.md` | frei liegende Gestaltung: Ebenen, Lage, Anker, Arten, s/w; Farben und Didaktik der Gestaltung stehen in `grundschul-didaktik/references/gestaltung.md` |

## Ablauf

### 1. Entwürfe (Phase 2 aus `grundschul-didaktik/references/entwurf-und-aufgabenplan.md`)

- Je Entwurf eine HTML-Datei aus `vorlage-arbeitsblatt.html` kopieren (`<title>` = Entwurfsname, z. B. „A · Kompakt üben"), echte Texte, 2–5 Beispiel-Items je Aufgabe. Exakte Abbildungen gleich als `x-…`-Element (kostet nichts), neue Bilder als `<div class="platzhalter" style="--h:90px">Bild: Murmeln</div>`.
- `python3 scripts/blatt.py uebersicht a.html b.html c.html -o ordner/` → `entwuerfe.png` und `entwuerfe.html` mit den Seiten nebeneinander und „passt / passt nicht auf die Seite".
- Bild der Lehrkraft zeigen. Der gewählte Entwurf wird später direkt zur Endfassung ausgebaut, nichts wird neu gebaut.

### 2. Endfassung (nach Freigabe des Aufgabenplans)

1. Im gewählten Entwurf alle Items, Beispiele und Lösungen aus dem Plan eintragen. Lösungen stehen **im selben HTML**: `data-l="46"` an Antwortlinien, `loesung="4:30"` an Uhren, `buendel-loesung="3"` an Mengen, `loesung="3 5"` an Stellentafeln, `class="nur-loesung"` für Lösungstexte, `class="nicht-loesung"` für Schreiblinien, die auf dem Lösungsblatt verschwinden. Das erste Item als `class="beispiel"` zeigt seine Lösung schon auf dem Arbeitsblatt.
2. Bilder einsetzen: vorhandene aus `assets/bilder/`, alle anderen Motive der Bildliste mit Canva-KI erzeugen, jedes in vier Vierteln gegen seinen Bildvertrag prüfen und Fehler reparieren, dann als Datei einbauen; Figur, Zettel und Zahlen kommen als Ebenen darüber (`references/bilder.md`, Abschnitte 2 bis 4).
3. Vor dem ersten Bau die Pflichtlektüre der Materialart lesen (`references/pflichtlektuere.md`), dann bauen und prüfen:
   `python3 scripts/blatt.py bauen Kl2_Mathe_Uhrzeit_AB1.html -o ausgabe/`
   Ergebnis: eigenständige `.html` (alles eingebettet), `.pdf`, `-loesung.pdf`, Vorschau je Seite (`-s1.png`) und Ausschnitt je Aufgabe (`-s1-a1.png` …). Der Prüfbericht meldet FEHLER (Seitenrand, abgeschnitten, Überlappung, Schrift oder Bild fehlt; Lösungsblatt wird mitgeprüft), WARNUNGEN (Schrift zu klein, zu viele Aufgaben, Aufgaben zu dicht, Zeit, Menge und freier Platz) und HINWEISE (unscharfe Bilder, Platzhalter, s/w). Die Schwellen stehen in `grundschul-didaktik/references/druck-und-platz.md`, „Was die Prüfung meldet“. Die s/w-Hinweise stehen im Lauf der Schoolbox von selbst im Bericht, sonst mit `--profil sw`.
4. FEHLER beheben und neu bauen, bis keiner bleibt. Passt der Inhalt nicht: Reihenfolge nach `grundschul-didaktik/references/druck-und-platz.md`, Ende von „Menge nach Arbeitszeit“; nie Schrift, Rand oder Schreibfläche von Hand verkleinern. Meldet der Bericht `inhalt-wenig` oder `platz-frei`: Items, Reihen oder eine Aufgabe ergänzen, bis die Seite gefüllt ist wie im Schulbuch.
5. **Visuelle Endkontrolle** (`references/visuelle-endkontrolle.md`): Seitenvorschau, jeden Aufgaben-Ausschnitt und das Lösungsblatt ansehen, Befunde beheben, neu bauen.
6. Der Lehrkraft geben: PDF (Arbeitsblatt und Lösung) und die eigenständige HTML-Datei, mit einem Satz, was die Endkontrolle korrigiert hat. Mit Schoolbox stattdessen den Link (`references/schoolbox-befehle.md`).

### 3. Änderungen

Änderungswünsche werden in der HTML-Quelle umgesetzt und neu gebaut (Sekunden). Die eigenständige HTML-Datei lässt sich im Browser öffnen und drucken; wer in Canva weiterarbeiten will, lädt das PDF dort hoch.

## Gestaltungssystem kurz

- `<body class="kl2 farbe palette-himmel" data-satz="2">` (Paletten: sonnig, himmel, wiese, beere). `data-satz="2"` steht an jedem neuen Material: Es setzt Schrift, Abstände und Rechenkästchen wie im Schulbuch der Klasse (Werte: `grundschul-didaktik/references/druck-und-platz.md`, „Schrift und Abstand je Klasse“). Für ein vorhandenes Blatt ohne die Angabe gilt zusätzlich `references/aelterer-satz.md`. Die Klasse setzt Schriftgröße und Aufgabenabstand; die Palette Farben. s/w ist eine Ansicht davon, nicht `class="sw"` setzen (`grundschul-didaktik/references/gestaltung.md`). Text bleibt immer schwarz.
- Seite: `<section class="seite">`, mehrere Seiten = mehrere Sections. Eine Arbeitsseite ist gefüllt (sonst `inhalt-wenig`); `data-dicht-ok` an der Section nimmt eine Seite davon aus, die mit Absicht wenig trägt (Forscherbogen, Bastelvorlage).
- Kopf: `.namenszeile`, dann `.kopf` mit `.titel` (h1, `.ziel`, `.wahlhilfe`), `.loesung-marke`. Die Namenszeile steht im HTML vor dem Kopf und erscheint rechts neben der Überschrift. Der Tipp der Leitfigur (`.tipp`) steht im `.koerper` seiner Aufgabe, nicht im Kopf.
- Aufgabe: `.aufgabe` > `.nr` (oder `.nr.stern`) + `.anw` (`.text` + `.niveau` mit `<i>` je Punkt, in Klassenarbeiten stattdessen `.punkte`) + `.koerper`.
- Items: `.reihe` mit `--spalten`, darin `.zelle` (`.links` für linksbündig), `.zeile` für Rechenzeilen, `.antwort` (`.kurz`, `.breit`, `.lang`), `.schreiblinie`, `.box` (Ankreuzkästchen).
- Fuß (nur mit Selbsteinschätzung): `.fuss` mit Text, Wachstumsgrafik, `.reflexion`.
- Anweisungs-Symbol, nur wenn der Auftrag Symbole nennt (Standard: keine): `<span class="sym" data-sym="schreiben"></span>` in `.anw` vor `.text`, dann genau eines je Aufgabe: `schreiben`, `malen`, `lesen`, `sprechen`, `schneiden`, `kleben`, `verbinden`, `ankreuzen`, `rechnen`, `suchen`, `partner`, `wuerfeln`, `legen`.
- Seiten für die Lehrkraft: eigenes Dokument mit `<body class="kl… lehrkraft">` (Arial, 13 px, schlichte `h1`/`h2`, `.kit-tabelle`, `.lk-unter`, `.lk-stunde`), ohne Figuren und Farbflächen. Abschauen in `assets/beispiel-lehrkraft-hinweise.html`.
- Reihe: `.seite.fall` (Fall-Karte mit `.fall-bild`, `.fall-band`, `.fall-innen`, `.fall-frage`), `.kapitel-marke` in der Namenszeile, `.aufgabe.beweis` mit `.beweis-marke`, `.fuss-zeile`. Abschauen in `assets/beispiel-reihe-kapitel.html`.
- Karten: `.karten` mit `--spalten`, `.karte`, `.kartentext`, `.ecke`. Mit `data-satz="2"` zusätzlich `--zeilen`, `--set` (Setfarbe), `--fuge` (Abstand statt gemeinsamer Schnittlinie), `.karte.deckkarte`, `.karte.rueckseite`, `.karte.grund`, `.karte.legeteil`, `.karten.rueckseiten` (Rückseiten für den Duplexdruck gespiegelt), `.karten.streifen` und `.schneidebogen` mit `--spalten`, `--teil-b`, `--teil-h`. Abschauen in `assets/beispiel-kartensatz.html`.
- Folien: [Folien](references/folien.md).
- Eigene Gestaltung kommt als Thema über die Kit-Bausteine, nicht als eigene Struktur: `references/layout.md`, Abschnitt „Baukasten und Thema“. Eigene Klassen und `<style>` sind die begründete Ausnahme.

## Neues Element

Bevor ein Element, ein Format oder ein Maß dazukommt: [Quellen](references/quellen.md) lesen, dort steht, wo was gilt.

Fehlt eine Darstellung, kommt es darauf an, wo du arbeitest. Nie gilt: von Hand zurechtgeschobenes Layout statt eines Elements, ein KI-Bild statt einer exakten Abbildung, oder eine Absage, weil es das Element nicht gibt.

**Im Chat und in Lehrkraft-Sitzungen:** Vorhandene Elemente zuerst, denn sie lassen sich einstellen. Sonst baue die Darstellung als freies Element aus HTML und SVG mit `data-frei`: [Freies Element](references/abbildungen.md#freies-element). Den Code der Schoolbox änderst du dabei nicht. Schmuck, der frei auf der Seite liegt (Formen, Figuren, Schmuckschrift, Konfetti), schreibst du nach [Gestaltung](references/gestaltung.md); freie Elemente (`data-frei`) bleiben, was sie sind.

**Im Repo:** als neues Element nach der `README.md` des Repos, Abschnitt „Neues Element“.

Maßstäbliche Elemente (echte Zentimeter): `masstab(el)` im Element, und beim Anlegen `--druckhinweis "In Originalgröße drucken (100 %)"`.

## Tokens sparen

- Entwürfe und Endfassung sind dieselbe Datei; Änderungen als gezielte Edits, nicht neu schreiben.
- Abbildungen als `x-…`-Elemente statt SVG von Hand.
- Prüfbericht statt Bild für Geometrie; Bilder (Seite, Ausschnitte) nur für die visuelle Endkontrolle ansehen.
- Höchstens drei Runden Endkontrolle; bleibt danach etwas offen, die Vorschau mit dem offenen Punkt zeigen.

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

# Grundschul-Skills

AI-Skills zur Unterrichtsvorbereitung für Grundschul-Lehrkräfte (Klasse 1–4). Die Skills erstellen Unterrichtsmaterial nach aktuellen didaktischen Standards als **HTML/CSS** und geben es als druckfertiges A4-PDF mit Lösungsblatt aus. Bilder und Grafiken erzeugen die Skills bei Bedarf mit der **Canva-KI** (Canva MCP) und bauen sie ins Material ein.

## Aufbau

Die Skills sind in drei Ebenen gegliedert, die zusammenspielen:

```
skills/
├── grundschul-didaktik/        Basis: Kernkonzepte, Leitlinien, Gestaltung, Differenzierung, Rückfrage-Protokoll
│   ├── references/             kernkonzepte · rueckfragen · entwurf-und-aufgabenplan · gestaltung ·
│   │                           kindgerecht-gestalten · druck-und-platz · differenzierung ·
│   │                           sprachsensibel · quellen
├── html-materialerstellung/    Technik: Material als HTML bauen, prüfen, als PDF ausgeben
│   ├── assets/                 blatt.css (Gestaltungssystem) · abbildungen.js (Uhr, Mengen, Stellentafel …) ·
│   │                           vorlage-arbeitsblatt.html · fonts/ (Fredoka, Andika) · bilder/ (Willi, Wilma, Wachstum)
│   ├── references/             layout · visuelle-endkontrolle · bilder (KI-Bilder und -Grafiken mit Canva)
│   └── scripts/                blatt.py (prüft Rand, Überlappung, Schrift, Druckprofil; erzeugt PDF,
│                               Lösungsblatt, Vorschau und Ausschnitte je Aufgabe; Entwurfsübersicht)
│
├── unterrichtsplanung/         ┐
├── arbeitsblatt/               │
├── lesetext/                   │
├── lernspiel/                  │  Materialarten: Bauform, Rückfragen, Qualitätscheck
├── stationenlernen/            │
├── bild-und-wortkarten/        │
├── lernplakat/                 │
├── lernzielkontrolle/          ┘
│
├── fach-deutsch/               ┐
├── fach-mathematik/            │
├── fach-sachunterricht/        │  Fächer: Fachdidaktik, Inhalte, Konventionen
├── fach-englisch/              │
├── fach-kunst/                 │
└── fach-musik/                 ┘
```

Beispiel: "Ich brauche ein Arbeitsblatt zur Uhrzeit für Klasse 2" lädt `grundschul-didaktik` + `arbeitsblatt` + `fach-mathematik` + `html-materialerstellung`.

## Rückfragen statt Raten

Bei ungenauen Anfragen erstellen die Skills nicht sofort etwas, sondern fragen gezielt nach (`grundschul-didaktik/references/rueckfragen.md`):

- eine Frage pro Nachricht, in sinnvoller Reihenfolge (Klasse → Ziel → Lerngruppe → Form)
- jede Frage mit Antwortoptionen und einer Empfehlung
- Herleitbares wird nicht gefragt, sondern als Annahme genannt
- statt Fragen zu Aufgabenformat oder Rahmen: 2–3 schnelle Entwürfe zur Auswahl

## Erst Entwurf, dann Endfassung

Jedes Material läuft in Phasen (`grundschul-didaktik/references/entwurf-und-aufgabenplan.md`):

1. **Klären:** Start-Abfrage und wenige Rückfragen.
2. **Entwürfe:** 2–3 deutlich verschiedene Entwürfe als echte HTML-Seiten, nebeneinander als Bild (`blatt.py uebersicht`).
3. **Feedback:** Die Lehrkraft wählt einen Entwurf und sagt, was anders sein soll.
4. **Aufgabenplan:** alle Inhalte, Items, Lösungen und Bilder je Materialart exakt festgelegt, zur Freigabe.
5. **Endfassung:** Der gewählte Entwurf wird ausgebaut, benötigte Bilder und Grafiken erzeugt die Canva-KI, `blatt.py bauen` prüft und erzeugt PDF, Lösungsblatt und eine eigenständige HTML-Datei; danach visuelle Endkontrolle.

Warum HTML statt Canva-Layout: Schrift, Abstände und exakte Abbildungen sind frei bestimmbar, die Vorschau ist schon das fertige Blatt, und eine Änderung kostet Sekunden statt einer neuen Canva-Runde. Die Canva-Schnittstelle konnte keine Schrift setzen, KI-Layouts mussten komplett nachgebaut werden.

## Kernkonzepte

Alle Materialien verkörpern zwei Konzepte (`grundschul-didaktik/references/kernkonzepte.md`). Haltung und Sprache gelten immer; Selbsteinschätzung, Niveaus zur Selbstwahl und Sternchenaufgabe werden zu Beginn abgefragt:

- **Growth Mindset:** Ich-kann-Ziel oben, „noch"-Sprache, Strategietipps; wählbar: Wachstums-Selbsteinschätzung Samen → Keimling → Pflanze → Blume und Reflexionsfrage am Ende.
- **Churer Modell:** Kreisinput 10–12 min, Reflexion im Kreis; wählbar: Lernaufgaben ● Grundlage / ●● Kern / ●●● Herausforderung zur Selbstwahl.
- **Sternchenaufgabe ★** (wählbar): eine freiwillige Knobelaufgabe für alle am Ende.

Leitfigur aller Materialien ist Willi oder Wilma Waschbär (`grundschul-didaktik/references/kindgerecht-gestalten.md`).

Zu Beginn fragen die Skills einzeln ab: Materialart, Medium/Format, Farbe oder Schwarz-Weiß und je nach Materialart Selbsteinschätzung, Churer Modell und Sternchenaufgabe (`grundschul-didaktik/references/rueckfragen.md`). Daraus folgt das Druckprofil: s/w tonersparend mit Strichzeichnungen oder Farbe als Akzent. In beiden Profilen stehen Aufgaben ohne Kästen, damit der Platz für Aufgaben und Luft bleibt; Richtwerte je Klasse halten die Blätter übersichtlich (`grundschul-didaktik/references/druck-und-platz.md`).

## Didaktische Grundlage

Die Skills beruhen auf einer Recherche zu KMK-Bildungsstandards (2022), Perspektivrahmen Sachunterricht, Mathematikdidaktik (EIS-Prinzip, Kraft der Fünf, produktives Üben), Lese- und Rechtschreibdidaktik, Cognitive Load Theory, Differenzierung und sprachsensiblem Unterricht. Details und Links: [`skills/grundschul-didaktik/references/quellen.md`](skills/grundschul-didaktik/references/quellen.md).

## Installation

**Claude.ai / Claude Desktop:** Jeden Skill-Ordner als ZIP packen (`./scripts/package.sh` erzeugt sie in `dist/`) und unter *Einstellungen → Fähigkeiten → Skills* hochladen. Für Bilder und Grafiken den Canva-Connector verbinden. Zum Bauen der PDFs braucht die Umgebung Python und Chromium (`pip install playwright pypdfium2 && playwright install chromium`).

**Claude Code:** Ordner aus `skills/` nach `~/.claude/skills/` (persönlich) oder `.claude/skills/` (Projekt) kopieren.

Empfehlung: Immer alle Skills installieren, da sie aufeinander verweisen.

## Canva

- Die Canva-KI erzeugt Bilder und Grafiken nach Bedarf: Sachbilder, Wortschatz- und Anlautbilder, Bildergeschichten, unbeschriftete Sachgrafiken, neue Posen von Willi und Wilma. Die Skills holen sie als PNG in Originalauflösung und bauen sie ins HTML ein (`html-materialerstellung/references/bilder.md`). Canva for Education ist für Lehrkräfte kostenlos.
- Layout und Text entstehen nie in Canva, und exakte Abbildungen (Uhren, Mengen, Zahlenstrahl) nie per KI.
- Das fertige PDF lässt sich in Canva hochladen, wenn jemand dort weiterarbeiten möchte.

## Schriften

Fredoka und Andika liegen unter der SIL Open Font License in `html-materialerstellung/assets/fonts/` und werden ins PDF eingebettet. Eine Schulschrift der Klasse kann dort ergänzt werden, sofern die Lizenz das erlaubt.

## Erweitern

Neuer Fach- oder Material-Skill: Ordner mit `SKILL.md` anlegen (Frontmatter `name`, `description`), Abschnitt "Rückfragen", fachliche Leitlinien, Umsetzung der Kernkonzepte und Qualitätscheck aufnehmen und auf `grundschul-didaktik` verweisen.

# Grundschul-Skills

AI-Skills zur Unterrichtsvorbereitung für Grundschul-Lehrkräfte (Klasse 1–4). Die Skills erstellen Unterrichtsmaterial nach aktuellen didaktischen Standards und setzen es über den **Canva MCP** als druckfertiges Material um.

## Aufbau

Die Skills sind in drei Ebenen gegliedert, die zusammenspielen:

```
skills/
├── grundschul-didaktik/        Basis: Kernkonzepte, Leitlinien, Gestaltung, Differenzierung, Rückfrage-Protokoll
│   ├── references/             kernkonzepte · rueckfragen · entwurf-und-aufgabenplan · gestaltung ·
│   │                           kindgerecht-gestalten · druck-und-platz · differenzierung ·
│   │                           sprachsensibel · quellen
│   └── scripts/                entwurf.py (schnelle Entwürfe als HTML-Vorschau)
├── canva-materialerstellung/   Technik: Ablauf mit dem Canva MCP (erstellen, prüfen, korrigieren, exportieren)
│   ├── references/             layout-und-bearbeitbarkeit (Raster, Platzbudget, bearbeitbar bauen)
│   └── scripts/                layout_check.py (findet Überlappungen, Randfehler, fehlende Gruppen,
│                               Flächen, Kontrast und Leerraum je Druckprofil)
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

Beispiel: "Ich brauche ein Arbeitsblatt zur Uhrzeit für Klasse 2" lädt `grundschul-didaktik` + `arbeitsblatt` + `fach-mathematik` + `canva-materialerstellung`.

## Rückfragen statt Raten

Bei ungenauen Anfragen erstellen die Skills nicht sofort etwas, sondern fragen gezielt nach (`grundschul-didaktik/references/rueckfragen.md`):

- eine Frage pro Nachricht, in sinnvoller Reihenfolge (Klasse → Ziel → Lerngruppe → Form)
- jede Frage mit Antwortoptionen und einer Empfehlung
- Herleitbares wird nicht gefragt, sondern als Annahme genannt
- statt Fragen zu Aufgabenformat oder Rahmen: 2–3 schnelle Entwürfe zur Auswahl

## Erst Entwurf, dann Canva

Die Umsetzung in Canva ist der zeit- und tokenintensivste Schritt. Deshalb läuft jedes Material in Phasen (`grundschul-didaktik/references/entwurf-und-aufgabenplan.md`):

1. **Klären:** Start-Abfrage und wenige Rückfragen.
2. **Entwürfe:** 2–3 schnelle, deutlich verschiedene Entwürfe als HTML-Vorschau im echten Format (`grundschul-didaktik/scripts/entwurf.py`, ohne Canva) oder als Textskizze.
3. **Feedback:** Die Lehrkraft wählt einen Entwurf und sagt, was anders sein soll.
4. **Aufgabenplan:** alle Inhalte, Items, Lösungen und Bilder je Materialart exakt festgelegt, zur Freigabe.
5. **Canva:** baut nur den freigegebenen Plan, in einem Durchgang.

## Kernkonzepte

Alle Materialien verkörpern zwei Konzepte (`grundschul-didaktik/references/kernkonzepte.md`). Haltung und Sprache gelten immer; Selbsteinschätzung, Niveaus zur Selbstwahl und Sternchenaufgabe werden zu Beginn abgefragt:

- **Growth Mindset:** Ich-kann-Ziel oben, „noch"-Sprache, Strategietipps; wählbar: Wachstums-Selbsteinschätzung Samen → Keimling → Pflanze → Blume und Reflexionsfrage am Ende.
- **Churer Modell:** Kreisinput 10–12 min, Reflexion im Kreis; wählbar: Lernaufgaben ● Grundlage / ●● Kern / ●●● Herausforderung zur Selbstwahl.
- **Sternchenaufgabe ★** (wählbar): eine freiwillige Knobelaufgabe für alle am Ende.

Leitfigur aller Materialien ist Willi oder Wilma Waschbär (`grundschul-didaktik/references/kindgerecht-gestalten.md`).

Zu Beginn fragen die Skills einzeln ab: Materialart, Medium/Format, Farbe oder Schwarz-Weiß und je nach Materialart Selbsteinschätzung, Churer Modell und Sternchenaufgabe (`grundschul-didaktik/references/rueckfragen.md`). Daraus folgt das Druckprofil: s/w tonersparend mit Strichzeichnungen oder Farbe als Akzent. In beiden Profilen stehen Aufgaben ohne Kästen, damit mehr Übung auf eine Seite passt (`grundschul-didaktik/references/druck-und-platz.md`).

## Didaktische Grundlage

Die Skills beruhen auf einer Recherche zu KMK-Bildungsstandards (2022), Perspektivrahmen Sachunterricht, Mathematikdidaktik (EIS-Prinzip, Kraft der Fünf, produktives Üben), Lese- und Rechtschreibdidaktik, Cognitive Load Theory, Differenzierung und sprachsensiblem Unterricht. Details und Links: [`skills/grundschul-didaktik/references/quellen.md`](skills/grundschul-didaktik/references/quellen.md).

## Installation

**Claude.ai / Claude Desktop:** Jeden Skill-Ordner als ZIP packen (`./scripts/package.sh` erzeugt sie in `dist/`) und unter *Einstellungen → Fähigkeiten → Skills* hochladen. Der Canva-Connector muss verbunden sein.

**Claude Code:** Ordner aus `skills/` nach `~/.claude/skills/` (persönlich) oder `.claude/skills/` (Projekt) kopieren.

Empfehlung: Immer alle Skills installieren, da sie aufeinander verweisen.

## Canva

- Canva for Education ist für Lehrkräfte kostenlos.
- Schulschrift (z. B. Grundschrift) im Brand Kit hochladen, damit Materialien die Schrift der Klasse nutzen.
- Eigene Vorlagen (Kopfzeile, Symbole) in Canva anlegen – die Skills nutzen sie, wenn vorhanden.

## Erweitern

Neuer Fach- oder Material-Skill: Ordner mit `SKILL.md` anlegen (Frontmatter `name`, `description`), Abschnitt "Rückfragen", fachliche Leitlinien, Umsetzung der Kernkonzepte und Qualitätscheck aufnehmen und auf `grundschul-didaktik` verweisen.

# Grundschul-Skills

AI-Skills zur Unterrichtsvorbereitung für Grundschul-Lehrkräfte (Klasse 1–4). Die Skills erstellen Unterrichtsmaterial nach aktuellen didaktischen Standards und setzen es über den **Canva MCP** als druckfertiges Material um.

## Aufbau

Die Skills sind in drei Ebenen gegliedert, die zusammenspielen:

```
skills/
├── grundschul-didaktik/        Basis: Kernkonzepte, Leitlinien, Gestaltung, Differenzierung, Rückfrage-Protokoll
│   └── references/             kernkonzepte · rueckfragen · gestaltung · kindgerecht-gestalten ·
│                               druck-und-platz · differenzierung · sprachsensibel · quellen
├── canva-materialerstellung/   Technik: Ablauf mit dem Canva MCP (erstellen, prüfen, korrigieren, exportieren)
│   ├── references/             layout-und-bearbeitbarkeit (Raster, Platzbudget, bearbeitbar bauen)
│   └── scripts/                layout_check.py (findet Überlappungen, Randfehler, fehlende Gruppen,
│                               Farbflächen und Leerraum für den s/w-Druck)
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
- vor der Erstellung ein kurzes Briefing zur Freigabe

## Kernkonzepte

Alle Materialien verkörpern zwei verbindliche Konzepte (`grundschul-didaktik/references/kernkonzepte.md`):

- **Growth Mindset:** Ich-kann-Ziel oben, Wachstums-Selbsteinschätzung Samen → Keimling → Pflanze → Blume, „noch"-Sprache, Strategietipps, Reflexionsfrage am Ende.
- **Churer Modell:** Kreisinput 10–12 min, Lernaufgaben ● Grundlage / ●● Kern / ●●● Herausforderung zur Selbstwahl, Reflexion im Kreis.

Leitfigur aller Materialien ist Willi oder Wilma Waschbär (`grundschul-didaktik/references/kindgerecht-gestalten.md`).

Kopiervorlagen sind für den Schwarz-Weiß-Druck gebaut: keine Farbflächen, wenig Toner, Aufgaben ohne Kästen, damit mehr Übung auf eine Seite passt (`grundschul-didaktik/references/druck-und-platz.md`).

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

# Grundschul-Skills

AI-Skills zur Unterrichtsvorbereitung für Grundschul-Lehrkräfte (Klasse 1–4). Die Skills erstellen Unterrichtsmaterial nach aktuellen didaktischen Standards und setzen es über den **Canva MCP** als druckfertiges Material um.

## Aufbau

Die Skills sind in drei Ebenen gegliedert, die zusammenspielen:

```
skills/
├── grundschul-didaktik/        Basis: Leitlinien, Gestaltung, Differenzierung, Rückfrage-Protokoll
│   └── references/             gestaltung · differenzierung · sprachsensibel · rueckfragen · quellen
├── canva-materialerstellung/   Technik: Ablauf mit dem Canva MCP (erstellen, prüfen, korrigieren, exportieren)
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

## Didaktische Grundlage

Die Skills beruhen auf einer Recherche zu KMK-Bildungsstandards (2022), Perspektivrahmen Sachunterricht, Mathematikdidaktik (EIS-Prinzip, Kraft der Fünf, produktives Üben), Lese- und Rechtschreibdidaktik, Cognitive Load Theory, Differenzierung und sprachsensiblem Unterricht. Details und Links: [`skills/grundschul-didaktik/references/quellen.md`](skills/grundschul-didaktik/references/quellen.md).

## Installation

**Claude.ai / Claude Desktop:** Jeden Skill-Ordner als ZIP packen (`./scripts/package.sh` erzeugt sie in `dist/`) und unter *Einstellungen → Fähigkeiten → Skills* hochladen. Der Canva-Connector muss verbunden sein.

**Claude Code:** Ordner aus `skills/` nach `~/.claude/skills/` (persönlich) oder `.claude/skills/` (Projekt) kopieren.

Empfehlung: Immer alle Skills installieren, da sie aufeinander verweisen.

## Canva

- Canva for Education ist für Lehrkräfte kostenlos.
- Schulschrift (z. B. Grundschrift) im Brand Kit hochladen, damit Materialien die Schrift der Klasse nutzen.
- Leitfigur aller Materialien: Willi oder Wilma Waschbär (siehe `grundschul-didaktik/references/kindgerecht-gestalten.md`).
- Eigene Vorlagen (Kopfzeile, Symbole) in Canva anlegen – die Skills nutzen sie, wenn vorhanden.

## Erweitern

Neuer Fach- oder Material-Skill: Ordner mit `SKILL.md` anlegen (Frontmatter `name`, `description`), Abschnitt "Rückfragen", fachliche Leitlinien und Qualitätscheck aufnehmen und auf `grundschul-didaktik` verweisen.

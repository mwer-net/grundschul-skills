# Grundschul-Skills

AI-Skills zur Unterrichtsvorbereitung für Grundschul-Lehrkräfte (Klasse 1–4) in Baden-Württemberg. Die Skills erstellen Unterrichtsmaterial nach aktuellen didaktischen Standards als **HTML/CSS** und geben es als druckfertiges A4-PDF mit Lösungsblatt aus. Bilder und Grafiken erzeugen die Skills bei Bedarf mit der **Canva-KI** (Canva MCP) und bauen sie ins Material ein.

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
├── lernzielkontrolle/          │  (unbenotet: Lernzielkontrolle, Lernlandkarte, „Fit für die Arbeit")
├── klassenarbeit/              ┘  (benotet, Kl. 3/4: BW-Regeln, Probearbeit, Rückgabe)
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

Die Skills beruhen auf einer Recherche zum Bildungsplan Baden-Württemberg (Deutsch und Mathematik auf Grundlage der KMK-Bildungsstandards 2022), zu Grundwortschatz und Rechtschreibrahmen BW, zur Grundschul-Leistungsbeurteilungsverordnung und zu lernförderlichen Klassenarbeiten (PIKAS), zu Perspektivrahmen Sachunterricht, Mathematikdidaktik (EIS-Prinzip, Kraft der Fünf, produktives Üben), Lese- und Rechtschreibdidaktik, Cognitive Load Theory, Differenzierung und sprachsensiblem Unterricht. Details und Links: [`skills/grundschul-didaktik/references/quellen.md`](skills/grundschul-didaktik/references/quellen.md).

## Installation

**Claude.ai / Claude Desktop:** Jeden Skill-Ordner als ZIP packen (`./scripts/package.sh` erzeugt sie in `dist/`) und unter *Einstellungen → Fähigkeiten → Skills* hochladen. Für Bilder und Grafiken den Canva-Connector verbinden. Zum Bauen der PDFs braucht die Umgebung Python und Chromium (`pip install playwright pypdfium2 && playwright install chromium`).

**Claude Code (empfohlen):** Repo klonen und darin `claude` starten. `.claude/skills` ist ein Symlink auf `skills/`, alle Skills sind damit als Projekt-Skills geladen, und Änderungen an `skills/` wirken sofort, ohne Kopieren. Liegen dieselben Skills zusätzlich als Kopie in `~/.claude/skills/`, erscheinen sie doppelt. Die Kopien dann entfernen.

```bash
git clone <repo-url> && cd <repo>
git config core.hooksPath .githooks   # Pre-Commit-Hook: sperrt materialien/, lokal/ und .env
claude
```

**Claude Code (persönlich, ohne Projekt):** Ordner aus `skills/` nach `~/.claude/skills/` kopieren.

Empfehlung: Immer alle Skills installieren, da sie aufeinander verweisen.

### Python und Chromium für `blatt.py`

`blatt.py` braucht Python 3, Chromium, Pillow und pypdfium2 bzw. `pdftoppm`. Ohne die beiden Letzteren entsteht nur das PDF, ohne Vorschau-PNGs und ohne Ausschnitte je Aufgabe, und die visuelle Endkontrolle fällt aus. Chromium findet `blatt.py` als Playwright-Chromium (`~/.cache/ms-playwright/`), `chromium` oder `google-chrome`.

- **Debian/Ubuntu:** `sudo apt install python3-pil poppler-utils`. Danach läuft `python3 …/blatt.py` wie in den Skills beschrieben, ohne virtuelle Umgebung (PNGs über `pdftoppm`).
- **Andere Systeme:** `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`, dann `.venv/bin/python` statt `python3` aufrufen.

### Schoolbox (im Aufbau)

Die Schoolbox (`schoolbox/`) macht das Material für die Lehrkraft nutzbar: Ablage in Mappen, später Ansicht, PDF, Präsentation und Bearbeiten im Browser. Claude legt Material über das CLI an und gibt am Ende einen Link aus. Braucht Node 22 und pnpm.

```bash
cp .env.example .env                  # SCHOOLBOX_URL, MATERIAL_DIR, NODE_BIN, PYTHON_BIN anpassen
cd schoolbox && pnpm install && pnpm test
schoolbox/bin/schoolbox --hilfe       # aus dem Repo-Hauptordner
```

Ein typischer Ablauf aus einer Claude-Sitzung:

```bash
schoolbox/bin/schoolbox neu --titel "Kartoffeln" --fach sachunterricht --klasse 3
schoolbox/bin/schoolbox dokument <mappe> --titel "Teile der Kartoffel" --art arbeitsblatt --druckprofil sw --vorlage arbeitsblatt
# … material.html mit den Skills ausarbeiten …
schoolbox/bin/schoolbox fertig <mappe>/<dokument>   # baut mit blatt.py, legt eine Version an, gibt den Link aus
```

`NODE_BIN` ist nötig, wenn im `PATH` ein älteres Node liegt: Der Wrapper nimmt dann das Node aus `.env`. Die Materialien landen in `MATERIAL_DIR` (Standard `materialien/`), das per `.gitignore` und Pre-Commit-Hook gesperrt ist.

Der Server (`schoolbox/server`, Express) liefert API, Darstellung und Oberfläche aus und lauscht nur auf `HOST`/`PORT` aus `.env` (Standard `127.0.0.1:4009`). Ein Reverse Proxy leitet die öffentliche Adresse dorthin, `/api/ereignisse` (Server-Sent Events) ungepuffert. Er beobachtet `MATERIAL_DIR`: Ändert Claude ein `material.html`, legt er nach kurzer Ruhe eine Version an und meldet es allen offenen Browsern.

```bash
cd schoolbox
pnpm build                            # Oberfläche (web/) bauen
pnpm start                            # Server starten; mit PM2: pm2 start ecosystem.config.cjs
pnpm dev                              # Entwicklung: Server mit Neustart bei Änderungen, Vite mit Proxy
```

## Canva

- Die Canva-KI erzeugt Bilder und Grafiken nach Bedarf: Sachbilder, Wortschatz- und Anlautbilder, Bildergeschichten, unbeschriftete Sachgrafiken, neue Posen von Willi und Wilma. Die Skills holen sie als PNG in Originalauflösung und bauen sie ins HTML ein (`html-materialerstellung/references/bilder.md`). Canva for Education ist für Lehrkräfte kostenlos.
- Layout und Text entstehen nie in Canva, und exakte Abbildungen (Uhren, Mengen, Zahlenstrahl) nie per KI.
- Das fertige PDF lässt sich in Canva hochladen, wenn jemand dort weiterarbeiten möchte.

## Schriften

Fredoka und Andika liegen unter der SIL Open Font License in `html-materialerstellung/assets/fonts/` und werden ins PDF eingebettet. Eine Schulschrift der Klasse kann dort ergänzt werden, sofern die Lizenz das erlaubt.

## Erweitern

Neuer Fach- oder Material-Skill: Ordner mit `SKILL.md` anlegen (Frontmatter `name`, `description`), Abschnitt "Rückfragen", fachliche Leitlinien, Umsetzung der Kernkonzepte und Qualitätscheck aufnehmen und auf `grundschul-didaktik` verweisen.

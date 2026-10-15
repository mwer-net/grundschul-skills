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

Die Schoolbox (`schoolbox/`) macht das Material für die Lehrkraft nutzbar: Ablage in Mappen, im Browser eine Übersicht mit Suche, Papierkorb und Teilen-Links; später Ansicht, PDF, Präsentation und Bearbeiten. Claude legt Material über das CLI an und gibt am Ende einen Link aus. Braucht Node 22 und pnpm.

```bash
cp .env.example .env                  # SCHOOLBOX_URL, MATERIAL_DIR, NODE_BIN, PYTHON_BIN anpassen
cd schoolbox && pnpm install && pnpm test
schoolbox/bin/schoolbox --hilfe       # aus dem Repo-Hauptordner
schoolbox/bin/schoolbox passwort      # Passwort der Anmeldung setzen (erzeugt auch SITZUNG_GEHEIMNIS)
```

Ein typischer Ablauf aus einer Claude-Sitzung:

```bash
schoolbox/bin/schoolbox neu --titel "Kartoffeln" --fach sachunterricht --klasse 3
schoolbox/bin/schoolbox dokument <mappe> --titel "Teile der Kartoffel" --art arbeitsblatt --druckprofil sw --vorlage arbeitsblatt
schoolbox/bin/schoolbox entwuerfe <mappe>/<dokument> entwurf-a.html entwurf-b.html   # prüft, baut Vorschauen, gibt den Link aus
schoolbox/bin/schoolbox waehle <mappe>/<dokument> B                                  # Entwurf B wird material.html
# … material.html mit den Skills ausarbeiten …
schoolbox/bin/schoolbox fertig <mappe>/<dokument>   # baut mit blatt.py, legt eine Version an, gibt den Link aus
```

`NODE_BIN` ist nötig, wenn im `PATH` ein älteres Node liegt: Der Wrapper nimmt dann das Node aus `.env`. Die Materialien landen in `MATERIAL_DIR` (Standard `materialien/`), das per `.gitignore` und Pre-Commit-Hook gesperrt ist.

Der Server (`schoolbox/server`, Express) liefert API, Darstellung und Oberfläche aus und lauscht nur auf `HOST`/`PORT` aus `.env` (Standard `127.0.0.1:4009`). Ein Reverse Proxy leitet die öffentliche Adresse dorthin, `/api/ereignisse` (Server-Sent Events) ungepuffert. Er beobachtet `MATERIAL_DIR`: Ändert Claude ein `material.html`, legt er nach kurzer Ruhe eine Version an und meldet es allen offenen Browsern.

Ohne `PASSWORT_HASH` und `SITZUNG_GEHEIMNIS` startet er nicht. Anmeldung mit einem Passwort, wahlweise „angemeldet bleiben“ (ein Jahr); nach fünf Fehlversuchen von einer Adresse ist sie gebremst, jeder Fehlversuch steht als `Anmeldung fehlgeschlagen: ip=<Adresse>` im Log (passt für einen fail2ban-Filter). Ein neues Passwort gilt nach dem Neustart des Servers und meldet alle Geräte ab. Teilen-Links (`/f/<token>`) zeigen ein Dokument oder eine Mappe ohne Anmeldung, nur lesend, und lassen sich widerrufen. Der Reverse Proxy sollte `X-Forwarded-Proto` setzen; ist `SCHOOLBOX_URL` eine https-Adresse, ist das Cookie ohnehin `Secure`.

Die Oberfläche (`schoolbox/web`, React, Tailwind) ist für Safari auf Mac und iPad gebaut, Desktop zuerst und vollständig mit dem Finger bedienbar. Die Übersicht zeigt alle Mappen mit Vorschau, Suche und Filtern nach Fach, Klasse und Materialart; was Claude neu anlegt, erscheint ohne Neuladen. Fehlt einem Dokument die Vorschau der ersten Seite (`ausgabe/material-s1.png`) oder ist sie älter als `material.html`, baut der Server sie im Hintergrund mit `blatt.py` (eine nach der anderen, Chromium nötig). Gelöschte Mappen liegen 30 Tage in `MATERIAL_DIR/_papierkorb/` und lassen sich dort wiederherstellen; danach löscht der Server sie beim Start bzw. einmal täglich endgültig, samt ihren Teilen-Links.

Jedes Dokument hat eine eigene Seite: das Material, wie es gedruckt aussieht, umschaltbar auf die Lösung, mit „PDF herunterladen“ und „Drucken“ (öffnet das PDF in einem neuen Tab, gedruckt wird aus dem PDF-Betrachter des Browsers). PDFs baut der Server bei Bedarf mit `blatt.py` und hebt sie in `ausgabe/` auf, bis sich Material, Bilder, Stylesheets oder `blatt.py` ändern (`ausgabe/stand.json`); Vorschauen und PDFs bauen höchstens zu zweit gleichzeitig. Findet die Prüfung Fehler, warnt die Oberfläche mit verständlichen Sätzen und lässt das PDF trotzdem zu. „Alles als PDF“ fügt die Blätter einer Mappe zusammen, wahlweise mit den Lösungen am Ende; dafür braucht der Server `pdfunite` (Debian/Ubuntu: `poppler-utils`). Teilen-Links bieten Ansicht, PDF und Drucken genauso, ohne Warnung.

Entwürfe vergleicht die Lehrkraft unter `/m/<mappe>/<dokument>/entwuerfe`: am Mac und auf dem iPad quer nebeneinander und ohne Scrollen, auf dem iPad hoch zum Durchwischen, jeweils mit Buchstabe, Idee und dem Vermerk, ob der Entwurf auf die Seite passt; antippen zeigt ihn groß mit allen Seiten. Wählen kann sie nur bei Claude, deshalb gibt es dort keinen Auswahlknopf. `schoolbox entwuerfe` baut dafür die Vorschauen (`entwuerfe/A-s1.png`) mit `blatt.py`, aus einer Temp-Kopie im Dokumentordner, damit relative Pfade wie nach `waehle` stimmen. Teilen-Links sehen keine Entwürfe.

```bash
cd schoolbox
pnpm build                            # Oberfläche (web/) bauen
pnpm start                            # Server starten; mit PM2: pm2 start ecosystem.config.cjs
pnpm dev                              # Entwicklung: Server mit Neustart bei Änderungen, Vite mit Proxy
pnpm --filter @schoolbox/web run e2e:browser   # einmalig: WebKit und Chromium für die Browser-Tests
pnpm --filter @schoolbox/web run e2e           # Oberfläche bauen, in WebKit (iPad hoch/quer, Mac) und Chromium testen
```

Die Browser-Tests starten einen eigenen Server mit leerer Ablage in `/tmp`. Browser nur über `e2e:browser` installieren: `playwright install` räumt im gemeinsamen Cache `~/.cache/ms-playwright/` alle Browser ab, die zu keiner Playwright-Installation mehr gehören, und dazu kann das Chromium gehören, mit dem `blatt.py` baut. Das Skript setzt `PLAYWRIGHT_SKIP_BROWSER_GC=1` und installiert Chromium immer mit. WebKit braucht unter Linux zusätzliche Systembibliotheken; welche fehlen, nennt die Fehlermeldung beim ersten Start.

#### Betrieb auf einem eigenen Server

Der Server bindet nur `HOST` (Standard `127.0.0.1`); öffentlich erreichbar wird er über einen Reverse Proxy mit TLS, der alles auf `http://127.0.0.1:<PORT>/` weiterleitet. Der Webroot des Proxys darf **nie** der Repo-Ordner sein, sonst wären `.env` und die Materialien abrufbar. Beispiel für Apache (`mod_proxy_http`, `mod_headers`):

```apache
DocumentRoot /pfad/zu/einem/leeren/ordner     # nur für /.well-known/ (Zertifikat per Webroot)
ProxyPreserveHost On
RequestHeader set X-Forwarded-Proto https
ProxyPass /.well-known/ !
ProxyPass / http://127.0.0.1:4009/
ProxyPassReverse / http://127.0.0.1:4009/
ExpiresActive Off                             # Cache-Control setzt der Server selbst
LimitRequestBody 26214400                     # Bild-Uploads
```

Server-Sent Events brauchen keine Sonderbehandlung, solange der Proxy `text/event-stream` nicht komprimiert und sein Timeout über 25 s liegt (der Server sendet einen Puls). Erster Start: `pnpm install && pnpm build`, dann `pm2 start schoolbox/ecosystem.config.cjs && pm2 save`. Fehlversuche bei der Anmeldung stehen in `schoolbox/logs/error.log` als `JJJJ-MM-TT hh:mm:ss ±hh:mm: Anmeldung fehlgeschlagen: ip=<Adresse>` (bzw. `gebremst`), passend für einen fail2ban-Filter.

Danach rollt `scripts/ausrollen.sh` neue Stände aus: Fast-Forward auf `origin/main`, `pnpm install --frozen-lockfile`, Typprüfung, Oberfläche daneben bauen und tauschen, `pm2 reload schoolbox`, bis `/healthz` den neuen Commit meldet. Schlägt ein Schritt fehl, kehrt es zum alten Commit zurück und der alte Stand läuft weiter. Es verlangt einen sauberen Arbeitsbaum auf `main`; `--immer` baut auch ohne neuen Stand.

#### Zwei Klone: einer für die Lehrkraft, einer für die Entwicklung

Die Lehrkraft spricht mit Claude in dem Ordner, aus dem die Schoolbox läuft. Wer dort auch entwickelt, riskiert zweierlei: Ein halbfertiger Stand legt die Schoolbox lahm, und ein Wunsch wie „alle Arbeitsblätter sollen größere Schrift haben“ ändert einen Skill, statt beim Entwickler zu landen. Deshalb zwei Klone.

**Klon der Lehrkraft.** Er steht auf `main` und bekommt neue Stände nur mit `scripts/ausrollen.sh`. Einmal einrichten:

```bash
scripts/einrichten-lehrkraft.sh             # nach einer geänderten Vorlage erneut ausführen
scripts/einrichten-lehrkraft.sh --pruefen   # meldet, was fehlt oder abweicht
scripts/einrichten-lehrkraft.sh --aufheben  # alles zurücknehmen
```

Das Skript kopiert `schoolbox/vorlagen/settings.lehrkraft.json` nach `.claude/settings.local.json` (wird nie committet). Claude darf danach in diesem Ordner nicht committen, nicht pushen, `.env` nicht lesen und außerhalb von `materialien/` nichts ändern. Was es für Material braucht (das CLI, `blatt.py`, Canva, Dateien in `materialien/`), läuft ohne Rückfrage. Liegt `MATERIAL_DIR` woanders, die Freigaben in der Vorlage anpassen.

Außerdem kopiert es `schoolbox/vorlagen/CLAUDE.lehrkraft.md` nach `CLAUDE.local.md` (ebenfalls nie committet). Diese Anweisungen gelten nur in diesem Klon: Claude spricht mit einer Lehrkraft, die nicht programmiert. Im Chat stehen keine Befehle, Pfade oder Fehlermeldungen, Material wird über das CLI in Mappen abgelegt, und am Ende steht ein Link in die Schoolbox. Wünsche, die alle Materialien betreffen („ab jetzt größere Schrift“), ändert Claude nicht selbst, sondern notiert sie mit `schoolbox wunsch` in `materialien/_wuensche.md`. Die Skills selbst bleiben ohne Schoolbox nutzbar; ihre Abschnitte „Mit Schoolbox“ greifen nur, wenn die Projektanweisungen eine nennen.

Zwei Dinge an der Vorlage sind nicht offensichtlich:

- **Hooks sind abgeschaltet** (`disableAllHooks`). Ein Hook aus den persönlichen Einstellungen, der Bash-Befehle umschreibt und freigibt, setzt sonst jede `Bash(…)`-Sperre außer Kraft, weil die Regel den umgeschriebenen Befehl nicht mehr erkennt.
- **Die Regeln prüfen den Wortlaut eines Befehls.** `git -C . push` trifft die Sperre für `git push` nicht. Das Skript macht deshalb zusätzlich die Push-Adresse des Klons ungültig und schaltet im Pre-Commit-Hook eine Commit-Sperre ein (`git config schoolbox.lehrkraftModus true`). Holen funktioniert weiter, `ausrollen.sh` pusht nie.

Einen Berechtigungsmodus legt die Vorlage nicht fest. Für die Sitzungen der Lehrkraft passt Auto: Claude fragt dann auch bei Unvorhergesehenem nicht nach, und die Sperren gelten trotzdem. Auto lässt sich nicht in der Einstellungsdatei setzen, nur beim Start, zum Beispiel mit `claude remote-control --permission-mode auto`.

**Entwicklerklon.** Ein zweiter Klon an anderer Stelle, mit eigener `.env`: anderer `PORT`, eigenes `MATERIAL_DIR` mit Testmappen (nie die echten Materialien) und `SCHOOLBOX_URL=http://localhost:5173`, sonst nimmt der Browser das Anmelde-Cookie über http nicht an. Dort `git config core.hooksPath .githooks`, in `schoolbox/` einmal `pnpm install`, dann `pnpm dev`. `einrichten-lehrkraft.sh` wird dort nie ausgeführt. `ausrollen.sh` bricht im Entwicklerklon ab, solange die PM2-App aus einem anderen Ordner läuft, und lädt so nie versehentlich die Schoolbox der Lehrkraft neu.

Der Weg einer Änderung: Branch im Entwicklerklon, nach `main` zusammenführen und pushen, dann im Klon der Lehrkraft `scripts/ausrollen.sh`.

## Canva

- Die Canva-KI erzeugt Bilder und Grafiken nach Bedarf: Sachbilder, Wortschatz- und Anlautbilder, Bildergeschichten, unbeschriftete Sachgrafiken, neue Posen von Willi und Wilma. Die Skills holen sie als PNG in Originalauflösung und bauen sie ins HTML ein (`html-materialerstellung/references/bilder.md`). Canva for Education ist für Lehrkräfte kostenlos.
- Layout und Text entstehen nie in Canva, und exakte Abbildungen (Uhren, Mengen, Zahlenstrahl) nie per KI.
- Das fertige PDF lässt sich in Canva hochladen, wenn jemand dort weiterarbeiten möchte.

## Schriften

Fredoka und Andika liegen unter der SIL Open Font License in `html-materialerstellung/assets/fonts/` und werden ins PDF eingebettet. Eine Schulschrift der Klasse kann dort ergänzt werden, sofern die Lizenz das erlaubt.

## Erweitern

Neuer Fach- oder Material-Skill: Ordner mit `SKILL.md` anlegen (Frontmatter `name`, `description`), Abschnitt "Rückfragen", fachliche Leitlinien, Umsetzung der Kernkonzepte und Qualitätscheck aufnehmen und auf `grundschul-didaktik` verweisen.

# Folien

Für Präsentationen (Skill `praesentation`), Ausgangspunkt `assets/vorlage-praesentation.html`. Am `<body>` steht `folie`, z. B. `<body class="kl3 farbe palette-wiese folie">`, je Folie eine `<section class="seite">`. Eine Folie ist 1280 × 720 px groß (16:9), mit 48 px Rand bleiben 1184 × 624 px. Text 40 px (Kl. 1/2: 48 px), Überschrift 64 px; das setzt `blatt.css` für `folie`, die Klassenstufe ändert daran nichts außer in Kl. 1/2. Raster und Platzbudget: `references/layout.md`.

| Baustein | Markup | Beim Präsentieren | Im PDF |
|---|---|---|---|
| Bühne | `<div class="buehne">` nach dem Kopf: füllt den Rest der Folie, Inhalte nebeneinander und mittig. Bilder, Platzhalter und Timer behalten ihre Breite, Text und `.tipp` passen sich an. | wie im PDF | wie gesetzt |
| Schritt | `data-schritt="1"`, `"2"` … an einem Element der Folie; gleiche Zahl erscheint zusammen | Weiter deckt der Reihe nach auf, danach kommt die nächste Folie | alles sichtbar |
| Aufdecken | `<span class="aufdecken">…</span>` um die Lösung im Satz, z. B. das Schlüsselwort des Merksatzes | verdeckt (Fläche mit „?“), Antippen oder Weiter deckt auf | sichtbar |
| Timer | `<x-timer minuten="25" groesse="280"></x-timer>`. Die Skala reicht bis 60, über 60 Minuten bis 120; für kurze Phasen `skala="5"` oder `"10"`, sonst ist die Scheibe kaum zu sehen | läuft ab wie ein Time Timer, Antippen startet und hält an, sanftes Ende ohne Ton | Scheibe mit der eingestellten Zeit, darunter „25 Minuten“ |
| Vermutung | `<div class="vermutung"><span class="nr">A</span>Antwort<span class="leerstelle"></span></div>`, mehrere untereinander in `<div class="reihe" style="--spalten:1;width:620px">`: Antwort zum Abstimmen mit Kästchen für die Strichliste; langer Text bricht um | wie im PDF | wie gesetzt |
| Leerstelle | `<span class="leerstelle" style="--h:120px"></span>` (Höhe über `--h`, sonst volle Breite oder `width`) für Antworten oder Wortkarten, die die Lehrkraft am Board ergänzt | gestrichelter Rahmen | gestrichelter Rahmen |
| Notiz | `<aside class="notiz"><p>…</p></aside>` am Ende jeder Folie | nie zu sehen | fehlt; steht in „Folien mit Notizen“ (`--notizen`) |

Präsentiert wird mit `assets/praesentation.js`: Mit `?praesentation=1` in der Adresse (oder `class="praesentieren"` am `<body>`) zeigt es eine Folie nach der anderen bildschirmfüllend und verhält sich wie in der vorletzten Spalte; ohne den Schalter bleibt das Dokument wie in der letzten Spalte. In der Schoolbox heißt das Knopf **Präsentieren**, sie fügt das Skript selbst ein; ins Material gehört es nicht. Niveau-Punkte, ★ und `.tipp` funktionieren wie auf dem Arbeitsblatt. Die Prüfung meldet auf Folien keinen freien Platz (eine Aussage je Folie ist gewollt), warnt bei zu kleiner Schrift (`schrift-klein`, gemessen an der Folienschrift) und weist auf Folien ohne Notiz hin, sobald eine Folie eine hat.

Ausgaben von `blatt.py bauen` für Folien, zum Präsentieren ohne Internet und zum Ausdrucken:

| Ausgabe | Aufruf | Wofür |
|---|---|---|
| `NAME.html` | immer | Offline-Präsentation für den Mac: alles eingebettet samt `praesentation.js`, startet mit „Präsentation starten“ (Vollbild, Bildschirm bleibt wach), nach Esc wieder der Startbildschirm. Ohne JavaScript und im Druck die Seitenfolge |
| `NAME-schritte.pdf` | `--schritte` | Fürs iPad: eine Seite je Zustand wie beim Weiterklicken, also je Folie 1 (alles verdeckt) + je Schritt + je `.aufdecken`; die Vorlage hat 11 Seiten. Verdeckt sieht aus wie beim Präsentieren, der Timer steht still |
| `NAME-notizen.pdf` | `--notizen` | Zum Ausdrucken: A4 hoch, je Blatt bis zu zwei Folien klein (360 px breit), daneben „Folie 3 · 3 Schritte · 1 × aufdecken · Timer 25 Minuten“ und die Notizen in 17 px. Passt die zweite nicht mehr, kommt sie aufs nächste Blatt. Die Prüfung läuft auch hier; nur FEHLER zählen („Folien mit Notizen: … → Notiz kürzen“) |

`--nur-zusatz` baut nur `--schritte`/`--notizen`, ohne Blatt, Vorschauen und Lösung (so ruft die Schoolbox es auf). Das normale PDF bleibt in jedem Fall die Seitenfolge mit allem aufgedeckt.

Für die `x-…`-Elemente hier gilt der Kopf des Katalogs `references/abbildungen.md` („Für alle gilt“: Lösung, Farbe, unzulässige Angaben, Attributformate, `seed`, `masstab`).

### `x-timer`: Zeitscheibe

Für Folien, läuft in der Präsentation ab.

```html
<x-timer minuten="25" groesse="120"></x-timer>
```

`minuten` von 1 bis 120, `skala` 5, 10, 15, 30, 60 oder 120 Minuten (für kurze Phasen 5 oder 10, sonst ist die Scheibe kaum zu sehen), `groesse` von 120 bis 600 px, Standard 360.

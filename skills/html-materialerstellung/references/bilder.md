# Bilder: Leitfigur, KI-Bilder mit Canva, Bilder ins Blatt holen

Was ein Bild bekommt, entscheidet `grundschul-didaktik/references/kindgerecht-gestalten.md` (Leitfigur mit Funktion, Bilder nur mit Mehrwert, Weglass-Test). Diese Datei regelt die Technik.

## 1. Vorhandene Grafiken (`assets/bilder/`)

| Datei | Inhalt | Profil | Canva-Media-ID |
|---|---|---|---|
| `willi.png` | Willi Waschbär, zeigt nach oben | Farbe | `MAHXV49zJZE` |
| `willi-strich.png` | Willi als Strichzeichnung, zeigt zur Seite | s/w | `MAHXWZ6fTfM` |
| `wilma.png` | Wilma Waschbär, zeigt nach oben | Farbe | `MAHXV_-A1xo` |
| `wachstum.png` | Wachstumsgrafik Samen → Keimling → Pflanze → Blume | Farbe | `MAHXV6P-UTw` |
| `wachstum-strich.png` | Wachstumsgrafik als Strichzeichnung | s/w | `MAHXWdlD_qM` |

Wilma als Strichzeichnung fehlt noch (anlegen nach Abschnitt 2, Datei `wilma-strich.png`).

**Auflösung:** Die Dateien sind derzeit Vorschaubilder (200 px breit). Für Willi/Wilma bis ca. 80 px Breite reicht das (≥ 240 dpi), die Wachstumsgrafik wird im Druck leicht unscharf (`blatt.py` meldet die dpi). Sobald die Originale (1264 px bzw. 1776 px) vorliegen, die Dateien gleichen Namens ersetzen.

Einbinden: `<img class="figur" src="bilder/willi-strich.png" alt="Willi">`. Im s/w-Profil immer die Strich-Version (`blatt.py` warnt bei farbigen Bildern).

## 2. Neue KI-Bilder mit Canva

Canva dient nur noch als Bildgenerator. Erst nach Freigabe des Aufgabenplans und nur für Motive aus dessen Bildliste.

1. `generate-image` mit dem **Stil-Satz** aus `kindgerecht-gestalten.md` (für alle Bilder eines Materials wörtlich gleich), danach das Motiv konkret. Neue Posen von Willi/Wilma mit dem Original als `imageReferences`. Keine Schrift, Zahlen oder Uhren im Bild.
2. Bei weißem Hintergrund freistellen: `remove-background`.
3. **Bild als Datei holen**, in dieser Reihenfolge:
   - a) Das Ergebnis enthält eine `design_id`: `export-design` als `png` mit `transparent_background: true`, dann die Download-URL mit `curl -L -o motiv.png "<url>"` laden. Klappt nur, wenn die Umgebung Canva-Downloads erlaubt.
   - b) Gesperrt: Die Lehrkraft öffnet „Open generated image", lädt das Bild herunter und gibt es in den Chat oder den Arbeitsordner.
   - c) Notlösung für kleine Figuren (≤ 80 px Breite): das Vorschaubild aus `get-assets` (200 px), wenn es als Datei vorliegt.
4. Die Datei neben die HTML-Quelle legen (`bilder/motiv.png`) und einbinden; `blatt.py` bettet sie ins PDF und in die eigenständige HTML-Datei ein.
5. Neue Posen der Leitfigur in `assets/bilder/` aufnehmen und in der Tabelle oben mit Media-ID ergänzen, damit sie nie zweimal erzeugt werden.

Die Media-IDs liegen im Canva-Konto, in dem die Figuren erstellt wurden. In einem anderen Konto die Dateien aus `assets/bilder/` verwenden; neue Posen mit einer davon als Referenz erzeugen (vorher hochladen: `create-upload-url`).

## 3. Keine KI für exakte Abbildungen

Uhren, Mengen, Zehnerstangen, Stellentafeln, Zwanzigerfeld, Zahlenstrahl kommen aus `assets/abbildungen.js`, nie aus einem KI-Bild: Zeiger, Teilungen und Anzahlen stimmen bei KI regelmäßig nicht. Fehlt eine Darstellung (z. B. Geldstücke, Geometrie), als SVG berechnen und bei Bedarf als neues `x-…`-Element in `abbildungen.js` ergänzen.

Sachabbildungen (Tiere, Pflanzen, Körper) fachlich prüfen; bei Zweifel ein geprüftes Foto der Lehrkraft verwenden.

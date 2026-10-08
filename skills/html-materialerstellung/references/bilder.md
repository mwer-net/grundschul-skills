# Bilder: Leitfigur, KI-Bilder und -Grafiken mit Canva, Bilder ins Blatt holen

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

**Auflösung:** Originale aus Canva (Willi/Wilma 1264 × 1264 px, Wachstumsgrafik 1776 × 896 px, transparenter Hintergrund), druckscharf in jeder sinnvollen Größe.

Einbinden: `<img class="figur" src="bilder/willi-strich.png" alt="Willi">`. Im s/w-Profil immer die Strich-Version (`blatt.py` warnt bei farbigen Bildern).

## 2. Bilder und Grafiken nach Bedarf mit Canva-KI

Braucht ein Material ein Bild oder eine Grafik, die nicht in `assets/bilder/` liegt und nicht exakt berechnet werden muss (Abschnitt 3), erzeugt der Skill sie selbst mit der Canva-KI und baut sie ins HTML ein. Die Lehrkraft muss dafür nichts tun.

**Wofür:** Sachbilder (Tiere, Pflanzen, Gegenstände), Wortschatz-, Anlaut- und Bildkarten, Bildergeschichten und Schreibanlässe, Sachgrafiken ohne Beschriftung (Wasserkreislauf, Teile einer Pflanze, Lebenszyklus), Illustrationen für Lesetexte und Plakate, neue Posen von Willi und Wilma. Beschriftungen, Pfeile mit Text und Nummern setzt immer das HTML über oder neben das Bild, nie die KI.

**Wann:** Jedes Motiv steht in der Bildliste des Aufgabenplans und besteht den Weglass-Test (`kindgerecht-gestalten.md`). Erzeugt wird erst nach Freigabe des Aufgabenplans.

### Ablauf

1. **Erzeugen:** `generate-image` mit dem Stil-Satz des Druckprofils aus `kindgerecht-gestalten.md` (für alle Bilder eines Materials wörtlich gleich), danach das Motiv konkret (wer, was, Pose, Blickrichtung, Ausschnitt). `aspectRatio` passend zum Platz auf dem Blatt (z. B. `SQUARE_1_1` für Karten, `LANDSCAPE_2_1` für Bildfolgen). Neue Posen von Willi/Wilma und Strich-Versionen vorhandener Bilder mit dem Original als `imageReferences`. Danach `get-generate-image-job` abfragen, bis `SUCCESS`; das Ergebnis ist eine Media-ID (`MA…`).
2. **Prüfen:** Vorschau ansehen: Motiv eindeutig und fachlich richtig, keine Schrift oder Zahlen im Bild, Stil passt zu den anderen Bildern. Sonst mit präzisiertem Prompt neu erzeugen (höchstens drei Versuche, dann die Lehrkraft fragen).
3. **Freistellen:** `remove-background` mit der Media-ID → neue Media-ID mit transparentem Hintergrund.
4. **Als Datei holen:** Canva gibt einzelne Bilder nicht direkt als Datei heraus, nur Designs. Deshalb über das Hilfsdesign „Bild-Export (Hilfsdesign)“:
   - `get-assets` mit der Media-ID liefert die Originalgröße (`metadata.width`/`height`, meist 1264 px).
   - Hilfsdesign mit `search-designs` suchen. Fehlt es: ein beliebiges Design mit `resize-design` (custom, Bildgröße) kopieren, Elemente löschen und den Titel per `update_title` auf „Bild-Export (Hilfsdesign)“ setzen.
   - `read-design` mit `open_transaction`, dann `edit-design`: `add_page` in Originalgröße mit dem Dateinamen als Titel; mit `read-design` (`page_indices`) die Seiten-ID holen; `insert_fill` mit der Media-ID bei `top: 0, left: 0` in voller Seitengröße; `commit`.
   - `export-design` als `png` mit `pages: [n]`, `transparent_background: true`, `lossless: true`.
   - `curl -fsSL -o bilder/motiv.png "<url>"`; mit `file` prüfen (PNG, volle Größe). Die Umgebung muss `export-download.canva.com` erreichen.
5. **Einbauen:** Datei neben die HTML-Quelle legen (`bilder/motiv.png`), mit `<img src="bilder/motiv.png" alt="…">` und fester Breite einsetzen; `blatt.py` bettet sie ins PDF und in die eigenständige HTML-Datei ein und meldet unscharfe Bilder.
6. **Ablegen:** Neue Posen der Leitfigur in `assets/bilder/` aufnehmen und in der Tabelle oben mit Media-ID ergänzen, damit sie nie zweimal erzeugt werden.

Sind Canva-Downloads in der Umgebung gesperrt: Die Lehrkraft öffnet „Open generated image“, lädt das Bild herunter und gibt es in den Chat oder den Arbeitsordner.

Die Media-IDs liegen im Canva-Konto, in dem die Bilder erstellt wurden. In einem anderen Konto die Dateien aus `assets/bilder/` verwenden; als Referenz für neue Posen vorher hochladen (`create-upload-url`).

## 3. Keine KI für exakte Abbildungen

Uhren, Mengen, Zehnerstangen, Stellentafeln, Zwanzigerfeld, Zahlenstrahl kommen aus `assets/abbildungen.js`, nie aus einem KI-Bild: Zeiger, Teilungen und Anzahlen stimmen bei KI regelmäßig nicht. Fehlt eine Darstellung (z. B. Geldstücke, Geometrie), als SVG berechnen und bei Bedarf als neues `x-…`-Element in `abbildungen.js` ergänzen.

Sachabbildungen (Tiere, Pflanzen, Körper) fachlich prüfen; bei Zweifel ein geprüftes Foto der Lehrkraft verwenden.

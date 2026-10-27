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

**Wofür:** Sachbilder (Tiere, Pflanzen, Gegenstände), Wortschatz-, Anlaut- und Bildkarten, Bildergeschichten und Schreibanlässe, Sachgrafiken ohne Beschriftung (Wasserkreislauf, Teile einer Pflanze, Lebenszyklus), Illustrationen für Lesetexte und Plakate, Szenenbilder für eine Rahmengeschichte (`kindgerecht-gestalten.md`, „Geschichten-Rahmen für eine Reihe“), neue Posen von Willi und Wilma. Beschriftungen, Pfeile mit Text und Nummern setzt immer das HTML über oder neben das Bild, nie die KI.

**Wann:** Jedes Motiv steht in der Bildliste des Aufgabenplans und besteht den Weglass-Test (`kindgerecht-gestalten.md`). Erzeugt wird erst nach Freigabe des Aufgabenplans.

### Ablauf

1. **Erzeugen:** `generate-image` mit dem Stil-Satz aus `kindgerecht-gestalten.md` (für alle Bilder eines Materials wörtlich gleich), danach das Motiv nach den Prompt-Regeln dort (jede Figur mit Aussehen, jede nur einmal, was sie wie hält). `aspectRatio` passend zum Platz auf dem Blatt (z. B. `SQUARE_1_1` für Karten, `LANDSCAPE_2_1` für Bildfolgen, `LANDSCAPE_16_9` für Szenenbilder). Neue Posen von Willi/Wilma und Strich-Versionen vorhandener Bilder mit dem Original als `imageReferences`; in Szenen nur die Referenzen der Figuren, die darin vorkommen, je Figur eine. Danach `get-generate-image-job` abfragen, bis `SUCCESS`; das Ergebnis ist eine Media-ID (`MA…`).
2. **Grob prüfen:** Vorschau ansehen: Motiv eindeutig und fachlich richtig, Stil passt zu den anderen Bildern. Sonst mit präzisiertem Prompt neu erzeugen (höchstens drei Versuche, dann die Lehrkraft fragen). Die Vorschau ist zu klein für Fehler an Augen, Pfoten und Gegenständen; die genaue Prüfung folgt in Schritt 5.
3. **Freistellen** (nur Figuren und Einzelmotive, keine Szenen): `remove-background` mit der Media-ID → neue Media-ID mit transparentem Hintergrund.
4. **Als Datei holen:** Canva gibt einzelne Bilder nicht direkt als Datei heraus, nur Designs. Deshalb über das Hilfsdesign „Bild-Export (Hilfsdesign)“:
   - `get-assets` mit der Media-ID liefert die Originalgröße (`metadata.width`/`height`, meist 1264 px).
   - Hilfsdesign mit `search-designs` suchen. Fehlt es: ein beliebiges Design mit `resize-design` (custom, Bildgröße) kopieren, Elemente löschen und den Titel per `update_title` auf „Bild-Export (Hilfsdesign)“ setzen.
   - `read-design` mit `open_transaction`, dann `edit-design`: `add_page` in Originalgröße mit dem Dateinamen als Titel; mit `read-design` (`page_indices`) die Seiten-ID holen; `insert_fill` mit der Media-ID bei `top: 0, left: 0` in voller Seitengröße; `commit`.
   - **Höchstens 100 Seiten je Design.** Meldet `add_page` „Page limit reached“, eine vorhandene Seite gleicher Größe wiederverwenden: `update_fill` am Bildelement mit der neuen Media-ID, danach `crop_media` am selben Element, bis das ganze Bild die Seite füllt (`update_fill` allein übernimmt den alten Zuschnitt und zeigt nur einen Ausschnitt), `commit`. Oder ein zweites Hilfsdesign anlegen.
   - `export-design` mit `pages: [n]`: Figuren und freigestellte Motive als `png` mit `transparent_background: true`, `lossless: true`; Szenenbilder ohne Transparenz als `jpg` (Qualität ca. 90), das macht das PDF um ein Vielfaches kleiner.
   - `curl -fsSL -o bilder/motiv.png "<url>"`; mit `file` prüfen (Format, volle Größe). Die Umgebung muss `export-download.canva.com` erreichen. Mit Schoolbox aus dem Hauptordner: `curl -fsSL -o materialien/<mappe>/dokumente/<dokument>/bilder/motiv.png "<url>"`.
5. **Genau prüfen:** jede Datei in voller Auflösung in vier Viertel schneiden und jedes Viertel einzeln ansehen, bei Szenen jede Figur für sich (Checkliste G in `visuelle-endkontrolle.md`):

   ```bash
   python3 -c "import sys; from PIL import Image
   p=sys.argv[1]; b=Image.open(p); w,h=b.size
   for i,(x,y) in enumerate([(0,0),(w//2,0),(0,h//2),(w//2,h//2)]): b.crop((x,y,x+w//2,y+h//2)).save(f'{p[:-4]}-v{i+1}.png')" bilder/motiv.png
   ```

   Danach Bild und Text nebeneinander: Tut im Bild dieselbe Figur, was die Geschichte oder Aufgabe sagt? Stimmen Gegenstände, Ort und jede Anzahl, die der Text nennt? Bei einem Befund nach Abschnitt 2a reparieren; ist das Bild gut und nur der Text weicht ab, den Text an das Bild anpassen. Die Viertel sind Arbeitsdateien und werden danach gelöscht.
6. **Einbauen:** Datei neben die HTML-Quelle legen (`bilder/motiv.png`), mit `<img src="bilder/motiv.png" alt="…">` und fester Breite einsetzen; `blatt.py` bettet sie ins PDF und in die eigenständige HTML-Datei ein und meldet unscharfe Bilder.
7. **Ablegen:** Neue Posen der Leitfigur in `assets/bilder/` aufnehmen und in der Tabelle oben mit Media-ID ergänzen, damit sie nie zweimal erzeugt werden. Bei mehreren KI-Bildern in einem Material eine Bildliste neben die Quelle legen (`bilder/canva-ids.tsv`: Datei, Media-ID, Motiv), damit eine spätere Reparatur das Original findet; ersetzte IDs dort mit Datum und Grund vermerken.

Meldet Canva `quota_cooldown` („credit usage is cooling down“), einige Minuten warten, nicht in einer Schleife neu anfragen. Bei vielen Bildern eins erzeugen und in der Wartezeit Text und Layout weiterbauen. Lehnt der Sicherheitsfilter ein Bild ab (`CLIENT_UNSAFE_INPUT`), das Motiv harmloser umformulieren.

Sind Canva-Downloads in der Umgebung gesperrt: Die Lehrkraft öffnet „Open generated image“, lädt das Bild herunter und gibt es in den Chat oder den Arbeitsordner.

Die Media-IDs liegen im Canva-Konto, in dem die Bilder erstellt wurden. In einem anderen Konto die Dateien aus `assets/bilder/` verwenden; als Referenz für neue Posen vorher hochladen (`create-upload-url`).

### 2a. Fehler im KI-Bild beheben

KI-Bilder haben regelmäßig Fehler, die erst in voller Auflösung auffallen: ein Lupenring, der mit dem Auge verschmilzt, eine dritte Hand, ein Arm, der in einen Gegenstand übergeht, eine Pfote ohne Körper, dieselbe Figur zweimal, durchscheinende Figuren oder Schleier, einzelne Buchstaben. Kein solcher Fehler bleibt im Material.

1. **Bearbeiten statt neu würfeln**, wenn das Bild sonst passt: `generate-image` mit dem fehlerhaften Bild als **einziger** `imageReferences` und dem Prompt „Bearbeite dieses Bild und behalte alles andere genau gleich (Figuren, Farben, Hintergrund, Bildausschnitt). Korrigiere nur: …“, dann den Fehler mit Ort und den gewünschten Zustand („Die Lupe hat einen Griff und Willi hält sie mit der rechten Pfote vor sich, sein Auge ist frei“).
2. **Den Sollzustand beschreiben, nie auf eine andere Figur verweisen.** „Dunkelbraune Augen ohne Wimpern“ statt „Augen wie bei Wilma“: Der Verweis überträgt weitere Merkmale der anderen Figur (Augenfarbe, Wimpern, Schleife).
3. **Ergebnis wieder vollständig prüfen** (Schritt 5): Eine Bearbeitung lässt den Fehler oft stehen oder erzeugt einen neuen an anderer Stelle.
4. **Nach zwei erfolglosen Bearbeitungen** neu erzeugen, mit der Prompt-Regel, die den Fehler verhindert, oder den Bildausschnitt so wählen, dass die Stelle wegfällt. Pixel-Retusche an Figuren (übermalen, weichzeichnen) sieht fast immer schlechter aus als der Fehler.
5. **Kleine Fehler an einer Stelle:** Bleibt nach der Bearbeitung ein kleiner Rest oder betrifft der Fehler nur eine Stelle, nicht das ganze Bild neu bearbeiten:
   - Auf ruhigem Untergrund (Busch, Himmel, Wiese, Stoff) die Stelle mit Textur direkt daneben überdecken: dasselbe Bild um einige Pixel verschoben, nur innerhalb einer weichen Maske einsetzen, die vor Konturen endet. Einen Farbstich (grünlich, bläulich) nur in der Maske entfärben.
   - An Figuren den Ausschnitt um die Stelle (etwa 256 px) auf 1024 px vergrößern, hochladen (`create-upload-url`), nach Schritt 1 bearbeiten, wieder verkleinern, per Versatzsuche genau ausrichten und mit weicher Maske einsetzen.
   - Exakte Inhalte (Würfelaugen, Punkte) nicht von der KI zeichnen lassen: die KI macht die Fläche leer, dann die Punkte perspektivisch in die Fläche rechnen (Ecken der Fläche bestimmen, Punkte bilinear abbilden).

   Danach die Stelle vergrößert ansehen; sieht man die Naht, Maske kleiner oder Versatz ändern.
6. Die neue Datei ersetzen, Bildliste aktualisieren, neu bauen.

## 3. Keine KI für exakte Abbildungen

Uhren, Mengen, Zehnerstangen, Stellentafeln, Zwanzigerfeld, Zahlenstrahl kommen aus `assets/abbildungen.js`, nie aus einem KI-Bild: Zeiger, Teilungen und Anzahlen stimmen bei KI regelmäßig nicht. Fehlt eine Darstellung (z. B. Geldstücke, Geometrie), als SVG berechnen und bei Bedarf als neues `x-…`-Element in `abbildungen.js` ergänzen.

Das gilt auch in Szenenbildern. Würfelaugen, Fächer in Eierkartons, Anzahl Häuser oder Muscheln in Reihen hat die KI in Tests fast nie richtig getroffen. Hängt eine Geschichte oder Aufgabe an einer Anzahl, gibt es drei Wege:

- Den Text so schreiben, dass er die Anzahl nicht aus dem Bild braucht („viele Häuser“).
- Die exakte Menge als SVG neben das Bild setzen, als Lernobjekt der Aufgabe.
- Im fertigen Bild nachzählen und den Text an das Bild anpassen.

Nie eine Anzahl aus dem Prompt ungeprüft in den Text übernehmen.

Sachabbildungen (Tiere, Pflanzen, Körper) fachlich prüfen; bei Zweifel ein geprüftes Foto der Lehrkraft verwenden.

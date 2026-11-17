# Bilder: Leitfigur, KI-Bilder und -Grafiken mit Canva, Bilder ins Blatt holen

Was ein Bild bekommt, entscheidet `grundschul-didaktik/references/kindgerecht-gestalten.md` (Leitfigur mit Funktion, Bilder nur mit Mehrwert, Weglass-Test). Diese Datei regelt die Technik: Format, Bildvertrag, Prompt, Prüfung und Reparatur jedes KI-Bilds und wie Figur, Zettel und Zahlen als Ebenen auf das Bild kommen. Andere Skills und Aufträge verweisen hierher.

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

Einbinden: `<img class="figur" src="bilder/willi-strich.png" alt="Willi">`. In der s/w-Ausgabe wird ein `name-strich.png` neben `name.png` von selbst genommen, sonst das Bild in Graustufen.

## 2. Bilder und Grafiken nach Bedarf mit Canva-KI

Braucht ein Material ein Bild oder eine Grafik, die nicht in `assets/bilder/` liegt und nicht exakt berechnet werden muss (Abschnitt 3), erzeugt der Skill sie selbst mit der Canva-KI und baut sie ins HTML ein. Die Lehrkraft muss dafür nichts tun.

**Wofür:** Sachbilder (Tiere, Pflanzen, Gegenstände), Wortschatz-, Anlaut- und Bildkarten, Bildergeschichten und Schreibanlässe, Sachgrafiken ohne Beschriftung (Wasserkreislauf, Teile einer Pflanze, Lebenszyklus), Illustrationen für Lesetexte und Plakate, Szenenbilder für eine Rahmengeschichte (`kindgerecht-gestalten.md`, „Geschichten-Rahmen für eine Reihe“), Posen der Leitfigur. Alles Lesbare und alles Mathematische kommt nie aus der KI (Abschnitt 3).

**Wann:** Jedes Motiv steht in der Bildliste des Aufgabenplans und besteht den Weglass-Test (`kindgerecht-gestalten.md`). Erzeugt wird erst nach Freigabe des Aufgabenplans und erst, wenn der Text steht, zu dem das Bild gehört.

### Format nach Platz

Ein Bild füllt seinen Platz mit `object-fit:cover` und verliert dabei, was über das Seitenverhältnis des Platzes hinausgeht: Ein Bild in 16:9 zeigt auf einer Fall-Karte von 794 × 650 px nur 15,7 bis 84,3 % seiner Breite. Deshalb entsteht jedes Bild in dem Verhältnis, das seinem Platz am nächsten ist. `generate-image` kennt genau diese Werte für `aspectRatio` (Breite : Höhe):

`LANDSCAPE_2_1` 2,0 · `LANDSCAPE_16_9` 1,78 · `LANDSCAPE_3_2` 1,5 · `LANDSCAPE_4_3` 1,33 · `LANDSCAPE_5_4` 1,25 · `SQUARE_1_1` 1,0 · `PORTRAIT_4_5` 0,8 · `PORTRAIT_3_4` 0,75 · `PORTRAIT_2_3` 0,67 · `PORTRAIT_9_16` 0,56 · `PORTRAIT_1_2` 0,5

| Platz | Maße im Material | `aspectRatio` |
|---|---|---|
| Fall-Karte (`.fall-bild`, Höhe `--h`) | 794 × 615 bis 700 px (Muster: 660) | `LANDSCAPE_5_4` |
| Fall-Karte mit `--h` 565 bis 614 px | 794 × `--h` | `LANDSCAPE_4_3` |
| Fall-Karte ohne `--h` | 794 × 446 px | `LANDSCAPE_16_9` |
| Bildfolie und Folie des Auftakts, randlos | 16 : 9 | `LANDSCAPE_16_9` |
| Deckblatt (`.db-bild`, 600 px breit, ohne `--h`) | das Bild bestimmt die Höhe | `LANDSCAPE_4_3` |
| Karte mit Einzelmotiv (Bildkarte, Memory, Domino) | freigestellt, `object-fit:contain` | `SQUARE_1_1` |
| Karte, deren Bild die Fläche füllt | Bildfläche der Karte | nächster Wert aus der Liste |
| Figur, Pose, Clipart | freigestellt | `SQUARE_1_1` |
| Schublade „Bilder“ (Platz noch offen) | | Szene `LANDSCAPE_4_3`, Einzelbild `SQUARE_1_1` |

Für jeden anderen Platz: Breite durch Höhe teilen und den nächsten Wert nehmen. Beim Bearbeiten eines Bilds bleibt sein `aspectRatio`.

**Wichtiges nie in den äußeren 15 %.** Auch im passenden Format schneidet der Platz ein paar Prozent ab, und am Rand liegen Marke, Band und Rahmen. Alles, wovon der Text spricht, liegt deshalb zwischen 15 und 85 % von Breite und Höhe. Der Prompt sagt das („alles Wichtige in der Bildmitte, an den Rändern nur ruhiger Hintergrund“), der Bildvertrag nennt die Lage, die Prüfung sieht nach (Schritt 5).

### Bildvertrag

Vor dem Erzeugen steht für jedes Bild fest, was darauf sein muss und was nicht. Der Vertrag steht in `bilder.json` (Schoolbox: im Arbeitsordner; Claude-App: `bilder/bilder.json` neben den Bildern), je Bild ein Eintrag:

```json
{"datei": "fall-5.jpg", "motiv": "Werkstatt, rotes Glöckchen auf dem Fensterbrett",
 "platz": {"breite": 794, "hoehe": 660}, "blickpunkt": {"x": 50, "y": 50},
 "vertrag": {
   "pflicht": [{"was": "Glöckchen", "zahl": 1, "farbe": "rot", "lage": "auf dem Fensterbrett rechts der Mitte, ganz zu sehen"},
               {"was": "rundes Fenster mit Schnee", "zahl": 1, "lage": "rechts oben"}],
   "verboten": ["Figuren und Tiere (die Leitfigur liegt als Ebene darüber)", "Schrift, Buchstaben, Zahlen"],
   "frei": "links unten, für die Leitfigur"},
 "pruefung": [{"versuch": 1, "mediaId": "MA…", "ok": ["rundes Fenster mit Schnee"], "fehlt": ["Glöckchen abgeschnitten"]}]}
```

- `pflicht`: jedes Ding, von dem Fall-Karte, Vorleseheft oder Aufgabe sprechen und das man sehen soll, höchstens drei, je mit Zahl, Farbe und Lage (Drittel von Breite und Höhe, nie im Rand). Was sich nicht verlässlich zeichnen lässt, steht hier nicht, sondern kommt als Ebene (Abschnitte 3 und 4).
- `verboten`: immer Schrift, Buchstaben und Zahlen; die Leitfigur, wenn sie als Ebene kommt; alles, was der Text ausschließt.
- `frei`: wo Figur und Zettel als Ebene hinkommen; dort ist nur ruhiger Hintergrund.
- `platz` und `blickpunkt`: Maße des Platzes in px und die Stelle, auf die es ankommt, in Prozent von Breite und Höhe des Bilds. Der Blickpunkt ist zugleich `object-position` im Material (`--bx`, `--by`, Abschnitt 4), damit der Ausschnitt die Spur zeigt.
- `pruefung`: nach jedem Versuch jeder Punkt aus `pflicht` als `ok` oder `fehlt` und jeder Fund aus `verboten`. Ein Punkt ist erst `ok`, wenn er im Ausschnitt des Platzes ganz zu sehen ist.

Der Prompt entsteht aus dem Vertrag: jedes Pflichtobjekt mit Zahl, Farbe und Lage, jedes Verbot als „ohne …“.

### Prompt

**Stilblock:** einmal je Material oder Reihe festlegen und wortgleich an den Anfang jedes Prompts setzen, für Figuren, Szenen und Cliparts derselbe. Nur so passen Figur und Hintergrund zusammen.

> Kindgerechte Illustration im flachen Vektorstil, runde, weiche Formen, klare dunkle Konturen gleichmäßiger Stärke, flache Farbflächen ohne Verlauf und ohne Textur, wenige warme Farben ({Palette}), freundliche Gesichter, keine Schrift, keine Buchstaben, keine Zahlen.

Danach je nach Art ein fester Zusatz:
- **Figur, Pose, Clipart:** „Genau ein Motiv, ganz zu sehen, weißer Hintergrund, freigestellt, kein Hintergrundmuster.“
- **Szene:** „Hintergrund bis an alle Ränder, alles Wichtige in der Bildmitte, an den Rändern nur ruhiger Hintergrund.“ Kommen die Figuren als Ebene (Abschnitt 4), dazu „keine Figuren, keine Tiere, keine Menschen“.
- **Strichzeichnung zum Anmalen** (`name-strich.png`, statt des Stilblocks): „Kindgerechte Strichzeichnung wie ein Ausmalbild, runde, weiche Formen, klare schwarze Konturen gleichmäßiger Stärke, weiße Füllung, keine Grautöne, keine Schraffur, freundliche Gesichter, weißer Hintergrund, freigestellt, keine Schrift, keine Zahlen, keine Buchstaben im Bild, kein Hintergrundmuster.“

Danach das Motiv aus dem Bildvertrag. Jede Regel verhindert einen Fehler, der in der Erprobung vorkam:
- **Höchstens zwei bis drei Dinge, auf die es ankommt**, jedes mit Zahl, Farbe und Lage. Jedes weitere Ding wird unscharf oder fehlt.
- **Kein Text im Bild.** Dinge, die Schrift tragen (Zettel, Schild, Bauplan, Buch, Tafel), kommen als Ebene (Abschnitt 4). Muss so ein Ding im Bild sein, heißt es im Prompt „leer, ohne jede Markierung“, und der Inhalt kommt als Ebene darauf.
- **Hände verdeckt oder eine Tierfigur.** Menschliche Hände misslingen fast immer: hinter dem Rücken, in der Tasche, außerhalb des Bilds. Leitfiguren sind Tiere.
- **Cliparts einzeln und freigestellt:** je Motiv ein eigenes Bild (`SQUARE_1_1`, danach `remove-background`), nie mehrere Motive auf einem Bild.
- **Szenen ohne Figuren.** Leitfigur und wiederkehrende Nebenfiguren kommen als feste Ebene darüber (Abschnitt 4). Nur wenn die Szene ohne Figur im Bild nicht geht (Spiegelbild, Figur hinter etwas) oder ein einzelnes Bild aus der Schublade „Bilder“ Figuren zeigen soll: höchstens zwei Figuren, jede mit ihrer abgenommenen Pose als Referenz.
- **Jede Figur mit ihrem Aussehen beschreiben**, auch wenn ihr Referenzbild dabei ist: Art, Fellfarbe, Augenfarbe, Kleidung, Erkennungszeichen („Willi: grauer Waschbär-Junge, schwarze Augenmaske, dunkelbraune Augen, oranges T-Shirt“).
- **„Jede Figur genau einmal im Bild.“** ausdrücklich in den Prompt schreiben. Ohne den Satz erscheint dieselbe Figur gelegentlich zweimal, mit anderer Kleidung.
- **Einfache, eindeutige Posen und Griffe:** wer hält was in welcher Pfote und wie („hält die Lupe am Griff vor sich, das Auge bleibt frei“). Ein Gegenstand direkt vor dem Auge verschmilzt mit dem Auge; ein Gegenstand ohne beschriebenen Griff schwebt oder wächst aus dem Arm.
- **Nie auf eine andere Figur verweisen** („genau wie Wilma“, „im selben Stil wie die andere Figur“): Die KI überträgt dann Merkmale wie Augenfarbe, Wimpern oder Schleife.
- **Nur Referenzbilder der Figuren, die vorkommen**, je Figur eins. Ein überzähliges Referenzbild holt seine Figur zusätzlich ins Bild.

### Ablauf

1. **Vertrag, dann erzeugen:** Bildvertrag schreiben (oben), dann `generate-image` mit Stilblock und Motiv nach „Prompt“ und dem `aspectRatio` aus „Format nach Platz“. Neue Posen und Strich-Versionen vorhandener Bilder mit dem Original als einziger `imageReferences` (Abschnitt 4). Danach `get-generate-image-job` abfragen, bis `SUCCESS`; das Ergebnis ist eine Media-ID (`MA…`).
2. **Grob prüfen:** Vorschau ansehen: Motiv eindeutig und fachlich richtig, Stil passt zu den anderen Bildern. Sonst nach „Fehler und Versuche“ (unten) weiter. Die Vorschau ist zu klein für Fehler an Augen, Pfoten, Gegenständen und Rändern; die genaue Prüfung folgt in Schritt 5.
3. **Freistellen** (nur Figuren und Einzelmotive, keine Szenen): `remove-background` mit der Media-ID → neue Media-ID mit transparentem Hintergrund.
4. **Als Datei holen:** Canva gibt einzelne Bilder nicht direkt als Datei heraus, nur Designs. Deshalb über das Hilfsdesign „Bild-Export (Hilfsdesign)“:
   - `get-assets` mit der Media-ID liefert die Originalgröße (`metadata.width`/`height`, meist 1264 px).
   - Hilfsdesign mit `search-designs` suchen. Fehlt es: ein beliebiges Design mit `resize-design` (custom, Bildgröße) kopieren, Elemente löschen und den Titel per `update_title` auf „Bild-Export (Hilfsdesign)“ setzen.
   - `read-design` mit `open_transaction`, dann `edit-design`: `add_page` in Originalgröße mit dem Dateinamen als Titel; mit `read-design` (`page_indices`) die Seiten-ID holen; `insert_fill` mit der Media-ID bei `top: 0, left: 0` in voller Seitengröße; `commit`.
   - **Höchstens 100 Seiten je Design.** Meldet `add_page` „Page limit reached“, eine vorhandene Seite gleicher Größe wiederverwenden: `update_fill` am Bildelement mit der neuen Media-ID, danach `crop_media` am selben Element, bis das ganze Bild die Seite füllt (`update_fill` allein übernimmt den alten Zuschnitt und zeigt nur einen Ausschnitt), `commit`. Oder ein zweites Hilfsdesign anlegen.
   - `export-design` mit `pages: [n]`: Figuren und freigestellte Motive als `png` mit `transparent_background: true`, `lossless: true`; Szenenbilder ohne Transparenz als `jpg` (Qualität ca. 90), das macht das PDF um ein Vielfaches kleiner.
   - `curl -fsSL -o bilder/motiv.png "<url>"`; mit `file` prüfen (Format, volle Größe). Die Umgebung muss `export-download.canva.com` erreichen. Mit Schoolbox aus dem Hauptordner: `curl -fsSL -o materialien/<mappe>/dokumente/<dokument>/bilder/motiv.png "<url>"`.
5. **Genau prüfen (Pflicht für jedes Bild):** die vier Viertel in voller Auflösung und den Ausschnitt, den der Platz zeigt, je einzeln ansehen, bei Szenen jede Figur für sich (Checkliste G in `visuelle-endkontrolle.md`). Die Prüfbilder macht `blatt.py`, mit Platz und Blickpunkt aus dem Vertrag:

   ```bash
   python3 scripts/blatt.py viertel bilder/motiv.jpg -o pruefbilder --platz 794x660 --blick 50,50
   ```

   Das legt `motiv-v1.png` bis `-v4.png` (oben links, oben rechts, unten links, unten rechts) und `motiv-platz.png` an und nennt den sichtbaren Bereich in Prozent. In der Schoolbox macht das der Server (Abschnitt 2b). Danach den Vertrag abhaken (`pruefung`): Ist jedes Pflichtobjekt mit Zahl, Farbe und Lage da und im Ausschnitt ganz zu sehen? Ist nichts Verbotenes im Bild? Tut keine Figur etwas anderes, als der Text sagt? Bei einem Befund nach „Fehler und Versuche“ weiter. Die Prüfbilder sind Arbeitsdateien und werden danach gelöscht.
6. **Einbauen:** Datei neben die HTML-Quelle legen (`bilder/motiv.png`), mit `<img src="bilder/motiv.png" alt="…">` und fester Breite einsetzen; `blatt.py` bettet sie ins PDF und in die eigenständige HTML-Datei ein und meldet unscharfe Bilder.
7. **Ablegen:** Neue Posen der Leitfigur in `assets/bilder/` aufnehmen und in der Tabelle oben mit Media-ID ergänzen, damit sie nie zweimal erzeugt werden. Das gilt im Repository der Skills; in der Schoolbox entstehen neue Posen in der Schublade „Figuren“. Bei mehreren KI-Bildern in einem Material eine Bildliste neben die Quelle legen (`bilder/canva-ids.tsv`: Datei, Media-ID, Motiv), damit eine spätere Reparatur das Original findet; ersetzte IDs dort mit Datum und Grund vermerken.

### Fehler und Versuche

Höchstens drei Versuche je Bild, das erste Bild eingerechnet; ein Auftrag kann weniger erlauben.

1. Fehlt etwas aus dem Vertrag, ist etwas abgeschnitten oder hat das Bild einen Fehler nach 2a: das Bild **bearbeiten**, mit ihm als einziger `imageReferences`, demselben `aspectRatio` und dem Prompt aus 2a, Punkt 1.
2. Hilft das nicht: **neu erzeugen**, mit der Prompt-Regel, die den Fehler verhindert, und dem Ding deutlicher in der Mitte.
3. Bleibt der Fehler nach dem dritten Versuch: **den Satz an das Bild anpassen**, so dass der Text nur nennt, was das Bild zeigt, oder das Ding als Ebene auf das Bild legen (Abschnitt 4). Nie ein Bild ins Material, das dem Text widerspricht.

Jeder Versuch kommt mit Media-ID und Befund in `pruefung`.

Meldet Canva `quota_cooldown` („credit usage is cooling down“), einige Minuten warten, nicht in einer Schleife neu anfragen. Bei vielen Bildern eins erzeugen und in der Wartezeit Text und Layout weiterbauen. Lehnt der Sicherheitsfilter ein Bild ab (`CLIENT_UNSAFE_INPUT`), das Motiv harmloser umformulieren.

Sind Canva-Downloads in der Umgebung gesperrt: Die Lehrkraft öffnet „Open generated image“, lädt das Bild herunter und gibt es in den Chat oder den Arbeitsordner.

Die Media-IDs liegen im Canva-Konto, in dem die Bilder erstellt wurden. In einem anderen Konto die Dateien aus `assets/bilder/` verwenden; als Referenz für neue Posen vorher hochladen (`create-upload-url`).

### 2a. Fehler im KI-Bild beheben

KI-Bilder haben regelmäßig Fehler, die erst in voller Auflösung auffallen: ein Lupenring, der mit dem Auge verschmilzt, eine dritte Hand, ein Arm, der in einen Gegenstand übergeht, eine Pfote ohne Körper, dieselbe Figur zweimal, durchscheinende Figuren oder Schleier, einzelne Buchstaben. Kein solcher Fehler bleibt im Material.

1. **Bearbeiten statt neu würfeln**, wenn das Bild sonst passt: `generate-image` mit dem fehlerhaften Bild als **einziger** `imageReferences` und dem Prompt „Bearbeite dieses Bild und behalte alles andere genau gleich (Figuren, Farben, Hintergrund, Bildausschnitt). Korrigiere nur: …“, dann den Fehler mit Ort und den gewünschten Zustand („Die Lupe hat einen Griff und Willi hält sie mit der rechten Pfote vor sich, sein Auge ist frei“).
2. **Den Sollzustand beschreiben, nie auf eine andere Figur verweisen.** „Dunkelbraune Augen ohne Wimpern“ statt „Augen wie bei Wilma“: Der Verweis überträgt weitere Merkmale der anderen Figur (Augenfarbe, Wimpern, Schleife).
3. **Ergebnis wieder vollständig prüfen** (Schritt 5): Eine Bearbeitung lässt den Fehler oft stehen oder erzeugt einen neuen an anderer Stelle.
4. **Hilft die Bearbeitung nicht,** neu erzeugen (Abschnitt 2, „Fehler und Versuche“), oder den Blickpunkt so wählen, dass die Stelle im Platz wegfällt. Pixel-Retusche an Figuren (übermalen, weichzeichnen) sieht fast immer schlechter aus als der Fehler.
5. **Kleine Fehler an einer Stelle:** Bleibt nach der Bearbeitung ein kleiner Rest oder betrifft der Fehler nur eine Stelle, nicht das ganze Bild neu bearbeiten:
   - Auf ruhigem Untergrund (Busch, Himmel, Wiese, Stoff) die Stelle mit Textur direkt daneben überdecken: dasselbe Bild um einige Pixel verschoben, nur innerhalb einer weichen Maske einsetzen, die vor Konturen endet. Einen Farbstich (grünlich, bläulich) nur in der Maske entfärben.
   - An Figuren den Ausschnitt um die Stelle (etwa 256 px) auf 1024 px vergrößern, hochladen (`create-upload-url`), nach Schritt 1 bearbeiten, wieder verkleinern, per Versatzsuche genau ausrichten und mit weicher Maske einsetzen.
   - Exakte Inhalte (Würfelaugen, Punkte) nicht von der KI zeichnen lassen: die KI macht die Fläche leer, dann die Punkte perspektivisch in die Fläche rechnen (Ecken der Fläche bestimmen, Punkte bilinear abbilden).

   Danach die Stelle vergrößert ansehen; sieht man die Naht, Maske kleiner oder Versatz ändern.
6. Die neue Datei ersetzen, Bildliste aktualisieren, neu bauen.

### 2b. In der Schoolbox (ohne Bash)

Baut die Schoolbox ein neues Blatt, eine Unterrichtseinheit oder ein Bild aus der Schublade „Figuren“ oder „Bilder“, gibt es kein Bash, kein curl und kein Python. Der Ablauf aus Abschnitt 2 gilt mit diesen Unterschieden:

- **Werkzeuge:** nur `generate-image`, `get-generate-image-job`, `remove-background`, `get-assets`, `search-designs`, `read-design`, `edit-design`, `resize-design` und `export-design`. Fehlt das Hilfsdesign und lässt es sich so nicht anlegen, keine Bilder erzeugen und mit Platzhaltern weiterbauen.
- **Schritt 4, Datei holen:** statt `curl` im Eintrag des Bilds in `bilder.json` (Arbeitsordner, mit dem Bildvertrag) `url` und `mediaId` ergänzen: `{"datei": "motiv.png", "url": "<Export-URL>", "motiv": "…", "mediaId": "MA…", "platz": …, "blickpunkt": …, "vertrag": …}`. Einen Eintrag ohne `url` lässt der Server liegen. Er lädt nur von `export-download.canva.com`, prüft Format und Größe und legt die Datei nach `bilder/`. Die Endung muss zum Export passen. Nach einer Reparatur bekommt derselbe Eintrag die neue `url` und `mediaId`; der Server lädt dann neu.
- **Schritt 5, genau prüfen (Pflicht):** Bevor ein Bild in `bilder/` erscheint, legt der Server seine Prüfbilder unter `ansicht/bilder/` ab: `<name>-v1.png` bis `-v4.png` und, wenn der Eintrag `platz` hat, `<name>-platz.png` (Ausschnitt nach `blickpunkt`). Jedes mit Read ansehen und den Vertrag in `pruefung` abhaken wie in Schritt 5. Fehlen die Prüfbilder, obwohl das Bild da ist, das ganze Bild ansehen und das in `pruefung` vermerken.
- **Schritt 6 und 7:** Im Material `../../bilder/motiv.png`; die Bildliste `canva-ids.tsv` schreibt der Server. Bilder aus der Schublade „Figuren“ legt der Server in die Figurenbibliothek, nicht nach `assets/bilder/`. Bilder aus der Schublade „Bilder“ legt der Server nach `bilder/` der Mappe und notiert sie in `canva-ids.tsv`.

## 3. Nichts Lesbares und nichts Exaktes aus der KI

Zettel, Schilder, Baupläne, Briefe, Buchstaben, Wörter und Zahlen kommen nie aus der KI: Sie bleiben leer oder werden zu Kritzeln. Sie kommen als HTML oder SVG auf das Bild oder daneben (Abschnitt 4). Dasselbe gilt für alles Mathematische: Gitter, symmetrische Figuren, Muster, Anzahlen, Uhren.

Uhren, Mengen, Zehnerstangen, Stellentafeln, Zwanzigerfeld, Zahlenstrahl kommen aus `assets/abbildungen.js`, nie aus einem KI-Bild: Zeiger, Teilungen und Anzahlen stimmen bei KI regelmäßig nicht. Fehlt eine Darstellung (z. B. Geldstücke, Geometrie), als SVG berechnen und bei Bedarf als neues `x-…`-Element in `abbildungen.js` ergänzen.

Das gilt auch in Szenenbildern. Würfelaugen, Fächer in Eierkartons, Anzahl Häuser oder Muscheln in Reihen hat die KI in Tests fast nie richtig getroffen. Hängt eine Geschichte oder Aufgabe an einer Anzahl, gibt es drei Wege:

- Den Text so schreiben, dass er die Anzahl nicht aus dem Bild braucht („viele Häuser“).
- Die exakte Menge als SVG neben das Bild setzen, als Lernobjekt der Aufgabe.
- Im fertigen Bild nachzählen und den Text an das Bild anpassen.

Nie eine Anzahl aus dem Prompt ungeprüft in den Text übernehmen.

Sachabbildungen (Tiere, Pflanzen, Körper) fachlich prüfen; bei Zweifel ein geprüftes Foto der Lehrkraft verwenden.

## 4. Ebenen über dem Bild: Figur, Zettel, Zahlen

Was in jedem Bild gleich aussehen oder genau stimmen muss, liegt als Ebene über dem Bild statt darin: die Leitfigur, Zettel und Schilder mit Text, Zahlen, Gitter und Figuren aus `abbildungen.js`.

**Figur als feste Ebene.** Die Leitfigur entsteht einmal und wird danach nur noch als Datei verwendet:
1. Grundpose erzeugen (`SQUARE_1_1`, Stilblock mit Zusatz „Figur“, Aussehen aus dem Steckbrief), freistellen (`remove-background`), nach Schritt 5 prüfen.
2. **Abnehmen:** Stimmt sie in Viertel und Ganzem mit dem Steckbrief überein (Farben, Kleidung, Erkennungszeichen, Proportionen)? Erst dann ist sie die Vorlage.
3. Weitere Posen (`verkauf.md`, Abschnitt 5) nur mit der abgenommenen Grundpose als einziger `imageReferences`, jede freistellen und neben die Grundpose legen: gleiche Augen, gleiche Kleidung, gleiche Größenverhältnisse. Was abweicht, wird bearbeitet wie in 2a.
4. Szenen entstehen ohne Figur, mit einer freien Fläche für sie (`frei` im Vertrag). Die Pose kommt als Ebene darauf, auf allen Fall-Karten einer Reihe in derselben Breite (`--b`). Eine Handlung zeigt die Pose („hält ein leeres Blatt“, „zeigt nach oben“); was sie hält, bekommt seinen Inhalt als Zettel-Ebene.

Willi und Wilma sind schon abgenommen (`assets/bilder/`, Abschnitt 1); für sie beginnt der Ablauf bei Punkt 3.

**Markup.** `.bild-lagen` füllt einen Platz mit fester Höhe (Fall-Karte, Bildfolie, Karte) wie `object-fit:cover`; darin hat `.lagen-flaeche` das Seitenverhältnis der Bilddatei. Jede `.lage` steht in Prozent dieser Fläche, also in Prozent des Bilds, und wandert mit, wenn der Blickpunkt den Ausschnitt verschiebt. Gilt mit `data-satz="2"` am `<body>`; Muster: `assets/beispiel-reihe-kapitel.html`, Seite 1.

```html
<div class="fall-bild" style="--h:660px">
  <div class="bild-lagen" style="--bx:50%;--by:50%">
    <div class="lagen-flaeche" style="--ar:5/4">
      <img src="../../bilder/fall-2.jpg" alt="Werkstatt mit großem Spiegel">
      <img class="lage" src="../../bilder/luna-haelt-blatt.png" alt="Luna" style="--x:6%;--y:38%;--b:30%">
      <div class="lage lage-zettel gehalten" style="--x:24%;--y:52%;--b:12%;--dreh:-6deg">Hallo!</div>
    </div>
  </div>
  <div class="fall-band">Kapitel 2</div>
</div>
```

- `--ar`: Breite/Höhe der Bilddatei (`5/4`, `16/9`, `1680/944`). `--bx`, `--by`: der Blickpunkt aus dem Vertrag, wie `object-position`.
- `.lage`: `--x`, `--y` die linke obere Ecke, `--b` die Breite, alles in Prozent des Bilds; `--dreh` dreht leicht. Die Zahlen nimmt man aus dem Viertel, in dem die Stelle liegt (ein Viertel ist 50 % breit und hoch).
- `.lage-zettel`: Papier mit Nadel, Schrift aus dem Blatt (`--zs`, ab 18 px); mit `gehalten` ohne Nadel, für ein Blatt in der Hand einer Figur. Darin Text, inline-SVG oder ein Element aus `abbildungen.js` (`<x-uhr>`, `<x-gitter>` …).
- Ein Bild ohne Ebenen auf der Fall-Karte oder dem Deckblatt bekommt den Blickpunkt direkt: `<img src="…" style="--bx:62%">`.

Die Prüfung meldet in `.bild-lagen` keine Überlappung und keinen Beschnitt; ob jede Ebene richtig liegt (Zettel auf dem Blatt, Figur auf dem Boden, nichts Pflichtiges verdeckt), zeigt nur das Seitenbild nach dem Bau.

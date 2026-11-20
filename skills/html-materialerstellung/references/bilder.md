# Bilder: Leitfigur, KI-Bilder und -Grafiken, Bilder ins Blatt holen

Inhalt: 1. Vorhandene Grafiken (`assets/bilder/`) · 2. Bilder und Grafiken nach Bedarf per KI (Format nach Platz, Bildvertrag, Prompt, Ablauf mit Canva, Fehler und Versuche, 2a. Fehler im KI-Bild beheben, 2b. In der Schoolbox: Bild-API) · 3. Exaktes und Lesbares im Bild · 4. Figuren in der Szene, Ebenen für Text

Was ein Bild bekommt, entscheidet `grundschul-didaktik/references/kindgerecht-gestalten.md` (Leitfigur mit Funktion, Weglass-Test). Diese Datei regelt die Technik: Format, Bildvertrag, Prompt, Prüfung und Reparatur jedes KI-Bilds, wie Figuren in die Szene und Text als Ebene auf das Bild kommen.

## 1. Vorhandene Grafiken (`assets/bilder/`)

| Datei | Inhalt | Profil | Canva-Media-ID |
|---|---|---|---|
| `willi.png` | Willi Waschbär, zeigt nach oben | Farbe | `MAHXV49zJZE` |
| `willi-strich.png` | Willi als Strichzeichnung, zeigt zur Seite | s/w | `MAHXWZ6fTfM` |
| `wilma.png` | Wilma Waschbär, zeigt nach oben | Farbe | `MAHXV_-A1xo` |
| `wachstum.png` | Wachstumsgrafik Samen → Keimling → Pflanze → Blume | Farbe | `MAHXV6P-UTw` |
| `wachstum-strich.png` | Wachstumsgrafik als Strichzeichnung | s/w | `MAHXWdlD_qM` |

Wilma als Strichzeichnung fehlt noch (anlegen nach Abschnitt 2, Datei `wilma-strich.png`). Die Media-IDs gelten nur mit Canva; die Bild-API nimmt die Dateien selbst als Referenz.

**Auflösung:** Originale aus Canva (1264 × 1264 px, Wachstumsgrafik 1776 × 896 px, transparent), druckscharf in jeder sinnvollen Größe.

Einbinden: `<img class="figur" src="bilder/willi-strich.png" alt="Willi">`. In der s/w-Ausgabe wird ein `name-strich.png` neben `name.png` von selbst genommen, sonst das Bild in Graustufen.

## 2. Bilder und Grafiken nach Bedarf per KI

Braucht ein Material ein Bild oder eine Grafik, die nicht in `assets/bilder/` liegt und keine Aufgabendarstellung ist (Abschnitt 3), erzeugt der Skill sie selbst und baut sie ins HTML ein: in der Claude-App mit der Canva-KI (Ablauf unten), in der Schoolbox mit der Bild-API (Abschnitt 2b). Format, Bildvertrag, Prompt, Prüfung und Reparatur gelten für beide.

**Wofür:** Sachbilder (Tiere, Pflanzen, Gegenstände), Wortschatz-, Anlaut- und Bildkarten, Bildergeschichten und Schreibanlässe, Sachgrafiken ohne Beschriftung, Illustrationen für Lesetexte und Plakate, Szenenbilder für eine Rahmengeschichte (`kindgerecht-gestalten.md`, „Geschichten-Rahmen für eine Reihe“), Posen der Leitfigur.

**Wann:** Jedes Motiv steht in der Bildliste des Aufgabenplans und besteht den Weglass-Test (`kindgerecht-gestalten.md`). Erzeugt wird erst nach Freigabe des Aufgabenplans und erst, wenn der Text steht, zu dem das Bild gehört.

### Format nach Platz

Ein Bild füllt seinen Platz mit `object-fit:cover` und verliert dabei, was über das Seitenverhältnis des Platzes hinausgeht. Deshalb entsteht jedes Bild in dem Verhältnis, das seinem Platz am nächsten ist. Canva (`aspectRatio` von `generate-image`) und die Bild-API (`format` von `bild_erzeugen`) kennen genau diese Werte (Breite : Höhe):

`LANDSCAPE_2_1` 2,0 · `LANDSCAPE_16_9` 1,78 · `LANDSCAPE_3_2` 1,5 · `LANDSCAPE_4_3` 1,33 · `LANDSCAPE_5_4` 1,25 · `SQUARE_1_1` 1,0 · `PORTRAIT_4_5` 0,8 · `PORTRAIT_3_4` 0,75 · `PORTRAIT_2_3` 0,67 · `PORTRAIT_9_16` 0,56 · `PORTRAIT_1_2` 0,5

| Platz | Maße im Material | Format |
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

Für jeden anderen Platz: Breite durch Höhe teilen und den nächsten Wert nehmen. Beim Bearbeiten eines Bilds bleibt sein Format.

**Wichtiges nie in den äußeren 15 %.** Auch im passenden Format schneidet der Platz ein paar Prozent ab, und am Rand liegen Marke, Band und Rahmen. Alles, wovon der Text spricht, liegt deshalb zwischen 15 und 85 % von Breite und Höhe. Prompt und Bildvertrag sagen das, die Prüfung sieht nach (Schritt 5).

**Bühne: Die Szene füllt den Platz.** Die Handlung liegt in der Bildmitte, der Boden oder die Standfläche der Figuren im unteren Drittel. Im Ausschnitt des Platzes ist keine leere Fläche (Wand, Himmel, Boden ohne Ding) größer als etwa ein Viertel.

### Bildvertrag

Vor dem Erzeugen steht für jedes Bild fest, was darauf sein muss und was nicht. Der Vertrag steht in `bilder.json` (Schoolbox: im Arbeitsordner; Claude-App: `bilder/bilder.json` neben den Bildern), je Bild ein Eintrag:

```json
{"datei": "fall-5.jpg", "motiv": "Werkstatt, Willi kniet am Fensterbrett und sieht auf das rote Glöckchen",
 "platz": {"breite": 794, "hoehe": 660}, "blickpunkt": {"x": 50, "y": 50},
 "vertrag": {
   "pflicht": [{"was": "Willi", "zahl": 1, "lage": "links der Mitte", "handlung": "sieht auf das Glöckchen", "standflaeche": "kniet auf einem Hocker"},
               {"was": "Glöckchen", "zahl": 1, "farbe": "rot", "lage": "auf dem Fensterbrett rechts der Mitte, ganz zu sehen"}],
   "buehne": "Handlung in der Bildmitte, Dielenboden und Hocker im unteren Drittel",
   "verboten": ["Schrift, Buchstaben und Zahlen, die der Vertrag nicht nennt", "weitere Figuren und Tiere"]},
 "pruefung": [{"versuch": 1, "ok": ["Willi kniet auf dem Hocker"], "fehlt": ["Glöckchen abgeschnitten"]}]}
```

- `pflicht`: jedes Ding, von dem Fall-Karte, Vorleseheft oder Aufgabe sprechen und das man sehen soll, höchstens drei, je mit Zahl, Farbe und Lage (Drittel von Breite und Höhe, nie im Rand). Jede Figur der Szene ist ein Pflichtobjekt, mit `handlung` (was sie tut, wie im Text) und `standflaeche` (worauf sie steht, sitzt oder kniet). Schrift im Bild steht mit ihrem Wortlaut da (`"text": "Äpfel 3 €"`), eine Menge mit ihrer Zahl. Was nach Abschnitt 3 nicht ins Bild gehört, steht hier nicht.
- **Werkzeuge und Fachgegenstände des Themas** sind im Bild fachlich richtig: Der Vertrag sagt, wie das Werkzeug aussieht (sichtbare Merkmale), wo es steht, wie es benutzt wird und was man in oder an ihm sieht, und schließt in `verboten` die Darstellung aus, die das Bildmodell erfahrungsgemäß malt. Beispiel Spiegel: „Taschenspiegel mit rotem Rahmen und Standfuß, undurchsichtig, steht senkrecht an der Spiegelachse; in der Spiegelfläche nur die fehlende Hälfte, seitenverkehrt“, verboten „Glasscheibe, durchsichtiges Glas, die ganze Figur hinter dem Spiegel“. „Rechteckiger Spiegel ohne Rand“ malt das Modell als Glasscheibe.
- **Kanon der Einheit** (Schoolbox): Nennt der Auftrag Zeilen aus dem Kanon, steht jede, die zum Bild passt, wörtlich als eigener Eintrag in `pflicht` oder `verboten`.
- `buehne`: Lage von Handlung und Standfläche (oben, „Bühne“).
- `verboten`: immer Schrift, Buchstaben und Zahlen, die der Vertrag nicht nennt (mit Canva: jede Schrift); Figuren, die der Text dort nicht nennt; alles, was der Text ausschließt.
- `frei`: nur für einen Zettel als Ebene (Abschnitt 4); dort ist ruhiger Hintergrund. Nie für eine Figur.
- `platz` und `blickpunkt`: Maße des Platzes in px und die Stelle, auf die es ankommt, in Prozent von Breite und Höhe des Bilds. Der Blickpunkt ist zugleich `object-position` im Material (`--bx`, `--by`, Abschnitt 4), damit der Ausschnitt die Spur zeigt.
- `figur` und `pose` (Schoolbox): Zeigt das Bild eine Figur allein, ihr Name aus dem Plan und `grund` für die Grundpose oder ein Wort für die Pose (`"figur": "Luna", "pose": "zeigt"`). Abgenommene Grundposen und eingebundene Posen kommen so in die Figurenbibliothek.
- `pruefung`: nach jedem Versuch jeder Punkt aus `pflicht` als `ok` oder `fehlt` und jeder Fund aus `verboten`. Ein Punkt ist erst `ok`, wenn er im Ausschnitt des Platzes ganz zu sehen ist. Jede Anzahl wird im Viertel gezählt, nicht geschätzt, jede Schrift Zeichen für Zeichen mit dem Vertrag verglichen.

Der Prompt entsteht aus dem Vertrag: jedes Pflichtobjekt mit Zahl, Farbe und Lage, jede Figur mit Handlung und Standfläche, jedes Verbot als „ohne …“.

### Prompt

**Aufbau:** Stilblock, Zusatz der Art, dann das Motiv in dieser Reihenfolge: Szene (Ort, Tageszeit, Licht), Figuren und Dinge, Details, Einschränkungen („ohne …“), gern als beschriftete Abschnitte.

**Stilblock:** einmal je Material oder Reihe festlegen und wortgleich an den Anfang jedes Prompts setzen, für Figuren, Szenen und Cliparts derselbe. Nur so passen Figur und Hintergrund zusammen.

> Kindgerechte Illustration im flachen Vektorstil, runde, weiche Formen, klare dunkle Konturen gleichmäßiger Stärke, flache Farbflächen ohne Verlauf und ohne Textur, wenige warme Farben ({Palette}), Figuren mit freundlichen Gesichtern, Dinge ohne Gesicht.

**Schriftsatz:** Mit Canva endet der Stilblock (und der Zusatz „Strichzeichnung“) mit „keine Schrift, keine Buchstaben, keine Zahlen“. Mit der Bild-API steht der Satz als Schluss des Motivs: „Keine Schrift, keine Buchstaben und keine Zahlen im Bild.“, oder nach verlangter Schrift „Sonst keine Schrift, …“.

Danach je nach Art ein fester Zusatz:
- **Figur, Pose, Clipart:** „Genau ein Motiv, ganz zu sehen, freigestellt auf weißem Hintergrund, kein Hintergrundmuster.“ Mit der Bild-API statt „auf weißem Hintergrund“: „auf vollständig transparentem Hintergrund, ohne Schatten, ohne Schachbrettmuster“, dazu `transparent`.
- **Szene:** „Hintergrund bis an alle Ränder, alles Wichtige in der Bildmitte, an den Rändern nur ruhiger Hintergrund. Die Szene füllt das Bild, Boden und Standfläche im unteren Drittel.“
- **Strichzeichnung zum Anmalen** (`name-strich.png`, statt des Stilblocks): „Kindgerechte Strichzeichnung wie ein Ausmalbild, runde, weiche Formen, klare schwarze Konturen gleichmäßiger Stärke, weiße Füllung, keine Grautöne, keine Schraffur, Figuren mit freundlichen Gesichtern, Dinge ohne Gesicht, weißer Hintergrund, freigestellt, kein Hintergrundmuster.“

Danach das Motiv aus dem Bildvertrag, nach diesen Regeln:
- **Höchstens zwei bis drei Dinge, auf die es ankommt**, jedes mit Zahl, Farbe und Lage. Jedes weitere Ding wird unscharf oder fehlt.
- **Tageszeit und Licht immer nennen** („am hellen Tag, helles, freundliches Licht“), Farben statt Stimmungswörter. Sonst malen die Modelle gern Nacht.
- **Nichts, was der Vertrag nicht nennt:** „ohne Blätter, ohne weitere Dinge“. Hat das Motiv keine Figuren: „ohne Personen und Tiere“, sonst setzt das Modell Kinder dazu.
- **Schrift im Bild** nach Abschnitt 3; mit Canva heißen Dinge mit Schrift (Zettel, Schild, Buch, Tafel) „leer, ohne jede Markierung“.
- **Hände verdeckt oder eine Tierfigur.** Menschliche Hände misslingen fast immer: hinter dem Rücken, in der Tasche, außerhalb des Bilds. Leitfiguren sind Tiere.
- **Cliparts einzeln und freigestellt:** je Motiv ein eigenes Bild (`SQUARE_1_1`, freigestellt), nie mehrere Motive auf einem Bild.
- **Figuren in die Szene.** Das Bildmodell malt die Figuren, die die Geschichte dort zeigt, mit ins Bild: höchstens zwei, jede mit ihrer abgenommenen Grundpose als Referenz. Die Figur tut, was der Text sagt, an dem Ort, an dem es geschieht: Sie steht, sitzt oder kniet auf etwas Genanntem („kniet auf dem Hocker“), hält etwas, sieht auf die Spur.
- **Handlung über Körper und Blick:** „beugt sich über die Kiste, schaut auf das Glöckchen, ganzer Körper zu sehen“.
- **Jede Figur mit ihrem Aussehen beschreiben**, auch wenn ihr Referenzbild dabei ist: Art, Fellfarbe, Augenfarbe, Kleidung, Erkennungszeichen („grauer Waschbär-Junge, schwarze Augenmaske, dunkelbraune Augen, oranges T-Shirt“). Namen gehen nie an den Anbieter des Bildmodells.
- **Referenzen mit Nummer und Rolle** (Bild-API, in der Reihenfolge von `referenzen`): „Bild 1 zeigt die Eule, Bild 2 den Dachs. Zeichne beide genau so wie in ihren Bildern …“.
- **„Jede Figur genau einmal im Bild.“** ausdrücklich in den Prompt schreiben. Sonst erscheint eine Figur gelegentlich zweimal.
- **Einfache, eindeutige Posen und Griffe:** wer hält was in welcher Pfote und wie („hält die Lupe am Griff vor sich, das Auge bleibt frei“). Ein Gegenstand direkt vor dem Auge verschmilzt mit dem Auge; ein Gegenstand ohne beschriebenen Griff schwebt oder wächst aus dem Arm.
- **Nie auf eine andere Figur verweisen** („genau wie Wilma“, „im selben Stil wie die andere Figur“): Die KI überträgt dann Merkmale wie Augenfarbe, Wimpern oder Schleife.
- **Nur Referenzbilder der Figuren, die vorkommen**, je Figur eins. Ein überzähliges Referenzbild holt seine Figur zusätzlich ins Bild.

**Exaktes im Prompt** (Bild-API, Abschnitt 3):
- **Anzahl** als Ziffer und Wort mit Anordnung: „genau sieben (7) rote Äpfel nebeneinander in einer geraden Reihe, mit gleichem Abstand, keiner verdeckt einen anderen“. Geordnet statt gestreut, damit Kinder und Prüfung zählen können.
- **Würfel:** das Augenbild der sichtbaren Fläche („oben genau fünf Augen, vier in den Ecken, eins in der Mitte“) und „Seitenflächen ohne Augen“. Sonst malt das Modell Seiten, die es an keinem Würfel gibt.
- **Muster:** die Folge ganz ausschreiben („rot, rot, blau, rot, rot, blau, …“) und die Gesamtzahl nennen.
- **Symmetrie:** „exakt achsensymmetrisch zu einer senkrechten Achse durch …, jede Hälfte das genaue Spiegelbild der anderen“, dazu Lage und Farbe jedes Merkmals auf beiden Seiten. Die Achse nur, wenn sie zu sehen sein soll.
- **Uhr in der Szene:** jeden Zeiger einzeln („der lange Minutenzeiger zeigt senkrecht nach unten auf die 6, der kurze Stundenzeiger genau auf die Mitte zwischen 3 und 4“).
- **Schrift:** wörtlich in „…“, mit Ort und Schrift („in großer, dunkler Druckschrift“), dann „Sonst keine Schrift, keine Buchstaben und keine Zahlen im Bild.“ Ungewöhnliche Wörter Buchstabe für Buchstabe.

### Ablauf mit Canva (Claude-App)

1. **Vertrag, dann erzeugen:** Bildvertrag schreiben (oben), dann `generate-image` mit Stilblock und Motiv nach „Prompt“ und dem `aspectRatio` aus „Format nach Platz“. `imageReferences`: für eine Szene die Grundpose jeder Figur darin, für eine neue Pose oder Strich-Version nur das Original (Abschnitt 4). Danach `get-generate-image-job` abfragen, bis `SUCCESS`; das Ergebnis ist eine Media-ID (`MA…`).
2. **Grob prüfen:** Vorschau ansehen: Motiv eindeutig und fachlich richtig, Stil passt zu den anderen Bildern. Sonst nach „Fehler und Versuche“ (unten) weiter. Die genaue Prüfung folgt in Schritt 5.
3. **Freistellen** (nur Figuren und Einzelmotive, keine Szenen): `remove-background` mit der Media-ID → neue Media-ID mit transparentem Hintergrund.
4. **Als Datei holen:** Canva gibt einzelne Bilder nicht direkt als Datei heraus, nur Designs. Deshalb über das Hilfsdesign „Bild-Export (Hilfsdesign)“:
   - `get-assets` mit der Media-ID liefert die Originalgröße (`metadata.width`/`height`, meist 1264 px).
   - Hilfsdesign mit `search-designs` suchen. Fehlt es: ein beliebiges Design mit `resize-design` (custom, Bildgröße) kopieren, Elemente löschen und den Titel per `update_title` auf „Bild-Export (Hilfsdesign)“ setzen.
   - `read-design` mit `open_transaction`, dann `edit-design`: `add_page` in Originalgröße mit dem Dateinamen als Titel; mit `read-design` (`page_indices`) die Seiten-ID holen; `insert_fill` mit der Media-ID bei `top: 0, left: 0` in voller Seitengröße; `commit`.
   - **Höchstens 100 Seiten je Design.** Meldet `add_page` „Page limit reached“, eine vorhandene Seite gleicher Größe wiederverwenden: `update_fill` am Bildelement mit der neuen Media-ID, danach `crop_media` am selben Element, bis das ganze Bild die Seite füllt (`update_fill` allein behält den alten Zuschnitt), `commit`. Oder ein zweites Hilfsdesign anlegen.
   - `export-design` mit `pages: [n]`: Figuren und freigestellte Motive als `png` mit `transparent_background: true`, `lossless: true`; Szenenbilder ohne Transparenz als `jpg` (Qualität ca. 90), für ein kleines PDF.
   - `curl -fsSL -o bilder/motiv.png "<url>"`; mit `file` prüfen (Format, volle Größe). Die Umgebung muss `export-download.canva.com` erreichen. Mit Schoolbox aus dem Hauptordner: `curl -fsSL -o materialien/<mappe>/dokumente/<dokument>/bilder/motiv.png "<url>"`.
5. **Genau prüfen (Pflicht für jedes Bild):** die vier Viertel in voller Auflösung und den Ausschnitt, den der Platz zeigt, je einzeln ansehen, bei Szenen jede Figur für sich (Checkliste G in `visuelle-endkontrolle.md`). Die Prüfbilder macht `blatt.py`, mit Platz und Blickpunkt aus dem Vertrag:

   ```bash
   python3 scripts/blatt.py viertel bilder/motiv.jpg -o pruefbilder --platz 794x660 --blick 50,50
   ```

   Das legt `motiv-v1.png` bis `-v4.png` (oben links, oben rechts, unten links, unten rechts) und `motiv-platz.png` an und nennt den sichtbaren Bereich in Prozent. In der Schoolbox macht das der Server (Abschnitt 2b). Danach den Vertrag abhaken (`pruefung`): Ist jedes Pflichtobjekt mit Zahl, Farbe und Lage da und im Ausschnitt ganz zu sehen? Ist nichts Verbotenes im Bild? Tut keine Figur etwas anderes, als der Text sagt? Steht oder sitzt jede Figur auf etwas, wirkt nichts eingeklebt, füllt die Szene den Platz (Checkliste G)? Bei einem Befund nach „Fehler und Versuche“ weiter. Die Prüfbilder sind Arbeitsdateien und werden danach gelöscht.
6. **Einbauen:** Datei neben die HTML-Quelle legen (`bilder/motiv.png`), mit `<img src="bilder/motiv.png" alt="…">` und fester Breite einsetzen; `blatt.py` bettet sie ins PDF und in die eigenständige HTML-Datei ein und meldet unscharfe Bilder.
7. **Ablegen:** Neue Posen der Leitfigur in `assets/bilder/` aufnehmen und in der Tabelle oben mit Media-ID ergänzen, damit sie nie zweimal erzeugt werden. Bei mehreren KI-Bildern in einem Material eine Bildliste neben die Quelle legen (`bilder/canva-ids.tsv`: Datei, Media-ID, Motiv), damit eine spätere Reparatur das Original findet; ersetzte IDs dort mit Datum und Grund vermerken.

### Fehler und Versuche

Neu statt flicken: je Fehler eine Bearbeitung und danach höchstens zwei neue Bilder; ein Auftrag kann weniger erlauben.

1. Fehlt etwas aus dem Vertrag, stimmt eine Anzahl oder Schrift nicht, ist etwas abgeschnitten, schwebt eine Figur, wirkt sie eingeklebt oder hat das Bild einen Fehler nach 2a: das Bild einmal **bearbeiten** nach 2a, Punkt 1. Eine Figur nie verschieben oder mit einer Pose überdecken.
2. Bleibt der Fehler: **neu erzeugen**, mit einem Prompt, der den Fehler ausdrücklich ausschließt („ohne …“, „kein …“), und dem Ding deutlicher in der Mitte. Nicht ein zweites Mal für denselben Fehler bearbeiten.
3. Bleibt der Fehler nach dem zweiten neuen Bild: kein weiterer Versuch. **Den Text an das Bild anpassen**, so dass er nur nennt, was das Bild zeigt (mit Canva auch: das exakte Ding als Ebene oder daneben, Abschnitt 3). Geht das nicht, bleibt das Bild mit einem Hinweis an die Lehrkraft (Schoolbox: `"offen"` beim Eintrag, Abschnitt 2b). Nie ein Bild ins Material, das dem Text widerspricht, ohne diesen Hinweis.

Jeder Versuch kommt mit Befund in `pruefung`, mit Canva auch mit Media-ID.

Mit Canva: Meldet sie `quota_cooldown` („credit usage is cooling down“), einige Minuten warten, nicht in einer Schleife neu anfragen; in der Wartezeit Text und Layout weiterbauen. Lehnt der Sicherheitsfilter ein Bild ab (`CLIENT_UNSAFE_INPUT`), das Motiv harmloser umformulieren. Sind Canva-Downloads in der Umgebung gesperrt: Die Lehrkraft öffnet „Open generated image“, lädt das Bild herunter und gibt es in den Chat oder den Arbeitsordner. Die Media-IDs liegen im Canva-Konto, in dem die Bilder erstellt wurden. In einem anderen Konto die Dateien aus `assets/bilder/` verwenden; als Referenz für neue Posen vorher hochladen (`create-upload-url`).

### 2a. Fehler im KI-Bild beheben

KI-Bilder haben regelmäßig Fehler, die erst in voller Auflösung auffallen: ein Lupenring, der mit dem Auge verschmilzt, eine dritte Hand, ein Arm, der in einen Gegenstand übergeht, eine Pfote ohne Körper, dieselbe Figur zweimal, durchscheinende Figuren oder Schleier, Buchstaben, die der Vertrag nicht nennt, eine Figur, die schwebt oder eingeklebt wirkt. Kein solcher Fehler bleibt im Material.

1. **Bearbeiten statt neu würfeln**, wenn das Bild sonst passt. Mit Canva: `generate-image` mit dem fehlerhaften Bild als **einziger** `imageReferences` und demselben `aspectRatio`. In der Schoolbox: `bild_bearbeiten` mit der Datei; Format und Transparenz bleiben, eine abweichende Figur bekommt ihre Grundpose als Referenz dazu. Prompt: „Ändere nur: …“ mit Fehler, Ort und Sollzustand („Die Lupe hat einen Griff und die Figur hält sie mit der rechten Pfote vor sich, ihr Auge ist frei“), dann „Behalte alles andere genau gleich: Figuren, Farben, Hintergrund, Bildausschnitt.“ Eine Änderung je Runde; driftet das Bild, die wichtigen Bedingungen wiederholen.
2. **Den Sollzustand beschreiben,** „dunkelbraune Augen ohne Wimpern“ statt „Augen wie bei Wilma“ (Abschnitt 2, „Prompt“), bei einer Anzahl die Zahl mit Anordnung („der linke Würfel zeigt oben genau fünf Augen …“).
3. **Ergebnis wieder vollständig prüfen** (Schritt 5): Eine Bearbeitung lässt den Fehler oft stehen oder erzeugt einen neuen an anderer Stelle.
4. **Eine Bearbeitung je Fehler.** Bleibt der Fehler, erzeuge das Bild neu mit einem Prompt, der den Fehler ausdrücklich ausschließt (Abschnitt 2, „Fehler und Versuche“), oder wähle den Blickpunkt so, dass die Stelle im Platz wegfällt. Pixel-Retusche an Figuren (übermalen, weichzeichnen) sieht fast immer schlechter aus als der Fehler.
5. **Kleine Fehler an einer Stelle** (Claude-App mit Bash) nicht mit dem ganzen Bild bearbeiten:
   - Auf ruhigem Untergrund (Busch, Himmel, Wiese, Stoff) die Stelle mit Textur direkt daneben überdecken: dasselbe Bild um einige Pixel verschoben, nur innerhalb einer weichen Maske einsetzen, die vor Konturen endet. Einen Farbstich (grünlich, bläulich) nur in der Maske entfärben.
   - An Figuren den Ausschnitt um die Stelle (etwa 256 px) auf 1024 px vergrößern, hochladen (`create-upload-url`), nach Schritt 1 bearbeiten, wieder verkleinern, per Versatzsuche genau ausrichten und mit weicher Maske einsetzen.
   - Würfelaugen und Anzahlen: Abschnitt 3.

   Danach die Stelle vergrößert ansehen; sieht man die Naht, Maske kleiner oder Versatz ändern.
6. Die neue Datei ersetzen, Bildliste aktualisieren, neu bauen.

### 2b. In der Schoolbox: Bild-API

Baut die Schoolbox ein neues Blatt, eine Unterrichtseinheit oder ein Bild aus der Schublade „Figuren“ oder „Bilder“, erzeugt der Server die Bilder über die Bild-API. Es gibt kein Bash, kein curl, kein Python und kein Canva. Es gilt Abschnitt 2 ohne die Schritte 1 bis 4 des Ablaufs mit Canva:

- **`bild_erzeugen`:** `datei` (Name in `bilder/`, Kleinbuchstaben, Ziffern, Bindestriche, `.png` oder `.jpg`), `prompt`, `format` (Name aus „Format nach Platz“), `referenzen` (höchstens 4) und `transparent` (nur `.png`, für Figuren und Einzelmotive). Szenen werden `.jpg`. Vorher steht der Eintrag mit `datei` und `motiv` in `bilder.json` (Vertrag, dann erzeugen); sonst lehnt das Werkzeug ab. Eine Strichfassung ist ein neues Bild (`name-strich.png`) mit dem Original als Referenz.
- **`bild_bearbeiten`:** `datei` (ein Bild in `bilder/`), `prompt` nach 2a, Punkt 1, `befund` (der Fehler, den die Bearbeitung behebt, ein Satz) und `referenzen` (höchstens 3 weitere). Format und Transparenz bleiben die des Bilds.
- **Neu statt flicken:** Wer ein vorhandenes Bild neu erzeugt, nennt in `befund` den Fehler, den das neue Bild nicht mehr hat; für denselben Fehler derselbe Wortlaut. Der Server zählt je Datei über alle Läufe: Eine zweite Bearbeitung für denselben Befund lehnt er ab („Neu erzeugen“), nach zwei neuen Bildern für denselben Befund jeden weiteren Versuch. Dann beim Eintrag in `bilder.json` `"offen": "<der Fehler in einem Satz>"` eintragen; die Lehrkraft sieht den Hinweis. Ohne `offen`, sobald der Fehler behoben ist.
- **Unterrichtseinheit: Vertrag und Prüfung über die Werkzeuge.** Dort schreibst du `bilder.json` nicht. Den Vertrag gibst du `bild_erzeugen` als Parameter mit (`motiv`, `platz`, `blickpunkt`, `vertrag`, bei einer Figur allein `figur` und `pose`, je wie im Eintrag oben); das Werkzeug schreibt ihn vor dem Bild in die Liste. Ein späterer Aufruf, auch von `bild_bearbeiten`, nennt nur, was sich ändert. `bild_vertrag` liefert den Eintrag eines Bildes. `bild_pruefung` trägt die Prüfung ein (`ok`, `fehlt`, `verboten`; die Versuchsnummer setzt der Server) und setzt `offen` oder löscht es mit `""`. Wo dieser Abschnitt „in `bilder.json`“ oder „in `pruefung`“ sagt, gilt dort das Werkzeug.
- **Vertrag aus dem Kanon:** In einer Einheit mit Kanon lehnt `bild_erzeugen` einen Vertrag ab, dem eine Zeile aus dem Kanon fehlt, und nennt sie wörtlich; eine Grundpose mit einem Gegenstand der Handlung ebenso.
- **Referenzen** sind Dateien relativ zum Arbeitsordner, nur unter `bilder/`, `referenzen/` oder `ansicht/bilder/versuche/` (die Vorversionen, etwa „stelle … wie in Bild 2 wieder her“). Die Grundposen der Figuren legt der Server als `referenzen/<figur>.png` ab und nennt sie im Auftrag. Für eine Figur der Figurenbibliothek lehnt `bild_erzeugen` eine neue Grundpose ab, ebenso eine Pose, die sie schon hat: Ihre Posen legt der Server vor dem Lauf nach `bilder/` und nennt je Pose die Zeile zum Einbinden. Nennt der Auftrag Requisiten früherer Einheiten in `bilder/`, sieh dir eines vorher mit Read an und nimm es nur, wenn es dem Kanon (falls es einen gibt) und dem Vertrag des Bildes entspricht; dann statt eines neuen. Die Media-IDs aus Abschnitt 1 gelten hier nicht.
- **Danach** liegt das Bild schon in `bilder/<datei>`; eine Vorversion unter `ansicht/bilder/versuche/`. Die Antwort nennt Pixelmaße, Versuchsnummer und die Prüfbilder unter `ansicht/bilder/` (`<name>-v1.png` bis `-v4.png`, mit `platz` auch `<name>-platz.png`, Ausschnitt nach `blickpunkt`). Jedes mit Read ansehen und den Vertrag in `pruefung` abhaken wie in Schritt 5. Fehlen die Prüfbilder, das ganze Bild ansehen und das in `pruefung` vermerken.
- **`bilder.json`** hat kein `url` und kein `mediaId`. Ein Eintrag ohne Datei in `bilder/` ist ein fehlendes Bild.
- **Gleichzeitig:** Bis zu drei Bildaufrufe dürfen zugleich laufen, etwa die Szenen verschiedener Kapitel; eine Szene erst, wenn ihre Grundposen abgenommen sind. Jeder Aufruf zählt gegen die Grenze des Laufs.
- **Schritt 6 und 7:** Im Material `../../bilder/motiv.png`. Die Herkunft je Bild schreibt der Server in `bilder/bilder-herkunft.tsv`; `canva-ids.tsv` gilt nur für ältere Bilder. Bilder aus der Schublade „Figuren“ legt der Server in die Figurenbibliothek, nicht nach `assets/bilder/`, Bilder aus der Schublade „Bilder“ nach `bilder/` der Mappe.
- **Fehler:**
  - `bild-api-gesperrt` (Guthaben, Ausgabenlimit oder Schlüssel): kein Bild mehr anfragen, auch nicht ein zweites Mal. Jeden fehlenden Vertrag ohne Bild in `bilder.json` lassen, im Material mit Platzhalter fertig bauen und den Lauf beenden.
  - „Bild-API ausgelastet“: Das Werkzeug hat schon gewartet. Erst anderes weiterbauen, dann das Bild noch einmal; scheitert es wieder, bleibt der Platzhalter.
  - „Sicherheitsfilter“: das Motiv harmloser formulieren und noch einmal; lehnt er wieder ab, bleibt der Platzhalter.
  - Jeder andere Fehler: noch einmal nur, wenn die Ursache im Aufruf lag.

## 3. Exaktes und Lesbares im Bild

**Mit der Bild-API:**
1. **In Szenen und Illustrationen malt das Bildmodell Exaktes und Lesbares selbst:** Anzahlen, Würfelaugen, Muster, symmetrische Formen, eine Uhr in der Szene, Zahlen und kurze Schrift auf Schildern und Zetteln, nach „Exaktes im Prompt“ (Abschnitt 2). Kein leerer Zettel mit Ebene darauf, keine Zahl als Ebene, keine SVG-Menge neben dem Bild.
2. **Aufgabendarstellungen bleiben `x-…`-Elemente aus `abbildungen.js`:** alles, woran die Kinder ablesen, zählen, eintragen oder einzeichnen, und alles, was auf dem Lösungsblatt anders aussieht: die Uhr zum Ablesen, der Zahlenstrahl mit Lücken, Zwanzigerfeld, Stellentafel, Zehnerstangen zum Zählen, das Gitter zum Spiegeln. Sie sind die Aufgabe selbst, haben eine Lösung (`loesung=`), lassen sich im Editor einstellen und stimmen genau. Das Bildmodell liegt gerade hier daneben: 9 statt 10 Würfelchen, ungleiche Abstände, ein schiefer Stundenzeiger. Fehlt eine Darstellung (z. B. Geldstücke, Geometrie), als SVG berechnen und bei Bedarf als neues `x-…`-Element in `abbildungen.js` ergänzen.
3. **Text bleibt Ebene** (`.lage-zettel`, Abschnitt 4), wenn er mehr als eine kurze Zeile ist (über etwa fünf Wörter oder eine Rechnung), wenn die Lehrkraft ihn ändern können soll oder wenn er auf dem Lösungsblatt anders ist.
4. **Keine Namen im Bildtext.** Ein Schild „Willis Werkstatt“ ginge mit dem Namen an OpenAI. Solcher Text bleibt Ebene, oder das Schild trägt keinen Namen.

Stimmt eine Anzahl oder eine Schrift im Bild nicht: bearbeiten nach 2a, nach drei Versuchen den Text an das Bild anpassen. Ein Ersatz als Ebene oder SVG daneben entfällt.

**Mit Canva (Claude-App):** Schrift, Zahlen und alles Exakte (Gitter, symmetrische Figuren, Muster, Anzahlen, Uhren, Würfelaugen) kommen nie aus der KI; sie bleiben leer oder werden zu Kritzeln. Dinge mit Schrift bleiben im Bild leer, ihr Inhalt kommt als Ebene darauf (Abschnitt 4); Aufgabendarstellungen wie in Punkt 2. Hängt eine Geschichte an einer Anzahl in der Szene: den Text ohne die Anzahl schreiben („viele Häuser“), die exakte Menge als SVG neben das Bild setzen oder im fertigen Bild nachzählen und den Text anpassen. Würfelaugen: die KI macht die Fläche leer, die Punkte werden perspektivisch hineingerechnet (Ecken der Fläche, bilinear). Nie eine Anzahl aus dem Prompt ungeprüft in den Text übernehmen.

**Spuren groß zeigen.** Hängt das Rätsel an einer Spur, die exakt sein muss (Abdruck, Muster, Form), steht sie als eigenes, großes Element neben oder unter dem Bild, etwa als Lupen-Ausschnitt oder Spurenkarte, so groß, dass die Kinder sie im Kreis erkennen. Mit der Bild-API darf sie ein eigenes Bild aus dem Bildmodell sein. Auf der Szene liegt sie nie als kleine SVG. Muss sie nicht exakt sein, malt das Bildmodell sie in die Szene, und sie ist ein Pflichtobjekt im Bildvertrag.

Sachabbildungen (Tiere, Pflanzen, Körper) fachlich prüfen; bei Zweifel ein geprüftes Foto der Lehrkraft verwenden.

## 4. Figuren in der Szene, Ebenen für Text

Als Ebene über dem Bild liegt Text nach Abschnitt 3, Punkt 3, mit Canva jede Schrift und alles Exakte: Zettel, Schilder und Baupläne mit Text, auch ein Element aus `abbildungen.js` auf einem Zettel. Figuren liegen auf Szenen nie als Ebene. Freigestellte Posen stehen auf Plätzen ohne Szene: Tipp, Pass, Urkunde, Bildkarte, Sprechblase.

**Grundpose und Posen.** Jede Figur entsteht einmal als Grundpose; sie ist die Referenz für jede Szene und jede Pose:
1. Grundpose erzeugen (`SQUARE_1_1`, Stilblock mit Zusatz „Figur“, Aussehen aus dem Steckbrief). Die Grundpose zeigt nur, was die Figur in jeder Szene hat; ein Gegenstand der Handlung (ein Glöckchen, das sie erst verliert) kommt nie hinein. Freistellen (Canva `remove-background`, Bild-API `transparent`), nach Schritt 5 prüfen.
2. **Abnehmen:** Stimmt sie in Viertel und Ganzem mit dem Steckbrief überein (Farben, Kleidung, Erkennungszeichen, Proportionen)? Erst dann ist sie die Vorlage.
3. **Figur in der Szene** (Abschnitt 2, „Prompt“). Hält eine Figur einen Text, der Ebene bleibt, ist das Blatt im Bild leer; der Inhalt kommt als Zettel-Ebene (`gehalten`).
4. Posen für Tipp und Requisiten (`verkauf.md`, Abschnitt 5) nur mit der abgenommenen Grundpose als einziger Referenz, jede freistellen und mit der Grundpose vergleichen (Augen, Kleidung, Größenverhältnisse). Was abweicht, wird bearbeitet wie in 2a.

Reihenfolge: Grundpose, dann die Szenen in der Reihenfolge der Kapitel, zuletzt die Posen. Reichen Kontingent oder Guthaben nicht, fehlen so Posen, keine Szenen.

Willi und Wilma sind schon abgenommen (`assets/bilder/`, Abschnitt 1); für sie beginnt der Ablauf bei Punkt 3. In der Schoolbox gilt das für jede Figur der Figurenbibliothek: Ihre Grundpose ist die Referenz, ihre Posen sind schon da, neu entstehen nur fehlende.

**Markup.** `.bild-lagen` füllt einen Platz mit fester Höhe (Fall-Karte, Bildfolie, Karte) wie `object-fit:cover`; darin hat `.lagen-flaeche` das Seitenverhältnis der Bilddatei. Jede `.lage` steht in Prozent des Bilds und wandert mit, wenn der Blickpunkt den Ausschnitt verschiebt. Gilt mit `data-satz="2"` am `<body>`; Muster: `assets/beispiel-reihe-kapitel.html`, Seite 1.

```html
<div class="fall-bild" style="--h:660px">
  <div class="bild-lagen" style="--bx:50%;--by:50%">
    <div class="lagen-flaeche" style="--ar:5/4">
      <img src="../../bilder/fall-2.jpg" alt="Werkstatt, Willi hält ein leeres Blatt hoch">
      <div class="lage lage-zettel gehalten" style="--x:24%;--y:52%;--b:12%;--dreh:-6deg">Wer findet den goldenen Schlüssel zuerst?</div>
    </div>
  </div>
  <div class="fall-band">Kapitel 2</div>
</div>
```

- `--ar`: Breite/Höhe der Bilddatei (`5/4`, `16/9`, `1680/944`). `--bx`, `--by`: der Blickpunkt aus dem Vertrag, wie `object-position`.
- `.lage`: `--x`, `--y` die linke obere Ecke, `--b` die Breite, alles in Prozent des Bilds; `--dreh` dreht leicht. Die Zahlen nimmt man aus dem Viertel, in dem die Stelle liegt (ein Viertel ist 50 % breit und hoch).
- `.lage-zettel`: Papier mit Nadel, Schrift aus dem Blatt (`--zs`, ab 18 px); mit `gehalten` ohne Nadel, für ein Blatt in der Hand einer Figur. Darin Text, inline-SVG oder ein Element aus `abbildungen.js` (`<x-uhr>`, `<x-gitter>` …).
- Ein Bild ohne Ebenen auf der Fall-Karte oder dem Deckblatt bekommt den Blickpunkt direkt: `<img src="…" style="--bx:62%">`.

Die Prüfung meldet in `.bild-lagen` keine Überlappung und keinen Beschnitt; ob jede Ebene richtig liegt (Zettel auf dem Blatt in der Pfote, nichts Pflichtiges verdeckt), zeigt nur das Seitenbild nach dem Bau.

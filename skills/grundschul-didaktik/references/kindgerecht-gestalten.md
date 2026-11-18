# Kindgerecht und ansprechend gestalten, ohne zu überladen

Inhalt: Kernaussage der Forschung · Arbeitsseiten und Schauseiten: wie viel Gestaltung wohin · Die fünf Hebel · KI-Bilder und -Grafiken (Canva `generate-image`) · Geschichten-Rahmen für eine Reihe · Prüffragen „ansprechend, aber nicht überladen"

## Kernaussage der Forschung

Zwei Befunde scheinen sich zu widersprechen, passen aber zusammen:

1. **Emotional Design wirkt.** Warme, angenehme Farben, runde Formen und freundliche Gesichter an *lernrelevanten* Elementen verbessern Behalten, Verstehen und Motivation und senken die empfundene Schwierigkeit.
2. **Deko ohne Bezug schadet.** Interessante, aber für das Lernziel irrelevante Bilder und Details („seductive details") verschlechtern Behalten und Transfer. Bei Kindern mit geringer Impulskontrolle ist der Effekt am stärksten; bei Leseanfängern konkurrieren bunte Bilder neben dem Text um Aufmerksamkeit. Stark dekorierte Lernumgebungen senken bei jungen Kindern die Aufmerksamkeit und den Lernzuwachs.

Studien dazu: `grundschul-didaktik/references/quellen.md`, „Gestaltung und Kognition“.

**Daraus folgt die Grundregel: Das schön machen, was ohnehin da ist – nicht etwas dazustellen.** Form und Figuren kommen an Elemente mit Funktion (Aufgabennummer, Beispiel, Tipp, Lernobjekt), nicht als Füllung.

## Arbeitsseiten und Schauseiten: wie viel Gestaltung wohin

Wie viel gestaltet wird, folgt dem Zweck der Seite, nicht einer Vorlage. Die Muster in `html-materialerstellung/assets/` zeigen, was technisch geht, nicht wie eine Seite aussehen muss. Entscheide für jede Reihe neu, was sie zusammenhält (Farben, Marke, Kopf, Bildsprache), und entscheide auf jeder Seite, wie viel Gestaltung der Platz verträgt.

| Seitenart | Beispiele | Gestaltung |
|---|---|---|
| **Arbeitsseite** | Arbeitsblatt, Lernzielkontrolle, Klassenarbeit, Lesetext mit Aufgaben, Aufgabenkarte mit viel Inhalt | Der Platz gehört den Aufgaben. Gestaltet wird nur, was ohnehin da ist und kaum Fläche kostet: Titel, Farbakzent, Nummernkreise, Leitfigur mit Tipp, eine Marke in der Namenszeile. Kein Seitenrahmen, keine Symbole hinter der Aufgabennummer, keine Linien oder Balken am Text, keine Kästen um Aufgaben. Je weniger Aufgaben eine Seite trägt (Kl. 1, Forscherbogen, Malseite), desto mehr Spielraum. |
| **Schauseite** | Deckblatt, Fall- oder Szenenkarte, Plakat, Ausweis oder Pass, Sammelkarte, Urkunde, Spielplan, Spielkarten, Folien, Titel eines Hefts, Ausschneide- und Legematerial (Karten, Dominosteine, Legeteile, Schneidebögen) | Hier wird gestaltet und Platz ist zweitrangig: Szenenbild, Seitenfläche, Rahmen, Formen, Schmuckschrift, Streuung (`html-materialerstellung/references/gestaltung.md`). Maße und Bausteine für Ausschneidematerial: `druck-und-platz.md`, „Ausschneide- und Legematerial“. Eigene Ideen statt Nachbau des Musters. Maßstab: Würde ein Kind sie gern behalten, würde eine Lehrkraft in der Vorschau hängen bleiben? |
| **Seite für die Lehrkraft** | Hinweise zur Reihe, Ablauf der Stunden, Lösungen, Erwartungshorizont | Nüchtern und schnell zu überfliegen: `<body class="… lehrkraft">` (Arial, kleine Schrift), Stichpunkte und Tabellen statt Fließtext, keine Kästen, keine Kinderschrift. |

Im Zweifel bei Arbeitsseiten weglassen, bei Schauseiten mutiger sein.

**Farbe:** Material wird in Farbe angelegt, s/w ist eine Ansicht davon (`grundschul-didaktik/references/gestaltung.md`, Abschnitt „Farbe“). Emotional Design wirkt über Farbe als Akzent, Form, Schrift und Figur. Es gibt keine Farbflächen hinter Aufgaben und keine Aufgabenkästen – das Blatt soll Platz für Übung haben.

## Die fünf Hebel

### 1. Freundliche Formen für die Struktur

- Aufgaben **ohne Kasten und ohne Flächenfüllung**: hängende Nummer, Abstand zur nächsten Aufgabe (`druck-und-platz.md`, Abschnitt 4).
- Aufgabennummern in **kleinen gefüllten Kreisen** (Größe setzt `blatt.css`, `html-materialerstellung/references/layout.md`; weiße fette Ziffer, in der Hauptfarbe): starker Anker, kaum Fläche.
- Die wenigen Rahmen mit Funktion (Sprechblase, Wortspeicher, Antwortkästchen) als dünne Kontur mit **gerundeten Ecken** (Rundung ca. 8–16 px); Kontur in der Hauptfarbe (setzt `blatt.css`, nie Gelb) und ggf. sehr helle Füllung.
- Schreiblinien und Antwortkästen schlicht (schwarz/dunkelgrau, 1,5–2 px), damit Kinderschrift lesbar bleibt.

### 2. Farbe als Akzent

Material wird immer in Farbe angelegt (oben, „Farbe“). Dabei gilt:

- **1 Hauptfarbe + 1 Akzentfarbe** aus derselben Familie, warme, freundliche Töne; keine Neonfarben. Wohin Farbe kommt und wohin nicht: `druck-und-platz.md`, Abschnitt 3.
- Farbe bedeutet überall dasselbe: z. B. jede Station eine Farbe; Klassenkonventionen (Wortarten, Stellenwerte) haben Vorrang. Niveaus bekommen keine eigene Farbe, nur Punkte ● / ●● / ●●●.
- Farbe nie als einzige Information; Graustufen-Vorschau prüfen.

Bewährte Paletten (Hex):

| Name | Hauptfarbe | Akzent | Überschrift + Nummernkreis (Kontrast ≥ 3:1) |
|---|---|---|---|
| Sonnig | `#F28C28` Orange | `#2A9D8F` Petrol | `#C4620A` |
| Himmel | `#3A86FF` Blau | `#FFBE0B` Gelb | `#2F6FD6` |
| Wiese | `#43AA8B` Grün | `#F3722C` Orange | `#2E7D63` |
| Beere | `#E76F51` Koralle | `#6A4C93` Lila | `#C2462F` |

Hauptfarbe und Akzent für Linien, Konturen, Bilder; für Schrift und Nummernkreise mit weißer Ziffer die dunkle Variante (sonst zu wenig Kontrast; `blatt.css` setzt sie). Gelb nie für Schrift oder Linien auf Weiß.

Text bleibt schwarz (`#1D1D1B`).

### 3. Leitfigur: immer Willi oder Wilma Waschbär

Feste Vorgabe für alle Materialien: Die Leitfigur ist **Willi Waschbär** oder **Wilma Waschbär** – keine anderen Tiere, keine wechselnden Figuren. Die Wiedererkennung über alle Fächer und Klassenstufen ist der Sinn der Figur.

| Grafik | Aussehen | Datei (`html-materialerstellung/assets/bilder/`) |
|---|---|---|
| Willi Waschbär | grauer Waschbär-Junge, schwarze Augenmaske, dunkelbraune Augen ohne Wimpern, geringelter Schwanz, oranges T-Shirt (#F28C28) | `willi.png`, s/w `willi-strich.png` |
| Wilma Waschbär | graues Waschbär-Mädchen, schwarze Augenmaske, petrolfarbene Augen mit Wimpern, geringelter Schwanz, petrolfarbenes Kleid (#2A9D8F), petrolfarbene Schleife am Ohr | `wilma.png`, keine s/w-Version |
| Wachstumsgrafik (Samen → Keimling → Pflanze → Blume) | vier Stufen nebeneinander, Pastell, für die Selbsteinschätzung | `wachstum.png`, s/w `wachstum-strich.png` |

Canva-Media-IDs und Technik: `html-materialerstellung/references/bilder.md`.

**Im Material steht die farbige Version; die s/w-Ausgabe nimmt von selbst die Strich-Version**, denn die farbigen werden in s/w zu grauen Flächen (Toner, unruhig). Fehlt eine Strich-Version noch: anlegen nach `html-materialerstellung/references/bilder.md`, Abschnitt 2.

- **Wiederverwenden statt neu erzeugen:** Die vorhandenen Dateien einsetzen. Für eine andere Pose (zeigt nach links, freut sich, denkt nach) `generate-image` mit dem Original als `imageReferences` und der Aussehen-Beschreibung oben aufrufen, danach `remove-background`; neue Posen als Datei ergänzen.
- **Wer wann:** Pro Material eine Figur, abwechselnd über die Materialien einer Reihe; bei Partner- oder Dialogaufgaben auch beide.
- **Immer mit Funktion:** Die Figur gibt einen Strategietipp in einer Sprechblase, zeigt auf das Beispiel und denkt dort laut vor („So geht's: Zuerst … dann … zum Schluss prüfe ich …"), stellt die Herausforderung ●●●, hat sich bei „Finde den Fehler" vertan oder stellt die Reflexionsfrage. Sie spricht in „noch"-Sprache und lobt Strategie und Ausdauer, nie Begabung. Ohne Funktion keine Figur.
- Höchstens ein Auftritt pro Seite (Figur mit Tipp oder Figur in der Ecke, nie beides), zwei nur bei Partner- oder Dialogaufgaben; klein (Maß setzt `blatt.css`, Faustwert in `html-materialerstellung/references/layout.md`). Die Figur in der Ecke steht am Rand; der Tipp steht im Körper seiner Aufgabe über der Item-Reihe, nie mitten in einer Reihe und nicht im Kopf (`druck-und-platz.md`, „Kopf und Fuß schlank“). Zwei Figuren auf einer Seite wirken sofort überladen.

### 4. Bilder nur mit Mehrwert

Ein Bild kommt nur auf das Blatt, wenn das Kind es **zum Lösen braucht** oder es das Verstehen messbar erleichtert. Gefällig oder thematisch passend reicht nicht – unnütze Bilder lenken ab.

| Zulässig | Beispiel |
|---|---|
| Lernobjekt selbst | Uhr, Zwanzigerfeld, Anlautbild, Geldstücke |
| Bild trägt Information | Preisschilder beim Einkaufen, Mengen zum Zählen, Tierbild zum Beschriften |
| Bild ersetzt Text für Leseanfänger | Bildsymbol statt Wort in Klasse 1, Bildfolge zum Erzählen |
| Leitfigur mit Tipp | Willi/Wilma mit Sprechblase |

Nicht zulässig: Stimmungsbilder zur Sachaufgabe (Kind beim Frühstück, wenn die Uhrzeit im Text steht), Themen-Cliparts in der Überschrift, Randverzierungen.

**Weglass-Test:** Könnte das Kind die Aufgabe ohne das Bild genauso gut lösen? Dann weg damit.

Dosierung: Leitfigur plus nur die Bilder, die die Aufgaben brauchen.

### 5. Kindgerechte Schrift

- **Fließtext:** klare Druckschrift mit eindeutigen Formen. In Klasse 1/2 mit einstöckigem a und g, weil es der Form entspricht, die die Kinder schreiben (entscheidend ist die Passung zur Schrift der Klasse). Standard: **Andika** (für Leseanfänger entwickelt, einstöckiges a und g; im HTML eingebettet), auch ab Klasse 3. Nur eingebettete Schriften (`html-materialerstellung/assets/fonts/`).
- **Überschriften auf Arbeitsseiten:** die Leseschrift in fett, wie im Schulbuch. Eine runde, fröhliche Schmuckschrift (**Fredoka**) nur auf Schauseiten: Deckblatt, Szenenkarte, Plakat, Pass, Urkunde und Schmucktext.
- Höchstens diese zwei Schriften. Keine Schreibschrift- oder Schmuckschriften für Lesetext, keine Großbuchstaben-Texte.
- Ziffern in Schulform (1 ohne Fuß, offene 4, 7 mit Querstrich): `blatt.css` setzt sie von selbst.
- Schreibvorlagen in verbundener Schrift: Vereinfachte Ausgangsschrift, eingebettet (`x-lineatur schrift="va"`). Eine andere Schulschrift der Klasse (Druckschrift des Lehrwerks, Lateinische Ausgangsschrift), wenn verfügbar und lizenziert: als Schriftdatei in `html-materialerstellung/assets/fonts/` einbinden.

## KI-Bilder und -Grafiken (Canva `generate-image`)

Bilder und Grafiken, die das Material braucht, erzeugt der Skill nach Bedarf mit der Canva-KI und baut sie ins HTML ein. Es gilt der Weglass-Test aus Abschnitt 4. Format, Bildvertrag, Stilblock, Prompt-Regeln, Prüfung und Reparatur stehen in `html-materialerstellung/references/bilder.md`, Abschnitte 2 bis 4.

Was hier entschieden wird:
- **Nichts Lesbares und nichts Exaktes aus der KI:** Schrift, Zahlen, Uhren, Mengen und Geometrie werden berechnet oder als HTML gesetzt (`bilder.md`, Abschnitt 3).
- Leitfigur: immer Willi oder Wilma Waschbär (Dateien in `html-materialerstellung/assets/bilder/`, neue Posen nach `bilder.md`, Abschnitt 4).
- Sachabbildungen (Tiere, Pflanzen, Körper) auf fachliche Richtigkeit prüfen.
- Diversität: Kinder unterschiedlicher Herkunft, Geschlechter und mit/ohne Brille, Rollstuhl usw. selbstverständlich abbilden, ohne es zum Thema zu machen.

## Geschichten-Rahmen für eine Reihe

Eine durchgehende Geschichte trägt eine ganze Unterrichtsreihe besser als einzelne Blätter: Die Kinder wollen wissen, wie es weitergeht, und jede Stunde hat einen Anlass. Die Geschichte ist der Impuls des Kreisinputs, nicht Deko auf dem Arbeitsblatt.

- **Rahmen:** ein Problem, das sich nur mit dem Lernziel der Reihe lösen lässt (etwas ist verschwunden, kaputt, verzaubert); jede Stunde ein Kapitel oder Fall, dessen Rätsel genau das Ich-kann-Ziel der Stunde ist. Die letzte Stunde löst den Rahmen auf (Überprüfung als „Prüfung“, Fest, Urkunde).
- **Szenenkarte je Stunde** (Karte, Plakat oder Folie für den Kreisinput, eine Schauseite): Das Szenenbild trägt die Seite (etwa zwei Drittel der Höhe), dazu Titel des Kapitels, ein kurzer Text und die Frage der Stunde. Der Text hat in Kl. 1/2 höchstens 40 Wörter, in Kl. 3/4 höchstens 60 (diese Grenze gilt überall für Fall- und Szenenkarten); erzählt wird in einer Reihe im Vorleseheft (`unterrichtsplanung/references/reihe-als-geschichte.md`, „Das Vorleseheft“). Lieber zwei, drei Sätze wörtliche Rede der Figuren (auch als Sprechblasen) als Erzählprosa; was das Bild zeigt, muss der Text nicht beschreiben. Das Szenenbild ist hier Erzählanlass mit Funktion; der Weglass-Test gilt weiter für die Arbeitsblätter.
- **Arbeitsblätter bleiben ruhig:** Sie sind Arbeitsseiten. Sie greifen das Kapitel im Titel auf („Fall 3: …“) und haben höchstens die Leitfigur mit Tipp, keine Szenenbilder. Was die Blätter einer Reihe zusammenhält (Kapitel-Marke, Farbe, Fußzeile), kostet keinen Platz; ein Seitenrahmen gehört nicht dazu (`unterrichtsplanung/references/reihe-als-geschichte.md`, Abschnitt 3).
- **Leitfigur in Bewegung:** Willi oder Wilma zeigt in jeder Szene eine andere Handlung und Pose passend zur Geschichte (rennt, kniet und misst, staunt, zeigt auf eine Spur, jubelt). Immer dieselbe Standardpose wirkt langweilig und erzählt nichts.
- **Wiedererkennbar:** Leitfigur und höchstens drei Nebenfiguren (in einer Reihe die Verdächtigen) mit fester Aussehen-Beschreibung; jede Szene entsteht mit der abgenommenen Grundpose jeder Figur darin als Referenz, und der Stilblock ist für die ganze Reihe gleich (`html-materialerstellung/references/bilder.md`, Abschnitte 2 und 4).
- Szenen erst erzeugen, wenn alle Geschichten der Reihe stehen; danach jede Szene gegen ihren Text prüfen.

## Prüffragen „ansprechend, aber nicht überladen"

- [ ] Würde ein Kind das Blatt gern in die Hand nehmen? (farbige Überschrift, Schmuckschrift nur auf Schauseiten, Nummernkreise, Farbakzente, Willi oder Wilma mit Funktion)
- [ ] Jedes Bild besteht den Weglass-Test
- [ ] Nur Bilder, die zum Lösen gebraucht werden, plus Leitfigur
- [ ] Keine Flächen hinter Aufgaben, Text schwarz, Information nie nur über Farbe
- [ ] Höchstens zwei Schriften, Fließtext in klarer Druckschrift
- [ ] Nichts Dekoratives zwischen Anweisung und Arbeitsfläche; der Tipp der Leitfigur steht im Körper seiner Aufgabe über der Item-Reihe
- [ ] Aufgaben ohne Kasten, Platz für Übung statt für Rahmen (`druck-und-platz.md`)
- [ ] Höchstens ein Figurenauftritt pro Seite, keine Symbole hinter der Aufgabennummer (außer die Klasse nutzt ein Symbolset), keine selbst gezeichneten Hände oder Körperteile
- [ ] Arbeitsseiten ohne Seitenrahmen und ohne Linien am Text; Schauseiten wirklich gestaltet
- [ ] Jedes KI-Bild in voller Auflösung geprüft (Augen, Pfoten, Gegenstände, jede Figur einmal, keine Schrift) und passend zum Text

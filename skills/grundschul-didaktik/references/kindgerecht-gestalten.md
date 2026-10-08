# Kindgerecht und ansprechend gestalten, ohne zu überladen

## Kernaussage der Forschung

Zwei Befunde scheinen sich zu widersprechen, passen aber zusammen:

1. **Emotional Design wirkt.** Warme, angenehme Farben, runde Formen und freundliche Gesichter an *lernrelevanten* Elementen verbessern Behalten, Verstehen und Motivation und senken die empfundene Schwierigkeit (Meta-Analyse Brom et al. 2018: d ≈ 0,3–0,4; Wong & Adesope 2021; Um, Plass et al. 2012).
2. **Deko ohne Bezug schadet.** Interessante, aber für das Lernziel irrelevante Bilder und Details („seductive details") verschlechtern Behalten und Transfer (Sundararajan & Adesope 2020). Bei Kindern mit geringer Impulskontrolle ist der Effekt am stärksten; bei Leseanfängern konkurrieren bunte Bilder neben dem Text um Aufmerksamkeit. Stark dekorierte Lernumgebungen senken bei jungen Kindern die Aufmerksamkeit und den Lernzuwachs (Fisher, Godwin & Seltman 2014).

**Daraus folgt die Grundregel: Das schön machen, was ohnehin da ist – nicht etwas dazustellen.** Form und Figuren kommen an Elemente mit Funktion (Aufgabennummer, Beispiel, Tipp, Lernobjekt), nicht als Füllung.

**Druckprofil:** Die Start-Abfrage legt fest, ob farbig oder schwarz-weiß gestaltet wird (`druck-und-platz.md`). Im **Farbprofil** wirkt Emotional Design über Farbe als Akzent, Form, Schrift und Figur; im **s/w-Profil** über Form, Schrift und Figur. In beiden gibt es keine Farbflächen hinter Aufgaben und keine Aufgabenkästen – das Blatt soll Platz für Übung haben.

## Die fünf Hebel

### 1. Freundliche Formen für die Struktur

- Aufgaben **ohne Kasten und ohne Flächenfüllung**: hängende Nummer, Abstand zur nächsten Aufgabe (`druck-und-platz.md`, Abschnitt 3).
- Aufgabennummern in **kleinen gefüllten Kreisen** (32–36 px, weiße fette Ziffer; Farbprofil: Hauptfarbe, s/w: schwarz): starker Anker, kaum Fläche.
- Die wenigen Rahmen mit Funktion (Sprechblase, Wortspeicher, Antwortkästchen) als dünne Kontur mit **gerundeten Ecken** (Rundung ca. 8–16 px); im Farbprofil Kontur in der Akzentfarbe und ggf. sehr helle Füllung, im s/w-Profil ohne Füllung.
- Schreiblinien und Antwortkästen schlicht (schwarz/dunkelgrau, 1,5–2 px), damit Kinderschrift lesbar bleibt.

### 2. Farbe als Akzent (Farbprofil)

Wurde in der Start-Abfrage Farbe gewählt:

- **1 Hauptfarbe + 1 Akzentfarbe** aus derselben Familie, warme, freundliche Töne; keine Neonfarben. Farbe auf Nummernkreise, Überschrift, Trennlinien, Sprechblase, Leitfigur und Bilder, **keine Flächen hinter Aufgaben, Kopf oder Fuß**. Details: `druck-und-platz.md`, Abschnitt 3.
- Farbe bedeutet überall dasselbe: z. B. jede Station eine Farbe; Klassenkonventionen (Wortarten, Stellenwerte) haben Vorrang. Niveaus bekommen keine eigene Farbe, nur Punkte ● / ●● / ●●●.
- Farbe nie als einzige Information; Graustufen-Vorschau prüfen.

Im **s/w-Profil** entfällt die Palette: Nummernkreise schwarz, Überschrift schwarz in runder Schrift, Leitfigur und Wachstumsgrafik als Strichzeichnung zum Anmalen.

Bewährte Paletten (Hex) für das Farbprofil:

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
| Willi Waschbär | grauer Waschbär-Junge, schwarze Augenmaske, geringelter Schwanz, oranges T-Shirt (#F28C28) | `willi.png`, s/w `willi-strich.png` |
| Wilma Waschbär | graues Waschbär-Mädchen, schwarze Augenmaske, geringelter Schwanz, petrolfarbenes Kleid (#2A9D8F), Schleife am Ohr | `wilma.png`, s/w noch anlegen |
| Wachstumsgrafik (Samen → Keimling → Pflanze → Blume) | vier Stufen nebeneinander, Pastell, für die Selbsteinschätzung | `wachstum.png`, s/w `wachstum-strich.png` |

Canva-Media-IDs und Technik: `html-materialerstellung/references/bilder.md`.

**Farbprofil: farbige Versionen. s/w-Profil: Strich-Versionen**, denn die farbigen werden in s/w zu grauen Flächen (Toner, unruhig). Fehlt eine Strich-Version noch: in Canva mit `generate-image` aus dem Original (`imageReferences`) erzeugen, Prompt „gleiche Figur als Ausmalbild: nur klare schwarze Konturen, weiße Füllung, keine Grautöne, keine Schraffur, weißer Hintergrund", dann `remove-background`, als Datei in `assets/bilder/` ablegen (`bilder.md`).

- **Wiederverwenden statt neu erzeugen:** Die vorhandenen Dateien einsetzen. Für eine andere Pose (zeigt nach links, freut sich, denkt nach) `generate-image` mit dem Original als `imageReferences` und der Aussehen-Beschreibung oben aufrufen, danach `remove-background`; neue Posen als Datei ergänzen.
- **Wer wann:** Pro Material eine Figur, abwechselnd über die Materialien einer Reihe; bei Partner- oder Dialogaufgaben auch beide.
- **Immer mit Funktion:** Die Figur gibt einen Strategietipp in einer Sprechblase, zeigt auf das Beispiel und denkt dort laut vor („So geht's: Zuerst … dann … zum Schluss prüfe ich …"), stellt die Herausforderung ●●●, hat sich bei „Finde den Fehler" vertan oder stellt die Reflexionsfrage. Sie spricht in „noch"-Sprache und lobt Strategie und Ausdauer, nie Begabung. Ohne Funktion keine Figur.
- Höchstens 1–2 Auftritte pro Seite, klein (ca. 15 % der Seitenbreite), am Rand, nie zwischen Anweisung und Arbeitsfläche.

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

Dosierung: Leitfigur plus nur die Bilder, die die Aufgaben brauchen. Für s/w als Strichzeichnung.

### 5. Kindgerechte Schrift

- **Fließtext:** klare Druckschrift mit eindeutigen Formen. In Klasse 1/2 mit einstöckigem a und g, weil es der Form entspricht, die die Kinder schreiben (Lesetests zeigen keinen Nachteil des zweistöckigen a – entscheidend ist die Passung zur Schrift der Klasse). Standard: **Andika** (für Leseanfänger entwickelt, einstöckiges a und g; im HTML eingebettet). Ab Klasse 3 auch andere klare serifenlose Schriften wie **Nunito**.
- **Überschriften:** eine runde, fröhliche Display-Schrift, z. B. **Fredoka**, **Baloo 2**, **Chewy** (nur Überschrift!).
- Höchstens zwei Schriften. Keine Schreibschrift- oder Schmuckschriften für Lesetext, keine Großbuchstaben-Texte.
- Schulschrift des Bundeslandes (Grundschrift, Fibel Nord/Süd, Druckschrift Bayern) wenn verfügbar und lizenziert: als Schriftdatei in `html-materialerstellung/assets/fonts/` einbinden.

## KI-Bilder und -Grafiken (Canva `generate-image`)

Bilder und Grafiken, die das Material braucht, erzeugt der Skill nach Bedarf mit der Canva-KI und baut sie ins HTML ein (Ablauf: `html-materialerstellung/references/bilder.md`, Abschnitt 2). Es gilt der Weglass-Test aus Abschnitt 4.


**Stil-Satz einmal pro Material festlegen und für jedes Bild wörtlich wiederverwenden** – so bleibt der Stil einheitlich.

Farbprofil:

> Kindgerechte Illustration im flachen Vektorstil, runde, weiche Formen, klare dunkle Konturen, warme Pastellfarben ({Palette}), freundliche Gesichter, weißer Hintergrund, freigestellt, keine Schrift, keine Zahlen, keine Buchstaben im Bild, kein Hintergrundmuster.

s/w-Profil:

> Kindgerechte Strichzeichnung wie ein Ausmalbild, runde, weiche Formen, klare schwarze Konturen gleichmäßiger Stärke, weiße Füllung, keine Grautöne, keine Schraffur, freundliche Gesichter, weißer Hintergrund, freigestellt, keine Schrift, keine Zahlen, keine Buchstaben im Bild, kein Hintergrundmuster.


Danach Motiv konkret beschreiben: wer, was, Pose, Blickrichtung (zur Aufgabe hin), Bildausschnitt.

Regeln:
- **Keine Schrift, Zahlen oder Uhren im KI-Bild.** KI erzeugt dabei regelmäßig Fehler. Fachlich exakte Elemente (Uhren, Zahlenstrahl, Mengenbilder) werden berechnet und als Vektor gesetzt (`fach-mathematik/scripts`).
- Leitfigur: immer Willi oder Wilma Waschbär mit den IDs aus Abschnitt 3.
- Sachabbildungen (Tiere, Pflanzen, Körper) auf fachliche Richtigkeit prüfen.
- Diversität: Kinder unterschiedlicher Herkunft, Geschlechter und mit/ohne Brille, Rollstuhl usw. selbstverständlich abbilden, ohne es zum Thema zu machen.

## Prüffragen „ansprechend, aber nicht überladen"

- [ ] Würde ein Kind das Blatt gern in die Hand nehmen? (runde Überschrift, Nummernkreise, Farbakzente im Farbprofil, Willi oder Wilma mit Funktion)
- [ ] Jedes Bild besteht den Weglass-Test
- [ ] Nur Bilder, die zum Lösen gebraucht werden, plus Leitfigur; Version passend zum Druckprofil
- [ ] Keine Flächen hinter Aufgaben, Text schwarz, Information nie nur über Farbe
- [ ] Höchstens zwei Schriften, Fließtext in klarer Druckschrift
- [ ] Nichts Dekoratives zwischen Anweisung und Arbeitsfläche
- [ ] Aufgaben ohne Kasten, Platz für Übung statt für Rahmen (`druck-und-platz.md`)

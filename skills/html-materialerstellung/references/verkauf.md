# Material für den Verkauf (Eduki)

Lesen, wenn der Auftrag sagt, dass ein Material oder eine Reihe verkauft werden soll. Ohne diesen Satz gilt nichts von hier.

Verkauft wird an fremde Lehrkräfte. Sie sehen zuerst nur das Deckblatt als kleines Bild, sie kennen die Klasse der Autorin nicht, und Eduki prüft vor der Freigabe jede Quelle. Gekauft werden vollständige Reihen mit eigenen Aufgabenideen, die liebevoll gestaltet sind; mehr Seiten derselben Übung verkaufen nichts. Deshalb gilt Abschnitt 5 für jede Seite, und vier Dinge kommen dazu:

| Was | Wo | Slug, Art |
|---|---|---|
| Deckblatt | eigenes Dokument, eine Seite, das erste der Reihe | `deckblatt`, `sonstiges` |
| Handreichung | Teil von „Einführung und Überblick“ (Abschnitt 2) | – |
| Quellenverzeichnis | eigenes Dokument, eine Seite, das letzte zum Verkauf | `quellen`, `sonstiges` |
| Angebot für Eduki | eigenes Dokument, nur für die Autorin, wird nicht mitverkauft | `eduki-angebot`, `unterrichtsplanung` |

Diese Dokumente zählen nicht zur gewünschten Zahl der Materialien. Sie entstehen zuletzt, wenn alle anderen ohne Fehler gebaut sind: Erst dann stehen Seitenzahlen, Inhalte und Quellen fest.

Im verkauften Material steht nichts aus der Klasse der Autorin: keine Angaben zur Lerngruppe aus dem Auftrag, kein Name einer Schule oder eines Kindes. Die Angaben zur Klasse steuern weiter Niveau und Hilfen, sie werden aber nicht genannt.

## 1. Deckblatt

Das Deckblatt ist ein fester Baustein in `blatt.css`. Die Farben kommen aus dem Thema der Reihe.

```html
<body class="kl2 farbe">
<section class="seite deckblatt" data-flaeche-ok>
  <div class="db-rahmen" data-rand-ok></div>
  <div class="db-klasse" data-ueberlagert-ok data-rand-ok><b>Klasse</b><span>2</span></div>
  <div class="db-marke" data-klein-ok>Name aus dem Auftrag</div>
  <h1 class="db-titel">Das Geheimnis der <span>Waldkasse</span></h1>
  <div class="db-unter">Unterrichtsreihe Geld: Euro und Cent</div>
  <div class="db-bild"><img src="../../bilder/titel.jpg" alt="…"></div>
  <div class="db-chips">
    <span class="db-chip">4 Stunden</span>
    <span class="db-chip" style="--c:var(--haupt)">12 Arbeitsblätter</span>
    <span class="db-chip" style="--c:#C4620A">3 Niveaus</span>
    <span class="db-chip" style="--c:#B5483A">mit Lösungen</span>
  </div>
  <div class="db-faecher" data-ueberlagert-ok data-rand-ok>
    <img class="db-blatt" src="../../bilder/v-kapitel-1-2.png" alt="">
    <img class="db-blatt" src="../../bilder/v-kapitel-1-3.png" alt="">
    <img class="db-blatt" src="../../bilder/v-kapitel-3-5.png" alt="">
    <img class="db-blatt" src="../../bilder/v-pruefung-1.png" alt="">
  </div>
  <img class="db-figur" data-rand-ok data-ueberlagert-ok src="bilder/willi.png" alt="Willi">
</section>
```

- **Titel:** der Titel der Geschichte oder des Materials, höchstens drei Zeilen. Ein Wort im `<span>` trägt die Hauptfarbe. Ist der Titel lang, die Schrift mit `style="--gr:54px"` verkleinern statt umzubrechen, wo es nicht passt.
- **Unterzeile:** die Wörter, die eine Lehrkraft in die Suche tippt: Art des Materials und Thema („Unterrichtsreihe Geld: Euro und Cent“), höchstens zwei Zeilen.
- **Marke:** der Name aus dem Auftrag („Name auf dem Deckblatt“). Nennt der Auftrag keinen, entfällt die Zeile. Kein Name von Eduki, kein Preis, kein Logo.
- **Klasse:** eine Zahl oder eine Spanne („1/2“). Jahrgangsgemischt: die Spanne.
- **Bild:** das stärkste Szenenbild der Reihe, bei einer Reihe das Titelbild. Ohne neue Bilder entfällt `db-bild`; dann steht die Leitfigur größer (`style="height:300px"` an `db-figur`) und der Fächer rückt nach oben.
- **Inhalt:** drei oder vier Schilder mit dem, was wirklich im Paket ist. Jede Zahl am fertigen Material nachzählen: Stunden, Seiten für Kinder, Niveaus, Lösungen, Lernzielkontrolle, Spiel. Keine Werbewörter („mega“, „toll“).
- **Seitenvorschau:** vier echte Seiten, jede von anderer Art (Fall-Karte, Arbeitsblatt, Spiel oder Plakat, Lernzielkontrolle). Keine Lösungsseite, keine Seite, die die Auflösung verrät. In der Schoolbox nennt `bauen` nach jedem Material die Bilder (`../../bilder/v-<slug>-<Seite>.png`). In der Claude-App die Seitenbilder aus `blatt.py bauen` nach `bilder/` der Mappe kopieren.
- **Figur:** die Leitfigur der Reihe unten rechts. Ohne Leitfigur entfällt sie.
- Das Deckblatt hat keine Namenszeile, keine Aufgabe und keine Lösung. Es ist nur im Profil `farbe` gedacht.

Nach dem Bauen das Seitenbild ansehen, einmal in voller Größe und einmal in Gedanken als Bild von 150 Pixeln Breite: Titel und Klasse müssen dann noch lesbar sein, nichts Wichtiges liegt unter Fächer oder Figur.

## 2. Handreichung

„Einführung und Überblick“ (`unterrichtsplanung/references/reihe-als-geschichte.md`, Abschnitt 2) richtet sich jetzt an eine Lehrkraft, die das Material zum ersten Mal sieht. Es bekommt kein eigenes Deckblatt mehr und beginnt mit dem Inhalt. Dazu kommen:

- **Inhalt des Pakets:** Tabelle mit jedem Dokument, was es ist und wie viele Seiten es hat.
- **Lernziele:** die Ich-kann-Ziele der Reihe, jedes mit dem Satz, woran man es am Kind erkennt („legt 65 ct mit höchstens vier Münzen“). Eduki bewertet nur, was im Material steht, nicht die Beschreibung im Shop.
- **So setzt du das Material ein:** Ablauf einer Stunde in Schritten, Zeitbedarf, Sozialform. In jeder Stunde steht eine Phase, in der Kinder aufeinander angewiesen sind (Partnerkontrolle mit getauschten Blättern, gemeinsames Beweis-Rätsel mit verteilten Rollen), und eine Frage für die Reflexion.
- **Vorbereiten und drucken:** was vor der ersten Stunde zu tun ist; welche Seiten wie oft kopiert werden; A4, „tatsächliche Größe“; was laminiert oder geschnitten wird; welches Material aus dem Klassenzimmer gebraucht wird.
- **Differenzierung:** was die drei Niveaus unterscheidet und wie Kinder ihr Niveau wählen.
- **Warum so:** zwei bis drei Sätze zur Methode (Geschichte als Rahmen, Beispiel vor der Aufgabe, Selbsteinschätzung).
- **Bezug zum Lehrplan:** der Kompetenzbereich in Worten, die in jedem Bundesland gelten (Bildungsstandards der KMK), dazu der Bildungsplan Baden-Württemberg.

Prüffragen nach den Qualitätsmerkmalen von Eduki:

- [ ] Strukturiert: messbare Ziele im Material, klarer Aufbau, Aufgaben zur Überprüfung
- [ ] Differenziert: Hilfen und Erweiterung auf jeder Stufe
- [ ] Aktivierend: mehrere Aufgabenformate, nicht nur Wiedergeben
- [ ] Alltagsnah und inklusiv: Lebenswelt der Kinder, vielfältige Namen, keine Rollenklischees
- [ ] Praxisnah: ohne weitere Vorbereitung einsetzbar, Lösungen dabei
- [ ] Kooperativ: eine echte gemeinsame Aufgabe je Stunde
- [ ] Unterstützt die Lehrkraft: Hinweise zur Durchführung, typische Fehler, Reflexion

## 3. Quellenverzeichnis

Eduki verlangt für jedes Bild, jede Schrift, jeden Text und jedes Werkzeug eine Quelle, bei fremden Inhalten mit Link, bei eigenen „selbst erstellt“. Was mit KI entstand, muss im Material stehen, und zwar mit dem Namen des Werkzeugs: „mit KI-Unterstützung“ lehnt Eduki ab und schickt das Material zurück. Das Quellenverzeichnis ist eine Seite mit Titel „Quellen und Nutzung“, einer `kit-tabelle` (Was, Quelle) und dem Nutzungshinweis. Die Schrift darf klein sein (`data-klein-ok` an der Tabelle). Links stehen als ausgeschriebener Text, nicht als `<a>`.

Nur nennen, was die Reihe wirklich verwendet. Die Quellen der Teile, die mit den Skills kommen, wörtlich:

| Was | Quelle |
|---|---|
| Texte, Aufgaben, Rätsel, Lösungen | Selbst erstellt mit Claude (Anthropic), von der Autorin geprüft und überarbeitet |
| Gestaltung der Seiten | Selbst erstellt mit Claude (Anthropic), von der Autorin geprüft |
| Szenenbilder, Titelbild und neue Bilder aus Canva | Selbst erstellt mit dem KI-Bildgenerator von Canva |
| Willi und Wilma Waschbär, Wachstumsgrafik | Selbst erstellt mit dem KI-Bildgenerator von Canva, teils nachbearbeitet |
| Rechen- und Sachabbildungen aus `x-…`-Elementen und eigenes SVG (Münzen, Uhren, Zahlenstrahl, Formen, Tabellen) | Per Programmcode gezeichnet (Code selbst erstellt mit Claude), kein KI-Bildgenerator |
| Schrift im Text | Andika von SIL International, https://software.sil.org/andika/, SIL Open Font License 1.1, https://openfontlicense.org |
| Schrift der Titel | Fredoka von The Fredoka Project Authors, https://fonts.google.com/specimen/Fredoka, SIL Open Font License 1.1 |
| Schreibschrift (`schrift="va"`) | Playwrite DE VA von The Playwrite Project Authors (TypeTogether), https://fonts.google.com/specimen/Playwrite+DE+VA, SIL Open Font License 1.1 |
| Notenzeichen (`x-noten`, `x-rhythmus`) | Bravura von Steinberg Media Technologies GmbH, https://github.com/steinbergmedia/bravura, SIL Open Font License 1.1 |
| Verkehrszeichen | Amtliche Werke, gemeinfrei (§ 5 UrhG), über Wikimedia Commons; je Zeichen der Link aus `assets/bilder/verkehrszeichen/QUELLEN.md` |

„Autorin“ oder „Autor“ nach dem Namen im Auftrag; ohne Namen „von mir“. Zu den Zeilen von Claude und Canva gehört bei Eduki der Hinweis, nach welchen Bedingungen der Verkauf erlaubt ist. Er hängt vom Konto ab, deshalb schreibst du ihn nur, wenn der Auftrag ihn nennt; sonst steht er als offener Punkt im Angebot (Abschnitt 4).

Ein Bild, dessen Herkunft du nicht kennst (aus der Bildersammlung der Mappe, ohne Eintrag in `canva-ids.tsv`), bekommt die Zeile „Quelle bitte ergänzen: <Datei>“ und steht in deiner Antwort am Ende. Nichts erfinden.

Unter der Tabelle der Nutzungshinweis, wörtlich:

> Dieses Material ist für deinen eigenen Unterricht. Du darfst es für deine Schülerinnen und Schüler kopieren und an sie weitergeben. Die Weitergabe an andere Lehrkräfte, das Hochladen im Internet und der Verkauf sind nicht erlaubt.

Ganz unten, wenn der Auftrag einen Namen nennt: „© <Name>“ mit dem Jahr.

## 4. Angebot für Eduki

Ein Dokument nur für die Autorin, als `kit-tabelle` mit den Feldern, die Eduki beim Hochladen abfragt, zum Hineinkopieren. Oben steht groß: „Nur für dich. Nicht mit hochladen.“

| Feld | Inhalt |
|---|---|
| Titel | 32 bis 42 Zeichen (so zeigt Eduki ihn als „ideal“): Thema und Klasse in den Wörtern der Suche, dann der Name der Reihe: „Sachaufgaben Kl. 3/4: Die Detektiv-Reihe“. Die Zeichen zählen und die Zahl dazuschreiben |
| Beschreibung | Zuerst zwei, drei Sätze aus der Geschichte, die neugierig machen, ohne die Auflösung. Dann, was die Kinder lernen und wie eine Stunde läuft. Dann „Das steckt drin (N Seiten):“ als Liste mit echten Zahlen. Zuletzt, für welche Klasse es passt und was vorzubereiten ist. Im Ton einer Kollegin, ohne Werbewörter |
| Wörter, die Eduki fälschlich als Marke meldet | „Geld“, „Lied“ und „Memo“ in der Beschreibung umschreiben („Euro und Cent“, „Song“, „Paarspiel“) |
| Schlagwörter | 12 bis 20 für die Suche: Thema, Teilthemen, Methode, Materialart, Zahlenraum |
| Tags | drei bis vier; sie sind nur Filter auf der Seite der Autorin, z. B. „unterrichtsreihe“ und das Thema |
| Schulart, Klassenstufe | Grundschule; höchstens zwei Klassenstufen. Passt es für mehr, steht die Spanne im Titel |
| Materialtyp | höchstens drei, in den Worten von Eduki: Unterrichtseinheit, Arbeitsblätter, Stundenentwürfe, Test, Spiele, Poster, Bildkarten, Aufgabenkarten, Stationenlernen |
| Fach und Thema | Fach und das Themengebiet, wie es im Baum von Eduki heißen könnte („Mathematik → Größen → Geld“) |
| Umfang | Seitenzahl aller Dokumente zusammen, A4, Farbe; ob die Arbeitsblätter schwarz-weiß kopierbar sind |
| Datei | ein PDF aus allen Dokumenten in dieser Reihenfolge: Deckblatt, Handreichung, Kapitel, Material, Lösungen, Quellen. Eduki nimmt Seite 1 als Cover |
| Vorschau | welche Seiten offen bleiben (Deckblatt, Inhalt des Pakets, ein Kapitel ganz) und ab welcher Seite unscharf, meist ab Seite 10 oder 11 |
| Lösungsschlüssel | „an“, wenn Lösungen dabei sind |
| Quellen: Texte | die Zeile „Texte“ aus dem Quellenverzeichnis |
| Quellen: Bilder | die Zeilen zu Canva und zu den gezeichneten Abbildungen in einem Satz. Ohne Link: Eduki ordnet eine Quelle mit bekanntem Link einem älteren Eintrag zu und zeigt dann dessen Text |
| Quellen: Schrift | „Google Fonts: Fredoka und Andika (SIL Open Font License)“, dazu weitere verwendete Schriften |
| Quellen: Sonstiges | die Zeile „Gestaltung der Seiten“ |
| Erklärung zu KI | „Ja“; ankreuzen: KI-generierter Text; KI-Bilder – nicht realistisch (wenn Bilder aus Canva oder die Leitfiguren vorkommen); Sonstige KI-Inhalte. **Nie** „vollständig mit KI erstellt“: Die Autorin plant, prüft und überarbeitet |

Darunter „Vor dem Hochladen“ als Liste zum Abhaken:

- Jede Seite gelesen und jede Lösung nachgerechnet.
- Das Material im eigenen Unterricht erprobt.
- Der Zugang zu Claude erlaubt den Verkauf. Dann in den Quellen ergänzen, nach welchen Bedingungen („kommerzielle Nutzung erlaubt laut …“).
- Das Canva-Konto erlaubt den Verkauf; mit „Canva für Bildung“ ist er nicht erlaubt. Dann ergänzen: „(kommerzielle Nutzung erlaubt laut Canva AI Product Terms)“.
- Jede Zeile „Quelle bitte ergänzen“ im Quellenverzeichnis ersetzt.
- Alle Dokumente als PDF aus der Schoolbox geholt, in Farbe, und zu einer Datei zusammengefügt.

Einen Preis schlägst du nicht vor.

## 5. Gestaltung, die sich verkauft

Die Reihe folgt `unterrichtsplanung/references/reihe-als-geschichte.md` und dem Muster `assets/beispiel-reihe-kapitel.html`. Für den Verkauf kommt dazu:

- **Posen der Figuren:** Vor dem ersten Kapitel entstehen drei bis vier Posen der Leitfiguren im Kostüm der Geschichte (mit Lupe, schreibt ins Notizbuch, zeigt, staunt, jubelt), jede freigestellt und zweimal: farbig als `<figur>-<pose>.png` und als Strichzeichnung im selben Format als `<figur>-<pose>-strich.png`. Die Strichfassung druckt in s/w von selbst. Jede Niveau-Seite zeigt im Tipp die Pose, die zu ihrem Tipp passt; auf zwei Seiten hintereinander steht nie dieselbe. Erlaubt der Auftrag keine neuen Bilder, bleibt es bei den vorhandenen Figuren.
- **Wer dahintersteckt, bekommt ein Gesicht:** Die Figur aus der Auflösung hat ein eigenes Bild, das erst im letzten Kapitel und auf der Urkunde vorkommt.
- **Requisiten in Farbe:** Ausweis oder Pass, Sammelkarte, Plakat mit dem Merkwissen der Reihe und Urkunde sind farbige Seiten mit Seitenfläche, Rahmen, Schmuckschrift und Streuung (`references/gestaltung.md`, Muster `assets/beispiel-deckblatt-formen.html`). Die Arbeitsblätter bleiben Kopiervorlagen, die in s/w gut aussehen: Rahmen, Kapitel-Marke, Symbol, Strichfigur.
- **Fußzeile mit Namen:** „Titel der Reihe · Kapitel 2 · Name aus dem Auftrag“ auf jeder Seite, auch auf Requisiten und Lösungen. Auf Bögen mit Karten zum Schneiden blendet das Kit sie aus.
- **Eine Reihe, ein Bild:** dieselben zwei Farben, dieselbe Marke und derselbe Rahmen vom Deckblatt bis zur Urkunde.

**Gestaltungs-Durchgang am Ende:** Sind alle Dokumente gebaut, sieh dir von jedem die Seitenbilder noch einmal an, diesmal wie eine Käuferin, die durch die Vorschau blättert. Je Seitenart eine Frage:

- [ ] Fall-Karte: Füllt das Bild die Breite, steht die Marke im Bild, passt der Text ohne Lücke bis zur Frage?
- [ ] Lehrkraft-Seite: Findet man in zehn Sekunden Ziel, Material, Ablauf und Lösung des Beweis-Rätsels?
- [ ] Niveau-Seite: Rahmen, Marke, Symbole und Figur da? Sieht man die eigene Idee des Kapitels auf den ersten Blick, oder wirkt die Seite wie ein beliebiges Übungsblatt?
- [ ] Requisiten: Würde ein Kind sie gern behalten?
- [ ] Alle Seiten nebeneinander: Sieht man, dass sie zusammengehören?

Jede Seite, die eine Frage nicht besteht, bekommt eine Runde Nacharbeit; danach gilt sie.

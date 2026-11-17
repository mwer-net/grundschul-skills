# Druck und Platz

Material wird in Farbe angelegt, s/w ist eine Ansicht davon; die Regel dazu steht in `gestaltung.md` (Abschnitt „Farbe“). Dieser Text regelt, wie Farbe sparsam eingesetzt wird und wie der Platz genutzt wird.

**Immer gilt das kompakte Layout** (Abschnitt 4): Aufgaben ohne Kasten, schlanker Kopf und Fuß, volle Item-Reihen. Farbe macht ein Blatt ansprechend, Kästen mit Innenabstand kosten nur Platz.

## 1. Warum

- **Toner:** Flächen und mittlere Töne kosten am meisten. Auch Pastellflächen druckt ein Laser als Punktraster über die ganze Fläche; auf dem Probeblatt Uhrzeit bedeckten sie 55 % der Seite und kosteten fast eine halbe Textseite Toner zusätzlich.
- **Kopierer:** Helle Flächen werden fleckig oder fallen weg, sehr helle Linien verschwinden. Jede Kopie einer Kopie und jede Verkleinerung (A4 → A5 halbiert die Linienstärke) verliert weiter.
- **Graustufen:** Farben gleicher Helligkeit werden zum selben Grau. Farbcodes gehen verloren, farbige Schrift wird kontrastarm.
- **Kästen:** Jeder Kasten kostet Innenabstand, bei vier Aufgaben schnell 150–200 px, also eine ganze Aufgabe. Weißraum und Nähe ordnen ebenso klar; viele Rahmen machen das Blatt unruhig (Gestaltgesetze).
- **Emotional Design:** Farbe, runde Formen und Figur an lernrelevanten Elementen motivieren (`kindgerecht-gestalten.md`). Stark dekorierte Umgebungen lenken junge Kinder dagegen ab (Fisher, Godwin & Seltman 2014). Darum Farbe gezielt an Nummern, Überschrift, Figur und Lernobjekt, nie als Fläche oder Deko.

## 2. Damit es auch in s/w taugt

Die s/w-Ansicht rechnet alles um: helle bunte Flächen werden weiß, Text und Linien behalten ihre Helligkeit. Beim Anlegen zählt nur:

1. **Linien nicht heller als `#808080`** in Grau gerechnet, mindestens 1,5 px (≈ 1 pt), sonst fallen sie beim Kopieren weg. Die Nachspurvorlage in `x-lineatur` ist bewusst grau.
2. **Unterschiede nicht nur über Farbe** (`gestaltung.md`): fett oder normal, durchgezogen oder gestrichelt, gefüllt oder leer, Symbol, Buchstabe, Beschriftung. Die Abbildungen (`x-…`) bringen das selbst mit.
3. **Bilder zum Anmalen** als `name-strich.png` neben `name.png`: Die s/w-Ausgabe nimmt sie von selbst.
4. **Prüfen:** `blatt.py bauen --profil sw` und die s/w-Hinweise im Bericht ansehen (`kontrast-sw`, `farbwort-sw`, `bild-kontrast-sw`). Sie sind Hinweise, keine Sperre.

## 3. Farbe als Akzent

Farbe ist **Akzent**, das Layout bleibt kompakt:

1. **Weißer Seitenhintergrund**, kein Hintergrundbild, **keine Farbflächen hinter Aufgaben, Kopf oder Fuß**, keine Aufgabenkästen.
2. **Eine Palette** (Hauptfarbe + Akzent, Tabelle in `kindgerecht-gestalten.md`). Farbe bekommen:
   - Nummernkreise: gefüllt in der dunklen Variante der Hauptfarbe, weiße fette Ziffer,
   - Überschrift in der dunklen Variante der Hauptfarbe (Kontrast zu Weiß ≥ 3:1, Spalte in der Palettentabelle),
   - Kontur der Tipp-Sprechblase, Unterstreichung im Beispiel in der Akzentfarbe,
   - Willi oder Wilma, Wachstumsgrafik und Abbildungen in der farbigen Version,
   - Farbcodes der Klasse (Wortarten, Stellenwerte, Wendeplättchen) direkt farbig.
3. **Text bleibt schwarz** (`#1D1D1B`). Farbige Schrift nur für die Überschrift und kurze Hervorhebungen, nie für Anweisungen oder Fließtext. Einzige Ausnahme: Silbenfarben aus `x-silben`, wenn die Klasse damit arbeitet (Kontrast mindestens 4,5:1).
4. **Kleine Tönungen nur mit Funktion:** Füllung der Tipp-Sprechblase oder eines Wortspeichers in sehr hellem Ton (Helligkeit ≥ 90 %) ist erlaubt; ganze Aufgaben werden nicht hinterlegt.
5. **Lösungsblatt:** Lösungen fett, unterstrichen und in der Akzentfarbe.
6. **Prüfen:** `blatt.py bauen` (meldet Flächen hinter Aufgaben) und Vorschau ansehen: Farbe nur als Akzent.

**Präsentation/Whiteboard:** Farbe uneingeschränkt nach diesem Abschnitt, aber auch hier keine vollflächigen Bilder hinter Text. **Plakat und laminierte Karten:** Kartenrahmen dürfen farbig sein, weil sie Karten unterscheiden (Funktion).

## 4. Übersichtlich und platzsparend gestalten (beide Profile)

Ziel: **Übersicht und genug zu tun.** Ein Kind muss jede Aufgabe auf einen Blick verstehen: was zu tun ist, wo es schreibt, wie das Beispiel geht. Und das Blatt muss die Arbeitszeit tragen, für die es gedacht ist (Abschnitt „Menge nach Arbeitszeit“). Übersicht entsteht durch Ordnung: gleiche Abstände, eine Handlung je Aufgabe, ein Beispiel, klare Reihen. Sie entsteht nicht durch leere Fläche und nicht durch große Schrift. Maß ist die Schulbuchseite der Klasse: Lesetext in Buchgröße, vier bis sechs Aufgaben je Seite, viele Items in Reihen. Gespart wird an Rahmen, Innenabständen, Kopf, Fuß, Deko und an Wörtern in der Anweisung, nie an der Schreibfläche oder am Beispiel.

### Aufbau einer Aufgabe ohne Kasten

```
 ❶  Lies die Uhrzeit. Schreibe sie auf.                         ●
     ◷      ◷      ◷      ◷      ◷      ◷
    ____   ____   ____   ____   ____   ____
 ─────────────────────────────────────────────── (optional, 1 px grau)
 ❷  Zeichne die Zeiger ein.                                     ●●
```

- **Hängende Nummer:** Nummernkreis (in der Hauptfarbe, wenig höher als die Schrift) links, die Anweisung in normaler Stärke rechts daneben, die Arbeitsfläche beginnt bündig unter der Anweisung. Fett ist auf der Seite nur, was das Kind suchen soll: Nummer, Überschrift, Lösung. Die Nummer markiert den Aufgabenbeginn, ein Kasten ist nicht nötig.
- **Niveau-Punkte** (falls gewählt): Hat jedes Niveau seine eigene Seite, stehen sie einmal in der Namenszeile (`<span class="niveau">`); teilen sich die Niveaus eine Seite, rechtsbündig in der Anweisungszeile. Die Sternchenaufgabe trägt ★ an der Stelle der Nummer.
- **Trennung durch Abstand:** zwischen Aufgaben wie in der Tabelle „Schrift und Abstand je Klasse“, wenig zwischen Anweisung und Arbeitsfläche. `blatt.css` setzt beides; einheitlich im ganzen Material.
- **Rahmen nur mit Funktion:** Wortspeicher, Merkkasten (`.kasten` mit dem Merksatz der Stunde), Heft-Beispiel („Im Heft:“ mit dem Anfang des Eintrags, wie im Schulbuch), Tipp-Sprechblase der Leitfigur, Ergebnis- oder Antwortkästchen, Ausschneideteile (gestrichelt), Lösungsstreifen. Rahmen dann als dünne Kontur ohne Füllung, Ecken gerundet.

### Kopf und Fuß schlank

- **Kopf** in einer Zeile wie im Schulbuch: Überschrift links, Name und Datum rechts, darunter das Ich-kann-Ziel in einer Zeile; zusammen ca. 70 px. Im HTML bleibt die Namenszeile vor dem Kopf, `blatt.css` stellt sie neben die Überschrift. `blatt.py` meldet einen Kopf ab 210 px. Eine Wahlhilfe braucht nur ein Blatt, auf dem sich die Niveaus eine Seite teilen. Auf einer Folgeseite (`data-weiter`) entfällt der Kopf.
- **Tipp der Leitfigur** im Körper der Aufgabe, zu der er gehört, über ihrer Item-Reihe (Muster: `html-materialerstellung/assets/vorlage-arbeitsblatt.html`). Nicht im Kopf, nie mitten in einer Item-Reihe.
- **Fuß** (nur wenn Selbsteinschätzung gewählt, sonst entfällt er und der Platz geht an Aufgaben) als schmaler Streifen von ca. 95 px; `blatt.py` meldet ihn ab 150 px. Links der Ich-kann-Satz mit „So gut kann ich das schon. Kreuze an:“, rechts die Wachstumsgrafik mit vier Kreisen zum Ankreuzen darunter (Baustein `.wachstum` in der Vorlage), darunter die Reflexionsfrage mit Ankreuzfeldern. Abgegrenzt durch eine Linie, nicht durch eine Fläche. Nie „Male an“ ohne Kreise: Die Pflanzen sind schon farbig, das Kind wüsste nicht, was es anmalen soll.

### Aufgaben auf einen Blick verständlich

- **Eine Handlung pro Aufgabe.** Die Anweisung besteht aus kurzen Sätzen: in Kl. 1/2 höchstens ca. 10 Wörter je Satz und höchstens zwei Sätze, die sagen, was zu tun ist; in einer Reihe darf ein Satz Geschichte davorstehen. Ein Verb je Satz, in der Reihenfolge des Tuns („Falte das Blatt. Schneide dann aus.“, nicht „Schneide aus“ über Schritt 1 „Falten“). Fachwörter und Material heißen überall gleich und so, wie sie im Wortspeicher stehen. Braucht die Aufgabe mehrere Schritte, zeigt das Beispiel jeden Schritt. Das gilt auch für die Muster in `html-materialerstellung/assets/`.
- **Eine Darstellungsform pro Aufgabe** (z. B. nur Punktefeld, nur Stellenwerttafel). Zwei Formen nebeneinander (Bild + Tafel + Gleichung in einer Reihe) nur in Kl. 3/4.
- **Das vorgelöste Beispiel ist so groß wie ein Item** und hat denselben Abstand zu den Nachbarn wie jedes andere Item. Es wird nie verkleinert oder zwischen andere Elemente gequetscht; Ziffern, Einheiten und Gleichheitszeichen mit normalem Wortabstand.
- **Abbildungen exakt und ruhig:** Mengen geordnet statt gestreut (Punkte in Zweierreihen/Fünferstruktur, Zehnerstangen, Zwanzigerfeld), Bündel umschließen genau ihre Elemente ohne Überschneidung, Anzahlen stimmen. Solche Abbildungen berechnen und als Vektor setzen, nie frei zeichnen (`html-materialerstellung/assets/abbildungen.js`).

### Items pro Aufgabe

- Items gleichmäßig über die Spaltenbreite (A4: 794 − 120 = 674 px) verteilen (`.reihe` mit `--spalten`), damit die Zuordnung Item → Antwortlinie klar bleibt.
- Reihen füllen: so viele Items nebeneinander, wie bei den Mindestgrößen unten Platz haben, und so viele Reihen, wie das Zeitziel verlangt. Kl. 1 meist 4–5 Items je Reihe, ab Kl. 2 sechs kleine Abbildungen, vier mit Antwortlinie darunter oder drei Spalten Rechenzeilen.
- **Schrift und Abstand je Klasse** (aus `blatt.css`):

<!-- erzeugt: schrift-und-abstand -->
| Klasse | Schrift | Abstand zwischen Aufgaben | Zeilenhöhe | Ältere Blätter (ohne `data-satz`) |
|---|---|---|---|---|
| Kl. 1 | 19 px (14 pt) | 20 px | 1,35 | 28 px, Abstand 36 px |
| Kl. 2 | 16 px (12 pt) | 16 px | 1,3 | 24 px, Abstand 28 px; mit `data-zeit` 21 px, Abstand 24 px |
| Kl. 3 | 15 px (11 pt) | 16 px | 1,3 | 20 px, Abstand 28 px; mit `data-zeit` 19 px, Abstand 24 px |
| Kl. 4 | 15 px (11 pt) | 16 px | 1,3 | 18 px, Abstand 24 px; mit `data-zeit` 16 px |
<!-- /erzeugt: schrift-und-abstand -->

Lücken müssen breit genug sein, damit Kinder der Klasse darin schreiben können. Mindestbreite einer Lücke:

<!-- erzeugt: luecken-breite -->
| Klasse | Lücke mindestens |
|---|---|
| Kl. 1 | 30 mm |
| Kl. 2 | 26 mm |
| Kl. 3 | 22 mm |
| Kl. 4 | 18 mm |
<!-- /erzeugt: luecken-breite -->

- **Mindestgrößen** (Richtwerte, für Kinderhände nicht unterschreiten; sie gelten unabhängig von der Schriftgröße):

| Element | Kl. 1 | Kl. 2 | Kl. 3/4 |
|---|---|---|---|
| Uhr zum Ablesen | 100 px (2,6 cm) | 84 px (2,2 cm) | 76 px (2 cm) |
| Uhr zum Zeiger-Einzeichnen | 120 px (3,2 cm) | 84 px (2,2 cm) | 84 px (2,2 cm) |
| Antwortlinie für eine Zahl/Uhrzeit | 100 px | 88 px | 80 px |
| Zeilenhöhe Schreiblinie (`x-lineatur`, Maße in `gestaltung.md`) | Lineatur 1 | Lineatur 2 | Lineatur 3/4 |
| Ankreuz-/Ergebniskästchen | 22 px | 18 px | 17 px |
| Wortart-Symbol, Satzglied-Kästchen | folgt der Schriftgröße, nicht verkleinern | ebenso | ebenso |
| Glücksrad zum Ablesen | 180 px | 160 px | 140 px |
| Würfel | 60 px | 52 px | 44 px |
| Strichliste, Zeilenhöhe | 38 px | 34 px | 30 px |
| Gitter, Kästchen (wie im Rechenheft) | 0,7 cm | 0,5 cm | 0,5 cm |
| Figur | 120 px | 100 px | 80 px |
| Hunderterfeld, Feld | 22 px | 18 px | 14 px |
| Hundertertafel, Feld | 32 px | 28 px | 24 px |
| Rechenrahmen, Kugel | 18 px | 16 px | 10 px |
| Zahlenmauer, Stein | 44 px | 40 px | 38 px |
| Rechendreieck | 220 px | 200 px | 180 px |
| Rechenrad | 240 px | 220 px | 200 px |
| Geld, Maßstab | 0,5 | 0,5 | 0,3 |
| Messbecher, Thermometer, Länge | 180 px | 170 px | 150 px |
| Waage, Durchmesser | 240 px | 200 px | 170 px |
| Kalender, Monat | 44 px je Tag | 44 px je Tag | 44 px je Tag |
| Punktfeld, Punktabstand | 24 px | 20 px | 16 px |
| Malkreuz, Feld | 34 px hoch | 34 px hoch | 34 px hoch |
| Schriftliche Rechnung, Kästchen | 0,7 cm | 0,5 cm | 0,5 cm |
| Würfelgebäude, Würfelkante | 30 px | 26 px | 22 px |
| Würfelnetz, Kästchen | 34 px | 30 px | 20 px |
| Bastelwürfel, Kante | 4 cm | 4 cm | 3 cm |
| Diagramm, Höhe der Skala | 180 px | 160 px | 120 px |

### Menge nach Arbeitszeit

Ein Blatt ist dann richtig gefüllt, wenn ein Kind des Niveaus daran so lange arbeitet, wie die Lehrkraft es braucht. Maß ist das **Zeitziel** in Minuten: Die Lehrkraft nennt es (Start-Abfrage, Assistent der Schoolbox); nennt sie keins, gelten **20 Minuten**. Es ist die reine Arbeitszeit eines Kindes an seinem Niveau, ohne Einführung und Besprechung.

**So wird geplant:**

1. **Jedes Niveau bekommt seine eigene Seite** mit dem ganzen Zeitziel: Seite ●, Seite ●●, Seite ●●●, die Punkte stehen in der Namenszeile. Die Lehrkraft kopiert je Kind die passende Seite, oder das Kind wählt. Teilen sich drei Niveaus eine Seite, arbeitet jedes Kind nur ein Drittel davon und ist nach wenigen Minuten fertig; das ist nur richtig, wenn die Lehrkraft es ausdrücklich so wünscht („alle Niveaus auf einem Blatt“) oder das Zeitziel bei höchstens 10 Minuten liegt.
2. **Jede Aufgabe bekommt eine Minutenangabe** aus dem Zeitmodell unten. Die Summe je Niveau erreicht das Zeitziel (höchstens 15 % darunter, bis 25 % darüber). Die Sternchenaufgabe zählt nicht mit, sie ist Reserve für schnelle Kinder.
3. **Reicht eine Seite nicht für das Zeitziel, geht es auf der Rückseite weiter** (`<section class="seite" data-weiter>`, ohne Kopf). Vorder- und Rückseite sind ein Blatt Papier. Bei 20 Minuten trägt ab Kl. 2 meist eine Seite; in Kl. 1 und bei längeren Zeitzielen geht es auf der Rückseite weiter.
4. **Die Seite ist gefüllt wie im Schulbuch.** Eine Arbeitsseite trägt mindestens vier Aufgaben und zwölf Teilaufgaben (Antworten, Lücken, Zeilen); sonst meldet `blatt.py` `inhalt-wenig`. Bleibt unten Platz, kommt ein Item, eine Reihe oder eine Aufgabe dazu, in jeder Klasse. Nie mit Leerraum, größerer Schrift oder Deko füllen. Trägt eine Seite mit Absicht wenig (Forscherbogen, Bastelvorlage, freie Schreibseite), steht `data-dicht-ok` an ihrer `<section class="seite">`.
5. **Mehr Zeit kommt aus mehr Denk- und Schreibarbeit, nicht aus mehr vom Gleichen.** Nach 6–8 gleichen Items wechselt das Format: erst ablesen, dann selbst eintragen, dann anwenden, dann erklären oder selbst eine Aufgabe erfinden. So üben die Kinder dasselbe Ziel auf mehreren Wegen und bleiben dran. Dazu gehören Aufgaben mit Material („Lege mit Plättchen. Zeichne dann.“), zu zweit („Zu zweit: …“) und fürs Heft („Zeichne ins Heft.“ mit Heft-Beispiel); das Heft ist normale Arbeit, nicht nur die Sternchenaufgabe. Wie die Anforderungsbereiche verteilt sind: `differenzierung.md`, „Anforderungsbereiche auf jedem Arbeitsblatt“.

**Im HTML** steht am `<body>` `data-satz="2"` (gesetzt wie ein Schulbuch; ohne die Angabe gilt der ältere, große Satz) und das Zeitziel (`data-zeit="20"`), die Minuten an jeder Aufgabe (`<div class="aufgabe" data-min="5">`). `blatt.py` rechnet je Niveau nach und meldet `zeit-knapp`, `zeit-fehlt`, `inhalt-wenig`, einen zu hohen Kopf oder Fuß und freien Platz. Geprüftes Muster: `html-materialerstellung/assets/beispiel-niveaublatt-kl2.html`.

**Zeitmodell** (Richtwerte für ein Kind im mittleren Niveau, aus Unterrichtserfahrung; ● rechnet mit dem oberen, ●●● mit dem unteren Wert und bekommt dafür anspruchsvollere Items):

| Tätigkeit | Kl. 1 | Kl. 2 | Kl. 3 | Kl. 4 |
|---|---|---|---|---|
| Anweisung lesen und Beispiel ansehen, je Aufgabe | 1 min | 45 s | 30 s | 30 s |
| Kurze Antwort (Zahl, Wort, Kreuz, Verbindung), je Item | 30 s | 20–25 s | 15–20 s | 10–15 s |
| Kopfrechnung mit Ergebnis, je Item | 30–40 s | 20–30 s | 15–20 s | 10–15 s |
| Schriftliche Rechnung, je Item | – | 60–90 s | 60–90 s | 45–75 s |
| Zahlenmauer, Rechendreieck, Malkreuz, je Stück | 2 min | 1,5–2 min | 1–1,5 min | 1 min |
| Ablesen und eintragen (Uhr, Skala, Diagramm), je Item | 40–50 s | 30–40 s | 20–30 s | 20 s |
| Einzeichnen oder messen (Zeiger, Strecke, Form), je Item | 1,5–2 min | 1–1,5 min | 1 min | 45 s |
| Ein Wort abschreiben | 40–60 s | 30 s | 20 s | 15 s |
| Einen eigenen Satz schreiben | 2–3 min | 1,5–2 min | 1–1,5 min | 1 min |
| Eine Zeile in der Lineatur nachspuren und weiterschreiben | 2–3 min | 2 min | – | – |
| Lesen, je 50 Wörter | 2–3 min | 1–1,5 min | 45 s | 30 s |
| Ausmalen nach Regel, je Feld | 20–30 s | 15–20 s | 10–15 s | 10 s |
| Offene Aufgabe (erklären, erfinden, begründen) | 4–6 min | 4–6 min | 5–8 min | 5–8 min |

Daraus folgt, wie viel auf ein Blatt gehört. Für 20 Minuten sind das etwa:

| Klasse | Aufgaben je Niveau | Arbeitsplätze (Items, Lücken, Zeilen) je Niveau | Seiten je Niveau |
|---|---|---|---|
| 1 | 4–6 | 20–30 | 1–2 |
| 2 | 5–7 | 25–40 | 1 |
| 3 | 5–7 | 35–50 | 1 |
| 4 | 6–8 | 40–60 | 1 |

Für ein anderes Zeitziel im selben Verhältnis rechnen. Ein Blatt mit drei Aufgaben zu je vier Items ist in jeder Klasse nach fünf Minuten fertig.

Passt der Inhalt nicht auf die Seite: erst die Anweisungen kürzen und die Reihen füllen (mehr Spalten), dann geht er auf die Rückseite. Schrift, Abstände und Schreibflächen aus `blatt.css` werden nie von Hand verkleinert. Für Kinder mit Konzentrationsschwierigkeiten dieselben Aufgaben auf mehr Seiten verteilen (weniger pro Seite) und je Aufgabe ein Abhak-Kästchen setzen (`differenzierung.md`).

### Platzbudget (A4, Satzspiegel 1036 px)

| Bereich | Höhe |
|---|---|
| Kopf | ca. 70 px, höchstens 210 px; auf Folgeseiten keiner |
| Aufgaben inkl. Abstände | Rest, ca. 860–950 px, auf Folgeseiten bis 1030 px |
| Fuß | ca. 95 px, höchstens 150 px; nur auf der letzten Seite des Niveaus |

Bleiben unten mehr als ca. 90 px frei, meldet `blatt.py` das; dann Item, Reihe oder Aufgabe ergänzen.


## 5. Checkliste

- [ ] Weißer Hintergrund, kein Hintergrundbild, keine Flächen hinter Aufgaben, Kopf oder Fuß
- [ ] Aufgaben ohne Kasten, mit hängender Nummer und einheitlichem Abstand
- [ ] Rahmen nur mit Funktion
- [ ] `data-satz="2"` am Body; Kopf in einer Zeile, Fuß ca. 95 px, Tipp im Körper seiner Aufgabe
- [ ] Zeitziel erreicht: `data-zeit` am Body, `data-min` an jeder Aufgabe, Summe je Niveau stimmt
- [ ] Jedes Niveau auf eigener Seite, jede Arbeitsseite mit mindestens vier Aufgaben und gefüllt, Formate wechseln
- [ ] Jede Aufgabe auf einen Blick verständlich, Beispiel nicht gequetscht
- [ ] Mindestgrößen eingehalten, keine ungenutzten Leerstreifen
- [ ] Keine Information nur über Farbe

- [ ] Eine Palette, Farbe nur an Nummern, Überschrift, Linien, Figur, Bildern und Farbcodes
- [ ] Fließtext und Anweisungen schwarz
- [ ] Graustufen-Vorschau noch lesbar; `blatt.py` ohne Warnungen

## Quellen

- ISO/IEC 19752 (Reichweite von Tonerkartuschen bei 5 % Flächendeckung); Erläuterung z. B. troygroup.com/blog/understanding-toner-ink-yield-and-5-page-coverage
- Graustufen-Umsetzung: Farben gleicher Leuchtdichte werden zum selben Grau (u. a. Grundland & Dodgson, Cambridge Tech Report UCAM-CL-TR-649)
- Kopierfähige Vorlagen: Linien nicht zu dünn, Grauwerte unterscheidbar, Verkleinerung auf 70 % halbiert die Linienstärke (LIT Verlag, Hinweise zur Papiervorlage)
- Gestaltgesetz der gemeinsamen Region vs. Nähe; zu viele Rahmen erzeugen Unruhe (lawsofux.com/law-of-common-region)
- Fisher, A. V., Godwin, K. E. & Seltman, H. (2014). Visual environment, attention allocation, and learning in young children. Psychological Science, 25(7).

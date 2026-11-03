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
   - Trennlinien zwischen Aufgaben, Kontur der Tipp-Sprechblase, Unterstreichung im Beispiel in der Akzentfarbe,
   - Willi oder Wilma, Wachstumsgrafik und Abbildungen in der farbigen Version,
   - Farbcodes der Klasse (Wortarten, Stellenwerte, Wendeplättchen) direkt farbig.
3. **Text bleibt schwarz** (`#1D1D1B`). Farbige Schrift nur für die Überschrift und kurze Hervorhebungen, nie für Anweisungen oder Fließtext. Einzige Ausnahme: Silbenfarben aus `x-silben`, wenn die Klasse damit arbeitet (Kontrast mindestens 4,5:1).
4. **Kleine Tönungen nur mit Funktion:** Füllung der Tipp-Sprechblase oder eines Wortspeichers in sehr hellem Ton (Helligkeit ≥ 90 %) ist erlaubt; ganze Aufgaben werden nicht hinterlegt.
5. **Lösungsblatt:** Lösungen fett, unterstrichen und in der Akzentfarbe.
6. **Prüfen:** `blatt.py bauen` (meldet Flächen hinter Aufgaben) und Vorschau ansehen: Farbe nur als Akzent.

**Präsentation/Whiteboard:** Farbe uneingeschränkt nach diesem Abschnitt, aber auch hier keine vollflächigen Bilder hinter Text. **Plakat und laminierte Karten:** Kartenrahmen dürfen farbig sein, weil sie Karten unterscheiden (Funktion).

## 4. Übersichtlich und platzsparend gestalten (beide Profile)

Ziel: **Übersicht vor Menge.** Ein Kind muss jede Aufgabe auf einen Blick verstehen: was zu tun ist, wo es schreibt, wie das Beispiel geht. Gespart wird an Rahmen, Innenabständen und Deko, nie an Schriftgröße, Schreibfläche, dem Beispiel oder der Luft zwischen Aufgaben. In Kl. 1/2 gilt: lieber weniger Items mit Luft als eine volle Seite; eine Seite, die ein Erwachsener „vollgepackt" findet, überfordert ein Zweitklasskind.

### Aufbau einer Aufgabe ohne Kasten

```
 ❶  Lies die Uhrzeit. Schreibe sie auf.                         ●
     ◷      ◷      ◷      ◷      ◷      ◷
    ____   ____   ____   ____   ____   ____
 ─────────────────────────────────────────────── (optional, 1 px grau)
 ❷  Zeichne die Zeiger ein.                                     ●●
```

- **Hängende Nummer:** Nummernkreis (32–36 px, in der Hauptfarbe) links, Anweisung 12–16 px rechts daneben, die Arbeitsfläche beginnt bündig unter der Anweisung. Die Nummer markiert den Aufgabenbeginn, ein Kasten ist nicht nötig.
- **Niveau-Punkte** (falls gewählt) rechtsbündig in der Anweisungszeile. Die Sternchenaufgabe trägt ★ an der Stelle der Nummer.
- **Trennung durch Abstand:** zwischen Aufgaben wie in der Tabelle unter „Mindestgrößen“ (nie weniger), 12–16 px zwischen Anweisung und Arbeitsfläche. Optional eine dünne Trennlinie (1–1,5 px; s/w `#808080`, Farbe in der Akzentfarbe) über die Spaltenbreite. Einheitlich im ganzen Material.
- **Rahmen nur mit Funktion:** Wortspeicher, Tipp-Sprechblase der Leitfigur, Ergebnis- oder Antwortkästchen, Ausschneideteile (gestrichelt), Lösungsstreifen. Rahmen dann als dünne Kontur ohne Füllung, Ecken gerundet.

### Kopf und Fuß schlank

- **Kopf** (Name/Datum, Überschrift, Ich-kann-Ziel, Wahlhilfe nur mit Niveaus) zusammen höchstens ca. 160 px. Ich-kann-Ziel und Wahlhilfe in einer Zeile oder zwei kurzen Zeilen.
- **Tipp der Leitfigur** neben der Aufgabe, zu der er gehört (am Ende ihrer Item-Reihe oder neben dem Beispiel); fehlt dort der Platz, rechts im Kopf mit Bezug („Zu 1: …"). Nie zwischen Anweisung und Arbeitsfläche, nie mitten in einer Item-Reihe.
- **Fuß** (nur wenn Selbsteinschätzung gewählt, sonst entfällt er und der Platz geht an Aufgaben) in einer Zeile bzw. einem schmalen Streifen (ca. 80–110 px): Ich-kann-Satz + Wachstumsgrafik zum Anmalen links/rechts, Reflexionsfrage mit Ankreuzfeldern darunter. Abgegrenzt durch eine Linie, nicht durch eine Fläche. Die Wachstumsgrafik passend zum Profil (farbig oder Strich-Version zum Anmalen).

### Aufgaben auf einen Blick verständlich

- **Eine Handlung pro Aufgabe**, Anweisung in einer Zeile (Kl. 1/2 höchstens ca. 10 Wörter, ein oder zwei kurze Sätze). Braucht die Aufgabe mehrere Schritte, zeigt das Beispiel jeden Schritt.
- **Eine Darstellungsform pro Aufgabe** (z. B. nur Punktefeld, nur Stellenwerttafel). Zwei Formen nebeneinander (Bild + Tafel + Gleichung in einer Reihe) nur in Kl. 3/4.
- **Das vorgelöste Beispiel ist so groß wie ein Item** und hat denselben Abstand zu den Nachbarn (24–32 px). Es wird nie verkleinert oder zwischen andere Elemente gequetscht; Ziffern, Einheiten und Gleichheitszeichen mit normalem Wortabstand.
- **Abbildungen exakt und ruhig:** Mengen geordnet statt gestreut (Punkte in Zweierreihen/Fünferstruktur, Zehnerstangen, Zwanzigerfeld), Bündel umschließen genau ihre Elemente ohne Überschneidung, Anzahlen stimmen. Solche Abbildungen berechnen und als Vektor setzen, nie frei zeichnen (`html-materialerstellung/assets/abbildungen.js`).

### Items pro Aufgabe

- Items gleichmäßig über die Spaltenbreite (A4: 794 − 120 = 674 px) verteilen, Abstand 24–32 px, damit die Zuordnung Item → Antwortlinie klar bleibt.
- Kl. 1/2: eine Reihe mit 3–4 Items je Aufgabe; kleine Items (Rechnungen, Zahlen) bis 6. Kl. 3/4: Reihen füllen, bei Übungsblättern gern 2 Reihen à 5–6 Items.
- **Schrift und Abstand je Klasse** (aus `blatt.css`):

<!-- erzeugt: schrift-und-abstand -->
| Klasse | Schrift | Abstand zwischen Aufgaben |
|---|---|---|
| Kl. 1 | 28 px | 36 px |
| Kl. 2 | 24 px | 28 px |
| Kl. 3 | 20 px | 28 px |
| Kl. 4 | 18 px | 24 px |
<!-- /erzeugt: schrift-und-abstand -->

- **Mindestgrößen** (Richtwerte, für Kinderhände nicht unterschreiten):

| Element | Kl. 1 | Kl. 2 | Kl. 3/4 |
|---|---|---|---|
| Uhr zum Ablesen | 100 px (2,6 cm) | 88 px (2,3 cm) | 80 px (2,1 cm) |
| Uhr zum Zeiger-Einzeichnen | 120 px (3,2 cm) | 100 px (2,6 cm) | 96 px (2,5 cm) |
| Antwortlinie für eine Zahl/Uhrzeit | 100 px | 88 px | 80 px |
| Zeilenhöhe Schreiblinie (`x-lineatur`, Maße in `gestaltung.md`) | Lineatur 1 | Lineatur 2 | Lineatur 3/4 |
| Ankreuz-/Ergebniskästchen | 28 px | 24 px | 22 px |
| Wortart-Symbol, Satzglied-Kästchen | folgt der Schriftgröße, nicht verkleinern | ebenso | ebenso |
| Glücksrad zum Ablesen | 180 px | 160 px | 140 px |
| Würfel | 60 px | 52 px | 44 px |
| Strichliste, Zeilenhöhe | 38 px | 34 px | 30 px |
| Gitter, Kästchen | 1 cm | 1 cm | 0,5 cm |
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

### Richtwerte pro A4-Seite

| Klasse | Aufgaben | Items je Übungsaufgabe | belegte Fläche im Satzspiegel |
|---|---|---|---|
| 1 | 2–3 | 3–4 | höchstens ca. 55 % |
| 2 | 3–4 | 3–4 (kleine Items bis 6) | höchstens ca. 55 % |
| 3 | 4–5 | 6–8 | höchstens ca. 65 % |
| 4 | 5–6 | 6–10 | höchstens ca. 65 % |

Die Sternchenaufgabe zählt mit. Passt der Inhalt nicht, wird gestrichen oder auf zwei Blätter verteilt, nie enger gesetzt. `blatt.py bauen` meldet zu viele Aufgaben, Überlauf und zu dichte Abstände.

Für Kinder mit Konzentrationsschwierigkeiten dieselben Aufgaben auf zwei Blätter verteilen (weniger pro Seite) und je Aufgabe ein Abhak-Kästchen setzen (`differenzierung.md`).

### Platzbudget (A4, Satzspiegel 1003 px)

| Bereich | Höhe |
|---|---|
| Kopf | ≤ 160 px |
| Aufgaben inkl. Abstände | Rest, ca. 720–760 px |
| Fuß | 80–110 px |

Kl. 3/4: Passt eine weitere Aufgabe oder Item-Reihe hinein, wird sie ergänzt; bleiben unten mehr als ca. 150 px frei (`blatt.py` meldet das), Items ergänzen oder die Schreibfläche vergrößern. Kl. 1/2: Restplatz gleichmäßig als Luft zwischen die Aufgaben verteilen oder die Schreibfläche vergrößern, nicht auffüllen.

## 5. Checkliste

- [ ] Weißer Hintergrund, kein Hintergrundbild, keine Flächen hinter Aufgaben, Kopf oder Fuß
- [ ] Aufgaben ohne Kasten, mit hängender Nummer und einheitlichem Abstand
- [ ] Rahmen nur mit Funktion
- [ ] Kopf ≤ 160 px, Fuß ≤ 110 px, Tipp bei seiner Aufgabe oder mit „Zu 1: …" im Kopf
- [ ] Aufgaben- und Item-Zahl im Richtwert der Klasse, jede Aufgabe auf einen Blick verständlich, Beispiel nicht gequetscht
- [ ] Mindestgrößen eingehalten; Kl. 1/2 mit Luft, Kl. 3/4 ohne ungenutzte Leerstreifen
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

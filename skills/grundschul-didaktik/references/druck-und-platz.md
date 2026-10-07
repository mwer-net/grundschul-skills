# Schwarz-Weiß-Druck und Platz

Grundannahme für alle Kopiervorlagen (Arbeitsblatt, Lernzielkontrolle, Lesetext, Stationsblatt, Laufzettel): **Die Schule druckt und kopiert schwarz-weiß.** Das Material muss in s/w vollständig funktionieren, wenig Toner verbrauchen und die Seite für Aufgaben nutzen statt für Rahmen. Farbe ist die Ausnahme und wird nur eingesetzt, wenn die Lehrkraft Farbdruck nennt (Plakat, laminierte Karten, Spiele, Whiteboard).

Diese Regeln haben Vorrang vor älteren Gestaltungshinweisen (farbige Flächen, Aufgabenblöcke als Pastellkästen mit Innenabstand).

## 1. Warum

| Befund | Folge für das Material |
|---|---|
| Tonerverbrauch steigt mit bedruckter Fläche × Tonwert. Herstellerangaben zur Reichweite rechnen mit 5 % Flächendeckung pro Seite (ISO/IEC 19752). | Mittlere Töne kosten am meisten: Farbige Nummernkreise, farbige Bilder und die Leitfigur werden zu Grauflächen. Helle Pastellflächen sind einzeln günstig, summieren sich aber: Ein Laserdrucker rastert sie als Punktmuster über die ganze Fläche. Das Probeblatt Uhrzeit hatte Pastellflächen auf rund 55 % der Seite (≈ 2 % Deckung, fast eine halbe Textseite zusätzlich). |
| Am Kopierer werden helle Flächen oft ungleichmäßig wiedergegeben (Schleier, Streifen) oder fallen ganz weg. | Eine weiße Seite kopiert sauber, eine getönte nicht. |
| Farben werden in s/w nach ihrer Helligkeit in Grau umgesetzt. Verschiedene Farben gleicher Helligkeit werden zum selben Grau. | Farbcodes gehen verloren; farbige Schrift (z. B. Orange) wird mittelgrau und kontrastarm. |
| Kopierer lassen sehr helle Linien und Schrift wegfallen; jede Kopie einer Kopie und jede Verkleinerung (A4 → A5 halbiert die Linienstärke) verliert weiter. | Nur Schwarz und kräftiges Grau verwenden, keine Haarlinien. |
| Eine umschließende Fläche oder ein Rahmen gruppiert stärker als Nähe (Gestalt: gemeinsame Region), aber zu viele Rahmen machen das Blatt unruhig. In den meisten Fällen reichen Weißraum und Nähe für eine klare Ordnung. | Aufgaben durch Abstand trennen, nicht durch Kästen. Rahmen nur, wo der Rahmen selbst eine Funktion hat. |
| Jeder Kasten braucht Innenabstand oben und unten plus Abstand zum nächsten Kasten. Bei vier Aufgaben sind das schnell 150–200 px, also eine ganze Aufgabe. | Ohne Kästen passen bei gleicher Lesbarkeit mehr Items aufs Blatt. |
| Stark dekorierte Umgebungen lenken junge Kinder ab (Fisher, Godwin & Seltman 2014). | Ein ruhiges s/w-Blatt ist kein Nachteil, solange es freundlich bleibt (Abschnitt 4). |

## 2. Schwarz-Weiß-Regeln

1. **Weißer Seitenhintergrund**, kein Hintergrundbild, keine Flächenfüllung über Aufgaben, Kopf- oder Fußzeile.
2. **Gefüllte Flächen nur klein und mit Funktion:** Nummernkreis, Ankreuzfeld, Wendeplättchen. Faustregel: keine gefüllte Fläche größer als ca. 2 cm² (≈ 3 000 px²) außer Abbildungen, die das Lernobjekt sind.
3. **Text schwarz** (`#1D1D1B`). Keine farbige oder hellgraue Schrift. Hervorhebung durch Fettdruck, nicht durch Farbe.
4. **Linien schwarz oder dunkelgrau** (`#1D1D1B` bis `#4A4A4A`), mindestens 1,5 px (≈ 1 pt). Schreiblinien 1,5–2 px. Nichts heller als `#808080`, sonst fällt es beim Kopieren weg. Hilfslinien (Mittelband der Lineatur) als dünne graue Linie, nicht als farbige Fläche.
5. **Unterscheiden ohne Farbe:** fett vs. normal, durchgezogen vs. gestrichelt, gefüllt vs. leer, Symbol, Buchstabe (E/Z/H), Beschriftung. Farbcodes der Klasse (Wortarten, Stellenwerte, Wendeplättchen rot/blau) werden **von den Kindern angemalt** oder durch Beschriftung ersetzt („rot" ausgeschrieben, gefüllter Kreis = rot, leerer Kreis = blau).
6. **Abbildungen als Strichzeichnung:** schwarze Konturen, weiße Füllung, keine Verläufe, keine Fotos, keine grauen Flächen. Das Lernobjekt (Uhr, Zwanzigerfeld) ist ohnehin Vektor in Schwarz.
7. **Leitfigur und Wachstumsgrafik in der Strich-Version** (IDs in `kindgerecht-gestalten.md`). Bonus: Die Kinder können Willi oder Wilma und die Pflanzenstufen selbst anmalen. Das passt zu „Male an, wie weit du schon bist".
8. **Lösungsblatt:** Lösungen fett und unterstrichen, nicht farbig.
9. **Schrift:** normale Strichstärke für Fließtext; fett nur für Überschrift, Anweisung und Hervorhebung. Keine extra-fetten Display-Schriften für längere Texte.
10. **Prüfen:** Vorschau in Graustufen ansehen bzw. `layout_check.py` (meldet Flächen, farbige Schrift, helle oder dünne Linien, Hintergrundbilder).

## 3. Platzsparend gestalten

Ziel: **mehr Übung pro Blatt, ohne gedrängt zu wirken.** Gespart wird an Rahmen, Innenabständen und Deko, nie an Schriftgröße, Schreibfläche oder dem Abstand zwischen Aufgaben.

### Aufbau einer Aufgabe ohne Kasten

```
 ❶  Lies die Uhrzeit. Schreibe sie auf.                         ●
     ◷      ◷      ◷      ◷      ◷      ◷
    ____   ____   ____   ____   ____   ____
 ─────────────────────────────────────────────── (optional, 1 px grau)
 ❷  Zeichne die Zeiger ein.                                     ●●
```

- **Hängende Nummer:** Nummernkreis (32–36 px) links, Anweisung 12–16 px rechts daneben, die Arbeitsfläche beginnt bündig unter der Anweisung. Die Nummer markiert den Aufgabenbeginn, ein Kasten ist nicht nötig.
- **Niveau-Punkte** rechtsbündig in der Anweisungszeile.
- **Trennung durch Abstand:** 24–32 px zwischen Aufgaben, 8–16 px zwischen Anweisung und Arbeitsfläche. Optional eine dünne graue Trennlinie (1–1,5 px, `#808080`) über die Spaltenbreite. Einheitlich im ganzen Material.
- **Rahmen nur mit Funktion:** Wortspeicher, Tipp-Sprechblase der Leitfigur, Ergebnis- oder Antwortkästchen, Ausschneideteile (gestrichelt), Lösungsstreifen. Rahmen dann als dünne Kontur ohne Füllung, Ecken gerundet.

### Kopf und Fuß schlank

- **Kopf** (Name/Datum, Überschrift, Ich-kann-Ziel, Wahlhilfe) zusammen höchstens ca. 160 px. Ich-kann-Ziel und Wahlhilfe in einer Zeile oder zwei kurzen Zeilen.
- **Tipp der Leitfigur bei der Aufgabe, zu der er gehört** (rechts neben der Anweisung oder neben dem Beispiel), nicht als eigener Block im Kopf.
- **Fuß** in einer Zeile bzw. einem schmalen Streifen (ca. 80–110 px): Ich-kann-Satz + Wachstumsgrafik zum Anmalen links/rechts, Reflexionsfrage mit Ankreuzfeldern darunter. Abgegrenzt durch eine Linie, nicht durch eine Fläche.

### Mehr Items pro Aufgabe

- Reihen voll nutzen: Spaltenbreite (A4: 794 − 120 = 674 px) durch Item-Breite + Abstand teilen und die Reihe füllen, statt vier Items mit großem Zwischenraum zu verteilen.
- Bei Übungsblättern lieber 2 Reihen à 5–6 Items als 1 Reihe à 4.
- **Mindestgrößen** (Richtwerte, für Kinderhände nicht unterschreiten):

| Element | Kl. 1 | Kl. 2 | Kl. 3/4 |
|---|---|---|---|
| Uhr zum Ablesen | 100 px (2,6 cm) | 88 px (2,3 cm) | 80 px (2,1 cm) |
| Uhr zum Zeiger-Einzeichnen | 120 px (3,2 cm) | 100 px (2,6 cm) | 96 px (2,5 cm) |
| Antwortlinie für eine Zahl/Uhrzeit | 100 px | 88 px | 80 px |
| Zeilenhöhe Schreiblinie | Lineatur 1 | Lineatur 2 | Lineatur 3/4 |
| Ankreuz-/Ergebniskästchen | 28 px | 24 px | 22 px |

- Abstand zwischen Items in einer Reihe 24–32 px, damit Kinder die Zuordnung Item → Antwortlinie sehen.

### Richtwerte pro A4-Seite

| Klasse | Aufgaben | Items je Übungsaufgabe |
|---|---|---|
| 1 | 3–4 | 4–6 |
| 2 | 4–5 | 6–8 |
| 3/4 | 5–6 | 6–10 |

Bei Kindern mit Konzentrationsschwierigkeiten statt weniger Aufgaben pro Blatt: dieselbe Seite mit Abhak-Kästchen pro Aufgabe oder auf zwei Blätter verteilen (`differenzierung.md`).

### Platzbudget (A4, Satzspiegel 1003 px)

| Bereich | Höhe |
|---|---|
| Kopf | ≤ 160 px |
| Aufgaben inkl. Abstände | Rest, ca. 720–760 px |
| Fuß | 80–110 px |

Passt eine weitere Aufgabe oder Item-Reihe hinein, wird sie ergänzt. Bleibt ein waagerechter Leerstreifen von mehr als ca. 64 px ungenutzt, Items ergänzen oder die Schreibfläche sinnvoll vergrößern.

## 4. Freundlich bleiben in Schwarz-Weiß

Ein rein sachliches s/w-Blatt wirkt schnell kalt. Kindgerecht wird es durch Form, nicht durch Farbfläche:

- Runde Überschriftenschrift (Fredoka, Baloo 2), fett, schwarz.
- Nummern in gefüllten schwarzen Kreisen mit weißer Ziffer (kleine Fläche, starker Anker).
- Willi oder Wilma als Strichzeichnung mit Sprechblase (Kontur, runde Ecken) und echter Funktion.
- Gerundete Ecken bei den wenigen Rahmen und Kästchen, freundliche Symbole als Linien-Icons.
- Anmal-Anlässe mit Funktion: Wachstumsgrafik, Leitfigur, Ergebnisbild (Malen nach Ergebnis).

## 5. Wenn doch farbig gedruckt wird

Nur auf ausdrücklichen Wunsch (Plakat, laminierte Karten, Spiel, Whiteboard). Auch dann:
- keine großen Farbflächen hinter Text; Farbe auf Linien, Nummernkreise, Überschrift und Bildelemente beschränken,
- jede Farbinformation zusätzlich als Symbol, Muster oder Beschriftung,
- Graustufen-Vorschau prüfen: Das Material muss auch dann noch funktionieren.

## 6. Checkliste

- [ ] Weißer Hintergrund, keine großen Farb- oder Grauflächen, kein Hintergrundbild
- [ ] Text schwarz, Linien schwarz/dunkelgrau ≥ 1,5 px, nichts heller als `#808080`
- [ ] Keine Information nur über Farbe
- [ ] Bilder als Strichzeichnung, Leitfigur und Wachstumsgrafik in der Strich-Version
- [ ] Aufgaben ohne Kasten, mit hängender Nummer und einheitlichem Abstand
- [ ] Rahmen nur mit Funktion, als Kontur ohne Füllung
- [ ] Kopf ≤ 160 px, Fuß ≤ 110 px, Tipp bei der Aufgabe
- [ ] Reihen gefüllt, Mindestgrößen eingehalten, kein ungenutzter Leerstreifen
- [ ] `layout_check.py` ohne Druck-Warnungen

## Quellen

- ISO/IEC 19752 (Reichweite von Tonerkartuschen bei 5 % Flächendeckung); Erläuterung z. B. troygroup.com/blog/understanding-toner-ink-yield-and-5-page-coverage
- Graustufen-Umsetzung: Farben gleicher Leuchtdichte werden zum selben Grau (u. a. Grundland & Dodgson, Cambridge Tech Report UCAM-CL-TR-649)
- Kopierfähige Vorlagen: Linien nicht zu dünn, Grauwerte unterscheidbar, Verkleinerung auf 70 % halbiert die Linienstärke (LIT Verlag, Hinweise zur Papiervorlage)
- Gestaltgesetz der gemeinsamen Region vs. Nähe; zu viele Rahmen erzeugen Unruhe (lawsofux.com/law-of-common-region)
- Fisher, A. V., Godwin, K. E. & Seltman, H. (2014). Visual environment, attention allocation, and learning in young children. Psychological Science, 25(7).

# Gestaltung: Ebenen, frei liegende Elemente, Anker

Diese Datei beschreibt, wie Gestaltung im Material steht: Formen, Bilder, Figuren, Schmuckschrift, Streuungen, Seitenfläche
und Seitenrahmen, die frei auf der Seite liegen statt im Stapel der Aufgaben. Alles ist statisches HTML, CSS und SVG. Es
sieht ohne Skript gleich aus, im Editor, in der Vorschau und im PDF.

Leitsatz: **Inhalt rastet ein, Gestaltung liegt frei.** Aufgaben bleiben im Stapel, mit Nummern und Lösung wie bisher.
Gestaltung liegt in einer von zwei Ebenen je Seite oder hängt an einem Baustein.

## 1. Eine Seite, ein Stapel, zwei Ebenen

```
section.seite
├─ … Stapel …            Namenszeile, Kopf, Aufgaben, Fuß, wie bisher
│    └─ .aufgabe
│         └─ [data-lage="frei"][data-anker]   Gestaltung, die an dieser Aufgabe hängt
├─ .ebene.hinten         hinter dem Inhalt
│    ├─ .seitenflaeche   füllt die Seite (höchstens eine, immer zuunterst)
│    ├─ .seitenrahmen    (höchstens einer, direkt darüber)
│    └─ [data-lage="frei"] …
└─ .ebene.vorne          vor dem Inhalt
     └─ [data-lage="frei"] …
```

- Die Ebenen stehen **am Ende der Seite**, erst `hinten`, dann `vorne`. Was im Stapel neu dazukommt, steht immer davor.
- Eine Ebene gibt es nur, wenn sie etwas enthält. Ist sie leer, fällt sie weg.
- In einer Ebene liegt **vorne, was später im HTML steht**.
- Die Ebene schneidet am Blattrand ab. Was darüber hinausragt, ist nicht zu sehen.

## 2. Lage

Ein Gestaltungselement ist jedes Element mit `data-lage="frei"`. Seine Lage steht als CSS-Variablen im `style`:

| Variable | Bedeutung | Einheit | ohne Angabe |
|---|---|---|---|
| `--x`, `--y` | linke obere Ecke **vor** dem Drehen, relativ zum Behälter | px, ganzzahlig | 0 |
| `--b` | Breite | px | aus dem Inhalt |
| `--h` | Höhe | px | aus dem Inhalt oder dem Seitenverhältnis |
| `--drehen` | Drehung um die Mitte | deg, eine Nachkommastelle | 0 |
| `--spiegeln` | `-1` spiegelt waagerecht (Bild, Figur) | – | 1 |

- Behälter ist die Ebene (Koordinaten der Seite, A4 hoch 794 × 1123 px) oder beim Anker der Baustein.
- Immer px, nie %. Werte, die nicht gebraucht werden, bleiben weg; nicht `--x:0px` schreiben.
- Reihenfolge im `style`: `--x --y --b --h --drehen --spiegeln`, danach alles andere.

```html
<div class="ebene vorne">
  <img class="figur-frei" data-lage="frei" data-figur="wilma" src="bilder/wilma.png" alt="Wilma"
       style="--x:610px;--y:520px;--b:150px;--spiegeln:-1">
</div>
```

## 3. Gemeinsame Attribute

Alle sind freiwillig.

| Attribut | Wirkung |
|---|---|
| `data-sw="weg"` / `"grau"` | Verhalten in s/w (Abschnitt 6). Ohne Angabe gilt der Standard der Art. |
| `data-aus` | ausgeblendet: nicht im Blatt, nicht im Druck, nicht in der Prüfung |
| `data-gesperrt` | im Blatt nicht wählbar und nicht ziehbar |
| `data-anker` | hängt am umgebenden Baustein (Abschnitt 5) |
| `data-name` | Name in der Schublade „Ebenen“ |
| `class="nur-loesung"` / `"nicht-loesung"` | wie bei Bausteinen |
| `data-ueberlagert-ok` | Überdecken von Inhalt ist gewollt, die Prüfung meldet es nicht |
| `data-aufmachung-teil` | von einem Rezept erzeugt; nicht von Hand ändern (Abschnitt 7) |

## 4. Arten

Der Editor erkennt die Art am ersten passenden Element dieser Tabelle. Was keine eigene Art hat, aber `data-lage="frei"`
trägt, ist „Gestaltung“ und lässt sich trotzdem verschieben, drehen, duplizieren und löschen.

<!-- erzeugt: gestaltung-arten -->
| Art | Name | Element | Größe | Standard-Ebene | Fähigkeiten | Ab |
|---|---|---|---|---|---|---|
| `ebene` | Ebene | `.ebene` | – | – | – | E1 |
| `seitenflaeche` | Seitenfläche | `.seitenflaeche` | – | – | `fuellung` | E1 |
| `seitenrahmen` | Seitenrahmen | `.seitenrahmen` | – | – | `fuellung` | E1 |
| `flaeche` | Fläche | `.flaeche` | – | – | `ordnen`, `duplizieren`, `loeschen`, `hoehe` | E4 |
| `bildfrei` | Bild | `img.bild-frei[data-lage="frei"]` | Ecken halten das Verhältnis | vorne | `lage`, `duplizieren`, `loeschen`, `loesung`, `bild` | E2 |
| `figurfrei` | Figur | `img.figur-frei[data-lage="frei"]` | Ecken halten das Verhältnis | vorne | `lage`, `duplizieren`, `loeschen`, `loesung`, `bild` | E2 |
| `form` | Form | `svg.form[data-lage="frei"]` | frei | vorne | `lage`, `duplizieren`, `loeschen`, `loesung`, `fuellung` | E2 |
| `formtext` | Form mit Text | `.form-text[data-lage="frei"]` | frei | vorne | `lage`, `duplizieren`, `loeschen`, `loesung`, `fuellung`, `text` | E2 |
| `schmuck` | Schmuckschrift | `div.schmuck[data-lage="frei"]` | Ecke: Schrift, Kante: Breite | vorne | `lage`, `duplizieren`, `loeschen`, `loesung`, `fuellung`, `text` | E2 |
| `schmuckbogen` | Titel im Bogen | `svg.schmuck[data-lage="frei"]` | Ecken halten das Verhältnis | vorne | `lage`, `duplizieren`, `loeschen`, `loesung`, `fuellung` | E3 |
| `streuung` | Streuung | `svg.streuung[data-lage="frei"]` | frei | hinten | `lage`, `duplizieren`, `loeschen`, `loesung`, `fuellung` | E3 |
| `gruppe` | Gruppe | `.gruppe[data-lage="frei"]` | frei | vorne | `lage`, `duplizieren`, `loeschen`, `loesung` | E4 |
| `stapel` | Stapel | `.stapel[data-lage="frei"]` | nur Breite, Höhe aus dem Inhalt | vorne | `lage`, `duplizieren`, `loeschen`, `loesung`, `fuellung` | E5 |
| `gestaltung` | Gestaltung | `[data-lage="frei"]` | frei | vorne | `lage`, `duplizieren`, `loeschen`, `loesung` | E2 |
<!-- /erzeugt: gestaltung-arten -->

Eigene Klassen statt der vorhandenen: `.figur` (Leitfigur im Tipp) und `.blase` (Sprechblase im Tipp) bleiben dem Stapel.
Ein frei liegendes Bild heißt `img.bild-frei`, eine frei liegende Figur `img.figur-frei`.

## 5. Anker

Ein Gestaltungselement mit `data-anker` steht **im Baustein**, an dem es hängt, als dessen letztes Kind. Die Koordinaten
beziehen sich auf die linke obere Ecke des Bausteins. Es wandert mit, wenn der Baustein rutscht, die Seite wechselt,
kopiert oder gelöscht wird.

```html
<div class="aufgabe">
  <span class="nr">1</span>
  <div class="anw"><span class="text">Zeichne ein Haus aus Formen.</span></div>
  <div class="koerper">…</div>
  <img class="figur-frei" data-lage="frei" data-anker data-figur="wilma" src="bilder/wilma.png" alt="Wilma"
       style="--x:560px;--y:-40px;--b:110px">
</div>
```

Ankern lässt sich an Aufgaben und an allem, was direkt auf der Seite im Stapel liegt (Kopf, Tipp, Absatz, Bild …), nicht
an Teilen in einer Aufgabe. Am Anker liegt Gestaltung immer vor dem Inhalt.

## 6. Druck und s/w

- **Druckrand 19 px** (5 mm) an jeder Seite. Text, Bild, Figur und Form mit Text gehören nicht hinein, sonst fehlen sie
  im Druck. Seitenfläche, Streuung und Formen ohne Text dürfen bis an den Blattrand.
- Den Seitenrahmen 24 px vom Blattrand setzen, damit er nicht angeschnitten wirkt.
- In s/w ist jedes Gestaltungselement entweder **grau** (Farben werden umgerechnet) oder **weg** (`data-sw="weg"`).

| Art | Standard in s/w |
|---|---|
| Seitenfläche, Streuung | weg |
| Seitenrahmen, Form, Form mit Text, Schmuckschrift | grau |
| Bild, Figur | grau bzw. Strichfassung |
| Hintergrund eines Stapels | weg, Kontur bleibt |

**Prüfung.** `pruefung.js` meldet Gestaltung nicht als `rand`, `ueberlauf`, `ueberlappung` oder `flaeche`, sondern so:

| Code | Stufe | Wann |
|---|---|---|
| `druckrand` | WARNUNG | Bild, Figur, Form mit Text, Schmuckschrift oder `[data-frei]` liegt sichtbar in den äußeren 19 px (im Mini-Book nur an Kanten, die am Blattrand liegen, nicht an der Falz) |
| `aussen` | FEHLER | mehr als die Hälfte eines Gestaltungselements liegt außerhalb der Seite |
| `verdeckt` | HINWEIS | ein Element in `.ebene.vorne` oder am Anker überdeckt Inhalt oder die `.loesung-marke` um mehr als 400 px² |
| `ausgeblendet` | HINWEIS | einmal je Material: Elemente mit `data-aus`, die nicht gedruckt werden |

Gemessen wird das Rechteck nach dem Drehen. `data-rand-ok` schaltet `druckrand` ab, `data-ueberlagert-ok` schaltet
`verdeckt` ab. Was hinten liegt, verdeckt nie etwas.

## 7. Regeln für Claude

- Gestaltung nie in den Stapel schreiben, sondern in eine Ebene (`.ebene.hinten` bzw. `.ebene.vorne` am Ende der Seite)
  oder mit `data-anker` an einen Baustein. Die Ebene anlegen, wenn es sie noch nicht gibt; eine leere Ebene weglassen.
- Teile mit `data-aufmachung-teil` nicht von Hand ändern, sondern die Werte am `<body>`. Soll ein Teil anders werden, das
  Attribut vorher entfernen; dann ist er normale Gestaltung.
- Für Formen die Parameter setzen (`data-form`, `data-zacken` …); der Pfad darf fehlen, der Editor erzeugt ihn beim
  Öffnen. Eigene Pfade gehen als `data-form="pfad"`.
- Keine anderen Schriften als Andika und Fredoka.
- Farben bevorzugt aus der Palette: `var(--haupt)`, `var(--akzent)`, `var(--dunkel)`, `var(--linie)`, `var(--fuell)`.
  Eigene Farben als Hex.
- Ids in SVG (Verläufe, Bogenpfade, Masken) heißen `<art>-<4 Zeichen>` (`verlauf-k3f9`) und sind im Dokument eindeutig.
  Verweise darauf stehen als Attribut (`fill="url(#verlauf-k3f9)"`, `href="#bogen-k3f9"`), nicht als `url()` im
  `style`.
- Nur statisches HTML und SVG: kein Skript, keine Ereignisse, kein `foreignObject`, kein SVG-`image`, keine Adressen
  außerhalb des Blatts.

<!-- >> 095 Seitenfläche und Seitenrahmen -->
## Seitenfläche und Seitenrahmen

Eine Seite bekommt einen Grund (Farbe, Verlauf oder Muster) und einen Rahmen. Beide stehen **zuunterst in
`.ebene.hinten`**, erst die Fläche, dann der Rahmen, je Seite höchstens einer. Sie haben kein `data-lage`: Sie füllen die
Seite und lassen sich nicht ziehen. Sollen mehrere Seiten gleich aussehen, steht auf jeder Seite dasselbe.

```html
<div class="ebene hinten">
  <div class="seitenflaeche" data-flaeche="verlauf" style="--f1:#fff7e6;--f2:#ffe0b8;--winkel:180deg"></div>
  <div class="seitenrahmen" data-rahmen="gestrichelt"
       style="--rahmen-farbe:var(--dunkel);--rahmen-staerke:3px;--rahmen-abstand:24px;--rahmen-ecke:16px"></div>
</div>
```

| `data-flaeche` | Darstellung | Variablen im `style` |
|---|---|---|
| `farbe` | einfarbig | `--f1` |
| `verlauf` | linearer Verlauf | `--f1`, `--f2`, `--winkel` (ohne Angabe 180deg: von oben nach unten) |
| `muster` | Muster, `data-muster` = `streifen`, `punkte`, `karo`, `schraeg` | `--f1` Grund, `--f2` Muster, `--muster-groesse` (Kachel in px, ohne Angabe 24px) |

| `data-rahmen` | Darstellung | Variablen im `style`, alle freiwillig |
|---|---|---|
| `linie`, `doppelt`, `gestrichelt`, `gepunktet` | Linie in diesem Stil; `doppelt` ist mindestens 4px stark | `--rahmen-farbe` (ohne Angabe `var(--dunkel)`), `--rahmen-staerke` (2px), `--rahmen-abstand` vom Blattrand (24px, im Mini-Book 8px), `--rahmen-ecke` (Eckenradius, 0) |

- Farben aus der Palette (`var(--haupt)`, `var(--akzent)`, `var(--dunkel)`, `var(--linie)`, `var(--fuell)`) oder als
  Hex. Für einen ruhigen Grund helle Farben wählen, damit der Text lesbar bleibt.
- Die Fläche reicht bis an den Blattrand. Den Rahmen nicht näher als 24px an den Blattrand legen (Druckrand 19px).
- In s/w fällt die Fläche weg, außer mit `data-sw="grau"`; der Rahmen wird grau, außer mit `data-sw="weg"`.
- Fläche oder Rahmen mit `data-aufmachung-teil` gehören einem Rezept: nicht ändern.
<!-- << 095 -->

<!-- >> 102 Figuren -->
<!-- << 102 -->

<!-- >> 103 Bilder frei -->
<!-- << 103 -->

<!-- >> 104 Formen -->
## Formen

Eine Form ist ein `svg.form` mit `data-form` und ihren Parametern. **Die Parameter sind die Quelle, der Pfad ist
erzeugt:** Aus `data-form`, den Parametern und der Größe (`--b`, `--h`) entstehen `viewBox="0 0 b h"` und das `d` des
Pfads in Elementgröße. Ändert sich die Größe, zeichnet der Editor beides neu; darum steht nie
`preserveAspectRatio="none"` da, und Ecken und Strich bleiben beim Strecken richtig.

```html
<div class="ebene vorne">
  <svg class="form" data-lage="frei" data-form="stern" data-zacken="5" data-innen="0.45" viewBox="0 0 120 120"
       style="--x:610px;--y:84px;--b:120px;--h:120px;--drehen:12deg">
    <path d="M60 1.5 L…Z" style="fill:var(--akzent);stroke:var(--dunkel);stroke-width:3px;stroke-linejoin:round"/>
  </svg>
</div>
```

<!-- erzeugt: formen -->
| Form | `data-form` | Klasse | Parameter (Bereich, Standard) | Größe beim Ablegen |
|---|---|---|---|---|
| Rechteck | `rechteck` | ohne Text | `data-radius` 0–200 px, Standard 0 | 120 × 120 |
| Ellipse | `ellipse` | ohne Text | – | 120 × 120 |
| Dreieck | `dreieck` | ohne Text | `data-spitze` 0–1, Standard 0.5 | 120 × 120 |
| Vieleck | `vieleck` | ohne Text | `data-ecken` 3–12, Standard 6 | 120 × 120 |
| Stern | `stern` | ohne Text | `data-zacken` 3–12, Standard 5; `data-innen` 0.2–0.9, Standard 0.45 | 120 × 120 |
| Herz | `herz` | ohne Text | – | 120 × 120 |
| Wolke | `wolke` | ohne Text | `data-bogen` 4–10, Standard 6 | 120 × 120 |
| Pfeil | `pfeil` | ohne Text | `data-spitze` 0.1–0.6, Standard 0.35; `data-schaft` 0.2–0.8, Standard 0.45 | 120 × 120 |
<!-- /erzeugt: formen -->

- **Der Pfad darf fehlen.** Claude setzt `data-form`, die Parameter, `--b`, `--h` und die Farben; `viewBox` und `d`
  erzeugt der Editor beim Öffnen. Ein fehlender Parameter gilt mit seinem Standard. Ohne Pfad bekommt die Form die
  Standardfarben, mit Pfad ohne `d` behält sie dessen `style`.
- **Farben** stehen im `style` des Pfads: `fill` (Füllung, `none` für keine), `stroke` (Kontur, `none` für keine) und
  `stroke-width` in px (0–12, Standard 3). Bevorzugt Farben des Blatts (`var(--haupt)`, `var(--akzent)`,
  `var(--dunkel)`, `var(--linie)`, `var(--fuell)`): Sie folgen Palette und Thema. Eigene Farben als Hex folgen nicht.
  Standard ist Füllung `var(--akzent)`, Kontur `var(--dunkel)`.
- **Der Strich liegt innen**: Der Pfad ist um die halbe Strichstärke eingerückt, damit nichts am Rand des `svg`
  abgeschnitten wird.
- Eine Raute ist ein Vieleck mit `data-ecken="4"`, ein Kreis eine Ellipse mit gleicher Breite und Höhe.
- Pfade bestehen nur aus `M`, `L`, `C`, `Q` und `Z` mit absoluten Zahlen, ohne `A`; Kreise sind vier Kurven.
- Nicht die Klasse `.blase` verwenden: Sie gehört der Sprechblase im Tipp.
<!-- << 104 -->

<!-- >> 105 Schmuckschrift -->
## Schmuckschrift

Schmuckschrift ist Text **zum Schmücken**, nicht Inhalt: ein großer Titel auf dem Deckblatt, ein Stempel „Prima!“,
ein Etikett „13 Fälle“. Sie liegt frei in der Ebene `vorne` wie eine Form, bleibt stehen, wenn Aufgaben rutschen, und
steht nicht in der Lösung. **Was die Kinder lesen müssen** (Überschrift, Arbeitsauftrag, Absatz, Tipp, Lernziel), ist
kein Schmuck, sondern ein Baustein im Stapel.

```html
<div class="ebene vorne">
  <div class="schmuck" data-lage="frei" data-schmuck="titel"
       style="--x:64px;--y:150px;--b:666px;--gr:56px;--farbe:var(--dunkel)">Die <span style="color:var(--akzent)">Formen</span>-Detektive</div>
  <div class="schmuck" data-lage="frei" data-schmuck="stempel" style="--x:560px;--y:960px;--drehen:-8deg;--gr:28px">Prima!</div>
  <div class="schmuck" data-lage="frei" data-schmuck="etikett" style="--x:120px;--y:840px;--gr:20px;--hg:var(--haupt)">13 Fälle</div>
</div>
```

| Art | `data-schmuck` | Aussehen | Größe beim Ablegen |
|---|---|---|---|
| Titel | `titel` | Fredoka, Farbe `var(--dunkel)` | 56 px |
| Stempel | `stempel` | Großbuchstaben, Rahmen in Schriftfarbe, `--drehen:-8deg` | 28 px |
| Etikett | `etikett` | Pille mit Hintergrund `var(--akzent)`, weiße Schrift | 18 px |

| Variable | Bedeutung | Standard |
|---|---|---|
| `--gr` | Schriftgröße in px, 12–160 | 40px |
| `--farbe` | Schriftfarbe | `var(--dunkel)`, beim Etikett `#fff` |
| `--hg` | Hintergrund, nur beim Etikett | `var(--akzent)` |
| `--schrift` | `Fredoka` oder `Andika`, keine anderen | Fredoka |
| `--ausrichtung` | `left`, `center`, `right` | `left` |
| `--b` | Breite: Der Text bricht um. Ohne `--b` so breit wie der Text | – |

- **Nicht für Inhalt.** Steht die Information auch in der Lösung oder ist sie Teil der Aufgabe, gehört sie in einen
  Baustein. Ein Titel aus Schmuckschrift ersetzt nicht das `h1` im Kopf, wenn das Blatt einen Kopf hat.
- **Größe:** nie unter `0.8 × --fs` der Klasse (Klasse 1: 22 px, Klasse 2: 19 px). Die Prüfung `schrift-klein` gilt
  auch für Schmuckschrift.
- **Zwei Farben:** einzelne Wörter in `<span style="color:var(--akzent)">`. Nur in Schmuckschrift, nie im Inhalt.
  Sonst steht darin nur Text, `<br>`, `<b>`, `<u>`, `<mark>`.
- Nur die eingebetteten Schriften (Fredoka 600, Andika 400/700). Eine Schrift aus dem Netz fehlt im Druck.
- Farben bevorzugt als Farben des Blatts (`var(--haupt)` …), sie folgen Palette und Thema; Hex folgt nicht.
<!-- << 105 -->

<!-- >> 106 Anker -->
<!-- << 106 -->

<!-- >> 107 Sprechblase, Text und Linie in Formen -->
<!-- << 107 -->

<!-- >> 108 Aussehen -->
<!-- << 108 -->

<!-- >> 109 Streuung -->
<!-- << 109 -->

<!-- >> 110 Kontur und Titel im Bogen -->
<!-- << 110 -->

<!-- >> 111 Bildrahmen -->
<!-- << 111 -->

<!-- >> 114 Rezepte -->
<!-- << 114 -->

<!-- >> 115 Fläche im Stapel -->
<!-- << 115 -->

<!-- >> 116 Pfad -->
<!-- << 116 -->

<!-- >> 117 Figur von Claude -->
<!-- << 117 -->

<!-- >> 118 Daten der Rezepte -->
<!-- << 118 -->

<!-- >> 119 Rezepte freilegen -->
<!-- << 119 -->

<!-- >> 120 Gruppen -->
<!-- << 120 -->

<!-- >> 121 Kombinieren -->
<!-- << 121 -->

<!-- >> 125 Weitere Stapel -->
<!-- << 125 -->

<!-- >> 126 Nummern in Stapeln -->
<!-- << 126 -->

<!-- >> 128 Sticker -->
<!-- << 128 -->

<!-- >> 129 Hülle -->
<!-- << 129 -->

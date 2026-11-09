# Gestaltung: Ebenen, frei liegende Elemente, Anker

Diese Datei beschreibt, wie Gestaltung im Material steht: Formen, Bilder, Figuren, Schmuckschrift, Streuungen, Seitenfläche
und Seitenrahmen, die frei auf der Seite liegen statt im Stapel der Aufgaben. Alles ist statisches HTML, CSS und SVG. Es
sieht ohne Skript gleich aus, im Editor, in der Vorschau und im PDF.

Leitsatz: **Inhalt rastet ein, Gestaltung liegt frei.** Aufgaben bleiben im Stapel, mit Nummern und Lösung wie bisher.
Gestaltung liegt in einer von zwei Ebenen je Seite oder hängt an einem Baustein.

<!-- >> 112 Regeln für Claude -->
## Regeln für Claude

Was die Lehrkraft im Editor frei aufs Blatt legt, steht genau so im HTML, wie diese Datei es beschreibt. Lies und ändere
es wie eigenes; was du baust, muss sie danach von Hand weiterbearbeiten können. Ein fertiges Deckblatt zum Abschauen:
`assets/beispiel-deckblatt-formen.html`.

| Regel | So |
|---|---|
| Wohin | nie in den Stapel, sondern in `.ebene.hinten`/`.ebene.vorne` am Ende der `.seite` oder mit `data-anker` als letztes Kind in einen Baustein (Abschnitt 5). Fehlt die Ebene, anlegen; eine leere weglassen |
| Was | nur Schmuck. Was die Kinder lesen oder lösen, ist ein Baustein im Stapel. Ein eigenes Element aus HTML und SVG im Stapel bleibt ein freies Element mit `data-frei` (`references/abbildungen.md`) und wird nicht zur Gestaltung |
| Unverändert | Gestaltung und Anker, die der Auftrag nicht betrifft, bleiben Zeichen für Zeichen, wie sie sind |
| Lage | nur `--x --y --b --h --drehen --spiegeln` im `style`, ganze px (Abschnitt 2); kein eigenes `transform`, `width`, `height`, `position` |
| Formen | `data-form` und die Parameter setzen; der Pfad darf fehlen, der Editor erzeugt ihn beim Öffnen. Ebenso die Teile einer Streuung und der Pfad eines Bogens. Eigene Pfade gehen als `data-form="pfad"` |
| Schrift | nur Andika und Fredoka |
| Farben | bevorzugt die Farben des Blatts (Liste unten), sie folgen Palette und Thema; eigene als Hex |
| Rezepte | Teile mit `data-aufmachung-teil` nicht von Hand ändern, sondern die Werte am `<body>`. Soll ein Teil anders werden, das Attribut vorher entfernen; dann ist er normale Gestaltung |
| Ids in SVG | Verläufe, Bogenpfade, Masken heißen `<art>-<4 Zeichen a–z, 0–9>` (`verlauf-k3f9`) und kommen im Material nur einmal vor; eine Kopie bekommt neue. Verweise stehen als Attribut (`fill="url(#verlauf-k3f9)"`, `href="#bogen-k3f9"`), nie als `url()` im `style` |
| Sicher | nur statisches HTML und SVG: kein Skript, keine Ereignisse, kein `foreignObject`, kein SVG-`image`, keine Adressen außerhalb des Blatts. Sonst lehnt der Server den Vorschlag ab |

Farben des Blatts:

<!-- erzeugt: blatt-farben -->
| Wert | Name im Farbwähler |
|---|---|
| `var(--haupt)` | Hauptfarbe |
| `var(--akzent)` | Akzentfarbe |
| `var(--dunkel)` | Dunkel |
| `var(--linie)` | Linienfarbe |
| `var(--fuell)` | Füllfarbe |
| `#ffffff` | Weiß |
| `#rrggbb` | eigene Farbe |
<!-- /erzeugt: blatt-farben -->
<!-- << 112 -->

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
| `data-aufmachung-teil` | von einem Rezept erzeugt; nicht von Hand ändern (Regeln für Claude) |

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
| `bildrahmen` | Bildrahmen | `.bildrahmen[data-lage="frei"]` | frei | vorne | `lage`, `duplizieren`, `loeschen`, `loesung` | E3 |
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
## Figur frei

Willi, Wilma und die anderen Figuren liegen frei auf der Seite, meist neben der Aufgabe, um die es geht. Die Figur
schaut zur Aufgabe: Schaut sie in ihrer Datei in die falsche Richtung, steht `--spiegeln:-1` im `style`.

```html
<div class="ebene vorne">
  <img class="figur-frei" data-lage="frei" data-figur="wilma" src="bilder/wilma.png" alt="Wilma"
       style="--x:610px;--y:520px;--b:150px;--spiegeln:-1">
</div>
```

- Nur die Klasse `figur-frei`, nie `figur`: `.figur` ist die Leitfigur im Tipp (`.tipp` mit `.blase`) und bleibt im
  Stapel. Soll die Figur etwas sagen, bleibt es beim Tipp.
- `data-figur` ist die Kennung aus der Liste unten, `src` die Datei dazu, `alt` der Name. Standardbreite 150px; die
  Höhe kommt aus dem Bild, also kein `--h`.
- Spiegeln und Drehen nur über `--spiegeln` und `--drehen`, nie über ein eigenes `transform`.
- In s/w druckt eine Figur mit Strichfassung ihr Strichbild, die anderen in Graustufen. Dafür ist nichts zu tun.

<!-- erzeugt: figuren -->
| `data-figur` | Name | Datei | In s/w | Schaut nach |
|---|---|---|---|---|
| `willi` | Willi | `bilder/willi.png` | Strichbild `willi-strich.png` | rechts |
| `wilma` | Wilma | `bilder/wilma.png` | Graustufen | rechts |
<!-- /erzeugt: figuren -->
<!-- << 102 -->

<!-- >> 103 Bilder frei -->
## Freie Bilder

Ein Foto oder eine Grafik, die frei auf der Seite liegt, schräg, groß als Aufmacher oder klein in der Ecke, ist ein
`img.bild-frei` in `.ebene.vorne` (für ein blasses Hintergrundfoto in `.ebene.hinten`). Die Breite steht in `--b`, nie
in `width` oder `height`. Die Höhe ergibt sich aus dem Bild.

```html
<div class="ebene vorne">
  <img class="bild-frei" data-lage="frei" src="bilder/marktplatz.jpg" alt="Marktplatz"
       style="--x:96px;--y:300px;--b:320px;--drehen:-3deg">
</div>
```

| Variable | Wirkung |
|---|---|
| `--b` | Breite in px; ein neues Bild höchstens 320px bzw. die Breite der Datei |
| `--h` | feste Höhe: Das Bild wird auf dieses Seitenverhältnis zugeschnitten (`object-fit: cover`) |
| `--bx`, `--by` | Ausschnitt beim Zuschnitt, z. B. `30%` und `20%` (ohne Angabe die Mitte, `50%`) |

- `src` zeigt wie bei jedem Bild in den Ordner `bilder/` der Mappe; `alt` beschreibt das Bild.
- Ein Bild-Baustein im Stapel (`<img>` ohne `data-lage`) bleibt, wie er ist. Soll er frei liegen, wird er hier als
  `img.bild-frei` neu geschrieben und im Stapel entfernt; eine Bildunterschrift wird dann eine Schmuckschrift
  `div.schmuck[data-schmuck="titel"]` darunter.
- Im Druck braucht ein Foto mindestens 150 dpi bei seiner Breite, sonst meldet die Prüfung `bild-unscharf`.
- Leitfiguren im Tipp bleiben `img.figur`; Willi und Wilma frei auf der Seite sind `img.figur-frei` (Figuren).
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
| Sprechblase | `sprechblase` | mit Text | `data-blase` `rund`, `eckig`, `gedanke`, Standard `rund` | 180 × 84 |
| Band | `band` | mit Text | `data-kerbe` 0–0.3, Standard 0.15 | 180 × 84 |
| Linie | `linie` | Linie | `data-anfang` `keine`, `pfeil`, `punkt`, Standard `keine`; `data-ende` `keine`, `pfeil`, `punkt`, Standard `keine` | 180 × 20 |
| Eigene Form | `pfad` | Pfad | – | 120 × 120 |
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
## Sprechblase, Band, Linie

**Form mit Text** (Sprechblase, Band) ist ein `div.form-text` mit `data-form`, darin ein `svg` (die Form, ohne Klasse)
und `div.form-inhalt` (der Text). Sie liegt frei in der Ebene `vorne`, die Box ist `--b` × `--h` (Standard 180 × 84).

```html
<div class="ebene vorne">
  <div class="form-text" data-lage="frei" data-form="sprechblase" data-blase="rund" data-zipfel="-26,70"
       style="--x:470px;--y:690px;--b:180px;--h:84px;--gr:22px;--ausrichtung:center">
    <svg viewBox="0 0 180 84" aria-hidden="true">
      <path d="M…Z" style="fill:#ffffff;stroke:var(--dunkel);stroke-width:3px;stroke-linejoin:round"/>
    </svg>
    <div class="form-inhalt">Zähl genau!</div>
  </div>
  <svg class="form" data-lage="frei" data-form="linie" data-punkte="10,10 170,40" data-anfang="keine" data-ende="pfeil"
       viewBox="0 0 180 50" style="--x:300px;--y:760px;--b:180px;--h:50px">
    <path d="M10 10 L…" style="fill:none;stroke:var(--dunkel);stroke-width:3px;stroke-linejoin:round;stroke-linecap:round"/>
    <path class="spitzen" d="M170 40 L…Z" style="fill:var(--dunkel);stroke:none"/>
  </svg>
</div>
```

- **Sprechblase:** `data-blase` = `rund` (Standard), `eckig` oder `gedanke` (Denkblase: kleine Kreise statt Zipfel).
  `data-zipfel="x,y"` ist die Spitze des Zipfels in px relativ zur linken oberen Ecke der Box (vor dem Drehen). Sie
  darf und soll außerhalb liegen, etwa auf der Mitte der Figur, die spricht; liegt sie in der Box, gibt es keinen
  Zipfel. Der Zipfel zählt nicht zur Box: Er darf in den Druckrand ragen, die Box nicht.
- **Band:** `data-kerbe` 0–0,3 (Tiefe der Kerben als Anteil der Breite, Standard 0,15).
- **Text:** wie Schmuckschrift (`--gr`, `--farbe`, `--schrift`, `--ausrichtung`, einzelne Wörter in
  `<span style="color:…">`). `--gr` mindestens 22 px bzw. die Schriftgröße der Klasse. Die Blase wächst nicht mit:
  Passt der Text nicht, meldet die Prüfung `abgeschnitten`; dann `--b`/`--h` größer oder den Text kürzer.
- **Linie und Pfeil:** `svg.form[data-form="linie"]` mit `data-punkte="x1,y1 x2,y2"` (px im Element) und
  `data-anfang`/`data-ende` = `keine` (Standard), `pfeil` oder `punkt`. Die Box umschließt beide Punkte mit etwa
  10 px Rand für Strich und Spitzen; eine Linie hat kein `--drehen` und keine Füllung (`fill:none`). Die Spitzen sind
  ein zweiter Pfad `path.spitzen`, gefüllt mit der Farbe der Kontur. `marker` geht auch, ist aber nicht nötig.
- **Der Pfad darf fehlen** wie bei jeder Form: Bei `.form-text` erzeugt der Editor das ganze `svg`, bei der Linie Pfad
  und Spitzen aus `data-punkte`. Ohne `data-zipfel` zeigt der Zipfel nach links unten, ohne `data-punkte` liegt die
  Linie waagerecht in der Mitte.
- Nie die Klasse `.blase` verwenden (Tipp-Blase im Stapel).
<!-- << 107 -->

<!-- >> 108 Aussehen -->
## Aussehen: Verlauf, Kontur-Stil, Schatten, Deckkraft

| Eigenschaft | Arten | Wo |
|---|---|---|
| Verlauf der Füllung | Form, Form mit Text | `<defs>` im `svg`, Verweis als Attribut `fill="url(#…)"` am Pfad |
| Kontur-Stil, Enden | Form, Form mit Text | `data-kontur-stil`, `data-kontur-enden` am Element |
| Schatten | Form, Form mit Text, Schmuckschrift, Bild, Figur | `data-schatten` am Element |
| Deckkraft | jedes Gestaltungselement | `opacity` im `style` des Elements |

**Verlauf.** Zwei Stopps in einem `<linearGradient>` oder `<radialGradient>` im `<defs>` desselben `svg`. Die Id heißt
`verlauf-` plus vier Zeichen aus a–z und 0–9 und kommt im Material nur einmal vor; beim Duplizieren bekommt die Kopie
eine neue. Der Pfad verweist **als Attribut** darauf und hat dann kein `fill` im `style` (`url()` im `style` lässt die
Prüfung nicht zu). Die Farben stehen als `stop-color` im `style` der Stopps, bevorzugt als Farben des Blatts. Der
Winkel eines linearen Verlaufs ist `gradientTransform="rotate(w .5 .5)"` (0 = von links nach rechts, im
Uhrzeigersinn). Text mit Verlauf gibt es nicht, auch nicht in der Schmuckschrift: Er druckt nicht zuverlässig.

```html
<svg class="form" data-lage="frei" data-form="stern" viewBox="0 0 120 120" style="--x:610px;--y:84px;--b:120px;--h:120px">
  <defs><linearGradient id="verlauf-k3f9" gradientTransform="rotate(90 .5 .5)">
    <stop offset="0" style="stop-color:var(--haupt)"/><stop offset="1" style="stop-color:var(--akzent)"/>
  </linearGradient></defs>
  <path d="M60 1.5 L…Z" fill="url(#verlauf-k3f9)" style="stroke:var(--dunkel);stroke-width:3px;stroke-linejoin:round"/>
</svg>
```

**Kontur-Stil.** `data-kontur-stil="gestrichelt"` oder `"gepunktet"` (ohne: durchgezogen), `data-kontur-enden="rund"`
(ohne: eckig). Der Editor schreibt daraus `stroke-dasharray` und `stroke-linecap` in den `style` des Pfads, relativ zur
Stärke s: gestrichelt `3s 2s`, gepunktet `0 2s` mit runden Enden. Claude setzt nur die Attribute oder schreibt die
Werte passend dazu.

```html
<svg class="form" data-lage="frei" data-form="rechteck" data-radius="16" data-kontur-stil="gestrichelt"
     viewBox="0 0 200 120" style="--x:300px;--y:400px;--b:200px;--h:120px">
  <path d="…" style="fill:none;stroke:var(--dunkel);stroke-width:3px;stroke-linejoin:round;stroke-dasharray:9 6"/>
</svg>
```

**Schatten.** `data-schatten="leicht"`, `"mittel"` oder `"stark"`: ein weicher grauer Schatten (`drop-shadow` in
`blatt.css`), in s/w unverändert. Kein `filter` und kein `box-shadow` im `style` dazu.

```html
<img class="bild-frei" data-lage="frei" data-schatten="mittel" src="bilder/marktplatz.jpg" alt="Marktplatz" style="--x:96px;--y:300px;--b:420px">
```

**Deckkraft.** `opacity` im `style`, 0.1 bis 1 in Schritten von 0.05; 1 schreibt man nicht. Gedacht etwa für ein
blasses Bild in der Ebene hinten.

```html
<div class="ebene hinten">
  <img class="bild-frei" data-lage="frei" src="bilder/wiese.jpg" alt="" style="--b:794px;opacity:0.4">
</div>
```
<!-- << 108 -->

<!-- >> 109 Streuung -->
## Streuung: Konfetti, Punkte, Sterne

Eine Streuung ist **ein** Element mit vielen erzeugten Teilen. Sie liegt hinten und fällt in s/w weg (Standard).

```html
<svg class="streuung" data-lage="frei" data-streuung="konfetti" data-saat="4711" data-dichte="0.5"
     data-formen="punkt dreieck raute streifen" data-farben="haupt akzent dunkel" data-groesse="mittel"
     viewBox="0 0 300 300" style="--b:300px;--h:300px"></svg>
```

So steht sie nach dem Öffnen im Editor, mit gespeicherten Teilen (Punkte in der Ecke links unten):

```html
<svg class="streuung" data-lage="frei" data-streuung="punkte" data-saat="4711" data-dichte="0.5"
     data-formen="punkt" data-farben="haupt akzent dunkel" viewBox="0 0 220 260"
     style="--y:863px;--b:220px;--h:260px">
  <circle cx="18" cy="242" r="7" style="fill:var(--haupt)"/>
  <circle cx="48" cy="242" r="5" style="fill:var(--akzent)"/>
</svg>
```

| Attribut | Bereich | Standard |
|---|---|---|
| `data-streuung` | `punkte`, `konfetti`, `sterne` | nötig |
| `data-saat` | ganze Zahl 1–999999 | fehlt sie, setzt der Editor eine |
| `data-dichte` | 0–1 | 0,5 |
| `data-formen` | Liste aus `punkt dreieck raute stern streifen` | je Art (Punkte: `punkt`, Sterne: `stern`) |
| `data-farben` | Liste aus `haupt akzent dunkel linie fuell a1 a2 a3 a4` | `haupt akzent dunkel` |
| `data-groesse` | `klein`, `mittel`, `gross` | `mittel` |
| `data-ecke` | `ol`, `or`, `ul`, `ur`; nur Punkte, dort stehen sie dichter | `ul` |
| `data-zonen` | `x,y,b,h;x,y,b,h` in px des Elements; Teile nur darin | ganze Fläche |

- **Die Kinder dürfen fehlen.** Schreibe nur das `svg` mit den Attributen; der Editor erzeugt die Teile beim Öffnen. Gleiche
  Saat und Parameter ergeben immer dieselben Teile, höchstens 200.
- **Nicht von Hand ändern.** Verteile die Teile nicht selbst und verschiebe keine einzelnen. Für ein anderes Bild
  `data-saat` ändern („neu würfeln“); Größe ändern erzeugt die Teile mit derselben Saat neu.
- Eine Streuung liegt in `.ebene.hinten`. Teile am Rand bleiben innerhalb des Elements.
<!-- << 109 -->

<!-- >> 110 Kontur und Titel im Bogen -->
## Schmuckschrift: Kontur und Titel im Bogen

**Kontur** um die Buchstaben eines Titels (HTML): `data-kontur` am Element, `--kontur` (0 bis 16 px) und
`--kontur-farbe` im `style`. Die Kontur liegt hinter der Füllung, die Buchstaben bleiben so dick wie ohne. Weiß ist die
übliche Wahl für dunkle Schrift auf Bild oder Fläche. In s/w bleibt Weiß weiß.

```html
<div class="schmuck" data-lage="frei" data-schmuck="titel" data-kontur
     style="--x:64px;--y:150px;--b:666px;--gr:56px;--farbe:var(--dunkel);--kontur:6px;--kontur-farbe:#fff">Die Formen-Detektive</div>
```

**Titel im Bogen:** `svg.schmuck` mit `data-schmuck="bogen"`, `data-bogen` (Krümmung −100 bis 100, 0 gerade, negativ
nach unten gewölbt), `viewBox`, `--b` und `--h`. Der Text steht in `text` mit `textPath`; Schrift, Größe und Farbe im
`style` des `text`, die Kontur dort als `stroke`, `stroke-width` und `paint-order:stroke`. Das SVG skaliert als Ganzes.

```html
<svg class="schmuck" data-lage="frei" data-schmuck="bogen" data-bogen="35" viewBox="0 0 600 160"
     style="--x:97px;--y:120px;--b:600px;--h:160px">
  <defs><path id="bogen-k3f9" d="M20 140 Q300 20 580 140"/></defs>
  <text text-anchor="middle" style="font:600 56px Fredoka,sans-serif;fill:var(--haupt);stroke:#fff;stroke-width:8px;paint-order:stroke">
    <textPath href="#bogen-k3f9" startOffset="50%">Zahlenzirkus</textPath>
  </text>
</svg>
```

- **Der Pfad darf fehlen.** Claude setzt `data-bogen`, `--b`, `--h` und den Text mit `textPath`; `viewBox`, `defs` mit
  dem Pfad und der Sprung `href` entstehen beim Öffnen im Editor (`ergaenzeBoegen`). Ein vorhandenes `d` bleibt.
- `href` an `textPath` darf nur auf eine Id im selben Dokument zeigen (`#bogen-…`), nie auf eine Adresse oder `data:`.
- Ids (`bogen-xxxx`) müssen im Dokument eindeutig sein; beim Kopieren vergibt der Editor neue.
- Den Bogen nur für einen Titel nehmen, nicht für Inhalt. Kein Titel im Bogen im Kopf eines Rezepts.
- Die Prüfung `schrift-klein` misst Text im SVG nicht: Die Größe im `font` selbst nicht unter die Grenze setzen.
<!-- << 110 -->

<!-- >> 111 Bildrahmen -->
## Rahmen-Stile, Masken, Bildrahmen

**Rahmen-Stil** an einem freien Bild (`img.bild-frei`, nicht an Figuren und nicht an Bild-Bausteinen im Stapel):

| `data-rahmenstil` | Aussehen |
|---|---|
| fehlt | gerade, nur das Bild |
| `schraeg` | dünner weißer Rand, weicher Schatten; dazu `--drehen:-3deg` |
| `polaroid` | weißer Rand, unten breiter, Schatten |
| `rund` | Kreis bzw. Ellipse, mit `--h` gleich `--b` ein Kreis |
| `kontur` | weißer Rand und dunkle Außenlinie wie ein Sticker |

**Maske:** Ein Bild in Form einer Form ohne Text (Stern, Herz, Wolke …). `data-maske` ist der Name der Form
(`data-form` aus der Tabelle der Formen), ihre Parameter stehen wie bei der Form als `data-*` daneben. Der Zuschnitt
selbst ist `clip-path` im `style`:

- Kreis bzw. Ellipse: `clip-path:ellipse(50% 50% at 50% 50%)`
- Rechteck mit runden Ecken: `clip-path:inset(0 round 20px)`
- jede andere Form: `clip-path:polygon(…)` mit Punkten in Prozent, z. B. ein Stern mit 10 Ecken

`clip-path` nur mit `polygon()`, `circle()`, `ellipse()`, `inset()`. `path()` und `url()` gehen nicht durch die Prüfung.
Maske und Rahmen-Stil schließen sich aus: Ein Bild hat entweder `data-maske` oder `data-rahmenstil`.

```html
<img class="bild-frei" data-lage="frei" data-maske="stern" data-zacken="5" src="bilder/marktplatz.jpg" alt="Marktplatz"
     style="--x:500px;--y:300px;--b:220px;--h:220px;--bx:40%;--by:50%;clip-path:polygon(50% 0%, 61.8% 34.5%, …)">
```

**Bildrahmen:** Ein leerer Rahmen, in den die Lehrkraft später ein Foto zieht. Er ist grau mit einem Bild-Symbol und
zählt für die Prüfung als Platzhalter (HINWEIS `platzhalter`). Er darf nicht in ein fertiges Material.

```html
<div class="bildrahmen platzhalter" data-lage="frei" data-maske="ellipse"
     style="--x:500px;--y:300px;--b:220px;--h:220px;clip-path:ellipse(50% 50% at 50% 50%)"></div>
```
<!-- << 111 -->

<!-- >> 114 Rezepte -->
## Rezepte (Aufmachung)

Ein Rezept gibt dem **ganzen Material** einen Look: Seitenfläche, Kopfband, Rahmen, Konfetti, Titelfarbe. Es besteht
aus Werten am `<body>`, aus Teilen, die der Editor daraus erzeugt, und aus Regeln in `blatt.css`. Im Minibuch gibt es
keine Rezepte.

```html
<body class="kl2 farbe palette-himmel" data-aufmachung="zirkus" data-aufmachung-farben="1"
      data-aufmachung-kopfband="welle" data-aufmachung-rahmen="gepunktet"
      data-aufmachung-konfetti="0.6 punkt dreieck stern" data-aufmachung-saat="4711"
      style="--a1:#e63946;--a2:#f77f00;--a3:#fcbf49;--a4:#1d3557;--a-flaeche:#fff8ec;--a-titel:#ffffff;--a-muster:#fdebd0">
```

| Wert am `body` | Bedeutung |
|---|---|
| `data-aufmachung` | Name des Rezepts (Tabelle unten) |
| `data-aufmachung-farben` | Farbwelt 1–3 |
| `data-aufmachung-kopfband` | `gerade`, `welle`, `bogen`, `zacken`; fehlt bei „ohne“ |
| `data-aufmachung-rahmen` | `ohne`, `linie`, `gestrichelt`, `gepunktet`, `doppelt` |
| `data-aufmachung-konfetti` | Menge 0–1, dann die Formen aus `punkt dreieck raute stern` |
| `data-aufmachung-saat` | ganze Zahl 1–999999; eine neue Saat würfelt Konfetti und Punkte neu |
| `--a1` … `--a4`, `--a-flaeche`, `--a-titel`, `--a-muster` | Farben der Farbwelt; nur Teile des Rezepts verweisen darauf |

**Teile.** Je Seite liegen zuunterst in `.ebene.hinten` die Seitenfläche, der Seitenrahmen und die Streuungen des
Rezepts, alle mit `data-aufmachung-teil` (`flaeche`, `rahmen`, `streuung`) und `data-gesperrt`. Das Kopfband ist kein
Element: `blatt.css` zeichnet es am `.kopf` aus den Werten am `body`, der Titel bekommt `--a-titel`. Eine Seite ohne
`.kopf` hat kein Kopfband; ein Thema mit eigenem Kopf (`.thema-kopf`, `.thema-band`) auch nicht. In s/w fallen
Fläche, Kopfband und Konfetti weg, der Titel wird dunkel.

- **Teile mit `data-aufmachung-teil` nicht von Hand ändern**, sondern die Werte am `body`; der Editor erzeugt die
  Teile daraus neu. Zum Ändern eines Teils erst freilegen (Schublade „Rezepte“) oder `data-aufmachung-teil` und
  `data-gesperrt` am Teil entfernen; dann ist es normale Gestaltung.
- Ein Rezept fasst nie Aufgaben, Nummern, Lösung, Bilder, Figuren oder eigene Gestaltung an.
- Ein Rezept ist kein Thema: Es ändert weder die Palette (`palette-*`) noch `thema.css`.
- Die Farben eines Rezepts (`var(--a1)` …) nur in Teilen des Rezepts benutzen.

<!-- erzeugt: aufmachungen -->
| Rezept | `data-aufmachung` | Farbwelten (`data-aufmachung-farben` 1–3) | Kopfband | Rahmen | Konfetti |
|---|---|---|---|---|---|
| Detektiv | `detektiv` | 1 Spurensuche (#1d3557 #f77f00 #2a9d8f #ffc43d), 2 Lupe (#3d348b #e76f51 #2a9d8f #f4a261), 3 Geheimakte (#22333b #c1121f #457b9d #f2c14e) | ohne | gestrichelt | `0.6 dreieck raute punkt` |
| Zirkus | `zirkus` | 1 Manege (#e63946 #f77f00 #fcbf49 #1d3557), 2 Zuckerwatte (#d6336c #f06595 #ffd43b #3b2f7a), 3 Abendvorstellung (#1971c2 #7048e8 #fcc419 #e03131) | Welle | gepunktet | `0.6 punkt dreieck stern` |
| Dschungel | `dschungel` | 1 Urwald (#2d6a4f #1b4332 #f9c74f #2a9d8f), 2 Lagune (#1d7874 #0b3c49 #f6bd60 #84a59d), 3 Mangrove (#3a5a40 #283618 #dda15e #588157) | Welle | linie | `0.6 punkt` |
| Ruhig | `ruhig` | 1 Grau (#343a40 #1d3557 #c4cad0 #6c757d), 2 Tinte (#1d3557 #343a40 #c3cedd #5c6f8a), 3 Schiefer (#2f3e46 #354f52 #c5cfc2 #52796f) | ohne | linie | `0 punkt` |
<!-- /erzeugt: aufmachungen -->
<!-- << 114 -->

<!-- >> 115 Fläche im Stapel -->
## Fläche im Stapel

Eine **Fläche** ist ein Baustein im Hauptstapel wie eine Aufgabe, aber mit Platz zum freien Gestalten: Ihre Kinder
sind Gestaltungselemente (`data-lage="frei"`), und `--x`/`--y` zählen von der **linken oberen Ecke der Fläche** aus.
Sie schneidet am Rand ab (`overflow:hidden`). Der Stapel schiebt, was darunter steht, mit, wenn sie höher wird.

```html
<div class="flaeche" style="--h:240px">
  <svg class="form" data-lage="frei" data-form="rechteck" style="--x:24px;--y:16px;--b:200px;--h:120px">…</svg>
  <div class="schmuck" data-lage="frei" data-schmuck="etikett" style="--x:260px;--y:60px">Haus</div>
</div>
```

- `--h` ist die Höhe in px (Standard 200, mindestens 40). Eine Fläche trägt keine Nummer und keinen Anker.
- **Wann Fläche, wann Anker:** Die Fläche, wenn das Gestaltete **zwischen** den Aufgaben steht und Platz im Fluss
  braucht (eine Zeichnung, ein Bild mit Beschriftung, ein Rahmen zum Ausmalen). Der Anker, wenn es **an** einem
  Baustein hängt und mit ihm wandert, ohne Platz zu nehmen. Alles andere liegt frei in der Ebene der Seite.
- Teile einer Fläche dürfen nicht über ihren Rand hinausragen: Die Prüfung meldet `abgeschnitten` („liegt über den
  Rand der Fläche hinaus“). Die Fläche höher machen oder das Element verkleinern und nach innen schieben.
- Nicht verwechseln mit der Seitenfläche (`.seitenflaeche`, Hintergrund der Seite) und der Prüfung `flaeche`.
- Im Editor: ⌘ beim Ziehen eines Elements aus der Schublade legt es in eine neue Fläche; „In den Stapel“ im ⋯ holt ein
  Element in eine neue Fläche; ein Element auf eine vorhandene Fläche ziehen legt es hinein, daraus heraus ziehen nimmt
  es wieder heraus. Die Höhe zieht man am Griff unter der Fläche.
<!-- << 115 -->

<!-- >> 116 Pfad -->
## Eigene Form (Pfad)

Eine eigene Form ist ein `svg.form` mit `data-form="pfad"`. **Hier ist das `d` die Quelle**, es gibt keine Parameter.
`viewBox` ist `0 0 b h` wie `--b`/`--h`, die Punkte stehen in px des Elements.

```html
<svg class="form" data-lage="frei" data-form="pfad" viewBox="0 0 160 90"
     style="--x:300px;--y:520px;--b:160px;--h:90px">
  <path d="M1.5 88.5 C30 10 80 10 100 45 L158.5 1.5"
        style="fill:none;stroke:var(--dunkel);stroke-width:3px;stroke-linejoin:round;stroke-linecap:round"/>
</svg>
```

- Für Umrisse, die keine Form der Liste hat: ein Land, ein Blatt, ein Weg mit Kurven, ein Pfeil um die Ecke. Gibt es
  die Form in der Liste, die Liste nehmen.
- Alle SVG-Befehle sind erlaubt, auch relative und `A`. Der Editor schreibt sie bei der ersten Änderung als `M L C Z`
  mit absoluten Zahlen.
- **Der Strich liegt innen** wie bei allen Formen: Die Punkte halten die halbe Strichstärke Abstand zum Rand.
- Geschlossen (`Z`) mit Füllung, offen nur mit Kontur (`fill:none`) und `stroke-linecap:round`.
- Größe ändern streckt die Punkte, der Strich bleibt gleich dick.
- Im Editor: Stift P zeichnet freihand und glättet beim Loslassen; endet der Zug am Anfang, ist er geschlossen.
  Pfad ⇧P setzt Punkte (Klick Ecke, Ziehen Kurve, Enter beendet, Klick auf den ersten Punkt schließt). Doppelklick
  auf einen Pfad bearbeitet seine Punkte.
<!-- << 116 -->

<!-- >> 117 Figur von Claude -->
## Figur von Claude

Wünscht sich die Lehrkraft eine eigene Figur („Figur von Claude zeichnen lassen“ in der Figuren-Schublade), zeichnest
du sie als freies Element (`data-frei`, `data-frei-titel`, siehe `abbildungen.md`, „Freies Element“) **mit**
`data-lage="frei"` in `.ebene.vorne` der genannten Seite. Der Auftrag nennt die Seite. Nur SVG, kein Bild, kein Foto.

```html
<div class="ebene vorne">
  <svg data-frei data-frei-titel="Eule mit Brille" data-lage="frei" viewBox="0 0 160 180"
       style="--x:420px;--y:360px;--b:160px">
    <g style="stroke:var(--dunkel);stroke-width:3px;stroke-linejoin:round">
      <path d="M30 60 L40 20 L62 46 Q80 40 98 46 L120 20 L130 60 Q150 120 120 160 Q80 178 40 160 Q10 120 30 60 Z"
            style="fill:var(--fuell)"/>
      <ellipse cx="80" cy="128" rx="30" ry="30" style="fill:#ffffff"/>
      <circle cx="58" cy="78" r="18" style="fill:#ffffff"/>
      <circle cx="102" cy="78" r="18" style="fill:#ffffff"/>
      <path d="M76 78 L84 78" style="fill:none"/>
      <path d="M74 94 L80 106 L86 94 Z" style="fill:var(--akzent)"/>
    </g>
    <circle cx="58" cy="80" r="6" style="fill:var(--dunkel)"/>
    <circle cx="102" cy="80" r="6" style="fill:var(--dunkel)"/>
  </svg>
</div>
```

- Ein **neues** Element: Was schon auf dem Blatt steht, auch ein gewählter Baustein, bleibt unverändert.
- Größe 120–200px in `--b`, `viewBox` passend zur Figur, kein `width`/`height` und kein `--h`: Die Höhe kommt aus
  der `viewBox`. Lage frei neben der Aufgabe, um die es geht, nie über Text.
- Farben als `var(--haupt)`, `var(--akzent)`, `var(--dunkel)`, `var(--fuell)` oder Weiß, damit die Figur zur Palette
  passt. Eine dunkle Kontur um jede Fläche, damit sie in s/w lesbar bleibt; Linien mindestens 1,5px.
- Wenige Pfade (höchstens etwa 15), einfache Formen, freundlicher Ausdruck, keine Schrift in der Figur.
- `data-frei-titel` ist der Name in den Ebenen, z. B. „Eule mit Brille“.
- Im Editor: Ein freies Element im Stapel legt „Frei legen“ (⋯) an derselben Stelle nach vorne; zurück geht es nur
  über „In den Stapel“ in eine Fläche.
<!-- << 117 -->

<!-- >> 118 Daten der Rezepte -->
<!-- << 118 -->

<!-- >> 119 Rezepte freilegen -->
**Freigelegtes Rezept.** „Freilegen“ (Schublade „Rezepte“ oder Reiter „Blatt“) macht alle Teile zu normaler
Gestaltung: `data-aufmachung*` am `body` und die Farben `--a1` … verschwinden, `data-aufmachung-teil` und
`data-gesperrt` an den Teilen auch. Jedes Teil trägt die Farben dann selbst in seinem `style`
(`--a1:#2d6a4f;--a2:#1b4332;…`), ein späteres Rezept färbt es nicht um. Das Kopfband wird eine Form
`svg.form[data-form="pfad"]` mit Verlauf ganz unten in `.ebene.hinten`, mit `data-sw="weg"`. Der Titel bekommt seine
Farbe als `style="color:#…"`.

- `data-sw="dunkel"` an einem Text (nur am Titel eines freigelegten Rezepts): in s/w dunkel statt der eigenen Farbe,
  sonst stünde weißer Titel auf weißem Grund. Nicht für anderes benutzen.
- Freigelegte Teile wie jede Gestaltung ändern; die Werte am `body` gibt es nicht mehr.
<!-- << 119 -->

<!-- >> 120 Gruppen -->
## Gruppe

Was zusammengehört (Figur mit Sprechblase, Etikett aus Form und Schrift), steht in einer **Gruppe**. Sie bewegt, dreht
und skaliert sich als Ganzes.

```html
<div class="gruppe" data-lage="frei" style="--x:420px;--y:600px;--b:300px;--h:220px;--drehen:-4deg">
  <img class="figur-frei" data-lage="frei" data-figur="wilma" src="bilder/wilma.png" alt="Wilma" style="--x:170px;--y:40px;--b:130px">
  <div class="form-text" data-lage="frei" data-form="sprechblase" style="--x:0px;--y:0px;--b:180px;--h:84px">…</div>
</div>
```

- In einer Gruppe stehen **nur Gestaltungselemente** (`data-lage="frei"`), nie Bausteine (Aufgaben, Text, Bilder im
  Stapel). Eine Gruppe darf eine Gruppe enthalten.
- `--x --y --b --h` der Gruppe umschließen die Kinder (nach deren Drehung); die Kinder stehen **in Koordinaten der
  Gruppe**, also relativ zu ihrer linken oberen Ecke. Lage und Größe erben sie nicht.
- Drehen und Spiegeln der Gruppe nur an der Gruppe (`--drehen`, `--spiegeln`), die Kinder drehen mit.
- Größer oder kleiner: `--x --y --b --h` jedes Kinds mit demselben Faktor ändern wie die Gruppe (px skalieren nicht von
  selbst), bei Schmuckschrift auch `--gr`. Strichstärken bleiben.
- Am Anker trägt die Gruppe `data-anker`, nicht ihre Kinder.
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

# Abbildungen: Größen, Daten und Zufall

Für die `x-…`-Elemente hier gilt der Kopf des Katalogs `references/abbildungen.md` („Für alle gilt“: Lösung, Farbe, unzulässige Angaben, Attributformate, `seed`, `masstab`).

## Größen

Muster: `assets/muster/groessen.html`. Beträge, Längen und Zeiten werden immer berechnet.

### `x-geld`: Münzen und Spielgeld-Scheine

```html
<x-geld stuecke="2€ 1€ 50ct 20ct 20ct" aufgabe="betrag"></x-geld>
<x-geld aufgabe="legen" betrag="3,45"></x-geld>
<x-geld stuecke="1ct 2ct 5ct 10ct 20ct 50ct 1€ 2€" massstab="original" anordnung="gruppiert"></x-geld>
```

`stuecke`: 1ct, 2ct, 5ct, 10ct, 20ct, 50ct, 1€, 2€, 5€, 10€, 20€, 50€, 100€, 200€, jedes Stück einzeln. `aufgabe`: `keine`, `betrag` (Antwortkästchen), `legen` (mit `betrag`; die Lösung legt mit möglichst wenigen Stücken, `stuecke` begrenzt dann den Vorrat). `anordnung` `reihe` oder `gruppiert`. `seite` `wert` oder `rueck` (nur Münzen). `massstab`: `original` (Münzen in echten mm, in Originalgröße drucken) oder Faktor 0,3 bis 1, Standard 0,5. Münzen haben echte Größenverhältnisse. Scheine sind schematisch, tragen „Spielgeld“ und bleiben höchstens 75 % groß (EZB/2013/10). Beträge bis Klasse 2 als „3 € 45 ct“, ab Klasse 3 als „3,45 €“. Nie Fotos oder KI-Bilder von echtem Geld.

### `x-skala`: Messgerät

```html
<x-skala art="lineal" von="0" bis="12" wert="7.5" aufgabe="ablesen"></x-skala>
<x-skala art="messbecher" einheit="ml" wert="300" aufgabe="ablesen"></x-skala>
<x-skala art="thermometer" wert="-5" aufgabe="einzeichnen"></x-skala>
<x-skala art="waage" einheit="g" bis="1000" loesung="350"></x-skala>
```

`art`: `lineal` (cm, mm), `massband` (cm, m), `messbecher` (ml, l), `thermometer` (°C, Standard −20 bis 40), `waage` (g, kg). `von`, `bis`, `einheit`, `teilung` (Hauptstrich und Zwischenstrich, z. B. `10 1`). `wert` zeigt den Wert, `loesung` erst im Lösungsblatt. `aufgabe`: `ablesen` (Antwortkästchen), `einzeichnen` (Marke erst in der Lösung). Das Lineal ist in Originalgröße, also in Originalgröße drucken; `massstab="nein"` verkleinert es auf `groesse` und schreibt „nicht zum Messen“ dazu. `groesse` ist sonst die Länge oder der Durchmesser in px.

### `x-strecke`: Strecke zum Messen

```html
<x-strecke laenge="7" beschriftung="A B"></x-strecke>
<x-strecke laenge="45 mm" richtung="schraeg"></x-strecke>
```

`laenge` in cm oder mm, immer in Originalgröße; was nicht auf die Seite passt, meldet das Element. `beschriftung` Buchstaben an den Enden, `richtung` `waagerecht` oder `schraeg`. Die Länge steht im Antwortkästchen der Lösung.

### `x-kalender`: Monat oder Jahr

```html
<x-kalender monat="2" jahr="2028" markiert="14" luecken="8 22" kw="ja"></x-kalender>
<x-kalender art="jahr" jahr="2028"></x-kalender>
```

`art` `monat` oder `jahr` (12 Monate auf einer Seite). Wochen beginnen am Montag, Schaltjahre stimmen. `markiert` Tage mit Ring, `luecken` Tage ohne Zahl; im Jahreskalender als `Monat-Tag`, z. B. `2-14`. `kw="ja"` Kalenderwochen. Feiertage und Ferien kommen nicht automatisch, sie sind je Land verschieden: über `markiert`.

### `x-zeitspanne`: Zeitspanne am Zeitstrahl

```html
<x-zeitspanne von="8:20" bis="9:45"></x-zeitspanne>
<x-zeitspanne von="8:20" bis="10:00" spruenge="bis 9:00, +1 h" zeige="von spruenge"></x-zeitspanne>
```

Ohne `spruenge` geht es zur vollen Stunde, über die ganzen Stunden und dann zum Ende. Sprünge: `bis 9:00`, `+40 min`, `+1 h`. `zeige` mehrfach: `von`, `bis`, `spruenge`, `dauer`; Standard `von bis`. Bis 24 Stunden; in Klasse 1 und 2 nicht über Mitternacht.

## Daten und Zufall

Muster: `assets/muster/daten-und-zufall.html`.

### `x-gluecksrad`: Glücksrad

```html
<x-gluecksrad felder="rot: 1; blau: 2; gruen: 3" anteile="1 1 2" groesse="200"></x-gluecksrad>
<x-gluecksrad felder="leer: 1; leer: 2; leer: 3; leer: 4" loesung="rot blau rot rot"></x-gluecksrad>
<x-gluecksrad bastel="ja" felder="rot: 1; blau: 2; gruen: 3"></x-gluecksrad>
```

| Attribut | Bedeutung |
|---|---|
| `felder` | 2 bis 12 Felder: `Füllung: Beschriftung`, Füllung `rot`, `blau`, `gruen`, `gelb`, `orange`, `lila`, `grau`, `leer` |
| `anteile` | eine Zahl je Feld; ohne sind alle Felder gleich groß |
| `loesung` | Füllung je Feld nur auf dem Lösungsblatt; auf dem Arbeitsblatt bleibt alles weiß („Male so an, dass …“) |
| `zeiger`, `legende` | `ja` (Standard) oder `nein` |
| `bastel` | `ja`: Originalgröße Ø 12 cm mit Mitte und Hinweis zu Bleistift und Büroklammer; beim Anlegen `--druckhinweis "In Originalgröße drucken (100 %)"` |
| `groesse` | Durchmesser in px, 100 bis 460 |

s/w: Muster und Legende (das Kästchen zeigt das Muster zur Farbe); ohne Legende nicht zu lesen. Jedes Feld mindestens 20°, sonst Fehler. Eine Beschriftung erscheint nur, wenn sie in das Feld passt.

### `x-wuerfel`: Würfel

```html
<x-wuerfel augen="5"></x-wuerfel>
<x-wuerfel loesung="3"></x-wuerfel>
<x-wuerfel art="zahl" inhalt="12"></x-wuerfel>
<x-wuerfel ansicht="raeumlich" oben="1" vorne="2" rechts="3"></x-wuerfel>
```

`augen` 0 bis 6, `art` `augen`, `zahl`, `muster` (`inhalt` ist eine Füllung) oder `text`, `inhalt`, `loesung` nur auf dem Lösungsblatt, `ansicht` `flach` oder `raeumlich`, `groesse` 32 bis 200. Räumlich: Gegenüberliegende Seiten ergeben 7 und sind nie zusammen sichtbar, sonst Fehler. Sonderwürfel mit eigenen Seiten: `x-wuerfelnetz`.

### `x-strichliste`: Strichliste

```html
<x-strichliste werte="Hund: 7; Katze: 4" zeige="striche"></x-strichliste>
```

`werte` bis 8 Zeilen und 30 Striche je Zeile, `zeige` `striche` (Anzahl offen), `zahl` (Striche offen) oder `leer`; die fehlende Spalte steht auf dem Lösungsblatt. `groesse` Zeilenhöhe 28 bis 60. Fünferbündel: vier senkrechte Striche, der fünfte schräg darüber.

### `x-diagramm`: Diagramm

```html
<x-diagramm werte="Mo: 3; Di: 7; Mi: 12" offen="2" einheit="Kinder"></x-diagramm>
<x-diagramm art="balken" werte="Hund: 20; Katze: 35" skala="5"></x-diagramm>
<x-diagramm art="bild" werte="Äpfel: 6; Birnen: 3" symbol="stern" je="2"></x-diagramm>
```

`art` `saeulen`, `balken` oder `bild`; `werte`; `offen` Nummern der Einträge, die die Kinder zeichnen (stehen auf dem Lösungsblatt); `skala` Schritt, sonst automatisch; `bis`; `einheit` Achsenbeschriftung; `symbol` `kreis`, `quadrat`, `stern`, `herz` und `je` beim Bilddiagramm; `groesse` Höhe der Skala 100 bis 400.

Die Skala beginnt immer bei 0, höchstens 12 Linien. Werte liegen auf einem Skalenstrich oder genau dazwischen, sonst Fehler. Halbe Symbole gibt es nur bei `je="2"`.

### Temperaturverlauf mit `x-diagramm`

```html
<x-diagramm art="linie" werte="Mo: -5; Di: -2; Mi: 0; Do: 3" offen="3 4" von="-10" bis="10" skala="5" einheit="°C"></x-diagramm>
<x-diagramm art="linie" werte="Mo; Di; Mi; Do; Fr" von="-10" bis="30" skala="5" einheit="°C"></x-diagramm>
```

Nur `art="linie"` nimmt Werte unter null; `von` setzt den Skalenbeginn, die Null-Linie ist dann kräftig. `offen`: Punkte erst im Lösungsblatt. Einträge ohne Wert bleiben auch dort leer, z. B. für einen Beobachtungsbogen ohne feste Lösung.

### `x-urne`: Kugeln im Säckchen

```html
<x-urne kugeln="rot: 3; blau: 5" form="sack" seed="1"></x-urne>
<x-urne form="glas" loesung="rot: 4; gruen: 2"></x-urne>
```

`kugeln` Füllung und Anzahl, höchstens 20 Kugeln; `loesung` Kugeln nur auf dem Lösungsblatt; `form` `sack` oder `glas`; `legende`; `seed`; `groesse` 100 bis 300.

### `x-wahrscheinlichkeit`: Skala der Begriffe

```html
<x-wahrscheinlichkeit stufen="3" ereignisse="A: sicher; B: unmöglich; C: möglich"></x-wahrscheinlichkeit>
```

`stufen` 3 (unmöglich, möglich, sicher) oder 5 (zusätzlich wenig und sehr wahrscheinlich); `ereignisse` Buchstabe und Stufe. Auf dem Arbeitsblatt stehen unter jeder Stufe gleich viele leere Kästchen, damit die Anordnung die Lösung nicht verrät. Die Ereignisse selbst beschreibt die Aufgabe.

### `x-kombinatorik`: Möglichkeiten

```html
<x-kombinatorik stufen="Waffel Becher / Erdbeer Schoko Vanille"></x-kombinatorik>
<x-kombinatorik art="tabelle" stufen="Rot Blau / Hut Tuch"></x-kombinatorik>
<x-kombinatorik art="liste" stufen="Erdbeer Schoko Vanille / Erdbeer Schoko Vanille" wiederholung="nein" reihenfolge="nein"></x-kombinatorik>
```

`art` `baum`, `tabelle` (genau 2 Stufen) oder `liste`; `stufen` je Stufe die Wörter, getrennt mit `/`; `wiederholung` und `reihenfolge` `ja` (Standard) oder `nein`; `vorgegeben` wie viele Möglichkeiten schon dastehen (Standard 1). „2 aus 3 Sorten“ sind zwei gleiche Stufen. Höchstens 3 Stufen und 24 Möglichkeiten. Das Lösungsblatt zeigt alle Zweige und die Anzahl.

# Abbildungen: Klassenarbeit

Für die `x-…`-Elemente hier gilt der Kopf des Katalogs `references/abbildungen.md` („Für alle gilt“: Lösung, Farbe, unzulässige Angaben, Attributformate, `seed`, `masstab`).

### `x-gesamtpunkte`

```html
<x-gesamtpunkte></x-gesamtpunkte>
```

Zählt die `.punkte` aller Aufgaben ohne Sternchenaufgaben, also auch nach Umstellen und Löschen richtig. Am `<body>` blendet die Klasse `ohne-punkte` Punkte und Gesamtpunkte aus.

### `x-notenschluessel`

```html
<x-notenschluessel></x-notenschluessel>
<x-notenschluessel grenzen="1:90; 2:75; 3:60; 4:45; 5:20" gesamt="20"></x-notenschluessel>
```

`grenzen`: Prozent für Note 1 bis 5, von oben nach unten kleiner. Ohne `grenzen` gilt der Vorschlag, und das Blatt sagt das. `gesamt`: feste Summe; ohne sie zählt das Blatt wie `x-gesamtpunkte`.

### `x-notenspiegel`

```html
<x-notenspiegel></x-notenspiegel>
```

Leere Verteilung und Durchschnitt zum Eintragen. Nie mit Namen von Kindern.

### `x-unterschrift`

```html
<x-unterschrift felder="beides" text="Unterschrift"></x-unterschrift>
```

`felder`: `beides`, `datum`, `unterschrift`. `text`: Beschriftung der Unterschrift.

### `x-erwartungshorizont`

```html
<x-erwartungshorizont></x-erwartungshorizont>
```

Erscheint nur in der Lösung. Sammelt je Aufgabe `data-l`, `loesung`, `nur-loesung` und Lücken, dazu die Punkte; `data-afb="I"` an der `.aufgabe` ergibt die Spalte Bereich. Rechnet das Blatt anderes (etwa `x-zuordnen`), steht dort „siehe Lösungsblatt“.

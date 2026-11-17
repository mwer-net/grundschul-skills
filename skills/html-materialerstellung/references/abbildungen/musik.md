# Abbildungen: Musik

Für die `x-…`-Elemente hier gilt der Kopf des Katalogs `references/abbildungen.md` („Für alle gilt“: Lösung, Farbe, unzulässige Angaben, Attributformate, `seed`, `masstab`).

## Musik

Muster: `assets/muster/musik.html`. Noten nie als Text oder KI-Bild setzen: Das Element balkt, setzt die Hälse und prüft die Takte.

### `x-rhythmus`

```html
<x-rhythmus art="karte" takt="2/4" noten="4 8 8" silben="ta"></x-rhythmus>
<x-rhythmus takt="4/4" noten="4 8 8 4 r4 | 8 8 8 8 2" aufgabe="silben"></x-rhythmus>
<x-rhythmus art="grafisch" takt="4/4" noten="4 8 8 2"></x-rhythmus>
```

`takt` `2/4`, `3/4`, `4/4`. `noten` wie in LilyPond: `1`, `2`, `4`, `8`, Punkt (`2.`, `4.`), Pause mit `r` (`r4`), Takte mit `|`. Jeder Takt muss aufgehen, sonst FEHLER mit Taktnummer; `auftakt="ja"` erlaubt einen kürzeren ersten und letzten Takt. Keine Sechzehntel und Triolen. `art` `zeile`, `karte` (genau ein Takt, Notenkopf 8 mm) oder `grafisch` (Strich und Punkt, Pausen als Lücke, Kl. 1/2). `silben` `keine`, `ta` (ta, ti, ta-a) oder die Silben der Klasse mit Leerzeichen, eine je klingende Note. `aufgabe` `keine`, `silben` (Felder, Lösung nennt sie), `noten` (Silben gegeben, Noten im Lösungsblatt), `ergaenzen` (`offen`: Nummern der fehlenden Noten, ohne Angabe die letzte). `linie="ja"` zieht die Rhythmuslinie. Im Kartenbogen breite Takte auf `--spalten:1` setzen: Eine Karte mit acht Achteln braucht rund 12 cm.

### `x-noten`

```html
<x-noten takt="4/4" noten="c'4 d'4 e'4 f'4 | g'2 g'2" namen="ja"></x-noten>
<x-noten takt="3/4" noten="g'4 a'4 h'4 | c''2." aufgabe="zeichnen"></x-noten>
<x-noten systeme="4"></x-noten>
```

`noten` mit Tonhöhe, Oktaven mit Strichen: `c'` bis `h'`, `c''` bis `a''`; mehr geht nicht. Deutsche Namen: `h` ist die weiße Taste über `a` (`b` meint dasselbe, ein erniedrigtes h kommt über die Vorzeichnung). `namen="ja"` Notennamen darunter. `text` Liedsilben mit Leerzeichen, eine je Note. `aufgabe` `keine`, `benennen` (Felder, Lösung nennt die Namen), `zeichnen` (Namen gegeben, Noten im Lösungsblatt). `systeme` leere Notenzeilen. `vorzeichen` `keine`, `b` (F-Dur), `kreuz` (G-Dur), ab Kl. 4. `auftakt`, `takt` und `breite` wie oben; zu lange Stücke brechen nach einem Takt um.

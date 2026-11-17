# Abbildungen: Rätsel und Spiele

Für die `x-…`-Elemente hier gilt der Kopf des Katalogs `references/abbildungen.md` („Für alle gilt“: Lösung, Farbe, unzulässige Angaben, Attributformate, `seed`, `masstab`).

## Rätsel

Muster: `assets/muster/raetsel.html`, `assets/muster/raetsel-kl1.html`. Suchsel, Kreuzworträtsel und Lösungswörter nie von Hand bauen: Die Elemente legen die Wörter und prüfen, dass alles aufgeht. Nur mit Anschlussaufgabe einsetzen (Wörter aufschreiben, Sätze bilden), nicht als bloße Beschäftigung.

### `x-suchsel`

```html
<x-suchsel spalten="10" zeilen="10" woerter="Hund; Katze; Maus"></x-suchsel>
<x-suchsel wortliste="bilder" woerter="dog: bild:bilder/hund.png; cat: bild:bilder/katze.png"></x-suchsel>
```

`woerter` nur Buchstaben; optional hinter `: ` ein Mini-Inhalt für `wortliste="bilder"`. `wortliste` `text`, `bilder`, `keine`. `spalten`, `zeilen` 5 bis 20, Standard 10; Zelle 1 cm (Kl. 1/2), 0,8 cm (Kl. 3/4), also höchstens 16 bzw. 20 Spalten. `richtungen` aus `rechts runter diagonal rueckwaerts`, Standard nach Klasse: Kl. 1 nach rechts, Kl. 2 auch nach unten, ab Kl. 3 auch schräg; rückwärts nur auf Wunsch in Kl. 4. `buchstaben` `gross` oder `wie-geschrieben`, Kl. 1/2 groß. Ä, Ö, Ü sind eine Zelle, ß wird in Großschreibung zu SS. Jedes Wort steht genau einmal im Gitter, deshalb darf kein Wort in einem anderen stecken (`Oma` und `Omas`). `seed` für ein anderes Gitter. Lösung: Rahmen um jedes Wort.

### `x-kreuzwort`

```html
<x-kreuzwort loesungswort="HEFT" eintraege="Damit schreibst du.: STIFT; bild:bilder/stuhl.png: STUHL"></x-kreuzwort>
<x-kreuzwort art="senkrecht" loesungswort="BAUM" eintraege="Du isst sie.: BIRNE; Darin wohnst du.: HAUS; Das Tier bellt.: HUND; Er scheint nachts.: MOND"></x-kreuzwort>
```

`eintraege` Hinweis (Text oder Mini-Inhalt) und Wort, 2 bis 12. `art="kreuz"` legt die Wörter frei und zusammenhängend, sie berühren sich nur an Kreuzungen; `loesungswort` markiert dann passende Felder mit Nummern. `art="senkrecht"` legt die Wörter untereinander, das Lösungswort steht in einer Spalte; es braucht so viele Buchstaben, wie es Wörter sind, und jedes Wort muss seinen Buchstaben enthalten. Findet sich kein Gitter: ein Wort tauschen oder `seed` ändern.

### `x-loesungswort`

```html
<x-loesungswort wort="SONNE" bezug="3" zuordnung="42: S; 64: O; 27: N; 28: N; 45: E" ablenker="24: U; 72: K"></x-loesungswort>
```

Selbstkontrolle zu einer Aufgabe: `bezug` ist die Nummer der Aufgabe auf demselben Blatt, ihre `.antwort` liefern in Reihenfolge die Buchstaben. `zuordnung` hält fest, welches Ergebnis zu welchem Buchstaben gehört, auch mit `bezug`: Nur so fällt auf, wenn sich später eine Lösung ändert („Aufgabe 3, Eintrag 2 hat jetzt die Lösung 48; das Lösungswort stimmt nicht mehr.“). Fehlt sie, nennt die Meldung, was einzutragen ist. Ohne `bezug` nur `wort` und `zuordnung`. `ablenker` sind typische falsche Ergebnisse (±1, Zahlendreher; `fach-mathematik`) mit eigenem Buchstaben. Ein Ergebnis gehört immer zu genau einem Buchstaben.

## Spiele

Muster: `assets/muster/spiele.html`. Bingo, Domino und Spielpläne nie von Hand bauen: Die Elemente mischen, prüfen und legen Folgeseiten selbst an. Ein Element, das mehr als eine Seite füllt, steht allein auf seiner `.seite`; die Folgeseiten (`data-erzeugt`) gehören nicht in die Quelle. FEHLER aus `blatt.py` ernst nehmen: Sie heißen, dass das Spiel so nicht funktioniert.

**Mini-Inhalte** statt Text, in jedem Feld: `uhr:7:30`, `wuerfel:5`, `menge:7`, `geld:2€ 50ct`, `rhythmus:4 8 8 4`, `bild:bilder/katze.png`. Listen trennt `;`, zwei Seiten eines Eintrags trennt `: ` mit Leerzeichen.

### `x-bingo`

```html
<x-bingo felder="3" karten="28" je-seite="2" eintraege="7·8: 56; 6·9: 54; 3·4: 12; 5·6: 30; 8·8: 64; 4·7: 28; 9·3: 27; 6·6: 36; 7·7: 49; 2·9: 18; 8·3: 24; 9·9: 81; 5·7: 35"></x-bingo>
```

`eintraege` Ruf und Feld, ohne `: ` beides gleich. `felder` 3 (Kl. 1), 4 oder 5; `karten` 1 bis 40; `je-seite` 1, 2 oder 4; `frei="ja"` Joker in der Mitte bei ungerader Größe; `rufliste="nein"` ohne Rufliste; `seed` für andere Karten. Nötig sind Felder × Felder + 4 Einträge, alle verschieden. Zwei Karten unterscheiden sich in mindestens zwei Feldern. Feld mindestens 2,5 cm (Kl. 1/2), 2 cm (Kl. 3/4). Die Rufliste enthält alle Einträge in gemischter Reihenfolge und steht auf einer eigenen Seite des Lösungsblatts.

### `x-domino`

```html
<x-domino kette="geschlossen" paare="7·8: 56; 6·9: 54; 3·4: 12; 5·6: 30; 8·8: 64; 4·7: 28; 9·3: 27; 6·6: 36; 7·7: 49; 2·9: 18; 8·3: 24; uhr:7:30: halb 8"></x-domino>
```

`paare` Aufgabe und Lösung, 12 bis 24. `kette` `geschlossen` (der erste Stein trägt die Lösung des letzten) oder `offen` (mit „Start“ und „Ende“, ein Stein mehr). `je-seite` gerade Zahl bis 16, Standard 12; `rueckseite="nummer"` zeigt die Nummer auf jedem Stein, zur Selbstkontrolle; `seed` für eine andere Lage. Keine Lösung doppelt, keine Lösung gleich einer Aufgabe. Auf dem Blatt gemischt, auf dem Lösungsblatt in Kettenfolge mit Nummern.

### `x-spielplan`

```html
<x-spielplan felder="30" form="schlange" inhalt="; 7+8; ?; +3; ★" leitern="3-14; 17-5" loesungen="2: 15"></x-spielplan>
<x-spielplan art="lernlandkarte" inhalt="Ich kann bis 100 zählen.; Ich kann zum Zehner ergänzen."></x-spielplan>
```

`felder` 20 bis 40; `form` `schlange`, `spirale`, `rundweg`, `leiter`. `inhalt` je Feld ab Feld 1, leere Einträge zählen mit; Feld 1 und das letzte tragen `start` und `ziel`. Sonderfelder `?`, `★`, `+3`, `−2`. `leitern` von-bis; rückwärts ist es eine Rutsche (gestrichelt); auf einem Feld endet höchstens eine, eine Leiter kreuzt höchstens eine andere. `loesungen` `Feld: Lösung` als Kontrollkarte auf dem Lösungsblatt. Passt der Weg nicht, meldet das Element einen Fehler: weniger Felder oder `a4-quer`, `a3-hoch`. `art="lernlandkarte"`: `inhalt` sind 2 bis 12 Ich-kann-Ziele, je Station drei Kreise zum Anmalen.

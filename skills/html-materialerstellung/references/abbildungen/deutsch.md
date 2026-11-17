# Abbildungen: Deutsch

Für die `x-…`-Elemente hier gilt der Kopf des Katalogs `references/abbildungen.md` („Für alle gilt“: Lösung, Farbe, unzulässige Angaben, Attributformate, `seed`, `masstab`).

## Deutsch

Muster: `assets/muster/deutsch.html`.

### `x-lineatur`

```html
<x-lineatur art="2" zeilen="3" vorlage="Rosine" vorlage-zeilen="1" anfang="Ha" loesung="Der Hund bellt."></x-lineatur>
```

`art` `1`, `2`, `3`, `4`, `karo`, `karo-klein`; Maße in `grundschul-didaktik/references/gestaltung.md`. `zeilen` 1 bis 30. `vorlage` grau zum Nachspuren (Schriftgröße folgt dem Mittelband), `vorlage-zeilen` wie viele Zeilen, `anfang` schwarzes Vorbild am Zeilenanfang. `loesung` nur im Lösungsblatt, wird umbrochen und muss in die freien Zeilen passen. `schrift="va"` setzt Vorlage, Vorbild und Lösung in Vereinfachter Ausgangsschrift (nicht im Karo); ohne Angabe Druckschrift. Text in Schreibschrift außerhalb der Linien: Klasse `schreibschrift`, nur als Vorlage zum Abschreiben, nie für Lesetext. `mittelband` `linie` oder `getoent` (nur in Farbe, nur auf Wunsch). `band` 2 bis 10 mm überschreibt das Mittelband, falls das Heft der Klasse anders misst. `breite` in px, Standard ganze Spalte. Fest in Originalgröße; der Druckhinweis erscheint von selbst. Zu langer Text meldet einen Fehler, gekürzt wird nichts.

### `x-silben`

```html
<x-silben>Die Ro|si|ne ist süß.</x-silben>
<x-silben darstellung="beides" farben="blau rot">Zu|cker</x-silben>
<x-silben aufgabe="boegen">Ta|fel</x-silben>
```

Inhalt: Text mit `|` an den Silbengrenzen; ein Wort ohne `|` ist eine Silbe. Ziffern und andere Zeichen bleiben ohne Bogen stehen. Nicht erlaubt: `||`, `|` am Wortanfang oder -ende. `<mark>` und `<b>` im Text bleiben sichtbar: `<x-silben>B<mark>ie</mark>|n<mark>e</mark></x-silben>`. `darstellung` `boegen`, `farbe`, `beides`; in s/w immer Bögen. `farben` zwei aus `blau`, `rot`, `gruen`, `lila`, `braun`, `schwarz`; je Wort beginnt die erste Farbe neu. `aufgabe` `keine`, `boegen` (Bögen nur im Lösungsblatt), `trennen` (Striche nur im Lösungsblatt). Silbenregeln: `fach-deutsch`.

Im Fließtext: `<x-silben im-text>Ro|si|ne</x-silben>` bleibt in der Zeile.

### Zeilennummern im Lesetext

```html
<p class="text" data-zeilennummern="5">Text des Lesetexts …</p>
```

`data-zeilennummern`: `1` jede Zeile, `5` alle 5 Zeilen. Der Browser zählt beim Zeichnen die echten Zeilen, über alle Absätze und Seiten des Dokuments. Keine Nummern von Hand setzen.

### `x-wortarten`

```html
<x-wortarten aufgabe="bestimmen" nur="N V">Der/Art Hund/N bellt/V laut/A.</x-wortarten>
```

Inhalt: Kürzel mit `/` am Wort; Wörter ohne Kürzel bleiben ohne Zeichen. Kürzel: `N` Nomen, `Art` Artikel, `V` Verb, `A` Adjektiv, `P` Pronomen, `Pr` Präposition, `K` Konjunktion, `Adv` Adverb. `darstellung` `symbole` (Montessori-Formen unter dem Wort) oder `unterstreichen` (Linienart je Wortart). `nur` Kürzel, die gezeigt werden. `farben` Klassenfarben, z. B. `N: blau; V: rot` (blau, rot, gruen, lila, braun, schwarz, hellblau, rosa, orange); wirkt nur in Farbe. `aufgabe` `keine` oder `bestimmen` (leere Symbolplätze, Symbole und Linien nur im Lösungsblatt).

### `x-satzglieder`

```html
<x-satzglieder aufgabe="umstellen">[Der Hund]S [bellt]P [den Briefträger]AkO [an]P.</x-satzglieder>
```

Inhalt: Satzglieder in eckigen Klammern mit Rolle `S`, `P`, `AkO`, `DaO`, `Ort`, `Zeit`; das Prädikat darf zweiteilig sein. `aufgabe` `keine` (Rollen über den Kästchen), `bestimmen`, `umstellen` (leere Kästchen, Umstellung nur im Lösungsblatt), `fragen` („Wen oder was?“). `vorn` Rolle, die beim Umstellen nach vorn kommt; Standard das nächste Satzglied. `ausschneiden="ja"` Satzstreifen mit gestricheltem Rand.

Die Umstellung setzt das finite Verb an die zweite Stelle, die Verbpartikel ans Ende und passt die Großschreibung an. Nur Sätze mit dem Prädikat an zweiter Stelle, keine Fragen. Am Satzanfang schreibt sie Artikel, Pronomen, Präpositionen und Zeitwörter klein, ebenso ein Wort mit Adjektivendung vor einem Nomen; Nomen und Namen bleiben groß. **Prüfe die Lösung bei Doppelnamen auf -e, -er oder -en (`Peter Müller`)**: Sie würden klein; stelle solche Sätze um oder wähle einen anderen Satz.

### `x-wortbausteine`

```html
<x-wortbausteine stamm="fahr" aufgabe="zerlegen">ver|fahr|en</x-wortbausteine>
<x-wortbausteine art="familie" aufgabe="familie" woerter="Fahrer; Abfahrt; fahren">fahr</x-wortbausteine>
```

Inhalt: Bausteine mit `|`, ein Wort ohne Leerzeichen; bei `art="familie"` nur der Stamm. `stamm` muss einer der Bausteine sein. `woerter` 1 bis 8 Wörter der Familie um den Stamm. `aufgabe` bei `wort`: `keine`, `zerlegen` (Kästchen nur im Lösungsblatt), `zusammensetzen` (Wort nur im Lösungsblatt); bei `familie`: `keine`, `familie` (Wörter nur im Lösungsblatt).

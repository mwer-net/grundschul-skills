# Klassen von blatt.css

Welche Klassen `assets/blatt.css` kennt und wofür, damit du die CSS zum Bauen nicht liest. Je Zeile der erste Satz des Kommentars in `blatt.css` und die Klassen, die danach zum ersten Mal vorkommen; Überschriften sind die großen Abschnitte der Datei. Wie die Bausteine zusammengehören, zeigen `references/layout.md` und die Vorlagen in `assets/`. Klassen, die nur innerhalb eines `x-…`-Elements stehen, setzt `abbildungen.js` selbst: Du schreibst das Element ([abbildungen.md](abbildungen.md)), nicht seine Klassen.

Nicht aus `blatt.css`: `.aufdecken` setzt `praesentation.js` (Antippen deckt auf, [folien.md](folien.md)).

<!-- erzeugt: klassen-index -->
- Vereinfachte Ausgangsschrift für Schreibvorlagen; die Buchstaben verbinden sich von selbst (calt): `.kl1` `.kl2` `.kl3` `.kl4`
- Blätter mit Zeitziel (data-zeit, Menge nach Arbeitszeit): Lesetext ab Kl. 2 am unteren Rand der Spanne aus grundschul-didaktik (16, 14, 12 pt), damit …: `.folie` `.farbe` `.palette-sonnig` `.palette-himmel` `.palette-wiese` `.palette-beere`
- Schulziffern; die Seite (`section.seite`): `.seite`
- Formate: Klasse am <body>; Standard A4 hoch: `.a4-quer` `.a3-hoch` `.a5-hoch`
- Mini-Book: acht Felder in Lesereihenfolge; 16 px Rand hält den Inhalt 4 mm von der Falz: `.minibuch` `.faltanleitung`
- Kopf: `.namenszeile` `.name` `.datum` `.kopf` `.titel` `.ziel` `.wahlhilfe`
- Aufgabe: hängende Nummer, kein Kasten: `.aufgabe` `.trenner` `.nr` `.stern` `.anw` `.text` `.niveau` `.punkte` `.koerper`
- Item-Reihen: `.reihe` `.zelle` `.links` `.zeile`
- Antworten: leer auf dem Arbeitsblatt, gefüllt im Beispiel und auf dem Lösungsblatt: `.antwort` `.kurz` `.breit` `.lang` `.box`
- Lösungsblatt (`body.loesung`; `.nur-loesung` nur dort, `.nicht-loesung` nur auf dem Arbeitsblatt, `.beispiel` zeigt die Lösung schon auf dem Arbeitsblatt), Malfeld, Sicherheitshinweis, Schreiblinie, Kästchen, s/w: `.loesung` `.loesung-marke` `.beispiel` `.malfeld` `.sicherheit` `.sw` `.nur-loesung` `.nicht-loesung` `.schreiblinie`
- Leitfigur mit Sprechblase: `.tipp` `.figur` `.blase` `.rechts`
- Fuß: Selbsteinschätzung und Reflexion (nur wenn gewählt): `.fuss` `.reflexion`
- Wachstums-Selbsteinschätzung zum Ankreuzen: unter jeder der vier Stufen ein Kreis: `.wachstum`
- Verlaufsplan (Unterrichtsplanung): Tabelle für die Lehrkraft, nicht für Kinder: `.plan`
- Karten (Lernspiel, Wort-/Bildkarten): `.karten` `.karte` `.ecke` `.kartentext`
- Entwürfe: Platzhalter für Bilder, die erst nach der Freigabe kommen: `.platzhalter`

### Rätsel

- `.raetsel-liste` `.kreuz-hinweise` `.kreuz-titel` `.raetsel-legende` `.raetsel-wort`
- Spiele (abbildungen.js): `.spiel-zelle` `.spiel-teil` `.spiel-joker` `.bingo-bogen` `.bingo-kopf` `.bingo-gitter` `.rufliste` `.domino-bogen` `.domino-stein` `.domino-nr` `.spiel-plan` `.spiel-pfeile` `.spiel-feld` `.spiel-ende` `.spiel-sonder` `.spiel-nr` `.land-karte` `.land-station` `.land-legende` `.ampel` `.spiel-bild`
- Abbildungen (abbildungen.js): `.timer-text` `.stellentafel` `.plaettchen-zelle` `.l`
- Folien (praesentation): Bühne füllt den Platz unter dem Kopf, Leerstelle für Ergebnisse der Kinder, Vermutung = Antwort zum Abstimmen mit Kästchen für …: `.buehne` `.leerstelle` `.vermutung` `.notiz`
- Schreibschrift für Vorlage, Vorbild und Lösung; Kreislauf (`kl-…`) und Wetterbogen: `.schreibschrift` `.kl-kreis` `.kl-station` `.kl-ablauf` `.leer` `.kl-bild` `.kl-pfeil` `.wetterbogen` `.hoch` `.wetter-reihe`
- Kit-Tabelle (047): `.kit-tabelle` `.kopfspalte` `.schreibzeilen` `.kompakt` `.nach-inhalt` `.erste-schmal` `.ohne-linien-innen`
- Sprach-Werkzeuge (052): `.zeilennummer`
- Punkte und Noten (053): `.gesamt-linie` `.noten-vorschlag` `.noten-schnitt` `.unterschrift-feld` `.ohne-punkte`
- Bausteine für ein Thema (055): Aussehen kommt aus thema.css: `.thema-band` `.thema-kopf`
- Deckblatt für den Verkauf (references/verkauf.md): Marke, Titel, Szenenbild, Klasse, Inhalt, Seitenvorschau: `.deckblatt` `.db-rahmen` `.db-marke` `.db-titel` `.db-unter` `.db-bild` `.db-klasse` `.db-chips` `.db-chip` `.db-faecher` `.db-blatt` `.db-figur`

### Reihe als Geschichte (unterrichtsplanung/references/reihe-als-geschichte.md) == Fall-Karte, Seite für die Lehrkraft, Kapitel-Marke, Beweis-Rätsel, …

- `.fall` `.fall-bild` `.fall-band` `.fall-innen` `.fall-thema` `.fall-text` `.fall-frage` `.fuss-zeile` `.lk` `.lk-kopf` `.lk-marke` `.lk-leiste` `.ich-kann` `.phase` `.phase-kopf` `.kasten` `.hinweis` `.lk-spalten`
- Hinweise für die Lehrkraft (210): ein eigenes Dokument mit body.lehrkraft, nüchtern und zum Überfliegen: `.lehrkraft` `.lk-unter` `.lk-stunde`
- 216 Vorleseheft: body.lehrkraft.vorleseheft: `.vorleseheft` `.vl-legende` `.vl-muster` `.vl-rollen` `.vl-kapitel` `.vl-kopf` `.vl-stunde` `.vl-dauer` `.vl-bild` `.vl-frage` `.vl-weiter` `.bild` `.frage` `.vl-regie` `.weiter` `.kapitel-marke` `.beweis` `.beweis-marke`
- Pass, Ausweis, Sammelkarte: eine .karte mit farbigem Kopf und Stempelfeldern für die Stücke der Rätselkette: `.pass` `.pass-rahmen` `.pass-kopf` `.pass-innen` `.pass-zeile` `.stempel-reihe` `.stempel` `.sym`
- Gestaltung (Entscheidungen 41, 45, 46): zwei Ebenen am Ende der Seite, frei liegende Elemente mit data-lage="frei": `.ebene` `.hinten` `.vorne`
- Gruppe: Die Kinder erben Lage und Größe der Gruppe nicht (eigene Werte im style gehen vor): `.gruppe`
- Seitenfläche und Seitenrahmen füllen ihre Ebene; Fläche, Muster und Rahmen-Arten: 095: `.seitenflaeche` `.seitenrahmen`
- s/w (Briefing 4.2): Seitenfläche und Streuung sind ohne data-sw weg, alles andere grau, bis data-sw="weg": `.streuung` `.stapel`
- Ein Band oben auf der Seite, höchstens eins je Seite, ohne data-lage. --h ist der volle Teil; Welle, Bogen und Zacken hängen darunter …: `.kopfband`
- Frei liegende Figur (Briefing 3.4): nur figur-frei, nie figur (die Leitfigur mit --figur): `.figur-frei`
- Freies Bild: Breite in --b, Höhe aus dem Bild; mit --h auf das Seitenverhältnis zugeschnitten, Ausschnitt in --bx/--by: `.bild-frei`
- Formen zeichnen sich in Elementgröße (viewBox = 0 0 --b --h), der Strich liegt innen: `.form`
- Schmuckschrift: liegt frei, nie für Inhalt: `.schmuck`
- Form mit Text (Sprechblase, Band): Das svg füllt die Box, der Zipfel ragt hinaus: `.form-text` `.form-inhalt`
- Leerer Bildrahmen: grau mit Bild-Symbol in der Mitte; die Form schneidet clip-path im style zu (data-maske hat keine eigene Regel): `.bildrahmen`
- Eine Fläche steht im Stapel wie ein Baustein; ihre Elemente liegen in ihren Koordinaten und werden am Rand abgeschnitten: `.flaeche`

### Satz 2 (212, 213): neues Material, gesetzt wie ein Schulbuch == data-satz="2" am <body>

- 215 Bilder (references/bilder.md, Abschnitt 4): Bild mit Ebenen. .bild-lagen füllt einen Platz mit fester Höhe wie object-fit:cover; .lagen-flaeche …: `.bild-lagen` `.lagen-flaeche` `.lage` `.lage-zettel` `.gehalten`
- Auftakt (Skill praesentation): Folien als Schauseite ohne Schema, nur unter body.folie.auftakt: `.auftakt` `.dunkel`
- Bildfolie zur Geschichte: die Nummer aus dem Vorleseheft klein unten links; unten rechts steht beim Präsentieren die Foliennummer: `.bildfolie` `.praesentieren` `.aktiv` `.schritt-zu`
- Ausschneide- und Legematerial ist Schauseite (Entscheidung 64), nur mit data-satz="2": `.streifen`
- Rückseiten in derselben Reihenfolge wie die Vorderseiten schreiben: Der Bogen spiegelt die Spalten selbst (Duplex über die lange Kante, bei a4-quer …: `.rueckseiten`
- Farbgrund: blasse Setfarbe mit Punkten, Innenfeld mit Kontur: `.grund`
- Rückseite: Streifen in der Setfarbe, Inhalt auf weißem Schild (Name des Sets oder die Lösung zur Selbstkontrolle): `.rueckseite`
- Deckkarte: vorn im Set, nennt Spiel, Inhalt und Klasse: `.deckkarte`
- Legeteil: ohne Innenfeld, ganz in blasser Setfarbe: `.legeteil`
- Domino (x-domino): Steine im Farbrahmen, zwei weiße Felder, Start und Ziel hervorgehoben: `.spiel-start` `.spiel-ziel`
- Schneidebogen: Teile, die Kinder selbst schneiden: `.schneidebogen`
- 249 Felder mit Zweck: data-fuer nennt in mm, was hineinkommt (Breite x Höhe), pruefung.js misst das Feld daran: `.feld-kleben` `.feld-zeichnen`
- Teil, das die Kinder ausschneiden, außerhalb von Schneidebogen und Karten (Kurzkante: teil-klein): `.ausschneiden`
<!-- /erzeugt: klassen-index -->

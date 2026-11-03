---
name: fach-sachunterricht
description: Fachdidaktik Sachunterricht Klasse 1–4 (Natur, Technik, Raum, Zeit, Gesellschaft) nach dem Perspektivrahmen der GDSU, inkl. Forscherheften, Versuchsprotokollen und Sachtexten. Laden bei jedem Sachunterrichts-Material oder jeder Sachunterrichts-Planung.
---

# Fach Sachunterricht (Klasse 1–4)

Grundlage: Bildungsplan Baden-Württemberg Sachunterricht (2016), Perspektivrahmen Sachunterricht (GDSU 2013).

## Fachspezifische Rückfragen

Nach dem Rückfrage-Protokoll aus `grundschul-didaktik` (eine Frage pro Nachricht, mit Empfehlung). Ergänzend zu den Fragen des Material-Skills:

1. **Thema und Perspektive:** Welches Thema (z. B. Wasser, Igel, Feuer, Verkehr, Wohnort, früher und heute)? Welcher Schwerpunkt?
2. **Zugang:** Experimentieren, Beobachten (Lerngang, Tier/Pflanze), Recherchieren (Sachtext, Medien), Bauen/Konstruieren, Befragen?
3. **Vorhandene Materialien:** Was steht für Versuche zur Verfügung (Sicherheit!)? Gibt es Exkursionsmöglichkeiten?
4. **Regionale Bezüge:** Wohnort und Region in Baden-Württemberg für Raum- und Ortsthemen.

## Die fünf Perspektiven

| Perspektive | Typische Themen | Denk-, Arbeits- und Handlungsweisen |
|---|---|---|
| Naturwissenschaftlich | Wasser, Luft, Magnetismus, Tiere, Pflanzen, Körper, Wetter | Fragen stellen, vermuten, beobachten, experimentieren, messen, dokumentieren |
| Technisch | Brücken, Fahrzeuge, Werkzeuge, Stromkreis | Konstruieren, Bauen, Funktion untersuchen, Erfindungen bewerten |
| Geographisch | Schulweg, Karten, Wohnort, Kontinente | Orientieren, Karten lesen/zeichnen, Räume erkunden |
| Historisch | Früher – heute, Familiengeschichte, Ortsgeschichte | Zeitleisten, Quellen befragen, Vergleichen |
| Sozialwissenschaftlich | Zusammenleben, Kinderrechte, Konsum, Demokratie in der Klasse | Diskutieren, Regeln aushandeln, Perspektiven übernehmen |

Gute Themen vernetzen Perspektiven (z. B. "Wasser": Naturwissenschaft + Geographie + Gesellschaft).

## Didaktische Leitlinien

- **Von Kinderfragen ausgehen:** Einstieg mit Phänomen oder Frage ("Warum schwimmt ein Schiff aus Eisen?"). Vorstellungen der Kinder erfassen (Vorwissensbogen, Zeichnung).
- **Forschender Kreislauf:** Frage → Vermutung → Versuch planen/durchführen → Beobachtung → Ergebnis → Erklärung → neue Frage.
- **Originale Begegnung** vor Abbildung (echte Pflanze, Lerngang). Material verweist auf reale Erfahrung.
- **Fachlich korrekt** und anschlussfähig: Vereinfachen ja, Falsches nein (z. B. nicht "Pflanzen essen Erde").
- **Fachwortschatz** mit Wortspeicher, Bild und Artikel aufbauen.

## Kernkonzepte im Fach

- Forschender Kreislauf ist gelebtes Growth Mindset: Vermutungen dürfen falsch sein, „Ich habe herausgefunden, dass meine Vermutung nicht stimmte" ist ein Ergebnis.
- Niveaus: ● beobachten und beschreiben (bildgestützt), ●● Versuch durchführen und dokumentieren, ●●● erklären, übertragen, eigene Forscherfrage.
- Ich-kann-Ziel nennt Denk- und Arbeitsweise und Inhalt („Ich kann eine Vermutung aufschreiben und prüfen.").

## Forscherheft / Versuchsprotokoll (Vorlage nach Klassenstufe)

Kl. 1/2 (bildgestützt): `--vorlage forscherbogen-12`. Kl. 3/4 (schriftlich): `--vorlage forscherbogen-34`, `art` der Lineatur nach der Klasse. Die Vorlagen geben Aufbau und Schritte vor; einsetzen, was zum Versuch gehört.

Sicherheitshinweise (Feuer, Strom, Glas, Lebensmittel, Allergien) immer für die Lehrkraft angeben, als `.nur-loesung` im Kopf wie in der Vorlage: Sie stehen nur auf dem Lösungsblatt. Keine Versuche mit Netzstrom oder gefährlichen Stoffen.

## Materialtypen im Sachunterricht

- Sachtexte mit Bildern (siehe `lesetext`, Stufe C/D).
- Beschriftungsaufgaben (Körperteile, Pflanzenteile) mit realistischen Abbildungen.
- Steckbriefe (Tiere, Pflanzen) als Rechercheraster.
- Zeitleisten, Karten, Lagepläne.
- Stromkreis und Leiterprobe, Wasserkreislauf, Wetter und Verkehr: Naturwissenschaft und Technik, siehe „Abbildungen“.
- Thermometer (`x-skala art="thermometer"`), Kalender (`x-kalender`) und Uhr mit Digitalanzeige (`x-uhr digital="ja"`) für Wetter und „Zeit und Zeitrhythmen“; Katalog in `html-materialerstellung`, Abschnitt „Größen“.
- Bauanleitungen in Bildschritten.
- Lerngang-/Beobachtungsbögen.
- Folien für den Kreisinput (`praesentation`): Bildimpuls oder Phänomen, Vermutungen sammeln und abstimmen, Auflösung neben der Vermutung, Merksatz zur Ergebnissicherung. Echtes hat Vorrang (originale Begegnung); die Folie zeigt, was sich nicht in den Kreis holen lässt (Feld, Tier im Bau, Vorgang unter der Erde, früher).

## Abbildungen

Exakte Darstellungen kommen als Elemente aus `html-materialerstellung/assets/abbildungen.js` ins HTML. Attribute: `html-materialerstellung/references/abbildungen.md`, Abschnitt „Sachunterricht“.

| Element | Darstellung | Klasse |
|---|---|---|
| `<x-jahreskreis jahreszeiten="ja">` | Jahreskreis, Woche, Tageskreis | 1/2 |
| `<x-plan art="raum" objekte="tafel: D1; tisch: B3">` | Klassenzimmer in Draufsicht | 1/2 |
| `<x-zeitleiste art="leben" von="0" bis="10">` | eigene Lebenszeit, maßstäblich | 2/3 |
| `<x-zeitleiste von="1900" bis="2020" ereignisse="1969: Mondlandung">` | Zeitleiste mit Ereignissen und Zeiträumen | 3/4 |
| `<x-plan objekte="schule: B3" massstab="1 Kästchen = 100 m" nordpfeil="ja">` | Ortsplan mit Planquadraten, Legende, Maßstabsleiste | 3/4 |
| `<x-wetter symbol="regen" wind="2">` | Wettersymbole; Bogen: `assets/muster/wetterbogen-klein.html` | 1/2 |
| `<x-kreislauf stationen="Bohne; Keimling; Blüte" art="ablauf">` | Wachstum, Entwicklung als Ablauf | 1/2 |
| `<x-windrose richtungen="8">` | Himmelsrichtungen, deutsche Kürzel | 3/4 |
| `<x-kreislauf stationen="Meer; Wolken; Regen; Fluss" pfeile="verdunsten; …">` | Wasserkreislauf, Lebenszyklus | 3/4 |
| `<x-schaltplan teile="batterie schalter:zu lampe" aufgabe="leuchtet">` | Stromkreis, das Element rechnet, ob die Lampe leuchtet | 3/4 |
| `<x-verkehrszeichen nummer="205">` | amtliche Verkehrszeichen, Radfahrausbildung | 3/4 |
| `<x-diagramm art="linie" von="-10">`, Bogen: `assets/muster/wetterbogen.html` | Wetter beobachten und messen, Temperaturverlauf | 3/4 |

## Leistung feststellen

Notengrundlage in Kl. 3/4 sind vor allem praktische Arbeiten, Forscherheft oder Lerntagebuch, Präsentationen und kurze schriftliche Übungs- oder Wiederholungsarbeiten (Rahmen in `klassenarbeit`). Kurze Überprüfungen fragen nach Ich-kann-Zielen und Denk- und Arbeitsweisen (Vermutung begründen, Beobachtung beschreiben, Abbildung beschriften), nicht nur nach Wissen. Leselast niedrig, Fachwörter mit Bild; Rechtschreibung anmerken; ob sie in die Note eingeht, regelt die Schule.

## Qualitätscheck Sachunterricht

- [ ] Fachlich geprüft (Biologie, Physik, Geographie, Geschichte)
- [ ] Abbildungen realistisch und korrekt (Anzahl Beine, Pflanzenteile; Kartenausschnitt: Pläne mit `x-plan`, nie als KI-Bild)
- [ ] Schaltungen fachlich richtig: mit `x-schaltplan`, das Element rechnet; nie als KI-Bild
- [ ] Verkehrszeichen nur amtlich: mit `x-verkehrszeichen`, nie gezeichnet oder als KI-Bild
- [ ] Versuchsmaterial alltagsnah und sicher
- [ ] Denk- und Arbeitsweisen sichtbar (nicht nur Wissen abfragen)
- [ ] Fachwörter mit Wortspeicher

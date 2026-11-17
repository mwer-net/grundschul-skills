# Ältere Blätter ohne `data-satz="2"`

Nur lesen, wenn ein vorhandenes Dokument geändert wird, dessen `<body>` kein `data-satz="2"` trägt. Neues Material hat immer `data-satz="2"` (`SKILL.md`, „Gestaltungssystem kurz“); für es gilt diese Datei nicht.

Ohne die Angabe gilt der ältere, große Satz, in dem bestehende Blätter bleiben.

## Was im älteren Satz anders ist

- **Schrift und Abstand je Klasse** (aus `blatt.css`; die Werte mit `data-satz="2"` stehen in `grundschul-didaktik/references/druck-und-platz.md`, „Schrift und Abstand je Klasse“):

<!-- erzeugt: aelterer-satz-schrift -->
| Klasse | Ältere Blätter (ohne `data-satz`) |
|---|---|
| Kl. 1 | 28 px, Abstand 36 px |
| Kl. 2 | 24 px, Abstand 28 px; mit `data-zeit` 21 px, Abstand 24 px |
| Kl. 3 | 20 px, Abstand 28 px; mit `data-zeit` 19 px, Abstand 24 px |
| Kl. 4 | 18 px, Abstand 24 px; mit `data-zeit` 16 px |
<!-- /erzeugt: aelterer-satz-schrift -->

- **Seitenrand** (`references/layout.md`, „Raster“): ältere Blätter ringsum 60 px.
- **Rechenkästchen** (`x-gitter`, `kaestchen` ohne Angabe, `references/abbildungen.md`): ältere Blätter ohne `data-satz`: 1 cm in Kl. 1/2, 0,5 cm ab Kl. 3.
- **Tipp im Kopf:** `.kopf .tipp` gibt es nur noch für ältere Blätter.
- **Seiten für die Lehrkraft:** `.seite.lk` gibt es nur noch für ältere Mappen.
- **Muster:** `assets/beispiel-zehner-einer-kl2.html` steht im älteren, großen Satz ohne `data-satz`.

## Was die Prüfung im älteren Satz anders meldet

Abweichend von der Tabelle in `grundschul-didaktik/references/druck-und-platz.md`, „Was die Prüfung meldet“:

<!-- erzeugt: aelterer-satz-schwellen -->
| Code | Stufe | Wann |
|---|---|---|
| `aufgaben-viele` | WARNUNG | mehr Aufgaben (ohne ★) auf einer Seite als in Kl. 1/2/3/4: 5/6/7/8 mit Zeitziel im älteren Satz, sonst 3/4/5/6 |
| `abstand-knapp` | WARNUNG | weniger als 20 px zwischen zwei Aufgaben |
<!-- /erzeugt: aelterer-satz-schwellen -->

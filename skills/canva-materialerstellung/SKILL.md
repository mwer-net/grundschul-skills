---
name: canva-materialerstellung
description: Technischer Ablauf, um Grundschulmaterial (Arbeitsblätter, Karten, Plakate, Spiele, Präsentationen) mit dem Canva MCP zu erstellen, zu prüfen, zu korrigieren und als druckfertiges PDF zu exportieren. Laden, sobald ein Material in Canva umgesetzt werden soll.
---

# Material mit Canva erstellen

Voraussetzung: Inhalt und Briefing stehen fest (siehe `grundschul-didaktik`, Rückfrage-Protokoll). Canva setzt um, entscheidet aber nicht über Inhalt oder Didaktik.

## Grundsatz: Erst Inhalt, dann Design

1. **Inhalt vollständig selbst schreiben:** Überschrift, alle Arbeitsanweisungen, alle Aufgaben, Wortspeicher, Lösungen. Rechnungen und Rechtschreibung prüfen.
2. **Layout-Skizze festlegen:** Reihenfolge der Blöcke, welche Bilder wohin, Platzbedarf für Schreibflächen.
3. **Dann erst Canva beauftragen** – mit dem fertigen Text wörtlich im Brief.

Canvas KI formuliert sonst eigene Texte, verwendet falsche Schriftgrößen oder füllt mit Deko. Das muss danach korrigiert werden.

## Ablauf mit den Canva-Werkzeugen

### 1. Gestalten

- **Neues Design:** `create-design` mit
  - `brief`: Zweck, Zielgruppe ("Arbeitsblatt für Klasse 2, Grundschule Deutschland"), Gestaltungsregeln (siehe Brief-Vorlage unten) und der **vollständige Text wörtlich**.
  - `format`: immer mit Ausrichtung, z. B. `"Worksheet (A4 Portrait)"` für Arbeitsblätter, `"Poster (Portrait A3)"` oder A4 für Lernplakate, `"Presentation"` für Tafelbilder/Whiteboard.
  - **Achtung Formatfalle:** `"A4 Document (Portrait)"` erzeugt ein *responsives* Canva-Doc. Darin sind nur Text-Operationen erlaubt (`replace_text`, `find_and_replace_text`, `update_fill`, `delete_element`) – keine Formen, keine Positionierung. Für Arbeitsblätter immer eine **feste Seite** (`"type": "fixed"` in `read-design`) verwenden, also `"Worksheet (A4 Portrait)"`.
  - Maße danach in `read-design` prüfen. Canva liefert bei „A4"-Formaten oft 816 × 1056 px (US Letter). Das ist für den Druck unkritisch, solange der Export mit `size: "a4"` erfolgt; sonst `resize-design` auf 794 × 1123 px.
  - Danach `get-create-design-async-job` abfragen, bis das Design fertig ist (nur wenn kein Widget es anzeigt).
- **Mit Markenvorlage der Schule/Klasse** (Brand Kit mit Schulschrift, Farben, Maskottchen): stattdessen die Legacy-Werkzeuge mit `brand_kit_id` (`generate-design` → `create-design-from-candidate`). Vorher mit `list-brand-kits` anbieten.
- **Vorhandene Vorlage der Lehrkraft:** `search-designs` → `copy-design` → bearbeiten. So bleiben Kopfzeile, Symbole und Schrift der Klasse erhalten. Bei wiederkehrenden Formaten (Wochenplan, Laufzettel) ist das der bevorzugte Weg.
- **Viele gleichartige Karten** (Domino, Memory, Wortkarten): wenn eine Brand-Template-Vorlage mit Feldern existiert, `get-brand-template-dataset` + `autofill-design`; sonst ein Design mit mehreren Seiten erzeugen und per `edit-design` befüllen.

### 2. Bilder

- Was ein Bild bekommt und wie viel: `grundschul-didaktik/references/kindgerecht-gestalten.md` (Leitfigur Willi/Wilma Waschbär mit fertigen Media-IDs, Bilder nur mit Mehrwert; Weglass-Test).
- Eigene Illustrationen: `generate-image` mit dem **Stil-Satz** aus `kindgerecht-gestalten.md`, für jedes Bild eines Materials wörtlich gleich, danach das Motiv konkret. Keine Schrift, Zahlen oder Uhren im KI-Bild. Für Ausmalbilder: "nur schwarze Umrisse, keine Füllung".
- `generate-image` liefert eine `media_id` (z. B. `MAHX…`). Diese direkt mit `edit-design` → `insert_fill` (`asset_type: "image"`, `asset_id: <media_id>`, `alt_text`, Position und Größe) ins Design setzen – kein Upload nötig. Die Leitfigur einmal erzeugen und die `media_id` für alle Auftritte und Folgematerialien wiederverwenden (Titel und ID der Lehrkraft nennen).
- KI-Bilder haben einen weißen Hintergrund. Auf weißer Seite unproblematisch; auf farbigen Flächen vorher `remove-background` oder das Bild außerhalb der Fläche platzieren.
- Sachabbildungen (Tiere, Pflanzen, Körper): realistisch, fachlich korrekt prüfen. Bei Zweifel Foto aus der Canva-Bibliothek statt KI-Bild.
- Hochladen von Bildern der Lehrkraft: `upload-asset-from-url` bzw. `create-upload-url`; Freisteller: `remove-background`.
- Einheitlicher Bildstil im ganzen Material.
- **Fachlich exakte Abbildungen nie von der KI zeichnen lassen** (Uhren, Zahlenstrahl, Zwanzigerfeld, Geometrie): Zeiger und Teilungen stimmen regelmäßig nicht. Stattdessen berechnen und als Vektor setzen – siehe unten.

### 2b. Exakte Abbildungen als Vektorformen

Wenn ein Upload nicht möglich ist (abgeschottete Umgebung, blockierte Upload-URL), lässt sich jede exakte Zeichnung direkt aus `insert_shape` aufbauen:

- SVG-Pfad in einer eigenen `view_box` (z. B. 100 × 100) rechnen, dann über `width`/`height` auf die Zielgröße skalieren. Nur `M/L/H/V/C/S/A/Z` sind erlaubt, **kein `Q`/`T`**. Kreise als zwei `A`-Bögen.
- Mehrere Teilformen in **einem** Pfad zusammenfassen (z. B. alle 12 Stundenstriche), sonst wird die Operationsliste sehr groß. Dünne Linien ggf. als offene Pfade mit `stroke_weight` statt als gefüllte Rechtecke.
- Zahlen am Zifferblatt als `add_text` – Position aus demselben Koordinatensystem rechnen.
- Fertige Generatoren: `fach-mathematik/scripts/uhr_canva.py` (Uhr als Canva-Operationen), `fach-mathematik/scripts/uhr.py` (Uhr als PNG, wenn Upload möglich ist).

### 3. Prüfen

- `read-design` lesen und gegen das Briefing abgleichen. Die Antwort wird schnell sehr groß; deshalb mit `filter.fields` gezielt anfordern (`thumbnails` für die Optik, `design_content` für Elementpositionen) und lange Ergebnisse als Datei mit `python3`/`jq` auswerten statt am Stück zu lesen.
  - Steht der Text wörtlich so da? Keine erfundenen Zusätze?
  - Schriftgrößen gemäß Klassenstufe (`grundschul-didaktik`)? Keine Schmuck- oder Großbuchstabenschrift für Fließtext?
  - Genug Schreibfläche, Lineatur vorhanden?
  - Keine Deko-Elemente ohne Funktion, kein Text auf unruhigem Hintergrund?
  - Funktioniert es in Schwarz-Weiß?
- Dem Nutzer die Vorschau zeigen.

### 4. Korrigieren

- `edit-design` innerhalb einer Bearbeitungstransaktion:
  - `find_and_replace_text` / `replace_text` für Textfehler
  - `format_text` für Schriftgröße (in px; bei A4-Designs ca. pt × 1,33), `line_height` 1,5, Fett für Hervorhebung
  - `delete_element` für Deko ohne Funktion
  - `insert_shape` für Schreiblinien, Rahmen, Kästchen
  - `add_text` setzt **immer** 16 px, normal, linksbündig – unabhängig vom Umfeld. Nach jedem `add_text` ein `format_text` mit Größe, Gewicht und `text_align` hinterherschicken, sonst sitzen Zahlen und Beschriftungen falsch.
  - `add_page` für Niveau-Varianten oder Lösungsblatt
- Mit `finalize: "keep_open"` arbeiten, Vorschau zeigen, **erst nach Freigabe** `finalize: "commit"`.

### 5. Exportieren

- `get-export-formats` prüfen, dann `export-design` als `pdf`, `size: "a4"`, `export_quality: "pro"` für den Druck.
- Für Whiteboard/Tablet zusätzlich `png`.
- Link zum Design und PDF an die Lehrkraft geben.

### 6. Ablage

- Ordner pro Fach/Thema anlegen (`create-folder`, `move-item-to-folder`), Titel nach Schema: `Kl2_Mathe_Uhrzeit_AB1_Niveau-A`.

## Brief-Vorlage für `create-design`

Schrift und Farben lassen sich nachträglich nur eingeschränkt ändern (`format_text` kennt **keine Schriftart**). Palette, runde Blöcke und farbige Nummernkreise setzt Canva aus dem Brief zuverlässig um; Schriftwünsche nur teilweise (im Test wurde eine runde Schrift für alles verwendet statt zwei getrennter). Wer eine bestimmte Schrift braucht, legt sie im Brand Kit an. Texte aus `add_text` erscheinen in Canvas Standardschrift – für längere Texte lieber Platz im Brief reservieren und den Text dort mitgeben. Deshalb Palette und Schriften schon im Brief festlegen; Bilder und exakte Abbildungen danach selbst einsetzen und im Brief nur Platz dafür reservieren.

```
Arbeitsblatt für die Grundschule, Klasse {K}, Fach {Fach}, Thema "{Thema}".
Format A4 hochkant, druckfreundlich, weißer Seitenhintergrund.
Gestaltung: kindgerecht, freundlich und fröhlich, aber ruhig und übersichtlich (Emotional Design ohne Deko).
Farbpalette "{Name}": Hauptfarbe {Hex}, Akzent {Hex}, Flächen sehr hell {Hex} und {Hex}, Text dunkel #1D1D1B.
Schriften: Überschrift in {Fredoka/Baloo 2} (fett, Hauptfarbe, {px}), aller übrige Text in {Andika/Schulschrift} ({px}, dunkel),
Zeilenabstand 1,5, linksbündig. Großzügige Ränder und viel Weißraum.
Jede Aufgabe ein eigener Block: helle Fläche mit stark abgerundeten Ecken, ohne Rahmenlinie.
Aufgabennummer als ausgefüllter Kreis in der Hauptfarbe mit weißer, fetter Ziffer links neben der Anweisung.
Unter der Überschrift das Ich-kann-Ziel in einer schmalen hellen Zeile. Jeder Aufgabenblock trägt rechts oben seine Niveau-Punkte (●, ●● oder ●●●) in Dunkelgrau.
Fußzeile als helle abgerundete Fläche, mindestens 80 px hoch: Ich-kann-Satz und "Male an, wie weit du schon bist:", rechts Platz (ca. 220 × 110 px) für die Wachstumsgrafik.
Platz lassen für: {Willi/Wilma oben rechts ca. 110 px mit Sprechblase, Uhren/Felder/benötigte Bilder …}.
KEINE Bilder, Icons oder Cliparts selbst einfügen – die werden später ergänzt.
Schreiblinien dunkelgrau und schlicht. Keine Dekoration ohne Funktion, kein Text auf Bildern, keine Großbuchstaben-Texte.
Verwende exakt folgenden Text, nichts umformulieren, nichts ergänzen:
---
{vollständiger Text inkl. Kopfzeile "Name: ____  Datum: ____", Ich-kann-Ziel, Niveau-Punkte vor jeder Aufgabe, Fußzeilentext}
---
```

## Typische Probleme

| Problem | Lösung |
|---|---|
| Canva ändert/ergänzt Text | `find_and_replace_text`, im Brief "exakt folgender Text" betonen |
| Zu kleine Schrift | `format_text` mit `font_size` hochsetzen, Textbox-Breite anpassen |
| Überladenes Layout | Deko löschen, Abstände per `position_element` vergrößern |
| Schulschrift fehlt | Lehrkraft bitten, die Schrift im Brand Kit hochzuladen (OTF/TTF/WOFF, Lizenz beachten) |
| Kein A4 (816 × 1056 px = Letter) | PDF mit `size: "a4"` exportieren; nur wenn das nicht reicht, `resize-design` auf 794 × 1123 px (ordnet das Layout neu – danach erneut prüfen) |
| „Only text operations are allowed" | Die Seite ist responsiv. Transaktion mit `cancel` verwerfen und das Design mit festem Format neu anlegen |
| Canva erfindet doppelte Schreiblinien, Icons oder Platzhalter | Alle Elemente aus `design_content` durchgehen; Dubletten mit `delete_element`, Textdubletten mit `find_and_replace_text` entfernen |
| Neu gesetzter Text ist zu klein/linksbündig | `format_text` nachziehen (siehe oben) |
| Upload von Bildern blockiert | Abbildung als Vektorformen bauen (Abschnitt 2b) |
| Canva setzt Platzhalter-Rahmen für Bilder/Uhren | Platzhalter mit `delete_element` entfernen; ein Bildrahmen kann mit `update_fill` direkt das KI-Bild aufnehmen (wird automatisch zugeschnitten) |
| Leitfigur hat weißen Kasten | `remove-background` auf die `media_id`, dann die neue ID einsetzen |
| Zu viele Seiten bei Karten | Kartenraster bewusst planen: 8 Karten pro A4-Seite (2 × 4) bei Memory/Wortkarten, 12 bei Domino (2 × 6) |

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
  - `format`: immer mit Ausrichtung, z. B. `"A4 Document (Portrait)"` für Arbeitsblätter, `"Poster (Portrait A3)"` oder A4 für Lernplakate, `"Presentation"` für Tafelbilder/Whiteboard. Prüfe nach dem Erzeugen die Maße (A4 = 210 × 297 mm).
  - Danach `get-create-design-async-job` abfragen, bis das Design fertig ist (nur wenn kein Widget es anzeigt).
- **Mit Markenvorlage der Schule/Klasse** (Brand Kit mit Schulschrift, Farben, Maskottchen): stattdessen die Legacy-Werkzeuge mit `brand_kit_id` (`generate-design` → `create-design-from-candidate`). Vorher mit `list-brand-kits` anbieten.
- **Vorhandene Vorlage der Lehrkraft:** `search-designs` → `copy-design` → bearbeiten. So bleiben Kopfzeile, Symbole und Schrift der Klasse erhalten. Bei wiederkehrenden Formaten (Wochenplan, Laufzettel) ist das der bevorzugte Weg.
- **Viele gleichartige Karten** (Domino, Memory, Wortkarten): wenn eine Brand-Template-Vorlage mit Feldern existiert, `get-brand-template-dataset` + `autofill-design`; sonst ein Design mit mehreren Seiten erzeugen und per `edit-design` befüllen.

### 2. Bilder

- Eigene Illustrationen: `generate-image` mit klarer Stilvorgabe ("einfache, freundliche Linienillustration, schwarze Konturen, weißer Hintergrund, kindgerecht, keine Schrift im Bild"). Für Ausmalbilder: "nur schwarze Umrisse, keine Füllung".
- Sachabbildungen (Tiere, Pflanzen, Körper): realistisch, fachlich korrekt prüfen. Bei Zweifel Foto aus der Canva-Bibliothek statt KI-Bild.
- Hochladen von Bildern der Lehrkraft: `upload-asset-from-url` bzw. `create-upload-url`; Freisteller: `remove-background`.
- Einheitlicher Bildstil im ganzen Material.

### 3. Prüfen

- `read-design` lesen und gegen das Briefing abgleichen:
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
  - `add_page` für Niveau-Varianten oder Lösungsblatt
- Mit `finalize: "keep_open"` arbeiten, Vorschau zeigen, **erst nach Freigabe** `finalize: "commit"`.

### 5. Exportieren

- `get-export-formats` prüfen, dann `export-design` als `pdf`, `size: "a4"`, `export_quality: "pro"` für den Druck.
- Für Whiteboard/Tablet zusätzlich `png`.
- Link zum Design und PDF an die Lehrkraft geben.

### 6. Ablage

- Ordner pro Fach/Thema anlegen (`create-folder`, `move-item-to-folder`), Titel nach Schema: `Kl2_Mathe_Uhrzeit_AB1_Niveau-A`.

## Brief-Vorlage für `create-design`

```
Arbeitsblatt für die Grundschule, Klasse {K}, Fach {Fach}, Thema "{Thema}".
Format A4 hochkant, druckfreundlich, weißer Hintergrund.
Gestaltung: ruhig, klar, kindgerecht. Schrift {Schrift}, Fließtext {pt} pt, Überschrift {pt×1,5} pt,
Zeilenabstand 1,5, linksbündig. Großzügige Ränder und viel Weißraum.
Aufgaben als nummerierte Blöcke mit Symbol links: {Symbolliste}.
Bilder: nur {konkrete Bildliste}, Stil: einfache Linienillustration mit schwarzen Konturen.
Keine Dekoration ohne Funktion, kein Text auf Bildern, keine Großbuchstaben-Texte.
Schreiblinien bzw. Kästchen wie angegeben.
Verwende exakt folgenden Text, nichts umformulieren, nichts ergänzen:
---
{vollständiger Text inkl. Kopfzeile "Name: ____  Datum: ____"}
---
```

## Typische Probleme

| Problem | Lösung |
|---|---|
| Canva ändert/ergänzt Text | `find_and_replace_text`, im Brief "exakt folgender Text" betonen |
| Zu kleine Schrift | `format_text` mit `font_size` hochsetzen, Textbox-Breite anpassen |
| Überladenes Layout | Deko löschen, Abstände per `position_element` vergrößern |
| Schulschrift fehlt | Lehrkraft bitten, die Schrift im Brand Kit hochzuladen (OTF/TTF/WOFF, Lizenz beachten) |
| Kein A4 | Mit `resize-design` auf A4 bringen oder neu mit korrektem `format` |
| Zu viele Seiten bei Karten | Kartenraster bewusst planen: 8 Karten pro A4-Seite (2 × 4) bei Memory/Wortkarten, 12 bei Domino (2 × 6) |

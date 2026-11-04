---
name: lesetext
description: Schreibt und gestaltet kindgerechte, differenzierte Lesetexte (Sachtexte, Geschichten, Lesespuren, Leseblätter mit Fragen, Lautlesetexte) für Klasse 1–4. Verwenden bei Leseförderung, Lesetexten, Leseverständnis oder Texten zu einem Sachthema.
---

# Lesetext

Laden mit: `grundschul-didaktik`, `fach-deutsch` (Lesedidaktik), ggf. Fach-Skill des Inhalts, `html-materialerstellung`.

## Rückfragen

Zuerst die Start-Abfrage (`grundschul-didaktik/references/rueckfragen.md`) inklusive Selbsteinschätzung, Churer Modell und Sternchenaufgabe. Danach:

1. **Textsorte:** Erzählung, Sachtext, Gedicht/Reim, Dialog/Lesetheater, Lesespur/Leserätsel? *Empfehlung abhängig vom Ziel; für Sachthemen Sachtext.*
2. **Leseziel:** Leseflüssigkeit (Lautlesen, wiederholtes Lesen) oder Leseverstehen (Fragen, Strategien)? *Unterscheidet Textlänge und Aufgaben.*
3. **Lesestand der Gruppe:** Wörter auf Silbenebene, kurze Sätze, flüssig? Gibt es Silbenfärbung/-bögen im Lehrwerk?
4. **Niveaus** (nur mit Churer Modell): 2 oder 3 Textfassungen mit gleichem Inhalt? *Empfehlung: 3, gekennzeichnet mit ● / ●● / ●●● zur Selbstwahl.* Ohne Churer Modell: eine Fassung.
5. **Aufgaben zum Text:** Ja/nein, wie viele?

## Entwürfe und Aufgabenplan

Nach den Rückfragen 2–3 Entwürfe zeigen (jeweils Überschrift, die ersten 2–3 Sätze und die Aufgabenliste), erst nach Freigabe des Aufgabenplans die Endfassung bauen (`grundschul-didaktik/references/entwurf-und-aufgabenplan.md`).

- **Entwürfe unterscheiden sich** in Textsorte bzw. Rahmen und in den Aufgabenformaten zum Text.
- **Aufgabenplan:** ganzer Text je Fassung mit Wortzahl und Lesestufe, Aufgaben, Lösungen, Zeilennummern, Bildliste.

## Textnormen nach Lesestand

| Stufe | Typisch | Wörter gesamt | Satzlänge | Wortmaterial |
|---|---|---|---|---|
| A – Leseanfang (Kl. 1) | Lautgetreue Wörter, nur eingeführte Buchstaben | 15–40 | 3–6 Wörter | 1–2 Silben, lautgetreu, häufige Wörter |
| B – Kl. 1 Ende / Kl. 2 | Kurze Geschichte / Sachtext | 50–120 | bis 8 Wörter | wenig Konsonantenhäufungen, bekannte Wörter |
| C – Kl. 2/3 | Text mit Absätzen | 120–250 | bis 12 Wörter | einzelne Fachwörter mit Erklärung |
| D – Kl. 3/4 | Sachtext mit Zwischenüberschriften | 200–400 | bis 15 Wörter | Fachwörter im Wortspeicher |

Regeln:
- Bei Stufe A nur Buchstaben verwenden, die die Klasse schon kennt – Buchstabenliste erfragen.
- Ein Satz pro Zeile in Stufe A/B; Umbruch nach Sinneinheiten, nie mitten in einer Wortgruppe.
- Keine Silbentrennung am Zeilenende, Flattersatz.
- Hauptsätze, Präsens oder Präteritum konsequent, direkte Rede nur mit klarer Sprecherangabe.
- Zeilennummern ab Stufe C (alle 5 Zeilen) für die Besprechung: `data-zeilennummern="5"` an jedem `<p class="text">` des Lesetexts, das Blatt zählt selbst, auch über Seiten (`references/abbildungen.md` in `html-materialerstellung`).
- Differenzierte Fassungen: gleicher Inhalt, gleiche Bilder, gleiche Überschrift – nur Länge und Komplexität variieren, damit alle gemeinsam darüber sprechen können.

## Aufgaben zum Text (nach Anforderungsbereich)

1. **Informationen entnehmen:** Richtig/falsch ankreuzen, Bild zuordnen, W-Fragen.
2. **Zusammenhänge herstellen:** Reihenfolge ordnen, Warum-Fragen, Überschriften zu Absätzen.
3. **Reflektieren und bewerten:** Meinung begründen, Ende weiterschreiben, Frage an den Text stellen.

Mit Churer Modell werden die Aufgaben als ● / ●● / ●●● zur Selbstwahl angeboten (entspricht grob den drei Bereichen), sonst in dieser Reihenfolge für alle. Falls gewählt, als letzte Aufgabe eine Sternchenaufgabe ★ (z. B. eigene Frage an den Text, Ende weiterschreiben). Oben das Ich-kann-Ziel („Ich kann Informationen in einem Sachtext finden."), unten – falls gewählt – Wachstums-Selbsteinschätzung und Reflexionsfrage („Welche Lesestrategie hat dir geholfen?").

Lesestrategien sichtbar machen (ab Kl. 2): Vor dem Lesen Überschrift/Bild betrachten und vermuten, beim Lesen unbekannte Wörter markieren, nach dem Lesen Wichtiges unterstreichen.

## Leseflüssigkeit

- Lautlesetandem-Texte: kurz (Lesezeit ca. 1–2 Minuten), Wiederholungsbögen (Feld zum Abhaken nach jedem Lesedurchgang: ① ② ③ ④). Der eigene Fortschritt zählt, kein Vergleich zwischen Kindern.
- Lesetheater/Dialoge mit Rollennamen fett vor jeder Rede und Rollensymbol, zusätzlich Rollenfarben.
- Blitzlesekarten mit häufigen Wörtern.

## Gestaltung

- Schriftgrößen gemäß Basis-Skill, Stufe A: 24–28 pt.
- Lesebüchlein für Stufe A/B als Mini-Book: `--format minibuch --vorlage minibuch` (siehe `html-materialerstellung`, Abschnitt „Mini-Book“), je Seite Bild und ein Satz.
- Ein Bild pro Absatz höchstens, nur wenn es Verständnis stützt.
- Text links, Bild rechts oder oben; nie Text um Bilder fließen lassen (Kl. 1/2).
- Silbenfärbung und -bögen nur über `x-silben`, Absatz für Absatz ein Element (`fach-deutsch`, Abschnitt „Abbildungen“), und nur, wenn die Klasse damit arbeitet. In der s/w-Ansicht werden Farben von selbst zu Bögen.
- Text schwarz auf Weiß, keine Hintergrundflächen; Bilder wie in `grundschul-didaktik/references/gestaltung.md`.

## Qualitätscheck

- [ ] Wortmaterial passt zum Lesestand (Stufe A: nur bekannte Buchstaben)
- [ ] Inhalt fachlich korrekt (Sachtexte prüfen!)
- [ ] Fassungen inhaltsgleich
- [ ] Fragen sind nur mit dem Text lösbar, nicht aus Weltwissen
- [ ] Lösungen beigelegt
- [ ] Ich-kann-Ziel vorhanden; Niveau-Punkte, Sternchenaufgabe, Wachstums-Selbsteinschätzung und Reflexionsfrage genau wie in der Start-Abfrage gewählt

**Aufgabenformate:** Lückentext, Wortspeicher, Ankreuzen und Richtig/Falsch sind fertige Elemente, siehe `html-materialerstellung/references/abbildungen.md`, Abschnitt „Aufgabenformate“.

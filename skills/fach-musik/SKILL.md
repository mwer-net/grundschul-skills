---
name: fach-musik
description: Fachdidaktik Musik Klasse 1–4 (Singen, Musizieren, Musik hören, Bewegung, Notation, Instrumentenkunde) für Liedblätter, Rhythmuskarten, Hörbögen und Musikstunden. Laden bei jedem Musik-Material oder jeder Musik-Planung in der Grundschule.
---

# Fach Musik (Klasse 1–4)

Grundlage: Bildungsplan Baden-Württemberg Musik (2016).

## Fachspezifische Rückfragen

Nach dem Rückfrage-Protokoll aus `grundschul-didaktik` (eine Frage pro Nachricht, mit Empfehlung). Ergänzend zu den Fragen des Material-Skills:

1. **Bereich:** Singen, Musizieren (Orff/Boomwhackers/Körperinstrumente), Musik hören, Musik und Bewegung, Musik erfinden, Instrumente kennenlernen?
2. **Vorkenntnisse:** Kennt die Klasse Rhythmussilben, grafische Notation, Noten? Welche Silben nutzt sie (ta, ti-ti, ta-a oder du, du-de)? Die Klassenkonvention gilt, `ta` ist nur der Standard.
3. **Lied oder Werk:** Welches? (Rechte prüfen; Volkslieder und gemeinfreie Werke bevorzugen)
4. **Instrumente vorhanden?**

## Didaktische Leitlinien

- **Musikpraxis zuerst:** Singen, Bewegen, Spielen vor Theorie.
- **Rhythmus über Sprache und Körper:** Rhythmussprache (Silben), Bodypercussion, dann Symbole.
- **Notation schrittweise:** grafische Notation (Punkte, Linien, Bilder) → Rhythmuskarten → traditionelle Noten (ab Kl. 3).
- **Aktives Hören:** Höraufträge mit konkreter Aufgabe (Instrumente erkennen, laut/leise, schnell/langsam, Mitmalen, Hörlandkarte).
- **Kreativität:** Klanggeschichten, eigene Begleitung, Rhythmen erfinden.

## Kernkonzepte im Fach

- ● / ●● / ●●● z. B. bei Rhythmuskarten: ● Viertel und Achtel nachklatschen, ●● Rhythmus lesen und spielen, ●●● eigenen Rhythmus erfinden und notieren.
- Ich-kann-Ziel als hörbare oder spielbare Handlung („Ich kann einen Rhythmus mit ta und ti-ti klatschen.").
- Kein Pflicht-Vorsingen allein vor der Klasse; Rückmeldung zum Üben, nie zur „Musikalität".

## Materialtypen

- **Liedblatt:** Text in großer Schrift, Strophen nummeriert, Refrain hervorgehoben; Bilder zu den Strophen für Leseanfänger; Noten nur wenn Ziel.
- **Rhythmuskarten:** ein Takt pro Karte, Symbol + Rhythmussilben, für Spiele kombinierbar: `x-rhythmus art="karte"`.
- **Hörbogen / Hörlandkarte:** Werk, Komponist, Aufgaben zum Ankreuzen/Malen.
- **Instrumentenkarten:** Foto, Name, Instrumentengruppe, Spielweise.
- **Klanggeschichte:** Text mit Symbolen, wo welches Instrument spielt.

## Abbildungen

Rhythmen und Noten kommen als Elemente aus `html-materialerstellung/assets/abbildungen.js` ins HTML, nie als Text oder KI-Bild. Attribute: `html-materialerstellung/references/abbildungen.md`, Abschnitt „Musik“. Muster: `assets/muster/musik.html`.

| Element | Darstellung | Klasse |
|---|---|---|
| `<x-rhythmus art="grafisch" takt="4/4" noten="4 8 8 2">` | grafische Notation, lang und kurz | 1/2 |
| `<x-rhythmus art="karte" takt="2/4" noten="4 8 8" silben="ta">` | Rhythmuskarte, ein Takt, Silben | 1–4 |
| `<x-rhythmus takt="4/4" noten="4 8 8 2 \| 4 4 2" aufgabe="silben">` | Rhythmuszeile, Aufgaben `silben`, `noten`, `ergaenzen` | 2–4 |
| `<x-noten noten="c'4 d'4 e'4 f'4" namen="ja">` | Noten im Violinschlüssel, Namen, Liedtext, Aufgaben `benennen`, `zeichnen` | 3/4 |
| `<x-noten systeme="4">` | leere Notenzeilen | 3/4 |

## Rechte

- Liedtexte und Noten urheberrechtlich prüfen; gemeinfreie Volks- und Kinderlieder oder selbst geschriebene Texte nutzen. Bei geschützten Liedern auf Lehrwerk/Liederbuch verweisen.

## Qualitätscheck Musik

- [ ] Rhythmen/Noten korrekt (Taktanzahl, Notenwerte)
- [ ] Liedtext korrekt und rechtlich unbedenklich
- [ ] Höraufgaben konkret und mit Hörzeitpunkt
- [ ] Praxisanteil vorhanden

# Wo was gilt

Jedes Wissen hat genau eine Quelle. Bei einem Widerspruch gilt die Quelle aus dieser Tabelle, nicht die neuere Stelle. Mechanische Fakten stehen in Code oder Daten, didaktisches Urteil in den Skills. Die Pfade unter `schoolbox/` gibt es nur im Repo; die Skills selbst brauchen sie nicht.

| Wissen | Einzige Quelle | Alle anderen Orte |
|---|---|---|
| Elemente, Attribute, Grenzen, Standardwerte, Namen | `ABBILDUNG_SCHEMA` (`schoolbox/kern/src/abbildungen.ts`) | `abbildungen.js`, `references/abbildungen.md`: von Tests bewacht |
| Arten, Formate, Empfehlung und Zusatzbausteine je Art | `ART_ANGABEN` (`schoolbox/kern/src/werte.ts`) | `standardFormat` liest sie; Tabellen in `grundschul-didaktik/references/rueckfragen.md` erzeugt |
| Schrift und Abstände je Klasse | `assets/blatt.css` | Tabelle in `grundschul-didaktik/references/druck-und-platz.md` erzeugt, `references/layout.md` verweist |
| Meldungen | `schoolbox/kern/src/meldungen.ts` | Jede ID aus `assets/pruefung.js` bewacht |
| Was ein freies Element enthalten darf | Allow-Liste in `schoolbox/kern/src/frei.ts` | `references/abbildungen.md` beschreibt nur die Grenze |
| Didaktik | Skills | Prompts, Hilfe und Kurzanleitung verweisen |

Erzeugte Abschnitte stehen zwischen `<!-- erzeugt: … -->` und werden nie von Hand geändert: Die Quelle ändern, dann `pnpm run quellen` in `schoolbox/`. `pnpm run quellen:pruefen` vergleicht nur; das läuft beim Commit und vor dem Ausrollen. Tests finden Namen, Zahlen und Listen, keine Widersprüche im Sinn: Ob ein Skill ein Element für die richtige Klasse empfiehlt, bleibt Sache der Durchsicht.

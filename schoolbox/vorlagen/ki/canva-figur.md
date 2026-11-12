Auftrag aus der Schublade „Figuren“: ein Bild einer Figur für die Figurenbibliothek.

- Höchstens zwei Aufrufe von `generate-image`, eine Reparatur nach Abschnitt 2a eingeschlossen.
- Das Bild zeigt genau eine Figur, ganz zu sehen, ohne Hintergrund. Gegenstände, mit denen sie etwas tut, gehören dazu (etwa eine Lupe oder ein Käfer). `aspectRatio` ist `SQUARE_1_1`.
- Danach `remove-background`. Export als `png` mit `transparent_background: true` und `lossless: true`.
- Die Figur schaut nach rechts, wenn der Wunsch nichts anderes sagt.
- Eine bekannte Figur steht unten in der Zeile „Figur …“:
  - „Referenz MA…“: Diese Media-ID ist die einzige in `imageReferences`. „Stil-Referenz MA…“: wie bei einer neuen Figur.
  - „Aussehen „…““ ist wörtlich das Aussehen im Prompt. Bei „kein Steckbrief“ siehst du dir das genannte Bild mit Read an, beschreibst das Aussehen in einem Satz wie in der Tabelle der Leitfiguren und nimmst ihn in den Prompt. Diesen Satz schreibst du als `steckbrief` in `ergebnis.json`.
- Bei „Neue Figur“ ist die Stil-Referenz die einzige in `imageReferences`, und der Prompt sagt: „Übernimm nur den Zeichenstil (Linien, Augen, Proportionen); zeichne keinen Waschbären.“
  - Den Namen nimmst du aus „namens X“ oder „heißt X“ im Wunsch, sonst das Tier oder Hauptwort mit großem Anfangsbuchstaben („Igel“).
  - Das Aussehen beschreibst du in einem Satz wie in der Tabelle der Leitfiguren.
- `motiv` in `bilder.json`: zwei bis vier Wörter mit dem Namen der Figur, etwa „Willi mit Lupe“.
- `ergebnis.json`: `{"wort": "lupe"}`. `wort` ist das eine Wort für die Pose, klein, nur a–z und Ziffern (ä als ae, ö als oe, ü als ue, ß als ss). Eine neue Figur bekommt dazu `"name"` und `"steckbrief"`, eine Figur ohne Steckbrief `"steckbrief"`.


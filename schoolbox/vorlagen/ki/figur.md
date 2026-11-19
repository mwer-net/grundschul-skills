Auftrag aus der Schublade „Figuren“: ein Bild einer Figur für die Figurenbibliothek.

- Höchstens zwei Aufrufe der Bildwerkzeuge, eine Reparatur mit `bild_bearbeiten` nach Abschnitt 2a eingeschlossen.
- Das Bild zeigt genau eine Figur, ganz zu sehen, ohne Hintergrund. Gegenstände, mit denen sie etwas tut, gehören dazu (etwa eine Lupe oder ein Käfer). `format` ist `SQUARE_1_1`.
- Freigestellt mit `transparent` und dem Zusatz „Figur, Pose, Clipart“ für die Bild-API (Abschnitt 2, „Prompt“), Datei `.png`.
- Die Figur schaut nach rechts, wenn der Wunsch nichts anderes sagt.
- Eine bekannte Figur steht unten in der Zeile „Figur …“:
  - „Referenz <Datei>“: Diese Datei ist die einzige in `referenzen`. „Stil-Referenz <Datei>“: wie bei einer neuen Figur.
  - „Aussehen „…““ ist wörtlich das Aussehen im Prompt. Bei „kein Steckbrief“ siehst du dir das genannte Bild mit Read an, beschreibst das Aussehen in einem Satz wie in der Tabelle der Leitfiguren und nimmst ihn in den Prompt. Diesen Satz schreibst du als `steckbrief` in `ergebnis.json`.
- Bei „Neue Figur“ ist die Stil-Referenz die einzige in `referenzen`, und der Prompt sagt: „Bild 1 zeigt nur den Zeichenstil. Übernimm Linien, Augen und Proportionen; zeichne keinen Waschbären.“
  - Den Namen nimmst du aus „namens X“ oder „heißt X“ im Wunsch, sonst das Tier oder Hauptwort mit großem Anfangsbuchstaben („Igel“).
  - Das Aussehen beschreibst du in einem Satz wie in der Tabelle der Leitfiguren.
- `motiv` in `bilder.json`: zwei bis vier Wörter mit dem Namen der Figur, etwa „Tilda mit Lupe“.
- `ergebnis.json`: `{"wort": "lupe"}`. `wort` ist das eine Wort für die Pose, klein, nur a–z und Ziffern (ä als ae, ö als oe, ü als ue, ß als ss). Eine neue Figur bekommt dazu `"name"` und `"steckbrief"`, eine Figur ohne Steckbrief `"steckbrief"`.

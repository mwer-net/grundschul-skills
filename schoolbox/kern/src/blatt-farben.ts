/**
 * Die Farben des Blatts als Variablen (Briefing 3.9): Sie folgen Palette und Thema. Der Farbwähler der Oberfläche und
 * die Tabelle in `references/gestaltung.md` (112) lesen beide diese Liste. Sie liegt im Kern, weil `quellen.ts` beim
 * Ausrollen nur mit `kern/src` und `skills` läuft.
 */
export const BLATT_FARBEN = [
	{ wert: 'var(--haupt)', name: 'Hauptfarbe', variable: '--haupt' },
	{ wert: 'var(--akzent)', name: 'Akzentfarbe', variable: '--akzent' },
	{ wert: 'var(--dunkel)', name: 'Dunkel', variable: '--dunkel' },
	{ wert: 'var(--linie)', name: 'Linienfarbe', variable: '--linie' },
	{ wert: 'var(--fuell)', name: 'Füllfarbe', variable: '--fuell' },
] as const;

export const WEISS = '#ffffff';

/** Die Tabelle der Farben (Marke `blatt-farben`). */
export const blattFarbenListe = () =>
	[
		'| Wert | Name im Farbwähler |',
		'|---|---|',
		...BLATT_FARBEN.map((f) => `| \`${f.wert}\` | ${f.name} |`),
		`| \`${WEISS}\` | Weiß |`,
		'| `#rrggbb` | eigene Farbe |',
	].join('\n');

import type { EinheitKanon, KanonNachtrag } from '@schoolbox/kern/src/einheit-kanon';

/** Ein Abschnitt des Kanons in der Plan-Ansicht (246): Überschrift und je Eintrag eine Zeile. */
export interface KanonAbschnitt {
	titel: string;
	zeilen: string[];
}

const kapitelName = (nr: number) => (nr === 0 ? 'Auftakt' : `Kap. ${nr}`);

/**
 * Der Kanon für die Lehrkraft: Figuren, Gegenstände je Kapitel, Geheimnisse, Regeln, Fachwörter und was fertige
 * Materialien ergänzt haben. Leere Abschnitte fehlen; ohne Kanon gibt es keinen.
 */
export const kanonAbschnitte = (
	kanon: EinheitKanon | undefined,
	nachtrag: readonly KanonNachtrag[] = [],
	titel: (slug: string) => string = (slug) => slug,
): KanonAbschnitt[] => {
	if (!kanon) {
		return [];
	}
	const abschnitte: KanonAbschnitt[] = [
		{
			titel: 'Figuren',
			zeilen: kanon.figuren.map(
				(f) =>
					`${f.name}: ${[f.fest.join('; '), f.nie.length ? `nie: ${f.nie.join('; ')}` : '']
						.filter(Boolean)
						.join(' · ')}`,
			),
		},
		{
			titel: 'Gegenstände',
			zeilen: kanon.dinge.map(
				(d) =>
					`${d.name}: ${Object.entries(d.kapitel)
						.sort(([a], [b]) => Number(a) - Number(b))
						.map(([k, z]) => `${kapitelName(Number(k))} ${z}`)
						.join(' · ')}`,
			),
		},
		{
			titel: 'Geheim',
			zeilen: kanon.geheim.map(
				(g) => `${g.was} (${g.bis === null ? 'bis zum Schluss' : `bis ${kapitelName(g.bis)}`})`,
			),
		},
		{ titel: 'Regeln', zeilen: kanon.regeln },
		{
			titel: 'Fachwörter',
			zeilen: kanon.begriffe.map(
				(b) => `${b.wort}: ${b.bedeutung}${b.ab === null ? '' : ` (ab Stunde ${b.ab})`}`,
			),
		},
		{ titel: 'Ergänzt', zeilen: nachtrag.map((n) => `${n.name}: ${n.was} („${titel(n.von)}“)`) },
	];
	return abschnitte.filter((a) => a.zeilen.length > 0);
};

/** Zahl der Einträge für die Überschrift des Aufklappers. */
export const kanonZahl = (abschnitte: readonly KanonAbschnitt[]) => abschnitte.reduce((n, a) => n + a.zeilen.length, 0);

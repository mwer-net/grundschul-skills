import type { PdfMeldung } from '../typen';

/** Meldungen je Dokument, in der Reihenfolge, in der sie kamen. */
export const jeDokument = (meldungen: PdfMeldung[]) => {
	const gruppen = new Map<string, { titel: string; meldungen: PdfMeldung[] }>();
	for (const m of meldungen) {
		const gruppe = gruppen.get(m.dok) ?? { titel: m.titel, meldungen: [] };
		gruppe.meldungen.push(m);
		gruppen.set(m.dok, gruppe);
	}
	return [...gruppen.entries()].map(([dok, gruppe]) => ({ dok, ...gruppe }));
};

/**
 * Fertiger Auftrag für die Claude-App: welche Mappe, welches Dokument, die Meldungen im Wortlaut der Prüfung (die
 * versteht Claude genauer als die Übersetzung für die Lehrkraft).
 */
export const bitteAnClaude = (mappe: { id: string; titel: string }, meldungen: PdfMeldung[]) => {
	const teile = jeDokument(meldungen).map(
		({ dok, meldungen: liste, titel }) =>
			`Dokument „${titel}“ (${dok}):\n${liste.map((m) => `- ${m.seite > 0 ? `Seite ${m.seite}: ` : ''}${m.text}`).join('\n')}`,
	);
	return [
		`Bitte repariere in der Schoolbox-Mappe „${mappe.titel}“ (${mappe.id}), was die Prüfung beim PDF meldet, und stelle das Material danach wieder fertig.`,
		...teile,
	].join('\n\n');
};

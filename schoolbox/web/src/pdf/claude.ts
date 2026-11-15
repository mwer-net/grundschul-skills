import { maschinenteil } from '@schoolbox/kern/src/referenz';

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
 * Fertiger Auftrag für die Claude-App: welcher Ordner, welches Dokument (als Referenz `[sb:…]`, 021), die Meldungen im Wortlaut der Prüfung (die
 * versteht Claude genauer als die Übersetzung für die Lehrkraft).
 */
export const bitteAnClaude = (mappe: { id: string; titel: string }, meldungen: PdfMeldung[]) => {
	const teile = jeDokument(meldungen).map(
		({ dok, meldungen: liste, titel }) =>
			`Dokument „${titel}“ ${maschinenteil(liste[0]?.mappe ?? mappe.id, dok, false)}:\n${liste.map((m) => `- ${m.seite > 0 ? `Seite ${m.seite}: ` : ''}${m.text}`).join('\n')}`,
	);
	return [
		`Bitte repariere in der Schoolbox im Ordner „${mappe.titel}“${mappe.id ? ` (${mappe.id})` : ''}, was die Prüfung beim PDF meldet, und stelle das Material danach wieder fertig.`,
		...teile,
	].join('\n\n');
};

/**
 * 191-U2: Die Bitte für die Blase im Editor. Claude sieht dort schon das Blatt, also nur die Meldungen im Wortlaut der
 * Prüfung. `seite`: die eine betroffene Seite, sonst `null` (ganzes Material).
 */
export const bitteImEditor = (meldungen: PdfMeldung[]) => {
	const seiten = new Set(meldungen.map((m) => m.seite));
	const [eine] = seiten;
	return {
		text: [
			'Bitte repariere, was die Prüfung beim PDF meldet:',
			...meldungen.map((m) => `- ${m.seite > 0 ? `Seite ${m.seite}: ` : ''}${m.text}`),
		].join('\n'),
		seite: seiten.size === 1 && eine !== undefined && eine > 0 ? eine : null,
	};
};

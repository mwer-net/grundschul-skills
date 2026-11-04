/**
 * Fertige Aufträge an Claude (059). Der Text je Aktion liegt in `schoolbox/vorlagen/ki/<id>.md`. Regeln stehen nicht
 * dort, sondern in den Skills (Entscheidung 27): Die Prompts sagen, was zu tun ist, und nennen den Skill.
 */
export type KiUmfang = 'baustein' | 'seite' | 'blatt';

export interface KiAktion {
	id: string;
	name: string;
	auf: KiUmfang[];
	/** Skills, die sicher gebraucht werden; Fach- und Material-Skill kommen aus Mappe und Dokument dazu. */
	skills: string[];
	/** Reine Sprachaufgabe: Fach- und Material-Skill brauchen nur Limit. */
	ohneFachSkill?: boolean;
	/** Braucht einen Wunsch der Lehrkraft, der an den Prompt angehängt wird. */
	eingabe?: boolean;
}

export const KI_AKTIONEN: readonly KiAktion[] = [
	{ id: 'leichter', name: 'Leichter', auf: ['baustein', 'blatt'], skills: ['grundschul-didaktik'] },
	{ id: 'schwerer', name: 'Schwerer', auf: ['baustein', 'blatt'], skills: ['grundschul-didaktik'] },
	{
		id: 'einfache-sprache',
		name: 'Einfache Sprache',
		auf: ['baustein', 'blatt'],
		skills: ['grundschul-didaktik'],
		ohneFachSkill: true,
	},
	{ id: 'loesungen', name: 'Lösungen ergänzen', auf: ['baustein', 'blatt'], skills: ['html-materialerstellung'] },
	{ id: 'baustein-fuellen', name: 'Baustein füllen', auf: ['baustein'], skills: ['html-materialerstellung'] },
	{
		id: 'aufgabe-dazu',
		name: 'Aufgabe hinzufügen',
		auf: ['seite'],
		skills: ['grundschul-didaktik', 'html-materialerstellung'],
	},
	{ id: 'drei-niveaus', name: 'Drei Niveaus', auf: ['blatt'], skills: ['grundschul-didaktik'] },
	{ id: 'thema-tauschen', name: 'Thema tauschen', auf: ['blatt'], skills: ['grundschul-didaktik'] },
	// Nur aus dem Assistenten (060), darum ohne Umfang im Panel.
	{
		id: 'neu-entwurf',
		name: 'Neues Blatt',
		auf: [],
		skills: ['grundschul-didaktik', 'html-materialerstellung'],
		eingabe: true,
	},
];

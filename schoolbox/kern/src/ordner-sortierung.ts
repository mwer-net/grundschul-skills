import type { Baum, OrdnerEintrag } from './ordner';

/**
 * Sortierung der Ablage. Ohne Node-Abhängigkeit, weil Oberfläche und Teilen-Links dieselbe Reihenfolge zeigen müssen:
 * „Alles als PDF“ folgt dem, was man sieht.
 */
export type SortierFeld = 'name' | 'geaendert' | 'erstellt' | 'art';

export interface Sortierung {
	feld: SortierFeld;
	auf: boolean;
}

export interface SortierObjekt {
	istOrdner: boolean;
	name: string;
	erstellt: string;
	geaendert: string;
	art: string;
}

const NATUERLICH = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

/**
 * Eine Reihe aus einer Mappe steht in der Reihenfolge ihrer Entstehung: Sie ist didaktisch gewollt, aber nicht
 * alphabetisch (in 8 von 8 Mappen der Produktion). Alles andere steht nach Name.
 */
export const standardSortierung = (ordner: { behaelter: string | null } | null): Sortierung =>
	ordner?.behaelter ? { feld: 'erstellt', auf: true } : { feld: 'name', auf: true };

const vergleiche = (a: SortierObjekt, b: SortierObjekt, feld: SortierFeld) => {
	switch (feld) {
		case 'name':
			return NATUERLICH.compare(a.name, b.name);
		case 'art':
			return NATUERLICH.compare(a.art, b.art) || NATUERLICH.compare(a.name, b.name);
		case 'erstellt':
			return a.erstellt.localeCompare(b.erstellt) || NATUERLICH.compare(a.name, b.name);
		case 'geaendert':
			return a.geaendert.localeCompare(b.geaendert) || NATUERLICH.compare(a.name, b.name);
	}
};

/** Ordner stehen immer zuerst, auch bei umgedrehter Richtung. */
export const sortiereObjekte = <T extends SortierObjekt>(objekte: readonly T[], { auf, feld }: Sortierung): T[] =>
	[...objekte].sort((a, b) => {
		if (a.istOrdner !== b.istOrdner) {
			return a.istOrdner ? -1 : 1;
		}
		const wert = vergleiche(a, b, feld);
		return auf ? wert : -wert;
	});

interface DokumentMitMeta {
	mappe: string;
	id: string;
	ordner: string | null;
	meta: { titel: string; erstellt: string; geaendert: string; art: string };
}

const alsObjekt = (o: OrdnerEintrag): SortierObjekt & { eintrag: OrdnerEintrag } => ({
	eintrag: o,
	istOrdner: true,
	name: o.name,
	erstellt: o.erstellt,
	geaendert: o.geaendert,
	art: '',
});

/** Alle Dokumente unter einem Ordner in Standardsortierung, Unterordner an ihrer Stelle. */
export const ordneNachFolge = <T extends DokumentMitMeta>(baum: Baum, wurzel: string, dokumente: readonly T[]): T[] => {
	const folge: T[] = [];
	const lauf = (id: string, gesehen: ReadonlySet<string>) => {
		const hier = baum.ordner.find((o) => o.id === id) ?? null;
		const unter = baum.ordner.filter((o) => o.eltern === id && !o.geloescht && !gesehen.has(o.id)).map(alsObjekt);
		const doks = dokumente
			.filter((d) => d.ordner === id)
			.map((d) => ({
				d,
				istOrdner: false,
				name: d.meta.titel,
				erstellt: d.meta.erstellt,
				geaendert: d.meta.geaendert,
				art: d.meta.art,
			}));
		for (const objekt of sortiereObjekte<SortierObjekt>([...unter, ...doks], standardSortierung(hier))) {
			if ('eintrag' in objekt) {
				lauf((objekt as ReturnType<typeof alsObjekt>).eintrag.id, new Set([...gesehen, id]));
			} else {
				folge.push((objekt as (typeof doks)[number]).d);
			}
		}
	};
	lauf(wurzel, new Set());
	return folge;
};

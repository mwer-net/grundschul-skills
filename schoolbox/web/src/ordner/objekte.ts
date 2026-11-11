import { sortiereObjekte, standardSortierung } from '@schoolbox/kern/src/ordner-sortierung';

import { anzahl, ART_NAME, FACH_NAME, falte, klasseName } from '../lib/text';
import type {
	AblageDok,
	AblageOrdner,
	AblageStand,
	DokObjekt,
	Inhalt,
	Knoten,
	Objekt,
	OrdnerObjekt,
	Sortierung,
} from './typen';

export const WURZEL_NAME = 'Mein Material';
export const ZULETZT_ANZAHL = 50;
/** So viel schaut aus einer Ordnerkachel heraus; so viele Blätter zeigt auch der Geist beim Ziehen. */
export const VORNE = 3;
export const STRICH = '–';

export const schluesselVon = (k: Knoten) => ('ordner' in k ? k.ordner : `${k.mappe}/${k.dok}`);

/** Nur direkt darin, wie beim Öffnen zu sehen; `null` ist „Mein Material“. */
export const inhaltVon = (stand: AblageStand, id: string | null): Inhalt => ({
	ordner: stand.ordner.filter((o) => o.eltern === id).length,
	materialien: stand.dokumente.filter((d) => d.ordner === id).length,
});

export const ordnerObjekt = (stand: AblageStand, ordner: AblageOrdner): OrdnerObjekt => ({
	schluessel: ordner.id,
	istOrdner: true,
	knoten: { ordner: ordner.id },
	ordner,
	name: ordner.name,
	erstellt: ordner.erstellt,
	geaendert: ordner.geaendert,
	art: '',
	geteilt: stand.geteilt.ordner.includes(ordner.id),
	inhalt: inhaltVon(stand, ordner.id),
});

export const dokObjekt = (stand: AblageStand, dok: AblageDok): DokObjekt => {
	const schluessel = `${dok.mappe}/${dok.id}`;
	return {
		schluessel,
		istOrdner: false,
		knoten: { mappe: dok.mappe, dok: dok.id },
		dok,
		name: dok.meta.titel,
		erstellt: dok.meta.erstellt,
		geaendert: dok.meta.geaendert,
		art: ART_NAME[dok.meta.art] ?? dok.meta.art,
		geteilt: stand.geteilt.dokumente.includes(schluessel),
	};
};

export const findeOrdner = (stand: AblageStand, id: string | null) =>
	id === null ? null : (stand.ordner.find((o) => o.id === id) ?? null);

/** Von oben nach unten. Ein Zyklus kann nur aus einem kaputten Stand kommen: Dann endet der Pfad dort. */
export const pfadVon = (stand: AblageStand, id: string | null) => {
	const pfad: AblageOrdner[] = [];
	const gesehen = new Set<string>();
	for (let o = findeOrdner(stand, id); o && !gesehen.has(o.id); o = findeOrdner(stand, o.eltern)) {
		gesehen.add(o.id);
		pfad.unshift(o);
	}
	return pfad;
};

export const ortName = (stand: AblageStand, id: string | null) =>
	[WURZEL_NAME, ...pfadVon(stand, id).map((o) => o.name)].join(' › ');

/** Sortiert nach dem Gespeicherten, sonst nach der Herkunft des Ordners. */
export type SortierungVon = (ordner: AblageOrdner | null) => Sortierung;

export const standardVon: SortierungVon = (ordner) => standardSortierung(ordner);

export const kinder = (stand: AblageStand, id: string | null, sortierung: Sortierung): Objekt[] =>
	sortiereObjekte<Objekt>(
		[
			...stand.ordner.filter((o) => o.eltern === id).map((o) => ordnerObjekt(stand, o)),
			...stand.dokumente.filter((d) => d.ordner === id).map((d) => dokObjekt(stand, d)),
		],
		sortierung,
	);

/** Was aus der Ordnerkachel herausschaut: das, was beim Öffnen vorn steht. */
export const vorneVon = (stand: AblageStand, id: string, sortierung: Sortierung) =>
	kinder(stand, id, sortierung).slice(0, VORNE);

/** Alle Nachkommen: Ein Ordner kann nicht in sich selbst, und nicht in etwas, das in ihm liegt. */
export const nachkommen = (stand: AblageStand, id: string) => {
	const alle = new Set([id]);
	for (let neu = true; neu;) {
		neu = false;
		for (const o of stand.ordner) {
			if (o.eltern !== null && alle.has(o.eltern) && !alle.has(o.id)) {
				alle.add(o.id);
				neu = true;
			}
		}
	}
	return alle;
};

export const elternVon = (o: Objekt) => (o.istOrdner ? o.ordner.eltern : o.dok.ordner);

/** Ungültig: in sich selbst, in etwas darunter, oder dorthin, wo es schon liegt. */
export const zielGueltig = (stand: AblageStand, objekte: readonly Objekt[], ziel: string | null) =>
	objekte.length > 0 &&
	objekte.every((o) => {
		if (elternVon(o) === ziel) {
			return false;
		}
		return !(o.istOrdner && ziel !== null && nachkommen(stand, o.ordner.id).has(ziel));
	});

/** Alles darunter in sichtbarer Sortierung, Unterordner an ihrer Stelle: die Reihenfolge von „Alles als PDF“. */
export const dokumenteInFolge = (stand: AblageStand, id: string | null, sortierungVon: SortierungVon): AblageDok[] => {
	const folge: AblageDok[] = [];
	const gesehen = new Set<string>();
	const lauf = (ordner: string | null) => {
		if (ordner !== null) {
			if (gesehen.has(ordner)) {
				return;
			}
			gesehen.add(ordner);
		}
		for (const objekt of kinder(stand, ordner, sortierungVon(findeOrdner(stand, ordner)))) {
			if (objekt.istOrdner) {
				lauf(objekt.ordner.id);
			} else {
				folge.push(objekt.dok);
			}
		}
	};
	lauf(id);
	return folge;
};

export interface SuchFilter {
	q: string;
	fach: string | null;
	klasse: string | null;
	art: string | null;
	/** `null`: überall. */
	in: string | null;
}

const worteVon = (text: string) => falte(text).split(/\s+/).filter(Boolean);

/** Dokumente und Ordner; mit aktivem Filter nur Dokumente (die haben Fach, Klasse und Art). */
export const suche = (stand: AblageStand, { art, fach, in: bereich, klasse, q }: SuchFilter): Objekt[] => {
	const worte = worteVon(q);
	const erlaubt = bereich === null ? null : nachkommen(stand, bereich);
	const imBereich = (o: string | null) => erlaubt === null || (o !== null && erlaubt.has(o));
	const gefiltert = fach !== null || klasse !== null || art !== null;
	const passt = (text: string) => {
		const t = falte(text);
		return worte.every((w) => t.includes(w));
	};
	const dokumente = stand.dokumente
		.filter((d) => imBereich(d.ordner))
		.filter((d) => fach === null || d.fach === fach)
		.filter((d) => klasse === null || String(d.klasse) === klasse)
		.filter((d) => art === null || d.meta.art === art)
		.filter((d) => passt([d.meta.titel, FACH_NAME[d.fach], klasseName(d.klasse), ART_NAME[d.meta.art]].join(' ')))
		.map((d) => dokObjekt(stand, d));
	const ordner =
		gefiltert || worte.length === 0
			? []
			: stand.ordner
					.filter((o) => imBereich(o.id) && o.id !== bereich)
					.filter((o) => passt(o.name))
					.map((o) => ordnerObjekt(stand, o));
	return [...ordner, ...dokumente];
};

export const zuletzt = (stand: AblageStand) =>
	[...stand.dokumente]
		.sort((a, b) => b.meta.geaendert.localeCompare(a.meta.geaendert))
		.slice(0, ZULETZT_ANZAHL)
		.map((d) => dokObjekt(stand, d));

/** Der Stand, den man nach der Aktion erwartet, sofort sichtbar. Der Server hat danach das letzte Wort. */
export const erwarteterStand = (stand: AblageStand, aktion: { art: string } & Record<string, unknown>): AblageStand => {
	const knoten = (aktion.knoten ?? []) as Knoten[] | Knoten;
	const liste = Array.isArray(knoten) ? knoten : [knoten];
	const schluessel = new Set(liste.map(schluesselVon));
	const istDok = (d: AblageDok) => schluessel.has(`${d.mappe}/${d.id}`);
	switch (aktion.art) {
		case 'bewegen': {
			const ziel = aktion.ziel as string | null;
			return {
				...stand,
				ordner: stand.ordner.map((o) => (schluessel.has(o.id) ? { ...o, eltern: ziel } : o)),
				dokumente: stand.dokumente.map((d) => (istDok(d) ? { ...d, ordner: ziel } : d)),
			};
		}
		case 'papierkorb': {
			const weg = new Set<string>();
			for (const k of liste) {
				if ('ordner' in k) {
					for (const id of nachkommen(stand, k.ordner)) {
						weg.add(id);
					}
				}
			}
			return {
				...stand,
				ordner: stand.ordner.filter((o) => !weg.has(o.id)),
				dokumente: stand.dokumente.filter((d) => !istDok(d) && !(d.ordner !== null && weg.has(d.ordner))),
			};
		}
		case 'umbenennen': {
			const name = aktion.name as string;
			return {
				...stand,
				ordner: stand.ordner.map((o) => (schluessel.has(o.id) ? { ...o, name } : o)),
				dokumente: stand.dokumente.map((d) => (istDok(d) ? { ...d, meta: { ...d.meta, titel: name } } : d)),
			};
		}
		default:
			return stand;
	}
};

export const objekteText = (n: number) => anzahl(n, 'Objekt', 'Objekte');
/** Für Zahlen in Spalten und Zeilen: „1 Objekt“ statt „Ein Objekt“. */
export const objekteZahl = (n: number) => objekteText(n).replace('Ein Objekt', '1 Objekt');

/** „Leer“, „3 Ordner“, „1 Material“, „1 Ordner · 2 Materialien“: an Kachel, Zeile, Informationen und Teilen-Link. */
export const inhaltText = ({ materialien, ordner }: Inhalt) => {
	const teile = [
		...(ordner > 0 ? [`${ordner} Ordner`] : []),
		...(materialien > 0 ? [`${materialien} ${materialien === 1 ? 'Material' : 'Materialien'}`] : []),
	];
	return teile.length > 0 ? teile.join(' · ') : 'Leer';
};

/** Noch nicht gezählt ist „–“. */
export const seitenText = (n: number) => (n > 0 ? `${n} ${n === 1 ? 'Seite' : 'Seiten'}` : STRICH);

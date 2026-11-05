/** Die Auswahl als reine Funktionen: über `reihenfolge`, also genau das, was gerade angezeigt wird. */
export interface AuswahlStand {
	gewaehlt: readonly string[];
	anker: string | null;
}

export const KEINE: AuswahlStand = { gewaehlt: [], anker: null };

export interface Zusatz {
	befehl: boolean;
	umschalt: boolean;
}

const nachReihenfolge = (menge: Iterable<string>, reihenfolge: readonly string[]) => {
	const m = new Set(menge);
	return reihenfolge.filter((s) => m.has(s));
};

const bereich = (von: string | null, bis: string, reihenfolge: readonly string[]) => {
	const a = von === null ? -1 : reihenfolge.indexOf(von);
	const b = reihenfolge.indexOf(bis);
	if (b < 0) {
		return [];
	}
	const start = a < 0 ? b : a;
	return reihenfolge.slice(Math.min(start, b), Math.max(start, b) + 1);
};

/** Klick wählt nur dieses; ⌘ schaltet um; ⇧ wählt den Bereich vom Anker bis hier, in Anzeigereihenfolge. */
export const klicke = (
	stand: AuswahlStand,
	schluessel: string,
	{ befehl, umschalt }: Zusatz,
	reihenfolge: readonly string[],
): AuswahlStand => {
	if (umschalt) {
		const neu = bereich(stand.anker ?? schluessel, schluessel, reihenfolge);
		return {
			gewaehlt: befehl ? nachReihenfolge([...stand.gewaehlt, ...neu], reihenfolge) : neu,
			anker: stand.anker ?? schluessel,
		};
	}
	if (befehl) {
		const drin = stand.gewaehlt.includes(schluessel);
		return {
			gewaehlt: nachReihenfolge(
				drin ? stand.gewaehlt.filter((s) => s !== schluessel) : [...stand.gewaehlt, schluessel],
				reihenfolge,
			),
			anker: schluessel,
		};
	}
	return { gewaehlt: [schluessel], anker: schluessel };
};

export const alles = (reihenfolge: readonly string[]): AuswahlStand => ({
	gewaehlt: [...reihenfolge],
	anker: reihenfolge[0] ?? null,
});

/** Was nicht mehr angezeigt wird, ist auch nicht mehr gewählt. */
export const bereinige = (stand: AuswahlStand, reihenfolge: readonly string[]): AuswahlStand => {
	const gewaehlt = nachReihenfolge(stand.gewaehlt, reihenfolge);
	const anker = stand.anker !== null && reihenfolge.includes(stand.anker) ? stand.anker : (gewaehlt[0] ?? null);
	return gewaehlt.length === stand.gewaehlt.length && anker === stand.anker ? stand : { gewaehlt, anker };
};

export type Richtung = 'hoch' | 'runter' | 'links' | 'rechts';

/**
 * Bewegt die Auswahl um eine Stelle, im Raster zweidimensional. Der Anker bleibt beim Erweitern stehen; gezählt wird
 * vom zuletzt berührten Objekt (`zeiger`).
 */
export const bewege = (
	stand: AuswahlStand,
	zeiger: string | null,
	richtung: Richtung,
	{ erweitern, reihenfolge, spalten }: { reihenfolge: readonly string[]; spalten: number; erweitern: boolean },
): { stand: AuswahlStand; zeiger: string | null } => {
	if (reihenfolge.length === 0) {
		return { stand, zeiger };
	}
	const jetzt = zeiger === null ? -1 : reihenfolge.indexOf(zeiger);
	const schritt = { hoch: -spalten, runter: spalten, links: -1, rechts: 1 }[richtung];
	let ziel: number;
	if (jetzt < 0) {
		ziel = schritt > 0 ? 0 : reihenfolge.length - 1;
	} else {
		ziel = jetzt + schritt;
		// Im Raster bleibt eine kurze letzte Zeile erreichbar; sonst bleibt die Auswahl stehen.
		if (
			richtung === 'runter' &&
			ziel >= reihenfolge.length &&
			Math.floor(jetzt / spalten) < Math.floor((reihenfolge.length - 1) / spalten)
		) {
			ziel = reihenfolge.length - 1;
		}
		if (ziel < 0 || ziel >= reihenfolge.length) {
			return { stand, zeiger };
		}
	}
	const neu = reihenfolge[ziel] ?? null;
	if (neu === null) {
		return { stand, zeiger };
	}
	if (erweitern) {
		const anker = stand.anker ?? zeiger ?? neu;
		return { stand: { gewaehlt: bereich(anker, neu, reihenfolge), anker }, zeiger: neu };
	}
	return { stand: { gewaehlt: [neu], anker: neu }, zeiger: neu };
};

/** Tippen springt zum passenden Namen; der Vergleich beginnt am Namensanfang. */
export const findeNachName = (
	puffer: string,
	objekte: readonly { schluessel: string; name: string }[],
	falte: (text: string) => string,
) => {
	const p = falte(puffer);
	return objekte.find((o) => falte(o.name).startsWith(p))?.schluessel ?? null;
};

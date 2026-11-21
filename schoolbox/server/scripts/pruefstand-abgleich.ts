/**
 * Der Abgleich des Prüfstands (239): Befunde eines Prüflaufs gegen den Fehlerkatalog `fehler.json`. Ein Eintrag gilt
 * als gefunden, wenn ein Befund desselben Materials auf derselben Seite (oder ohne Seite) eines seiner Stichwörter
 * nennt. Die Zuordnung ist grob; was als „neu“ übrig bleibt, beurteilt ein Mensch: echter Fund oder Fehlalarm.
 */
import type { PruefBefund } from '@schoolbox/kern';

/** Die Teile eines Prüflaufs; `plan` ist die Plan-Prüfung vor der Freigabe, `bild` die Bildprüfung (268). */
export const TEILE = ['kind', 'blick', 'fach', 'plan', 'bild'] as const;
export type Teil = (typeof TEILE)[number];
export const GEBAUTE_TEILE: readonly Teil[] = ['kind', 'blick', 'fach', 'plan', 'bild'];

/** Was der Plan selbst falsch hat (Punkt 4): findet die Plan-Prüfung, nicht der Blick auf die Materialien. */
export const PLAN_DOKUMENT = 'plan';

export interface KatalogEintrag {
	id: string;
	/** Slug des Materials im Plan oder `plan`. */
	dokument: string;
	seite: number | null;
	aufgabe: string;
	art: string;
	/** Die Teile, die den Fehler finden sollen; ein Lauf ohne sie wertet den Eintrag nicht. */
	teil: Teil[];
	stichwoerter: string[];
	beschreibung: string;
	/** `still`: Gegenprobe, auf dieser Seite soll nichts gemeldet werden. */
	erwartung: 'gefunden' | 'still';
	begruendung?: string;
}

export interface MaterialErgebnis {
	slug: string;
	/** Was der Lauf geprüft hat; leer, wenn er gescheitert ist. */
	geprueft: Teil[];
	befunde: PruefBefund[];
	fehler: string | null;
}

export type EintragStand = 'gefunden' | 'nicht gefunden' | 'still' | 'gemeldet' | 'nicht geprüft';

export interface Abgleich {
	eintraege: { id: string; dokument: string; seite: number | null; stand: EintragStand; befunde: number[] }[];
	/** Befunde ohne Eintrag: Material und Nummer des Befunds in seiner Liste. */
	neu: { slug: string; nr: number; befund: PruefBefund }[];
}

const istTextListe = (wert: unknown): wert is string[] =>
	Array.isArray(wert) && wert.every((w) => typeof w === 'string' && w.trim() !== '');

/** Prüft einen Eintrag mit gültiger `id`; jeder Fehler bricht den Abgleich ab. */
const katalogEintrag = (
	x: Record<string, unknown> & { id: string },
	wo: string,
	slugs: ReadonlySet<string>,
): KatalogEintrag => {
	if (typeof x.dokument !== 'string' || (x.dokument !== PLAN_DOKUMENT && !slugs.has(x.dokument))) {
		throw new Error(`${wo} (${x.id}): „dokument“ ist kein Slug des Plans und nicht „${PLAN_DOKUMENT}“.`);
	}
	if (x.seite !== null && !(typeof x.seite === 'number' && Number.isInteger(x.seite) && x.seite > 0)) {
		throw new Error(`${wo} (${x.id}): „seite“ ist keine Seitenzahl und nicht null.`);
	}
	if (!istTextListe(x.teil) || !x.teil.every((t) => (TEILE as readonly string[]).includes(t))) {
		throw new Error(`${wo} (${x.id}): „teil“ braucht eine Liste aus ${TEILE.join(', ')}.`);
	}
	const erwartung = x.erwartung ?? 'gefunden';
	if (erwartung !== 'gefunden' && erwartung !== 'still') {
		throw new Error(`${wo} (${x.id}): „erwartung“ ist „gefunden“ oder „still“.`);
	}
	if (erwartung === 'gefunden' && !istTextListe(x.stichwoerter)) {
		throw new Error(`${wo} (${x.id}): „stichwoerter“ fehlt.`);
	}
	if (erwartung === 'still' && x.seite === null) {
		throw new Error(`${wo} (${x.id}): Eine Gegenprobe „still“ braucht eine Seite.`);
	}
	return {
		id: x.id,
		dokument: x.dokument,
		seite: x.seite,
		aufgabe: typeof x.aufgabe === 'string' ? x.aufgabe : '',
		art: typeof x.art === 'string' ? x.art : '',
		teil: x.teil as Teil[],
		stichwoerter: istTextListe(x.stichwoerter) ? x.stichwoerter : [],
		beschreibung: typeof x.beschreibung === 'string' ? x.beschreibung : '',
		erwartung,
		...(typeof x.begruendung === 'string' ? { begruendung: x.begruendung } : {}),
	};
};

/** Liest `fehler.json` streng: Ein falscher Eintrag verfälscht jeden Abgleich, deshalb bricht er ab. */
export const leseKatalog = (roh: unknown, slugs: ReadonlySet<string>): KatalogEintrag[] => {
	const liste = (roh as { eintraege?: unknown } | null)?.eintraege;
	if (!Array.isArray(liste)) {
		throw new Error('fehler.json braucht eine Liste „eintraege“.');
	}
	const ids = new Set<string>();
	return liste.map((e: unknown, i) => {
		const x = (e ?? {}) as Record<string, unknown>;
		const wo = `fehler.json, Eintrag ${i + 1}`;
		if (typeof x.id !== 'string' || !x.id || ids.has(x.id)) {
			throw new Error(`${wo}: „id“ fehlt oder ist doppelt.`);
		}
		ids.add(x.id);
		return katalogEintrag(x as Record<string, unknown> & { id: string }, wo, slugs);
	});
};

const normal = (text: string) =>
	text
		.toLowerCase()
		.replace(/[„“”"‚‘’']/g, '')
		.replace(/\s+/g, ' ');

const seitePasst = (e: KatalogEintrag, b: PruefBefund) => e.seite === null || b.seite === null || e.seite === b.seite;

const nennt = (e: KatalogEintrag, b: PruefBefund) => {
	const text = normal(`${b.aufgabe} ${b.text}`);
	return e.stichwoerter.some((w) => text.includes(normal(w)));
};

const standVon = (erwartung: KatalogEintrag['erwartung'], getroffen: boolean): EintragStand => {
	if (erwartung === 'still') {
		return getroffen ? 'gemeldet' : 'still';
	}
	return getroffen ? 'gefunden' : 'nicht gefunden';
};

export const gleicheAb = (katalog: readonly KatalogEintrag[], materialien: readonly MaterialErgebnis[]): Abgleich => {
	const benutzt = new Set<string>();
	const eintraege = katalog.map((e) => {
		const m = materialien.find((x) => x.slug === e.dokument);
		if (!m || m.fehler || !e.teil.some((t) => m.geprueft.includes(t))) {
			return { id: e.id, dokument: e.dokument, seite: e.seite, stand: 'nicht geprüft' as const, befunde: [] };
		}
		const treffer = m.befunde
			.map((b, nr) => ({ b, nr }))
			.filter(({ b }) => (e.erwartung === 'still' ? e.seite === b.seite : seitePasst(e, b) && nennt(e, b)));
		for (const { nr } of treffer) {
			benutzt.add(`${m.slug}#${nr}`);
		}
		const stand = standVon(e.erwartung, treffer.length > 0);
		return { id: e.id, dokument: e.dokument, seite: e.seite, stand, befunde: treffer.map((t) => t.nr + 1) };
	});
	const neu = materialien.flatMap((m) =>
		m.befunde
			.map((befund, nr) => ({ slug: m.slug, nr: nr + 1, befund }))
			.filter((x) => !benutzt.has(`${x.slug}#${x.nr - 1}`)),
	);
	return { eintraege, neu };
};

const zelle = (text: string) => text.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

/** Die Tabelle für Ticket und Konsole: je Eintrag sein Stand, darunter die Befunde ohne Eintrag. */
export const abgleichTabelle = (katalog: readonly KatalogEintrag[], a: Abgleich) => {
	const zaehle = (stand: EintragStand) => a.eintraege.filter((e) => e.stand === stand).length;
	const kopf = [
		`Gefunden ${zaehle('gefunden')}, nicht gefunden ${zaehle('nicht gefunden')}, Gegenprobe still ${zaehle('still')}, gemeldet ${zaehle('gemeldet')}, nicht geprüft ${zaehle('nicht geprüft')}, neu ${a.neu.length}.`,
		'',
		'| Eintrag | Material | Seite | Stand | Befund Nr. | Beschreibung |',
		'|---|---|---|---|---|---|',
	];
	const zeilen = a.eintraege.map((e) => {
		const k = katalog.find((x) => x.id === e.id);
		return `| ${e.id} | ${e.dokument} | ${e.seite ?? '–'} | ${e.stand} | ${e.befunde.join(', ') || '–'} | ${zelle(k?.beschreibung ?? '')} |`;
	});
	const neu = a.neu.length
		? [
				'',
				'Neu (von Hand beurteilen: echter Fund oder Fehlalarm):',
				'',
				'| Material | Nr. | Seite | Art | Befund |',
				'|---|---|---|---|---|',
				...a.neu.map(
					(n) =>
						`| ${n.slug} | ${n.nr} | ${n.befund.seite ?? '–'} | ${n.befund.art} | ${zelle(`${n.befund.aufgabe ? `${n.befund.aufgabe}: ` : ''}${n.befund.text}`)} |`,
				),
			]
		: [];
	return [...kopf, ...zeilen, ...neu].join('\n');
};

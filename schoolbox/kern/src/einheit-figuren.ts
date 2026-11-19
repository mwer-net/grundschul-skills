/**
 * Besitzer: 242. Die Figuren einer Einheit aus einer Quelle: die Leitfigur aus dem Assistenten und die Figuren im Plan
 * mit ihrer Herkunft. Eine Figur der Bibliothek trägt ihre Kennung (`bibliothek:<id>`); nur sie bekommt eine Grundpose
 * als Referenz. 253 übernimmt die `neu`-Figuren nach dem Bilderlauf in die Bibliothek.
 */
import { SchoolboxFehler } from './fehler';
import type { BibliotheksFigur } from './figuren';
import { FIGUREN } from './figuren';
import { ID_MUSTER } from './schema';

export const FIGUR_ZEICHEN = { name: 40, aussehen: 300, rolle: 300, planAussehen: 400 };

const KENNUNG = new RegExp(ID_MUSTER);
const MAX_KENNUNG = 60;
const PRAEFIX = 'bibliothek:';

export interface FigurWahl {
	id: string;
	name: string;
}

/** Eine oder zwei Figuren der Bibliothek (Willi und Wilma als Paar), eine eigene mit Aussehen oder keine. */
export type EinheitLeitfigur =
	{ art: 'bibliothek'; figuren: FigurWahl[] } | { art: 'neu'; name: string; aussehen: string } | { art: 'keine' };

const eingebaut = (id: string): FigurWahl => ({ id, name: FIGUREN.find((f) => f.id === id)?.name ?? id });

/** Die Vorgabe wie vor 242: Willi und Wilma. */
export const leitfigurStandard = (): EinheitLeitfigur => ({
	art: 'bibliothek',
	figuren: [eingebaut('willi'), eingebaut('wilma')],
});

/** Die Werte vor 242 (`EINHEIT_LEITFIGUR`), wie alte Anfragen sie noch schicken. */
const ALT: Record<string, () => EinheitLeitfigur> = {
	willi: () => ({ art: 'bibliothek', figuren: [eingebaut('willi')] }),
	wilma: () => ({ art: 'bibliothek', figuren: [eingebaut('wilma')] }),
	beide: leitfigurStandard,
	keine: () => ({ art: 'keine' }),
};

const ungueltig = () => new SchoolboxFehler('Die Leitfigur ist ungültig.');

const feld = (wert: unknown, max: number, pflicht: boolean) => {
	if (wert === undefined && !pflicht) {
		return '';
	}
	if (typeof wert !== 'string' || wert.length > max || (pflicht && !wert.trim())) {
		throw ungueltig();
	}
	// Name und Aussehen stehen je in einer Zeile des Auftrags und des Prüflaufs.
	return wert.replace(/\s+/g, ' ').trim();
};

/** Prüft die Leitfigur aus dem Assistenten; ohne Angabe die Vorgabe. */
export const leseLeitfigur = (roh: unknown): EinheitLeitfigur => {
	if (roh === undefined) {
		return leitfigurStandard();
	}
	if (typeof roh === 'string') {
		const alt = ALT[roh];
		if (!alt) {
			throw ungueltig();
		}
		return alt();
	}
	if (typeof roh !== 'object' || roh === null) {
		throw ungueltig();
	}
	const l = roh as Record<string, unknown>;
	if (l.art === 'keine') {
		return { art: 'keine' };
	}
	if (l.art === 'neu') {
		return {
			art: 'neu',
			name: feld(l.name, FIGUR_ZEICHEN.name, true),
			aussehen: feld(l.aussehen, FIGUR_ZEICHEN.aussehen, false),
		};
	}
	if (l.art !== 'bibliothek' || !Array.isArray(l.figuren) || l.figuren.length < 1 || l.figuren.length > 2) {
		throw ungueltig();
	}
	const figuren = l.figuren.map((f): FigurWahl => {
		const x = (f ?? {}) as Record<string, unknown>;
		if (typeof x.id !== 'string' || !KENNUNG.test(x.id) || x.id.length > MAX_KENNUNG) {
			throw ungueltig();
		}
		return { id: x.id, name: feld(x.name, MAX_KENNUNG, true) };
	});
	if (new Set(figuren.map((f) => f.id)).size !== figuren.length) {
		throw ungueltig();
	}
	return { art: 'bibliothek', figuren };
};

const ohnePunkt = (text: string) => text.replace(/[.!?…]+$/, '');

/** Der Satz im Auftrag. Nennt ihn die Lehrkraft nicht, steht dort auch kein Willi. */
export const leitfigurSatz = (l: EinheitLeitfigur) => {
	if (l.art === 'keine') {
		return 'Ohne Leitfigur.';
	}
	if (l.art === 'neu') {
		return `Leitfigur: ${l.name} (neu, Aussehen: ${l.aussehen ? ohnePunkt(l.aussehen) : 'entscheide du'}).`;
	}
	return `Leitfigur: ${l.figuren.map((f) => f.name).join(' und ')} aus der Bibliothek.`;
};

/** Kurz für die Antwort im Assistenten: „Willi und Wilma“, „Luna“, „Keine“. */
export const leitfigurKurz = (l: EinheitLeitfigur) => {
	if (l.art === 'keine') {
		return 'Keine';
	}
	if (l.art === 'neu') {
		return l.name.trim() || 'Eigene Figur';
	}
	return l.figuren.map((f) => f.name).join(' und ');
};

export type FigurHerkunft = 'neu' | `${typeof PRAEFIX}${string}`;

/** Eine Figur der Geschichte im Plan (`einheit.json`, `figuren`). */
export interface PlanFigur {
	/** Leer bei Plänen vor 242: Dort war jede Figur ein Text, er steht ganz in `aussehen`. */
	name: string;
	rolle: string;
	aussehen: string;
	herkunft: FigurHerkunft;
}

export const MAX_PLAN_FIGUREN = 8;

const kurz = (wert: unknown, max: number) => (typeof wert === 'string' ? wert.trim().slice(0, max) : '');

const herkunftAus = (roh: unknown): FigurHerkunft => {
	const id = typeof roh === 'string' && roh.startsWith(PRAEFIX) ? roh.slice(PRAEFIX.length).trim() : '';
	return KENNUNG.test(id) && id.length <= MAX_KENNUNG ? `${PRAEFIX}${id}` : 'neu';
};

/**
 * Liest `figuren` aus dem Plan. Ein Text (Pläne vor 242) gilt als `neu`; eine unbekannte Herkunft auch, damit nie eine
 * falsche Grundpose als Referenz in den Lauf kommt.
 */
export const lesePlanFiguren = (roh: unknown): PlanFigur[] =>
	(Array.isArray(roh) ? roh : [])
		.map((f): PlanFigur | null => {
			if (typeof f === 'string') {
				const aussehen = kurz(f, FIGUR_ZEICHEN.planAussehen);
				return aussehen ? { name: '', rolle: '', aussehen, herkunft: 'neu' } : null;
			}
			if (typeof f !== 'object' || f === null) {
				return null;
			}
			const x = f as Record<string, unknown>;
			const figur: PlanFigur = {
				name: kurz(x.name, FIGUR_ZEICHEN.name),
				rolle: kurz(x.rolle, FIGUR_ZEICHEN.rolle),
				aussehen: kurz(x.aussehen, FIGUR_ZEICHEN.planAussehen),
				herkunft: herkunftAus(x.herkunft),
			};
			return figur.name || figur.aussehen ? figur : null;
		})
		.filter((f): f is PlanFigur => f !== null)
		.slice(0, MAX_PLAN_FIGUREN);

/** Die Kennung in der Bibliothek, `null` bei `neu`. */
export const bibliotheksId = (f: Pick<PlanFigur, 'herkunft'>) =>
	f.herkunft.startsWith(PRAEFIX) ? f.herkunft.slice(PRAEFIX.length) : null;

/** Eine Zeile je Figur für Bau- und Prüfläufe: „Luna (neu); Leitfigur, gibt die Tipps; Aussehen: braune Eule“. */
export const planFigurText = (f: PlanFigur) =>
	[
		f.name ? `${f.name} (${bibliotheksId(f) ? 'aus der Bibliothek' : 'neu'})` : '',
		f.rolle,
		f.aussehen && f.name ? `Aussehen: ${f.aussehen}` : f.aussehen,
	]
		.filter(Boolean)
		.join('; ');

/** Die Kennungen der Leitfigur aus der Bibliothek, für den Stand der Einheit. */
export const leitfigurIds = (l: EinheitLeitfigur) => (l.art === 'bibliothek' ? l.figuren.map((f) => f.id) : []);

/**
 * Die Figuren, deren Grundpose als Referenz in einen Lauf der Einheit kommt: die Leitfigur aus dem Assistenten und die
 * Figuren des Plans mit `bibliothek:<id>`, je Kennung einmal. Kein Name zählt: Fridolin der Einheit ist nicht Fridolin
 * der Bibliothek, solange der Plan ihn als `neu` führt. Neue Figuren haben ihre Grundpose aus dem Bilderlauf.
 */
export const referenzFiguren = <F extends Pick<BibliotheksFigur, 'id'>>(
	figuren: readonly Pick<PlanFigur, 'herkunft'>[],
	leitfigur: readonly string[],
	bibliothek: readonly F[],
): F[] => {
	const ids = [...new Set([...leitfigur, ...figuren.flatMap((f) => bibliotheksId(f) ?? [])])];
	return ids.flatMap((id) => bibliothek.filter((f) => f.id === id));
};

const MAX_BIBLIOTHEK = 30;
const STECKBRIEF_KURZ = 160;

/** Die Bibliothek für den Planlauf: je Figur Kennung, Name und Aussehen in einem Satz. */
export const bibliothekFuerPlan = (bibliothek: readonly Pick<BibliotheksFigur, 'id' | 'name' | 'steckbrief'>[]) =>
	bibliothek.length
		? [
				'Figuren der Bibliothek (für „herkunft“ im Plan; Grundpose und Posen gibt es schon):',
				...bibliothek
					.slice(0, MAX_BIBLIOTHEK)
					.map(
						(f) =>
							`- bibliothek:${f.id}: ${f.name}, ${f.steckbrief ? kurz(f.steckbrief, STECKBRIEF_KURZ) : 'ohne Steckbrief'}`,
					),
			].join('\n')
		: '';

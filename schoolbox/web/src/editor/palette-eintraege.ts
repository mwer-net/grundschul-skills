import { MEINE_BAUSTEINE } from '@schoolbox/kern/src/katalog';
import { leseBlatt } from '@schoolbox/kern/src/kit-einstellungen';

import type { Gruppe, Kontext } from './befehle';
import { befehleFuer, kuerzelText, symbolVon, titelVon } from './befehle';
import type { Posten } from './einfuegen';
import type { PalettenEintrag } from './palette-suche';
import type { SchubladenZiele } from './schubladen';
import { SCHUBLADEN } from './schubladen';

/** Sprungziele im Reiter „Blatt“; `ort` steht dort als `data-einstellung`. */
export const BLATT_EINSTELLUNGEN = [
	{ ort: 'titel', titel: 'Titel des Blatts', suchwoerter: ['überschrift', 'name'] },
	{ ort: 'klasse', titel: 'Klasse des Blatts', suchwoerter: ['jahrgang'] },
	{ ort: 'farbschema', titel: 'Farbschema', suchwoerter: ['farbe', 'palette'] },
	{ ort: 'format', titel: 'Format des Blatts', suchwoerter: ['a4', 'quer', 'hoch', 'karten'] },
	{ ort: 'abstand', titel: 'Abstand zwischen Aufgaben', suchwoerter: ['luft', 'platz', 'dichte'] },
	{ ort: 'punkte', titel: 'Punkte zeigen', suchwoerter: ['bewertung', 'ausblenden'] },
	// >> 181
	{ ort: 'seitenflaeche', titel: 'Seitenfläche', suchwoerter: ['hintergrund', 'farbe', 'grund'] },
	{ ort: 'seitenrahmen', titel: 'Rahmen der Seite', suchwoerter: ['rand', 'linie'] },
	{ ort: 'kopfband', titel: 'Kopfband', suchwoerter: ['band', 'kopf', 'kopfzeile'] },
	// << 181
] as const;

export const GANZES_BLATT = 'Ganzes Blatt';
export const BAUSTEIN_EINFUEGEN = 'Baustein einfügen';
export const SEITE = 'Seite';
export const DOKUMENT = 'Dokument';

const ZUR_AUSWAHL: Gruppe[] = ['bearbeiten', 'ablage', 'ordnen', 'baustein', 'gefahr'];
const IM_DOKUMENT = ['ansicht.versionen', 'ansicht.claude'];

export const auswahlTitel = (k: Kontext) => {
	const name = k.pfad.at(-1)?.name;
	return name ? `Auswahl: ${name}` : null;
};

const gruppeVon = (id: string, gruppe: Gruppe, auswahl: string | null) => {
	if (gruppe === 'dokument' || IM_DOKUMENT.includes(id)) {
		return DOKUMENT;
	}
	return ZUR_AUSWAHL.includes(gruppe) && auswahl ? auswahl : GANZES_BLATT;
};

/** Alles, was gerade verfügbar ist: nur `orte: palette`, keine gesperrten Befehle. */
export const befehleAlsEintraege = (k: Kontext, fuehreAus: (id: string) => unknown): PalettenEintrag[] => {
	const auswahl = auswahlTitel(k);
	return befehleFuer('palette', k)
		.filter((b) => !b.gesperrt?.(k))
		.map((b) => {
			const gruppe = gruppeVon(b.id, b.gruppe, auswahl);
			const [erstes] = b.kuerzel ?? [];
			const symbol = symbolVon(b, k);
			const notiz = b.notiz?.(k);
			return {
				id: b.id,
				titel: titelVon(b, k),
				gruppe,
				start: gruppe === auswahl || (!auswahl && gruppe === GANZES_BLATT),
				...(symbol ? { symbol } : {}),
				...(notiz ? { notiz } : {}),
				...(erstes ? { kuerzel: kuerzelText(erstes) } : {}),
				...(b.suchwoerter ? { suchwoerter: b.suchwoerter } : {}),
				aus: () => fuehreAus(b.id),
			};
		});
};

export interface PalettenZiele {
	posten: readonly Posten[];
	fuegeEin: (p: Posten) => void;
	zeigeSeite: (nr: number) => void;
	zeigeEinstellung: (ort: string) => void;
	fuehreAus: (id: string) => unknown;
	/** Inhalt der Schubladen (`suche` im Register); ohne Angabe nur die Befehle. */
	schubladen?: SchubladenZiele;
}

const ORDNUNG = (auswahl: string | null) => [auswahl, BAUSTEIN_EINFUEGEN, GANZES_BLATT, SEITE, DOKUMENT];

/** Der ganze Inhalt der Palette im Editor. */
export const eintraegeImEditor = (k: Kontext, z: PalettenZiele): PalettenEintrag[] => {
	const liste: PalettenEintrag[] = befehleAlsEintraege(k, z.fuehreAus);
	if (k.aktiv) {
		for (const p of z.posten) {
			liste.push({
				id: `einfuegen:${p.id}`,
				titel: p.name,
				gruppe: BAUSTEIN_EINFUEGEN,
				symbol: 'plus',
				notiz: p.eigen ? MEINE_BAUSTEINE : p.kategorie,
				suchwoerter: p.suchbegriffe,
				aus: () => z.fuegeEin(p),
			});
		}
	}
	if (k.frei && k.aktiv) {
		const mitPunkten = Boolean(k.quelle) && leseBlatt(k.quelle ?? '').hatPunkte;
		// >> 181
		// Im Mini-Book gibt es kein Kopfband (181).
		const gibt = (ort: string) =>
			(ort !== 'punkte' || mitPunkten) && (ort !== 'kopfband' || k.format !== 'minibuch');
		const einstellungen = BLATT_EINSTELLUNGEN.filter((b) => gibt(b.ort));
		// << 181
		for (const e of einstellungen) {
			liste.push({
				id: `einstellung:${e.ort}`,
				titel: e.titel,
				gruppe: GANZES_BLATT,
				symbol: 'blatt',
				notiz: 'Einstellung',
				suchwoerter: e.suchwoerter,
				aus: () => z.zeigeEinstellung(e.ort),
			});
		}
	}
	for (let nr = 1; nr <= (k.werte?.seiten ?? 0); nr += 1) {
		liste.push({
			id: `seite:${nr}`,
			titel: `Seite ${nr}`,
			gruppe: SEITE,
			symbol: 'seiten',
			suchwoerter: ['springen', 'gehe zu'],
			aus: () => z.zeigeSeite(nr),
		});
	}
	const { schubladen } = z;
	if (schubladen) {
		for (const s of SCHUBLADEN.filter((x) => x.suche && x.bereit(k))) {
			liste.push(...(s.suche?.(k, schubladen) ?? []));
		}
	}
	const ordnung = ORDNUNG(auswahlTitel(k));
	return liste.sort((a, b) => ordnung.indexOf(a.gruppe) - ordnung.indexOf(b.gruppe));
};

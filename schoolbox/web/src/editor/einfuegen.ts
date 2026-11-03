import type { Einfuegbar } from '@schoolbox/kern/src/einfuegen';
import { fuegeBausteinEin, verschiebeAufNeueSeite } from '@schoolbox/kern/src/einfuegen';
import type { KatalogEintrag } from '@schoolbox/kern/src/katalog';
import { sucheImKatalog } from '@schoolbox/kern/src/katalog';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLaden } from '../lib/laden';
import { nrVon } from './darstellung';
import type { Struktur } from './struktur';

export interface Posten extends KatalogEintrag {
	einfuegbar: Einfuegbar;
}

const ZULETZT = 'schoolbox.zuletzt-eingefuegt';
const ZULETZT_ANZAHL = 5;

const leseZuletzt = (): string[] => {
	try {
		const roh: unknown = JSON.parse(localStorage.getItem(ZULETZT) ?? '[]');
		return Array.isArray(roh) ? roh.filter((x): x is string => typeof x === 'string') : [];
	} catch {
		return [];
	}
};

/** Die Kinder, die von hinten weg müssen, damit die Seite wieder passt. Das erste Kind bleibt immer. */
export const ueberstehende = (seite: Element) => {
	const stil = seite.ownerDocument.defaultView?.getComputedStyle(seite);
	const grenze = seite.getBoundingClientRect().bottom - parseFloat(stil?.paddingBottom ?? '0');
	const kinder = [...seite.children];
	const unterkante = Math.max(...kinder.map((k) => k.getBoundingClientRect().bottom));
	let zuViel = unterkante - grenze;
	const raus: Element[] = [];
	for (const k of kinder.filter((e) => !e.classList.contains('fuss')).slice(1).toReversed()) {
		if (zuViel <= 1) {
			break;
		}
		raus.unshift(k);
		zuViel -= k.getBoundingClientRect().height;
	}
	return raus.flatMap((k) => nrVon(k) ?? []);
};

interface Optionen {
	struktur: Struktur;
	auswahl: number | null;
	folien: boolean;
	nachher: () => void;
}

/** Katalog und Befehle: jedes Einfügen ist ein Schritt im Verlauf, danach ist der neue Baustein gewählt. */
export const useEinfuegen = ({ auswahl, folien, nachher, struktur }: Optionen) => {
	const { daten } = useLaden<{ eintraege: Posten[] }>('/api/katalog');
	const [zuletzt, setZuletzt] = useState(leseZuletzt);
	const eintraege = daten?.eintraege ?? [];

	const fuegeEin = (e: Posten, nr: number | null = auswahl) => {
		const ok = struktur.fuehreAus(
			`${e.name} eingefügt`,
			(q) => fuegeBausteinEin(q, e.einfuegbar, nr, { jeSeite: folien }),
			true,
		);
		if (!ok) {
			return;
		}
		const neu = [e.id, ...zuletzt.filter((id) => id !== e.id)].slice(0, ZULETZT_ANZAHL);
		setZuletzt(neu);
		localStorage.setItem(ZULETZT, JSON.stringify(neu));
		nachher();
	};

	const verschiebe = (doc: Document, seitenNr: number) => {
		const seite = [...doc.querySelectorAll('.seite:not([data-erzeugt])')][seitenNr - 1];
		const nrs = seite ? ueberstehende(seite) : [];
		if (nrs.length > 0) {
			struktur.fuehreAus('Auf neue Seite verschoben', (q) => verschiebeAufNeueSeite(q, nrs, { jeSeite: folien }), true);
		}
	};

	const vorne = zuletzt.flatMap((id) => eintraege.find((e) => e.id === id) ?? []);
	return { eintraege, zuletzt: vorne, fuegeEin, verschiebe };
};

export type Einfuegen = ReturnType<typeof useEinfuegen>;

export interface SlashMenue {
	treffer: Posten[];
	index: number;
	x: number;
	y: number;
	waehle: (e: Posten) => void;
}

interface SlashOptionen {
	doc: Document | null;
	bearbeitet: boolean;
	beende: () => void;
	eintraege: Posten[];
	waehle: (e: Posten) => void;
}

const istZeilengrenze = (n: Node | null) => n === null || n.nodeName === 'BR';

/** Die Textstelle, in der getippt wird, falls sie in einem bearbeitbaren Träger liegt. */
const stelle = (doc: Document) => {
	const knoten = doc.getSelection()?.anchorNode;
	return knoten?.nodeType === 3 && knoten.parentElement?.closest('[contenteditable]') ? (knoten as Text) : null;
};

/**
 * `/` öffnet das Menü nur, wenn es allein in seiner Zeile steht; `1/2` und „und/oder“ bleiben Text. Die Tasten laufen
 * im Fenster des Materials zuerst hier durch, damit Enter und Esc weder die Zeile noch die Auswahl verändern.
 */
export const useSlash = ({ beende, bearbeitet, doc, eintraege, waehle }: SlashOptionen) => {
	const [offen, setOffen] = useState<{ knoten: Text; filter: string; index: number; x: number; y: number } | null>(null);
	const [gewaehlt, setGewaehlt] = useState<Posten | null>(null);
	const treffer = offen ? (sucheImKatalog(offen.filter, eintraege) as Posten[]) : [];
	const aktuell = useRef({ offen, treffer });
	useEffect(() => {
		aktuell.current = { offen, treffer };
	});

	const nimm = useCallback(
		(e: Posten) => {
			const knoten = aktuell.current.offen?.knoten;
			if (knoten) {
				knoten.data = '';
			}
			setOffen(null);
			setGewaehlt(e);
			beende();
		},
		[beende],
	);

	useEffect(() => {
		const fenster = doc?.defaultView;
		if (!doc || !fenster) {
			return undefined;
		}
		const tippt = () => {
			const k = stelle(doc);
			const jetzt = aktuell.current.offen;
			if (jetzt) {
				setOffen(
					k === jetzt.knoten && k.data.startsWith('/')
						? { ...jetzt, filter: k.data.slice(1), index: 0 }
						: null,
				);
				return;
			}
			if (k?.data === '/' && istZeilengrenze(k.previousSibling) && istZeilengrenze(k.nextSibling)) {
				const r = doc.createRange();
				r.selectNodeContents(k);
				const box = r.getBoundingClientRect();
				setOffen({ knoten: k, filter: '', index: 0, x: box.left, y: box.bottom });
			}
		};
		const taste = (e: KeyboardEvent) => {
			const { offen: jetzt, treffer: liste } = aktuell.current;
			if (!jetzt) {
				return;
			}
			const schritt = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
			if (schritt !== 0 && liste.length > 0) {
				setOffen({ ...jetzt, index: (jetzt.index + schritt + liste.length) % liste.length });
			} else if (e.key === 'Enter') {
				const e2 = liste[jetzt.index];
				if (e2) {
					nimm(e2);
				} else {
					setOffen(null);
				}
			} else if (e.key === 'Escape') {
				setOffen(null);
			} else {
				return;
			}
			e.preventDefault();
			e.stopImmediatePropagation();
		};
		doc.addEventListener('input', tippt);
		fenster.addEventListener('keydown', taste, true);
		return () => {
			doc.removeEventListener('input', tippt);
			fenster.removeEventListener('keydown', taste, true);
			setOffen(null);
		};
	}, [doc, nimm]);

	// Erst einfügen, wenn das Tippen abgeschlossen ist: Sonst nimmt der Befehlsweg nichts an.
	useEffect(() => {
		if (gewaehlt && !bearbeitet) {
			setGewaehlt(null);
			waehle(gewaehlt);
		}
	}, [gewaehlt, bearbeitet, waehle]);

	const menue: SlashMenue | null = offen ? { treffer, index: offen.index, x: offen.x, y: offen.y, waehle: nimm } : null;
	return { menue };
};

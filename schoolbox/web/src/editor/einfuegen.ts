import type { Einfuegbar, SchonDa } from '@schoolbox/kern/src/einfuegen';
import { fuegeBausteinEin, schonDa } from '@schoolbox/kern/src/einfuegen';
import { fuegeBausteinAn } from '@schoolbox/kern/src/einfuegen-ablage';
import { legeUm } from '@schoolbox/kern/src/fluss';
import { neueIdsInGestaltung } from '@schoolbox/kern/src/gestaltung';
import type { FuerBlatt, KatalogEintrag } from '@schoolbox/kern/src/katalog';
import { angebotFuerBlatt, gehtImBlatt, istAngeboten } from '@schoolbox/kern/src/katalog';
import { hatLoesung } from '@schoolbox/kern/src/loesungen';
import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import type { Ablage } from '@schoolbox/kern/src/struktur';
import { fuegeZeileEin, naechsteZelle, teileTabelle, vorigeZelle } from '@schoolbox/kern/src/tabelle';
import { useCallback, useEffect, useRef, useState } from 'react';

import { meldung } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { useLaden } from '../lib/laden';
import { bausteinVon, nrVon } from './darstellung';
import { blattDerSeite, istFlussblock, probelauf, seiteFliesst } from './fluss';
import type { Struktur } from './struktur';
import { leseAblage, mitBildern } from './zwischenablage';

export interface Posten extends KatalogEintrag {
	einfuegbar: Einfuegbar;
	/** Kennung in der Sammlung (051). */
	eigen?: string;
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

/** Ragt eine Tabelle über die Seite, wird zwischen den Zeilen geteilt statt der ganzen Aufgabe (047). */
export const tabelleZumTeilen = (seite: Element) => {
	const stil = seite.ownerDocument.defaultView?.getComputedStyle(seite);
	const grenze = seite.getBoundingClientRect().bottom - parseFloat(stil?.paddingBottom ?? '0');
	for (const t of seite.querySelectorAll<HTMLTableElement>('table.kit-tabelle')) {
		const zeilen = [...t.rows];
		const abZeile = zeilen.findIndex((r) => r.getBoundingClientRect().bottom > grenze);
		const nr = zeilen[0]?.cells[0] ? nrVon(zeilen[0].cells[0]) : null;
		if (abZeile > (t.tHead ? 1 : 0) && nr !== null) {
			return { nr, abZeile };
		}
	}
	return null;
};

export interface UmbruchKnopf {
	titel: string;
	art: 'umbrechen' | 'tabelle';
	aus: () => void;
}

interface Optionen {
	dokument: { mappe: string; dok: string };
	/** Fach und Klasse der Mappe, Art des Materials: was „Für dieses Blatt“ heißt (203-13). */
	blatt: FuerBlatt;
	struktur: Struktur;
	auswahl: number | null;
	folien: boolean;
	nachher: () => void;
}

/**
 * Katalog und Befehle: jedes Einfügen ist ein Schritt im Verlauf, danach ist der neue Baustein gewählt. `eintraege` ist
 * der Katalog ohne das, was im Blatt nicht zeichnet (`gehtImBlatt`; andere Schubladen suchen darin per Kennung, z. B.
 * `tipp` und `willi` in „Figuren“), `angebot` nur, was Schublade, Schnellauswahl, Slash und Palette zeigen (203-04).
 */
export const useEinfuegen = ({ auswahl, blatt, dokument, folien, nachher, struktur }: Optionen) => {
	const { daten, neuLaden } = useLaden<{ eintraege: Posten[] }>('/api/katalog');
	const [zuletzt, setZuletzt] = useState(leseZuletzt);
	const zeige = useHinweis();
	// 203-02, 203-N01: Was in diesem Blatt nicht fehlerfrei zeichnet, gibt es hier nicht, auf keinem Weg.
	const eintraege = (daten?.eintraege ?? []).filter((e) => gehtImBlatt(e, blatt));
	const angebot = eintraege.filter(istAngeboten);

	/** Hinter `nr` (Klick) oder an der Ablage, die das Ziehen gefunden hat (094). */
	const setzeEin = (e: Posten, einfuegbar: Einfuegbar, wo: number | null | { ablage: Ablage }) => {
		// 203-14: Hat die Seite das Teil schon, wird es gewählt statt verdoppelt.
		const gefunden: { da: SchonDa | null } = { da: null };
		const ok = struktur.fuehreAus(
			`${e.name} eingefügt`,
			(q) => {
				const nr = wo !== null && typeof wo === 'object' ? ('in' in wo.ablage ? wo.ablage.in : wo.ablage.nr) : wo;
				gefunden.da = schonDa(q, einfuegbar, nr);
				if (gefunden.da) {
					return { quelle: q, nr: gefunden.da.nr };
				}
				return wo !== null && typeof wo === 'object'
					? fuegeBausteinAn(q, einfuegbar, wo.ablage, { jeSeite: folien })
					: fuegeBausteinEin(q, einfuegbar, wo, { jeSeite: folien });
			},
			true,
		);
		if (gefunden.da) {
			struktur.zeigeAn(gefunden.da.nr);
			zeige({ text: gefunden.da.meldung });
			return;
		}
		if (!ok) {
			return;
		}
		const neu = [e.id, ...zuletzt.filter((id) => id !== e.id)].slice(0, ZULETZT_ANZAHL);
		setZuletzt(neu);
		localStorage.setItem(ZULETZT, JSON.stringify(neu));
		nachher();
	};

	const fuegeEin = (e: Posten, nr: number | null | { ablage: Ablage } = auswahl) => {
		if (e.eigen) {
			void mitBildern(dokument, { sammlung: e.eigen }, e.einfuegbar.html ?? '').then(
				(html) => setzeEin(e, { ...e.einfuegbar, html }, nr),
				(grund: unknown) => zeige({ text: meldung(grund), art: 'fehler' }),
			);
			return;
		}
		setzeEin(e, e.einfuegbar, nr);
	};

	/** Aus der Schublade gezogen: an der Stelle, die die Lücke zeigte. */
	const fuegeAn = (e: Posten, ablage: Ablage) => fuegeEin(e, { ablage });

	/** Aus der Zwischenablage eines anderen Dokuments, samt Bildern. */
	const fuegeAblageEin = async (nr: number | null = auswahl) => {
		const a = leseAblage();
		if (!a) {
			return;
		}
		const html = await mitBildern(dokument, { mappe: a.mappe, dok: a.dok }, a.html);
		struktur.fuehreAus(
			`${a.name} eingefügt`,
			// 106: Anker in der Kopie bekommen neue SVG-Ids, auch beim Einfügen ins selbe Dokument.
			(q) =>
				fuegeBausteinEin(q, { id: 'ablage', ort: a.ort, html: neueIdsInGestaltung(html, q) }, nr, {
					jeSeite: folien,
				}),
			true,
		);
		nachher();
	};

	/**
	 * Der Knopf an der Überlauf-Meldung einer Seite (206-05): Auf einer fließenden Seite bricht er das Blatt um, ein
	 * Schritt wie jeder andere. Steht nur ein Block auf der Seite und ist es eine Tabelle, teilt er sie (Regel 9).
	 */
	const umbruchKnopf = (doc: Document, z: Zerlegung, seitenNr: number): UmbruchKnopf | null => {
		const seite = [...doc.querySelectorAll('.seite')].filter((s) => !s.parentElement?.closest('.seite'))[
			seitenNr - 1
		];
		if (!seite) {
			return null;
		}
		const fliesst = seiteFliesst(doc, z, seitenNr);
		const bloecke = [...seite.children].filter((k) => nrVon(k) !== null && istFlussblock(k)).length;
		const geteilt = !fliesst || bloecke <= 1 ? tabelleZumTeilen(seite) : null;
		if (geteilt) {
			return {
				titel: 'Tabelle teilen',
				art: 'tabelle',
				aus: () =>
					struktur.fuehreAus(
						'Tabelle geteilt',
						(q) => teileTabelle(q, geteilt.nr, geteilt.abZeile, { jeSeite: folien }),
						true,
					),
			};
		}
		const blatt = blattDerSeite(doc, seitenNr);
		if (!fliesst || bloecke <= 1 || blatt === null) {
			return null;
		}
		const umbrechen = async () => {
			const plan = await probelauf(doc, z, { blaetter: [blatt], mitLoesung: hatLoesung(z.quelle) });
			if (!plan) {
				return;
			}
			struktur.fuehreAus('Auf nächste Seite umgebrochen', (q) => {
				if (q !== z.quelle) {
					return { quelle: q, nr: auswahl };
				}
				const u = legeUm(q, plan, { jeSeite: folien });
				return { quelle: u.quelle, nr: auswahl === null ? null : u.nummer(auswahl) };
			});
		};
		return { titel: 'Auf nächste Seite umbrechen', art: 'umbrechen', aus: () => void umbrechen() };
	};

	const vorne = zuletzt.flatMap((id) => angebot.find((e) => e.id === id) ?? []);
	/** Schnellauswahl, Slash und Palette (203-13): ohne Suchwort was zum Blatt passt, mit Suchwort alles im Angebot. */
	const fuerBlatt = (anfrage = '', ohne: Parameters<typeof angebotFuerBlatt>[3] = []) =>
		angebotFuerBlatt(angebot, blatt, anfrage, ohne);
	return {
		eintraege,
		angebot,
		blatt,
		fuerBlatt,
		zuletzt: vorne,
		fuegeEin,
		fuegeAn,
		jeSeite: folien,
		fuegeAblageEin,
		umbruchKnopf,
		neuLaden,
	};
};

export type Einfuegen = ReturnType<typeof useEinfuegen>;

export interface SlashMenue {
	treffer: Posten[];
	index: number;
	/** Was nach dem `/` steht: für „Nichts passt zu …“ (194-12). */
	suche: string;
	x: number;
	y: number;
	waehle: (e: Posten) => void;
}

interface SlashOptionen {
	doc: Document | null;
	bearbeitet: boolean;
	beende: () => void;
	/** Die Treffer zum Suchwort hinter dem `/`. */
	liste: (filter: string) => Posten[];
	waehle: (e: Posten) => void;
}

/** Das Slash-Menü steht im Text einer Aufgabe: Teile des Blatts und Folien gehören nicht dorthin (203-13). */
export const NICHT_IM_TEXT = ['Blatt', 'Folien'] as const;

/** Ohne Suchwort zuerst das zuletzt Benutzte, dann der Rest ohne Doppel. */
export const mitZuletzt = (zuletzt: readonly Posten[], liste: readonly Posten[]) => {
	const vorne = zuletzt.filter((z) => liste.some((e) => e.id === z.id));
	return [...vorne, ...liste.filter((e) => !vorne.some((z) => z.id === e.id))];
};

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
export const useSlash = ({ bearbeitet, beende, doc, liste, waehle }: SlashOptionen) => {
	const [offen, setOffen] = useState<{ knoten: Text; filter: string; index: number; x: number; y: number } | null>(
		null,
	);
	const [gewaehlt, setGewaehlt] = useState<Posten | null>(null);
	const treffer = offen ? liste(offen.filter) : [];
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
			const { offen: jetzt, treffer: zeilen } = aktuell.current;
			if (!jetzt) {
				return;
			}
			const schritt = ({ ArrowDown: 1, ArrowUp: -1 } as Record<string, number>)[e.key] ?? 0;
			if (schritt !== 0 && zeilen.length > 0) {
				setOffen({ ...jetzt, index: (jetzt.index + schritt + zeilen.length) % zeilen.length });
			} else if (e.key === 'Enter') {
				const e2 = zeilen[jetzt.index];
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

	const menue: SlashMenue | null = offen
		? { treffer, index: offen.index, suche: offen.filter, x: offen.x, y: offen.y, waehle: nimm }
		: null;
	return { menue };
};

interface TabOptionen {
	/** Das Dokument im Rahmen. Beim Tippen weicht die Quelle davon ab; die Taste muss trotzdem ankommen. */
	angezeigt: Document | null;
	doc: Document | null;
	bearbeitet: boolean;
	beende: () => void;
	fokussiere: () => void;
	setAuswahl: (nr: number | null) => void;
	struktur: Struktur;
	folien: boolean;
}

/** Tab in einer Kit-Tabelle (047): Der Text gilt, dann weiter zur nächsten Zelle; am Ende eine neue Zeile. */
export const useTabelleTab = ({
	angezeigt,
	bearbeitet,
	beende,
	doc,
	fokussiere,
	folien,
	setAuswahl,
	struktur,
}: TabOptionen) => {
	const [ziel, setZiel] = useState<{ tabelle: number; zeile: number; spalte: number; neu: boolean } | null>(null);
	const aktuell = useRef({ beende });
	useEffect(() => {
		aktuell.current = { beende };
	});

	useEffect(() => {
		const fenster = angezeigt?.defaultView;
		if (!angezeigt || !fenster) {
			return undefined;
		}
		const taste = (e: KeyboardEvent) => {
			// Das Ereignis kommt aus dem Rahmen: `instanceof` kennt dessen Klassen nicht.
			const start = e.target as Partial<Element> | null;
			const zelle = start?.closest?.('th, td') as HTMLTableCellElement | null;
			const t = zelle?.closest('table');
			if (e.key !== 'Tab' || !zelle || !t || bausteinVon(zelle)?.art !== 'tabellenzelle') {
				return;
			}
			e.preventDefault();
			e.stopImmediatePropagation();
			const zeile = (zelle.parentElement as HTMLTableRowElement).rowIndex;
			const tabelle = [...angezeigt.querySelectorAll('table')].indexOf(t);
			// 194-07: ⇧Tab geht in die vorige Zelle; in der ersten bleibt die Marke, wo sie ist.
			if (e.shiftKey) {
				const vorige = vorigeZelle({ zeile, spalte: zelle.cellIndex }, (z) => t.rows[z]?.cells.length ?? 1);
				if (vorige) {
					setZiel({ tabelle, ...vorige, neu: false });
					aktuell.current.beende();
				}
				return;
			}
			const weiter = naechsteZelle(
				{ zeile, spalte: zelle.cellIndex },
				t.rows.length,
				t.rows[zeile]?.cells.length ?? 1,
			);
			setZiel({ tabelle, zeile: weiter?.zeile ?? zeile + 1, spalte: weiter?.spalte ?? 0, neu: weiter === null });
			aktuell.current.beende();
		};
		fenster.addEventListener('keydown', taste, true);
		return () => fenster.removeEventListener('keydown', taste, true);
	}, [angezeigt]);

	useEffect(() => {
		if (!ziel || !doc || bearbeitet) {
			return;
		}
		const t = doc.querySelectorAll('table')[ziel.tabelle];
		const zelle = t?.rows[ziel.zeile]?.cells[ziel.spalte];
		if (ziel.neu && !zelle) {
			const start = t?.rows[0]?.cells[0];
			const nr = start ? nrVon(start) : null;
			setZiel({ ...ziel, neu: false });
			if (nr !== null) {
				const letzte = t?.rows[(t?.rows.length ?? 1) - 1]?.cells[0];
				const von = letzte ? nrVon(letzte) : nr;
				struktur.fuehreAus('Zeile eingefügt', (q) => fuegeZeileEin(q, von ?? nr, 'nach', { jeSeite: folien }));
			}
			return;
		}
		if (zelle) {
			setZiel(null);
			const nr = nrVon(zelle);
			setAuswahl(nr);
			window.setTimeout(fokussiere, 0);
		}
	}, [ziel, doc, bearbeitet, struktur, folien, setAuswahl, fokussiere]);
};

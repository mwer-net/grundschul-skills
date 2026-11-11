import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { meldung, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { istMac } from '../bausteine/kuerzel';
import type { MenueEintrag } from '../bausteine/Menue';
import { gehoertDemElement, istFeld, TASTEN_SPERRE_OHNE_LISTE } from '../editor/tasten';
import { hatOffeneEntwuerfe } from '../entwuerfe/offen';
import { falte } from '../lib/text';
import { dokumentSeite, editorSeite, entwuerfeSeite, praesentationSeite } from '../lib/zugang';
import { usePdf } from '../pdf/usePdf';
import { dokumentWahl, sammlungWahl } from '../pdf/wahl';
import { MaterialDialog } from '../seiten/Anlegen';
import { TeilenDialog } from '../teilen/TeilenDialog';
import type { AuswahlStand, Richtung } from './auswahl';
import { alles, bewege as bewegeAuswahl, findeNachName, KEINE } from './auswahl';
import type { Lage } from './befehle';
import { befehlZuTaste, lageArt, menueVon } from './befehle';
import { BewegenDialog, InfoDialog, TastenDialog, UebersichtDialog } from './dialoge';
import type { Merkzettel } from './kontext';
import { useAblage } from './kontext';
import { bewegtText, geloeschtText, kopiertText } from './meldungen';
import {
	dokObjekt,
	dokumenteInFolge,
	elternVon,
	findeOrdner,
	nachkommen,
	ordnerObjekt,
	schluesselVon,
	WURZEL_NAME,
} from './objekte';
import { leseSortierung, naechsteSortierung, SORTIER_NAME } from './sortierung';
import type { AblageDok, AblageOrdner, AblageStand, Darstellung, Knoten, Objekt, Seite, Sortierung } from './typen';

interface DialogAngaben {
	bewegen: { objekte: Objekt[] };
	info: { objekt: Objekt | null; ordner: AblageOrdner | null };
	uebersicht: { start: string | null };
	tasten: Record<never, never>;
	teilenOrdner: { ordner: { id: string; name: string } };
	teilenDok: { dok: AblageDok };
	material: { ordner: string | null };
}

type DialogStand = { [A in keyof DialogAngaben]: { art: A } & DialogAngaben[A] }[keyof DialogAngaben];

const PUFFER_MS = 700;

interface Optionen {
	stand: AblageStand | null;
	seite: Seite;
	hier: AblageOrdner | null;
	objekte: Objekt[];
	auswahl: AuswahlStand;
	setAuswahl: (a: AuswahlStand) => void;
	/** Wählt diese Objekte, sobald sie angezeigt werden. */
	waehleKommend: (schluessel: string[]) => void;
	darstellung: Darstellung;
	setDarstellung: (d: Darstellung) => void;
	sortierung: Sortierung;
	sortiere: (s: Sortierung) => void;
	offenListe: ReadonlySet<string>;
	klappeListe: (id: string, offen?: boolean) => void;
	oeffneBaum: (id: string) => void;
	seitenleiste: () => void;
	/** Spalten des Rasters, für ↑ und ↓. */
	spalten: () => number;
	sucheFokus: () => void;
}

const knotenVon = (objekte: readonly Objekt[]) => objekte.map((o) => o.knoten);
const objektZu = (stand: AblageStand, k: Knoten): Objekt | null => {
	if ('ordner' in k) {
		const o = stand.ordner.find((x) => x.id === k.ordner);
		return o ? ordnerObjekt(stand, o) : null;
	}
	const d = stand.dokumente.find((x) => x.mappe === k.mappe && x.id === k.dok);
	return d ? dokObjekt(stand, d) : null;
};

const zugangVon = (d: AblageDok) => ({ mappe: d.mappe, token: null });
export const seiteVon = (o: Objekt) => {
	if (o.istOrdner) {
		return `/o/${o.ordner.id}`;
	}
	const zugang = zugangVon(o.dok);
	return hatOffeneEntwuerfe(o.dok.meta) ? entwuerfeSeite(zugang, o.dok.id) : dokumentSeite(zugang, o.dok.id);
};

const dokVon = (l: Lage) => {
	const [erstes] = l.objekte;
	return erstes && !erstes.istOrdner ? erstes.dok : null;
};

const PFEILE: Partial<Record<string, Richtung>> = {
	ArrowUp: 'hoch',
	ArrowDown: 'runter',
	ArrowLeft: 'links',
	ArrowRight: 'rechts',
};
const ohneBefehlstaste = (e: KeyboardEvent) => !e.metaKey && !e.ctrlKey && !e.altKey;
const zeigeObjekt = (schluessel: string | null) =>
	document.querySelector(`[data-objekt="${schluessel ?? ''}"]`)?.scrollIntoView({ block: 'nearest' });

interface TastenStand {
	fuehreAus: (id: string, l: Lage) => void;
	lageFuer: (ziel: Objekt[]) => Lage;
	gewaehlteObjekte: Objekt[];
	o: Optionen;
	merkzettel: Merkzettel | null;
	merke: (m: Merkzettel | null) => void;
	objekte: Objekt[];
}

const pfeilTaste = (j: TastenStand, richtung: Richtung, erweitern: boolean, zeiger: RefObject<string | null>) => {
	const [einziges] = j.gewaehlteObjekte;
	if (j.o.darstellung === 'liste' && (richtung === 'links' || richtung === 'rechts')) {
		if (einziges?.istOrdner && j.gewaehlteObjekte.length === 1) {
			j.o.klappeListe(einziges.ordner.id, richtung === 'rechts');
		}
		return;
	}
	const reihenfolge = j.objekte.map((x) => x.schluessel);
	const start =
		zeiger.current !== null && reihenfolge.includes(zeiger.current)
			? zeiger.current
			: (j.o.auswahl.gewaehlt.at(-1) ?? null);
	const neu = bewegeAuswahl(j.o.auswahl, start, richtung, {
		reihenfolge,
		spalten: j.o.darstellung === 'liste' ? 1 : j.o.spalten(),
		erweitern,
	});
	zeiger.current = neu.zeiger;
	j.o.setAuswahl(neu.stand);
	zeigeObjekt(neu.zeiger);
};

const tippTaste = (
	j: TastenStand,
	zeichen: string,
	zeiger: RefObject<string | null>,
	puffer: RefObject<{ text: string; zeit: number }>,
) => {
	const jetzt = Date.now();
	puffer.current = {
		text: jetzt - puffer.current.zeit > PUFFER_MS ? zeichen : puffer.current.text + zeichen,
		zeit: jetzt,
	};
	const treffer = findeNachName(puffer.current.text, j.objekte, falte);
	if (treffer) {
		zeiger.current = treffer;
		j.o.setAuswahl({ gewaehlt: [treffer], anker: treffer });
		zeigeObjekt(treffer);
	}
};

/** Alle Befehle der Ablage: Register auf der einen Seite, hier die Wirkung. Menü, Leiste und Tasten teilen sich das. */
export const useBefehle = (o: Optionen) => {
	const { hier, objekte, seite, stand } = o;
	const { kannRueckgaengig, kannWiederholen, merke, merkzettel, rueckgaengig, setBenennen, tu, wiederholen } =
		useAblage();
	const navigate = useNavigate();
	const zeige = useHinweis();
	const [dialog, setDialog] = useState<DialogStand | null>(null);
	const pdf = usePdf({
		mappe: { id: hier?.behaelter ?? '', titel: hier?.name ?? WURZEL_NAME },
		warnen: true,
		ganzeMappe: true,
	});
	const fremd = seite.art !== 'ordner';
	const ortHier = seite.art === 'ordner' ? seite.ordner : null;

	const gewaehlteObjekte = useMemo(
		() => objekte.filter((x) => o.auswahl.gewaehlt.includes(x.schluessel)),
		[o.auswahl.gewaehlt, objekte],
	);

	const lageFuer = useCallback(
		(ziel: Objekt[], quelle: Lage['quelle'] = 'inhalt', ort: string | null = ortHier): Lage => ({
			art: lageArt(ziel),
			objekte: ziel,
			ort,
			fremd,
			merkzettel,
			quelle,
		}),
		[fremd, merkzettel, ortHier],
	);

	const neuerOrdner = async (eltern: string | null, wo: 'feld' | 'baum', inhalt?: Knoten[]) => {
		const antwort = await tu(
			{ art: 'neu', eltern, ...(inhalt ? { inhalt } : {}) },
			{ text: () => (inhalt ? 'Neuer Ordner mit der Auswahl angelegt.' : 'Neuer Ordner angelegt.') },
		);
		const id = antwort?.ergebnis.neu;
		if (id) {
			setBenennen({ schluessel: id, neu: true, wo });
			if (wo === 'feld') {
				o.waehleKommend([id]);
			}
		}
	};

	const fuegeEin = async (ziel: string | null, immerBewegen: boolean) => {
		if (!merkzettel || !stand) {
			return;
		}
		const quellen = merkzettel.knoten.flatMap((k) => objektZu(stand, k) ?? []);
		const bewegen = merkzettel.modus === 'ausschneiden' || immerBewegen;
		const antwort = await tu(
			bewegen
				? { art: 'bewegen', knoten: merkzettel.knoten, ziel }
				: { art: 'kopieren', knoten: merkzettel.knoten, ziel },
			{ text: (a) => (bewegen ? bewegtText : kopiertText)(stand, quellen, ziel, a) },
		);
		if (antwort) {
			if (bewegen) {
				merke(null);
			}
			if (ziel === ortHier) {
				o.waehleKommend(antwort.ergebnis.knoten.map(schluesselVon));
			}
		}
	};

	const dokumenteVon = useCallback(
		(ziel: readonly Objekt[], ort: string | null): AblageDok[] => {
			if (!stand) {
				return [];
			}
			if (ziel.length === 0) {
				return dokumenteInFolge(stand, ort, leseSortierung);
			}
			return ziel.flatMap((x) => (x.istOrdner ? dokumenteInFolge(stand, x.ordner.id, leseSortierung) : [x.dok]));
		},
		[stand],
	);

	const pdfMenue = (l: Lage): MenueEintrag[] => {
		const [erstes] = l.objekte;
		const wahl =
			erstes && !erstes.istOrdner && l.objekte.length === 1
				? dokumentWahl(
						zugangVon(erstes.dok),
						erstes.dok,
						erstes.dok.meta.format === 'folie' ? undefined : erstes.dok.meta.druckprofil,
					)
				: (() => {
						const dokumente = dokumenteVon(l.objekte, l.ort);
						if (dokumente.length === 0) {
							return [];
						}
						const ortName = hier?.name ?? WURZEL_NAME;
						const name = l.objekte.length > 1 ? `${ortName} (Auswahl)` : (erstes?.name ?? ortName);
						return sammlungWahl(dokumente, name);
					})();
		return wahl.map((w) => ({
			titel: w.titel,
			...(w.hinweis ? { beschreibung: w.hinweis } : {}),
			waehle: () => void pdf.hole(w),
		}));
	};

	const unterMenue = (id: string, l: Lage): MenueEintrag[] | null => {
		if (id === 'pdf') {
			return pdfMenue(l);
		}
		if (id === 'darstellung') {
			return (['kacheln', 'liste'] as const).map((d) => ({
				titel: d === 'kacheln' ? 'Kacheln' : 'Liste',
				aktiv: o.darstellung === d,
				waehle: () => o.setDarstellung(d),
			}));
		}
		if (id === 'sortieren') {
			return (['name', 'geaendert', 'erstellt', 'art'] as const).map((feld) => ({
				titel: SORTIER_NAME[feld],
				aktiv: o.sortierung.feld === feld,
				waehle: () => o.sortiere(naechsteSortierung(o.sortierung, feld)),
			}));
		}
		return null;
	};

	const gehe = (ziel: string | null, ersetzen = false) =>
		void navigate(ziel === null ? '/' : `/o/${ziel}`, { replace: ersetzen });

	const mitDok = (tun: (d: AblageDok) => void) => (l: Lage) => {
		const dok = dokVon(l);
		if (dok) {
			tun(dok);
		}
	};
	const mitErstem = (tun: (x: Objekt, l: Lage) => void) => (l: Lage) => {
		const [erstes] = l.objekte;
		if (erstes) {
			tun(erstes, l);
		}
	};
	const imOrdnerZeigen = (x: Objekt) => {
		o.waehleKommend([x.schluessel]);
		gehe(elternVon(x));
	};
	const neuerUnterordner = (x: Objekt, l: Lage) => {
		if (!x.istOrdner) {
			return;
		}
		const eltern = x.ordner.id;
		if (l.quelle === 'baum') {
			o.oeffneBaum(eltern);
			void neuerOrdner(eltern, 'baum');
			return;
		}
		if (o.darstellung === 'liste') {
			o.klappeListe(eltern, true);
		} else {
			void navigate(`/o/${eltern}`);
		}
		void neuerOrdner(eltern, 'feld');
	};
	const dupliziere = (l: Lage) => {
		if (!stand) {
			return;
		}
		const [erstes] = l.objekte;
		const eltern = erstes ? elternVon(erstes) : null;
		if (l.objekte.every((x) => elternVon(x) === eltern)) {
			void tu(
				{ art: 'kopieren', knoten: knotenVon(l.objekte), ziel: eltern },
				{ text: (a) => kopiertText(stand, l.objekte, eltern, a) },
			).then((a) => a && o.waehleKommend(a.ergebnis.knoten.map(schluesselVon)));
			return;
		}
		// Aus der Suche: Jedes landet neben seinem Original.
		for (const x of l.objekte) {
			void tu(
				{ art: 'kopieren', knoten: [x.knoten], ziel: elternVon(x) },
				{ text: (a) => kopiertText(stand, [x], elternVon(x), a) },
			);
		}
	};
	const inDenPapierkorb = (l: Lage) => {
		void tu({ art: 'papierkorb', knoten: knotenVon(l.objekte) }, { text: () => geloeschtText(l.objekte) }).then(
			(a) => {
				if (!a || !stand || !hier) {
					return;
				}
				// Liegt der offene Ordner mit im Papierkorb, geht es eine Ebene höher als das Gelöschte.
				const treffer = l.objekte.find((x) => x.istOrdner && nachkommen(stand, x.ordner.id).has(hier.id));
				if (treffer?.istOrdner) {
					gehe(treffer.ordner.eltern, true);
				}
			},
		);
	};
	const merkeFuer = (modus: 'ausschneiden' | 'kopieren', l: Lage) => {
		merke({ modus, knoten: knotenVon(l.objekte) });
		const zahl = l.objekte.length === 1 ? 'Ein Objekt' : `${l.objekte.length} Objekte`;
		zeige({
			text:
				modus === 'ausschneiden'
					? `${zahl} zum Bewegen gemerkt. Im Zielordner: Einfügen.`
					: `${zahl} zum Kopieren gemerkt.`,
		});
	};
	const materialDialog = (l: Lage) => {
		const [erstes] = l.objekte;
		setDialog({ art: 'material', ordner: erstes?.istOrdner ? erstes.ordner.id : l.ort });
	};

	const AKTIONEN: Record<string, (l: Lage) => void> = {
		oeffnen: mitErstem((x) => void navigate(seiteVon(x))),
		bearbeiten: mitDok((d) => void navigate(editorSeite(zugangVon(d), d.id))),
		praesentieren: mitDok((d) => void navigate(praesentationSeite(zugangVon(d), d.id))),
		entwuerfe: mitDok((d) => void navigate(entwuerfeSeite(zugangVon(d), d.id))),
		neuerTab: mitErstem((x) => void window.open(seiteVon(x), '_blank', 'noopener')),
		imOrdnerZeigen: mitErstem(imOrdnerZeigen),
		hoch: (l) => {
			const [erstes] = l.objekte;
			if (l.fremd && erstes) {
				imOrdnerZeigen(erstes);
			} else if (hier) {
				o.waehleKommend([hier.id]);
				gehe(hier.eltern);
			}
		},
		neuerOrdner: (l) => void neuerOrdner(l.ort, 'feld'),
		neuerUnterordner: mitErstem(neuerUnterordner),
		mitAuswahl: (l) => void neuerOrdner(ortHier, 'feld', knotenVon(l.objekte)),
		materialAnlegen: materialDialog,
		materialHier: materialDialog,
		teilen: (l) => {
			const dok = dokVon(l);
			if (dok) {
				setDialog({ art: 'teilenDok', dok });
				return;
			}
			const [erstes] = l.objekte;
			const ziel = erstes?.istOrdner ? erstes.ordner : hier;
			if (ziel) {
				setDialog({ art: 'teilenOrdner', ordner: ziel });
			}
		},
		variante: mitDok((d) => {
			sende<{ titel: string }>(`/api/mappen/${d.mappe}/dokumente/${d.id}/variante`).then(
				({ titel }) => zeige({ text: `Variante angelegt: „${titel}“.` }),
				(grund: unknown) => zeige({ text: meldung(grund), art: 'fehler' }),
			);
		}),
		umbenennen: mitErstem((x, l) =>
			setBenennen({ schluessel: x.schluessel, neu: false, wo: l.quelle === 'baum' ? 'baum' : 'feld' }),
		),
		duplizieren: dupliziere,
		ausschneiden: (l) => merkeFuer('ausschneiden', l),
		kopieren: (l) => merkeFuer('kopieren', l),
		bewegenNach: (l) => setDialog({ art: 'bewegen', objekte: l.objekte }),
		einfuegen: (l) => {
			const [erstes] = l.objekte;
			void fuegeEin(erstes?.istOrdner && l.quelle === 'baum' ? erstes.ordner.id : l.ort, false);
		},
		einfuegenBewegen: (l) => void fuegeEin(l.ort, true),
		uebersicht: (l) => setDialog({ art: 'uebersicht', start: l.objekte[0]?.schluessel ?? null }),
		informationen: (l) =>
			setDialog({
				art: 'info',
				objekt: l.objekte[0] ?? null,
				ordner: stand && l.ort !== null ? findeOrdner(stand, l.ort) : null,
			}),
		papierkorb: inDenPapierkorb,
		allesWaehlen: () => o.setAuswahl(alles(objekte.map((x) => x.schluessel))),
		kacheln: () => o.setDarstellung('kacheln'),
		liste: () => o.setDarstellung('liste'),
		seitenleiste: () => o.seitenleiste(),
		rueckgaengig: () => {
			if (kannRueckgaengig) {
				void rueckgaengig();
			} else {
				zeige({ text: 'Da gibt es nichts zurückzunehmen.' });
			}
		},
		wiederholen: () => {
			if (kannWiederholen) {
				void wiederholen();
			} else {
				zeige({ text: 'Da gibt es nichts zu wiederholen.' });
			}
		},
		suchen: () => o.sucheFokus(),
		tasten: () => setDialog({ art: 'tasten' }),
	};
	const fuehreAus = (id: string, l: Lage) => AKTIONEN[id]?.(l);

	const quellen = { fuehreAus, untermenue: unterMenue };

	/** Menü zu diesen Objekten: Bei einem Ordner gilt „Einfügen“ für diesen Ordner. */
	const menueFuer = (ziel: Objekt[], quelle: Lage['quelle'] = 'inhalt', ort?: string | null): MenueEintrag[] => {
		const [erstes] = ziel;
		const ordnerDerAuswahl = erstes?.istOrdner ? erstes.ordner.id : ortHier;
		const lage = lageFuer(ziel, quelle, ort === undefined ? ordnerDerAuswahl : ort);
		return menueVon(lage, quellen, ziel.length > 1 ? `${ziel.length} Objekte` : undefined);
	};

	// Tasten: dieselben Befehle mit der Auswahl als Ziel.
	const aktuell = useRef({ fuehreAus, lageFuer, gewaehlteObjekte, o, merkzettel, merke, objekte });
	aktuell.current = { fuehreAus, lageFuer, gewaehlteObjekte, o, merkzettel, merke, objekte };
	const zeiger = useRef<string | null>(null);
	const puffer = useRef({ text: '', zeit: 0 });

	useEffect(() => {
		const taste = (e: KeyboardEvent) => {
			const j = aktuell.current;
			if (document.querySelector(TASTEN_SPERRE_OHNE_LISTE) || istFeld(e.target) || gehoertDemElement(e)) {
				return;
			}
			if (e.key === 'Escape') {
				if (j.merkzettel?.modus === 'ausschneiden') {
					j.merke(null);
				} else {
					j.o.setAuswahl(KEINE);
				}
				return;
			}
			if (e.code === 'KeyC' && (e.metaKey || e.ctrlKey) && String(window.getSelection() ?? '') !== '') {
				return;
			}
			const richtung = PFEILE[e.key];
			if (richtung && ohneBefehlstaste(e)) {
				e.preventDefault();
				pfeilTaste(j, richtung, e.shiftKey, zeiger);
				return;
			}
			const lage = j.lageFuer(j.gewaehlteObjekte);
			const befehl = befehlZuTaste(e, lage);
			if (befehl) {
				e.preventDefault();
				j.fuehreAus(befehl.id, lage);
				return;
			}
			if (e.key.length === 1 && e.key !== ' ' && ohneBefehlstaste(e)) {
				tippTaste(j, e.key, zeiger, puffer);
			}
		};
		window.addEventListener('keydown', taste);
		return () => window.removeEventListener('keydown', taste);
	}, []);

	const schliessen = () => setDialog(null);
	const dialoge = (
		<>
			{pdf.dialog}
			{dialog?.art === 'bewegen' && <BewegenDialog objekte={dialog.objekte} schliessen={schliessen} />}
			{dialog?.art === 'info' && (
				<InfoDialog objekt={dialog.objekt} ordner={dialog.ordner} schliessen={schliessen} />
			)}
			{dialog?.art === 'uebersicht' && (
				<UebersichtDialog
					objekte={objekte}
					start={dialog.start}
					schliessen={schliessen}
					oeffne={(x) => void navigate(seiteVon(x))}
				/>
			)}
			{dialog?.art === 'tasten' && <TastenDialog schliessen={schliessen} />}
			{dialog?.art === 'teilenOrdner' && <TeilenDialog ordner={dialog.ordner} schliessen={schliessen} />}
			{dialog?.art === 'teilenDok' && (
				<TeilenDialog
					mappe={{ id: dialog.dok.mappe, titel: dialog.dok.meta.titel }}
					dokument={dialog.dok}
					schliessen={schliessen}
				/>
			)}
			{dialog?.art === 'material' && <MaterialDialog ordner={dialog.ordner} schliessen={schliessen} />}
		</>
	);

	return {
		dialoge,
		fuehreAus,
		gewaehlteObjekte,
		lageFuer,
		menueFuer,
		pdfMenue,
		neuerOrdner,
		zeiger,
		setDialog,
		istMac,
	};
};

export type Befehle = ReturnType<typeof useBefehle>;

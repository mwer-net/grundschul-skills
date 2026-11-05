import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { meldung, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { istMac } from '../bausteine/kuerzel';
import type { MenueEintrag } from '../bausteine/Menue';
import { AlsVorlage } from '../editor/AlsVorlage';
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
import { useAblage } from './kontext';
import { bewegtText, geloeschtText, kopiertText } from './meldungen';
import { dokumenteInFolge, dokObjekt, elternVon, findeOrdner, nachkommen, ordnerObjekt, schluesselVon, WURZEL_NAME } from './objekte';
import { naechsteSortierung, leseSortierung, SORTIER_NAME } from './sortierung';
import type { AblageDok, AblageOrdner, AblageStand, Darstellung, Knoten, Objekt, Seite, Sortierung } from './typen';

type DialogStand =
	| { art: 'bewegen'; objekte: Objekt[] }
	| { art: 'info'; objekt: Objekt | null; ordner: AblageOrdner | null }
	| { art: 'uebersicht'; start: string | null }
	| { art: 'tasten' }
	| { art: 'teilenOrdner'; ordner: { id: string; name: string } }
	| { art: 'teilenDok'; dok: AblageDok }
	| { art: 'material'; ordner: string | null }
	| { art: 'vorlage'; dok: AblageDok };

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

/** Alle Befehle der Ablage: Register auf der einen Seite, hier die Wirkung. Menü, Leiste und Tasten teilen sich das. */
export const useBefehle = (o: Optionen) => {
	const { hier, objekte, seite, stand } = o;
	const { kannRueckgaengig, kannWiederholen, merke, merkzettel, rueckgaengig, setBenennen, tu, wiederholen } = useAblage();
	const navigate = useNavigate();
	const zeige = useHinweis();
	const [dialog, setDialog] = useState<DialogStand | null>(null);
	const pdf = usePdf({ mappe: { id: hier?.behaelter ?? '', titel: hier?.name ?? WURZEL_NAME }, warnen: true, ganzeMappe: true });
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
			bewegen ? { art: 'bewegen', knoten: merkzettel.knoten, ziel } : { art: 'kopieren', knoten: merkzettel.knoten, ziel },
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
				? dokumentWahl(zugangVon(erstes.dok), erstes.dok, erstes.dok.meta.format === 'folie' ? undefined : erstes.dok.meta.druckprofil)
				: (() => {
						const dokumente = dokumenteVon(l.objekte, l.ort);
						if (dokumente.length === 0) {
							return [];
						}
						const name =
							l.objekte.length === 1 && erstes
								? erstes.name
								: l.objekte.length > 1
									? `${hier?.name ?? WURZEL_NAME} (Auswahl)`
									: (hier?.name ?? WURZEL_NAME);
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

	const fuehreAus = (id: string, l: Lage) => {
		const [erstes] = l.objekte;
		const dok = erstes && !erstes.istOrdner ? erstes.dok : null;
		const knoten = knotenVon(l.objekte);
		switch (id) {
			case 'oeffnen':
				if (erstes) {
					void navigate(seiteVon(erstes));
				}
				return;
			case 'bearbeiten':
				if (dok) {
					void navigate(editorSeite(zugangVon(dok), dok.id));
				}
				return;
			case 'praesentieren':
				if (dok) {
					void navigate(praesentationSeite(zugangVon(dok), dok.id));
				}
				return;
			case 'entwuerfe':
				if (dok) {
					void navigate(entwuerfeSeite(zugangVon(dok), dok.id));
				}
				return;
			case 'neuerTab':
				if (erstes) {
					window.open(seiteVon(erstes), '_blank', 'noopener');
				}
				return;
			case 'imOrdnerZeigen':
				if (erstes) {
					const eltern = elternVon(erstes);
					o.waehleKommend([erstes.schluessel]);
					void navigate(eltern === null ? '/' : `/o/${eltern}`);
				}
				return;
			case 'hoch':
				if (l.fremd && erstes) {
					fuehreAus('imOrdnerZeigen', l);
				} else if (hier) {
					o.waehleKommend([hier.id]);
					void navigate(hier.eltern === null ? '/' : `/o/${hier.eltern}`);
				}
				return;
			case 'neuerOrdner':
				void neuerOrdner(l.ort, 'feld');
				return;
			case 'neuerUnterordner':
				if (erstes?.istOrdner) {
					const eltern = erstes.ordner.id;
					if (l.quelle === 'baum') {
						o.oeffneBaum(eltern);
						void neuerOrdner(eltern, 'baum');
					} else if (o.darstellung === 'liste') {
						o.klappeListe(eltern, true);
						void neuerOrdner(eltern, 'feld');
					} else {
						void navigate(`/o/${eltern}`);
						void neuerOrdner(eltern, 'feld');
					}
				}
				return;
			case 'mitAuswahl':
				void neuerOrdner(ortHier, 'feld', knoten);
				return;
			case 'materialAnlegen':
			case 'materialHier':
				setDialog({ art: 'material', ordner: erstes?.istOrdner ? erstes.ordner.id : l.ort });
				return;
			case 'teilen': {
				if (dok) {
					setDialog({ art: 'teilenDok', dok });
				} else {
					const ziel = erstes?.istOrdner ? erstes.ordner : hier;
					if (ziel) {
						setDialog({ art: 'teilenOrdner', ordner: ziel });
					}
				}
				return;
			}
			case 'alsVorlage':
				if (dok) {
					setDialog({ art: 'vorlage', dok });
				}
				return;
			case 'variante':
				if (dok) {
					sende<{ titel: string }>(`/api/mappen/${dok.mappe}/dokumente/${dok.id}/variante`).then(
						({ titel }) => zeige({ text: `Variante angelegt: „${titel}“.` }),
						(grund: unknown) => zeige({ text: meldung(grund), art: 'fehler' }),
					);
				}
				return;
			case 'umbenennen':
				if (erstes) {
					setBenennen({ schluessel: erstes.schluessel, neu: false, wo: l.quelle === 'baum' ? 'baum' : 'feld' });
				}
				return;
			case 'duplizieren': {
				const eltern = erstes ? elternVon(erstes) : null;
				if (stand && l.objekte.every((x) => elternVon(x) === eltern)) {
					void tu({ art: 'kopieren', knoten, ziel: eltern }, { text: (a) => kopiertText(stand, l.objekte, eltern, a) }).then(
						(a) => a && o.waehleKommend(a.ergebnis.knoten.map(schluesselVon)),
					);
				} else if (stand) {
					// Aus der Suche: Jedes landet neben seinem Original.
					for (const x of l.objekte) {
						void tu({ art: 'kopieren', knoten: [x.knoten], ziel: elternVon(x) }, { text: (a) => kopiertText(stand, [x], elternVon(x), a) });
					}
				}
				return;
			}
			case 'ausschneiden':
				merke({ modus: 'ausschneiden', knoten });
				zeige({ text: `${l.objekte.length === 1 ? 'Ein Objekt' : `${l.objekte.length} Objekte`} zum Bewegen gemerkt. Im Zielordner: Einfügen.` });
				return;
			case 'kopieren':
				merke({ modus: 'kopieren', knoten });
				zeige({ text: `${l.objekte.length === 1 ? 'Ein Objekt' : `${l.objekte.length} Objekte`} zum Kopieren gemerkt.` });
				return;
			case 'bewegenNach':
				setDialog({ art: 'bewegen', objekte: l.objekte });
				return;
			case 'einfuegen':
				void fuegeEin(erstes?.istOrdner && l.quelle === 'baum' ? erstes.ordner.id : l.ort, false);
				return;
			case 'einfuegenBewegen':
				void fuegeEin(l.ort, true);
				return;
			case 'uebersicht':
				setDialog({ art: 'uebersicht', start: erstes?.schluessel ?? null });
				return;
			case 'informationen':
				setDialog({ art: 'info', objekt: erstes ?? null, ordner: stand && l.ort !== null ? findeOrdner(stand, l.ort) : null });
				return;
			case 'papierkorb':
				void tu({ art: 'papierkorb', knoten }, { text: () => geloeschtText(l.objekte) }).then((a) => {
					if (a && stand && hier) {
						// Liegt der offene Ordner mit im Papierkorb, geht es eine Ebene höher als das Gelöschte.
						const treffer = l.objekte.find((x) => x.istOrdner && nachkommen(stand, x.ordner.id).has(hier.id));
						if (treffer?.istOrdner) {
							const eltern = treffer.ordner.eltern;
							void navigate(eltern === null ? '/' : `/o/${eltern}`, { replace: true });
						}
					}
				});
				return;
			case 'allesWaehlen':
				o.setAuswahl(alles(objekte.map((x) => x.schluessel)));
				return;
			case 'kacheln':
				o.setDarstellung('kacheln');
				return;
			case 'liste':
				o.setDarstellung('liste');
				return;
			case 'seitenleiste':
				o.seitenleiste();
				return;
			case 'rueckgaengig':
				if (kannRueckgaengig) {
					void rueckgaengig();
				} else {
					zeige({ text: 'Da gibt es nichts zurückzunehmen.' });
				}
				return;
			case 'wiederholen':
				if (kannWiederholen) {
					void wiederholen();
				} else {
					zeige({ text: 'Da gibt es nichts zu wiederholen.' });
				}
				return;
			case 'suchen':
				o.sucheFokus();
				return;
			case 'tasten':
				setDialog({ art: 'tasten' });
				return;
			default:
		}
	};

	const quellen = { fuehreAus, untermenue: unterMenue };

	/** Menü zu diesen Objekten: Bei einem Ordner gilt „Einfügen“ für diesen Ordner. */
	const menueFuer = (ziel: Objekt[], quelle: Lage['quelle'] = 'inhalt', ort?: string | null): MenueEintrag[] => {
		const [erstes] = ziel;
		const lage = lageFuer(ziel, quelle, ort !== undefined ? ort : erstes?.istOrdner ? erstes.ordner.id : ortHier);
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
			const lage = j.lageFuer(j.gewaehlteObjekte);
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
			const pfeile: Record<string, Richtung> = { ArrowUp: 'hoch', ArrowDown: 'runter', ArrowLeft: 'links', ArrowRight: 'rechts' };
			const richtung = pfeile[e.key];
			if (richtung && !e.metaKey && !e.ctrlKey && !e.altKey) {
				e.preventDefault();
				const [einziges] = j.gewaehlteObjekte;
				if (j.o.darstellung === 'liste' && (richtung === 'links' || richtung === 'rechts')) {
					if (einziges?.istOrdner && j.gewaehlteObjekte.length === 1) {
						j.o.klappeListe(einziges.ordner.id, richtung === 'rechts');
					}
					return;
				}
				const reihenfolge = j.objekte.map((x) => x.schluessel);
				const start = zeiger.current !== null && reihenfolge.includes(zeiger.current) ? zeiger.current : (j.o.auswahl.gewaehlt.at(-1) ?? null);
				const neu = bewegeAuswahl(j.o.auswahl, start, richtung, {
					reihenfolge,
					spalten: j.o.darstellung === 'liste' ? 1 : j.o.spalten(),
					erweitern: e.shiftKey,
				});
				zeiger.current = neu.zeiger;
				j.o.setAuswahl(neu.stand);
				document.querySelector(`[data-objekt="${neu.zeiger ?? ''}"]`)?.scrollIntoView({ block: 'nearest' });
				return;
			}
			const befehl = befehlZuTaste(e, lage);
			if (befehl) {
				e.preventDefault();
				j.fuehreAus(befehl.id, lage);
				return;
			}
			if (e.key.length === 1 && e.key !== ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
				const jetzt = Date.now();
				puffer.current = { text: jetzt - puffer.current.zeit > PUFFER_MS ? e.key : puffer.current.text + e.key, zeit: jetzt };
				const treffer = findeNachName(puffer.current.text, j.objekte, falte);
				if (treffer) {
					zeiger.current = treffer;
					j.o.setAuswahl({ gewaehlt: [treffer], anker: treffer });
					document.querySelector(`[data-objekt="${treffer}"]`)?.scrollIntoView({ block: 'nearest' });
				}
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
			{dialog?.art === 'info' && <InfoDialog objekt={dialog.objekt} ordner={dialog.ordner} schliessen={schliessen} />}
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
				<TeilenDialog mappe={{ id: dialog.dok.mappe, titel: dialog.dok.meta.titel }} dokument={dialog.dok} schliessen={schliessen} />
			)}
			{dialog?.art === 'material' && <MaterialDialog ordner={dialog.ordner} schliessen={schliessen} />}
			{dialog?.art === 'vorlage' && (
				<AlsVorlage mappe={dialog.dok.mappe} dok={dialog.dok.id} titel={dialog.dok.meta.titel} schliessen={schliessen} />
			)}
		</>
	);

	return { dialoge, fuehreAus, gewaehlteObjekte, lageFuer, menueFuer, pdfMenue, neuerOrdner, zeiger, setDialog, istMac };
};

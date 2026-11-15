import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Segment } from '../bausteine/Segment';
import type { SymbolName } from '../bausteine/Symbol';
import { Symbol } from '../bausteine/Symbol';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import { Tooltip } from '../bausteine/Tooltip';
import type { Lage } from './befehle';
import { kuerzelVon, leistenKnoepfe } from './befehle';
import { Pfad } from './Pfad';
import { naechsteSortierung, SORTIER_NAME } from './sortierung';
import type { AblageOrdner, Darstellung, Seite, Sortierung } from './typen';
import type { Befehle } from './useBefehle';

/** ⋯ mit Tooltip; der Tooltip schweigt bei offenem Menü und nach dem Schließen (`Tooltip`, 188-20). */
const MehrKnopf = (props: Record<string, unknown>) => (
	<Tooltip text="Weitere Aktionen">
		<Knopf {...props} art="leise" className="size-knopf">
			<Symbol name="mehr" />
		</Knopf>
	</Tooltip>
);

const KnopfText = ({ dreht, symbol, text }: { symbol: SymbolName; text: string; dreht?: boolean }) => (
	<>
		<Symbol name={symbol} className={dreht ? 'animate-spin' : undefined} />
		<span className="@max-5xl:hidden">{text}</span>
	</>
);

const KNOPF: Record<string, { symbol: SymbolName; text: string }> = {
	entwuerfe: { symbol: 'ebenen', text: 'Entwürfe vergleichen' },
	praesentieren: { symbol: 'praesentieren', text: 'Präsentieren' },
	bearbeiten: { symbol: 'stift', text: 'Bearbeiten' },
	teilen: { symbol: 'teilen', text: 'Teilen' },
	bewegenNach: { symbol: 'bewegenNach', text: 'Bewegen nach …' },
};

/** Häufige Aktionen der Auswahl, aus dem Register: nur, was das Menü auch anbietet (188-02). */
const AuswahlKnoepfe = ({ befehle, ids, lage }: { befehle: Befehle; ids: string[]; lage: Lage }) => {
	const { fuehreAus, gewaehlteObjekte, pdfLaeuft, pdfMenue } = befehle;
	if (gewaehlteObjekte.length === 0) {
		return null;
	}
	return (
		<>
			{ids.map((id) => {
				if (id === 'pdf') {
					const eintraege = pdfMenue(lage);
					const [einzig] = eintraege;
					// Eine Datei: Der Knopf lädt sofort (191-41); sonst das Menü.
					if (eintraege.length === 1 && einzig?.waehle) {
						return (
							<Knopf key={id} art="zweit" disabled={pdfLaeuft} onClick={einzig.waehle}>
								<KnopfText
									symbol={pdfLaeuft ? 'laden' : 'herunterladen'}
									dreht={pdfLaeuft}
									text="PDF"
								/>
							</Knopf>
						);
					}
					return (
						eintraege.length > 0 && (
							<Menue
								key={id}
								name="PDF"
								beschriftung={(
									<KnopfText
										symbol={pdfLaeuft ? 'laden' : 'herunterladen'}
										dreht={pdfLaeuft}
										text="PDF"
									/>
								)}
								art="zweit"
								disabled={pdfLaeuft}
								eintraege={eintraege}
							/>
						)
					);
				}
				const knopf = KNOPF[id];
				return (
					knopf && (
						<Knopf key={id} art="zweit" aria-label={knopf.text} onClick={() => fuehreAus(id, lage)}>
							<KnopfText symbol={knopf.symbol} text={knopf.text} />
						</Knopf>
					)
				);
			})}
		</>
	);
};

interface Eigenschaften {
	befehle: Befehle;
	darstellung: Darstellung;
	setDarstellung: (d: Darstellung) => void;
	haken: boolean;
	setHaken: (an: boolean) => void;
	setKeineAuswahl: () => void;
	leisteAn: boolean;
	pfad: AblageOrdner[];
	seite: Seite;
	sortierung: Sortierung;
	sortiere: (s: Sortierung) => void;
}

const SEITEN_TITEL = { zuletzt: 'Zuletzt geändert', suche: 'Suche', papierkorb: 'Papierkorb' };

export const Werkzeugleiste = ({
	befehle,
	darstellung,
	haken,
	leisteAn,
	pfad,
	seite,
	setDarstellung,
	setHaken,
	setKeineAuswahl,
	sortiere,
	sortierung,
}: Eigenschaften) => {
	const navigate = useNavigate();
	const { fuehreAus, gewaehlteObjekte, lageFuer, menueOhne } = befehle;
	const lage = lageFuer(gewaehlteObjekte);
	const dieseLeiste = (id: string) => () => fuehreAus(id, lage);
	const knoepfe = leistenKnoepfe(lage);
	const leiste = useRef<HTMLDivElement>(null);
	const [breite, setBreite] = useState(0);
	const [weg, setWeg] = useState(0);
	const art = `${knoepfe.join()}|${gewaehlteObjekte.length}`;
	useLayoutEffect(() => {
		const el = leiste.current;
		if (!el) {
			return;
		}
		const beobachter = new ResizeObserver(([e]) => setBreite(Math.round(e?.contentRect.width ?? 0)));
		beobachter.observe(el);
		return () => beobachter.disconnect();
	}, []);
	// Fehlt Platz, gehen die Auswahlknöpfe von rechts ins ⋯, zuletzt verliert „Material anlegen“ seinen Text: Der Pfad
	// fällt nie unter sein Mindestmaß (189-03).
	useLayoutEffect(() => setWeg(0), [art, breite]);
	useLayoutEffect(() => {
		const el = leiste.current;
		if (el && weg <= knoepfe.length && el.scrollWidth > el.clientWidth + 1) {
			setWeg(weg + 1);
		}
	}, [art, breite, knoepfe.length, weg]);
	const gezeigt = knoepfe.slice(0, Math.max(0, knoepfe.length - weg));
	const eng = weg > knoepfe.length;
	return (
		<div
			ref={leiste}
			className="sticky top-[var(--kopf,0px)] z-leiste flex h-[var(--hoehe-werkzeug)] flex-none items-center gap-1.5 border-b border-rand bg-flaeche px-2"
			data-werkzeugleiste
		>
			{/* Immer dasselbe Symbol (189-23). Zurück und Vor bleiben beim Browser (188-30). */}
			<SymbolKnopf
				symbol="leisteLinks"
				beschriftung={leisteAn ? 'Seitenleiste ausblenden' : 'Seitenleiste einblenden'}
				kuerzel={kuerzelVon('seitenleiste')}
				onClick={() => fuehreAus('seitenleiste', lage)}
			/>
			{seite.art === 'ordner' ? (
				<Pfad pfad={pfad} gehe={(p) => void navigate(p)} fehlt={lage.gesperrt === true} />
			) : (
				<h1 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">{SEITEN_TITEL[seite.art]}</h1>
			)}
			{/* Fehlt der Ordner, gibt es hier nichts zu tun (189-02). */}
			{seite.art !== 'papierkorb' && !lage.gesperrt && (
				<>
					<AuswahlKnoepfe befehle={befehle} ids={gezeigt} lage={lage} />
					<Segment
						beschriftung="Darstellung"
						wert={darstellung}
						waehle={setDarstellung}
						werte={[
							{ wert: 'kacheln', titel: 'Kacheln' },
							{ wert: 'liste', titel: 'Liste' },
						]}
					/>
					{seite.art === 'ordner' && (
						<Menue
							name="Sortieren"
							beschriftung={
								<KnopfText symbol="sortieren" text={`Sortieren: ${SORTIER_NAME[sortierung.feld]}`} />
							}
							art="leise"
							eintraege={(['name', 'geaendert', 'erstellt', 'art'] as const).map((feld) => ({
								titel: SORTIER_NAME[feld],
								aktiv: sortierung.feld === feld,
								waehle: () => sortiere(naechsteSortierung(sortierung, feld)),
							}))}
						/>
					)}
					<span className="nur-finger">
						<Knopf
							art={haken ? 'haupt' : 'leise'}
							aria-label={haken ? 'Fertig' : 'Auswählen'}
							data-auswaehlen
							onClick={() => {
								setHaken(!haken);
								if (haken) {
									setKeineAuswahl();
								}
							}}
						>
							<Symbol name={haken ? 'haken' : 'auswaehlen'} />
							<span className="@max-5xl:hidden">{haken ? 'Fertig' : 'Auswählen'}</span>
						</Knopf>
					</span>
					{/* Ohne das, was daneben schon als Knopf steht (188-31). */}
					<Menue
						name="Weitere Aktionen"
						rechtsbuendig
						eintraege={menueOhne(gewaehlteObjekte, gezeigt)}
						ausloeser={<MehrKnopf />}
					/>
				</>
			)}
			{seite.art === 'ordner' && !lage.gesperrt && (
				<>
					<Knopf art="zweit" aria-label="Neuer Ordner" data-neuer-ordner onClick={dieseLeiste('neuerOrdner')}>
						<Symbol name="ordnerNeu" />
						<span className="@max-5xl:hidden">Neuer Ordner</span>
					</Knopf>
					<Knopf aria-label="Material anlegen" data-material-anlegen onClick={dieseLeiste('materialAnlegen')}>
						<Symbol name="plus" />
						<span className={eng ? 'hidden' : gewaehlteObjekte.length > 0 ? '@max-6xl:hidden' : undefined}>
							Material anlegen
						</span>
					</Knopf>
				</>
			)}
		</div>
	);
};

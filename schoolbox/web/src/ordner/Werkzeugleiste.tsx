import { useNavigate } from 'react-router-dom';

import { Knopf } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Segment } from '../bausteine/Segment';
import type { SymbolName } from '../bausteine/Symbol';
import { Symbol } from '../bausteine/Symbol';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import type { Lage } from './befehle';
import { Pfad } from './Pfad';
import { naechsteSortierung, SORTIER_NAME } from './sortierung';
import type { AblageOrdner, Darstellung, Seite, Sortierung } from './typen';
import type { Befehle } from './useBefehle';

const KNOPF_MEHR = (
	<Knopf art="leise" className="size-knopf px-0">
		<Symbol name="mehr" />
	</Knopf>
);

const KnopfText = ({ symbol, text }: { symbol: SymbolName; text: string }) => (
	<>
		<Symbol name={symbol} />
		<span className="@max-5xl:hidden">{text}</span>
	</>
);

/** Häufige Aktionen der Auswahl: gleichwertig zum Kachelknopf von früher. */
const AuswahlKnoepfe = ({ befehle, lage }: { befehle: Befehle; lage: Lage }) => {
	const { fuehreAus, gewaehlteObjekte, pdfMenue } = befehle;
	const [einziges] = gewaehlteObjekte;
	const dieseLeiste = (id: string) => () => fuehreAus(id, lage);
	const pdfEintraege = pdfMenue(lage);
	const alsOrdner = einziges?.istOrdner ? 'Alles als PDF' : 'PDF';
	const pdfTitel = gewaehlteObjekte.length > 1 ? 'Als PDF' : alsOrdner;
	return (
		<>
			{/* Häufige Aktionen der Auswahl: gleichwertig zum Kachelknopf von früher. */}
			{einziges && !einziges.istOrdner && gewaehlteObjekte.length === 1 && lage.art === 'material' && (
				<>
					{einziges.dok.meta.format === 'folie' ? (
						<Knopf art="zweit" aria-label="Präsentieren" onClick={dieseLeiste('praesentieren')}>
							<Symbol name="praesentieren" />
							<span className="@max-5xl:hidden">Präsentieren</span>
						</Knopf>
					) : (
						<Knopf art="zweit" aria-label="Bearbeiten" onClick={dieseLeiste('bearbeiten')}>
							<Symbol name="stift" />
							<span className="@max-5xl:hidden">Bearbeiten</span>
						</Knopf>
					)}
				</>
			)}
			{gewaehlteObjekte.length > 0 && pdfEintraege.length > 0 && (
				<Menue
					name="PDF"
					beschriftung={<KnopfText symbol="herunterladen" text={pdfTitel} />}
					art="zweit"
					eintraege={pdfEintraege}
				/>
			)}
			{gewaehlteObjekte.length === 1 && (
				<Knopf art="zweit" aria-label="Teilen" onClick={dieseLeiste('teilen')}>
					<Symbol name="teilen" />
					<span className="@max-5xl:hidden">Teilen</span>
				</Knopf>
			)}
			{gewaehlteObjekte.length > 1 && (
				<Knopf art="zweit" aria-label="Bewegen nach …" onClick={dieseLeiste('bewegenNach')}>
					<Symbol name="bewegen" />
					<span className="@max-5xl:hidden">Bewegen nach …</span>
				</Knopf>
			)}
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
	hier: AblageOrdner | null;
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
	hier,
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
	const { fuehreAus, gewaehlteObjekte, lageFuer, menueFuer } = befehle;
	const lage = lageFuer(gewaehlteObjekte);
	const dieseLeiste = (id: string) => () => fuehreAus(id, lage);
	return (
		<div
			className="sticky top-[var(--kopf,0px)] z-leiste flex h-[var(--hoehe-werkzeug)] flex-none items-center gap-1.5 border-b border-rand bg-flaeche px-2"
			data-werkzeugleiste
		>
			<SymbolKnopf
				symbol={leisteAn ? 'leisteLinks' : 'leisteRechts'}
				beschriftung={leisteAn ? 'Seitenleiste ausblenden' : 'Seitenleiste einblenden'}
				kuerzel="⌥S"
				onClick={() => fuehreAus('seitenleiste', lage)}
			/>
			<SymbolKnopf symbol="links" beschriftung="Zurück" onClick={() => void navigate(-1)} />
			<SymbolKnopf symbol="rechts" beschriftung="Vor" onClick={() => void navigate(1)} />
			{seite.art === 'ordner' ? (
				<Pfad pfad={pfad} gehe={(p) => void navigate(p)} />
			) : (
				<h1 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">{SEITEN_TITEL[seite.art]}</h1>
			)}
			{seite.art !== 'papierkorb' && (
				<>
					<AuswahlKnoepfe befehle={befehle} lage={lage} />
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
							beschriftung={<KnopfText symbol="sortieren" text="Sortieren" />}
							art="leise"
							eintraege={(['name', 'geaendert', 'erstellt', 'art'] as const).map((feld) => ({
								titel: SORTIER_NAME[feld],
								aktiv: sortierung.feld === feld,
								waehle: () => sortiere(naechsteSortierung(sortierung, feld)),
							}))}
						/>
					)}
					{seite.art === 'ordner' && (
						<Knopf
							art="leise"
							aria-label="Filter"
							onClick={() => void navigate(`/suche?${hier ? `in=${hier.id}&von=${hier.id}` : ''}`)}
						>
							<Symbol name="filter" />
							<span className="@max-5xl:hidden">Filter</span>
						</Knopf>
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
					<Menue
						name="Weitere Aktionen"
						rechtsbuendig
						eintraege={menueFuer(gewaehlteObjekte)}
						ausloeser={KNOPF_MEHR}
					/>
				</>
			)}
			{seite.art === 'ordner' && (
				<>
					<Knopf art="zweit" aria-label="Neuer Ordner" data-neuer-ordner onClick={dieseLeiste('neuerOrdner')}>
						<Symbol name="ordnerNeu" />
						<span className="@max-5xl:hidden">Neuer Ordner</span>
					</Knopf>
					<Knopf aria-label="Material anlegen" data-material-anlegen onClick={dieseLeiste('materialAnlegen')}>
						<Symbol name="plus" />
						<span className={gewaehlteObjekte.length > 0 ? '@max-6xl:hidden' : undefined}>
							Material anlegen
						</span>
					</Knopf>
				</>
			)}
		</div>
	);
};

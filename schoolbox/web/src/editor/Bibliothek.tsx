import { KATALOG_KATEGORIEN } from '@schoolbox/kern/src/abbildungen';
import { MEINE_BAUSTEINE, sucheImKatalog } from '@schoolbox/kern/src/katalog';
import type { Art, Fach, Klasse } from '@schoolbox/kern/src/werte';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { meldung, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { FELD_KLASSEN, klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import { Tooltip } from '../bausteine/Tooltip';
import { nrVon, trefferAn } from './darstellung';
import type { Einfuegen, Posten, SlashMenue } from './einfuegen';
import type { Einblendung } from './Leinwand';
import type { Struktur } from './struktur';
import { TEXTWERKZEUG } from './text';

const ZEILE = 'w-full rounded-md px-2 py-1 text-left hover:bg-flaeche-2';
const GLIEDERUNG_ZEILE = 'h-menue w-full rounded-md px-2 text-left hover:bg-flaeche-2 aria-[current]:bg-flaeche-2';

const passtZu = (e: Posten, m: { fach: Fach; klasse: Klasse }, art: Art) =>
	(!e.faecher || e.faecher.includes(m.fach)) &&
	(!e.klassen || e.klassen.includes(m.klasse)) &&
	(!e.arten || e.arten.includes(art));

const Liste = ({ aktiv, posten, waehle }: { posten: Posten[]; aktiv?: number; waehle: (e: Posten) => void }) => (
	<ul className="flex flex-col">
		{posten.map((e, i) => (
			<li key={e.id}>
				<button
					type="button"
					className={klassen(ZEILE, i === aktiv && 'bg-brand-100')}
					data-katalog-eintrag={e.id}
					ref={(k) => {
						if (i === aktiv) {
							k?.scrollIntoView({ block: 'nearest' });
						}
					}}
					// Sonst verliert der Textträger den Fokus, bevor der Klick ankommt.
					onMouseDown={(ev) => ev.preventDefault()}
					onClick={() => waehle(e)}
				>
					{e.name}
				</button>
			</li>
		))}
	</ul>
);

const schwebend = (top: number, hoehe: number) => (top + 320 > hoehe ? Math.max(0, top - 330) : top);

/** Plus unter dem gewählten Baustein, Aufforderung auf leeren Seiten, Schnellauswahl und Slash-Menü (044). */
export const Einfuegemarken = ({
	aktiv,
	auswahl,
	e,
	einfuegen,
	setAuswahl,
	slash,
}: {
	e: Einblendung;
	auswahl: number | null;
	aktiv: boolean;
	setAuswahl: (nr: number | null) => void;
	einfuegen: Einfuegen;
	slash: SlashMenue | null;
}) => {
	const [schnell, setSchnell] = useState<{ nr: number | null; left: number; top: number } | null>(null);
	const [suche, setSuche] = useState('');
	const { box, doc, hoehe, links, skala } = e;
	const leer = [...doc.querySelectorAll('.seite:not([data-erzeugt])')].filter((s) => s.children.length === 0);
	const liste = suche.trim() ? (sucheImKatalog(suche, einfuegen.eintraege) as Posten[]) : einfuegen.eintraege;
	const oeffne = (nr: number | null, left: number, top: number) => {
		setSuche('');
		setSchnell(schnell ? null : { nr, left, top });
	};

	return (
		<>
			{[...doc.querySelectorAll('.nicht-loesung, body.loesung .nur-loesung')].map((m) => {
				const r = m.getBoundingClientRect();
				return (
					<span
						key={nrVon(m)}
						className="pointer-events-none absolute rounded-md bg-amber-200 px-2 py-0.5 text-sm font-medium"
						data-sichtbarkeit-marke
						style={{ left: links + r.left * skala, top: r.top * skala - 12 }}
					>
						{m.classList.contains('nur-loesung') ? 'Nur Lösung' : 'Nur Arbeitsblatt'}
					</span>
				);
			})}
			{aktiv && box && auswahl !== null && (
				<button
					type="button"
					aria-label="Baustein einfügen"
					className="absolute flex size-11 -translate-x-1/2 items-center justify-center rounded-full bg-brand-500 text-white shadow-md"
					data-einfuegen-plus
					style={{ left: links + box.left * skala - 26, top: ((box.top + box.bottom) / 2) * skala - 22 }}
					onClick={() => oeffne(auswahl, links + box.left * skala, box.bottom * skala + 46)}
				>
					<Symbol name="plus" />
				</button>
			)}
			{aktiv &&
				leer.map((s) => {
					const r = s.getBoundingClientRect();
					const nr = nrVon(s);
					return (
						<div
							key={nr}
							className="absolute flex justify-center"
							style={{
								left: links + r.left * skala,
								width: r.width * skala,
								top: (r.top + r.height / 3) * skala,
							}}
						>
							<Knopf
								art="haupt"
								data-erster-baustein
								onClick={() => {
									setAuswahl(nr);
									oeffne(nr, links + r.left * skala + 20, (r.top + r.height / 3) * skala + 56);
								}}
							>
								<Symbol name="plus" />
								Ersten Baustein einfügen
							</Knopf>
						</div>
					);
				})}
			{schnell && (
				<div
					className="absolute z-20 w-80 rounded-xl border border-rand bg-flaeche p-2 shadow-lg"
					data-schnellauswahl
					style={{ left: schnell.left, top: schwebend(schnell.top, hoehe) }}
				>
					<input
						type="search"
						aria-label="Baustein suchen"
						placeholder="Suchen …"
						className="mb-2 h-knopf w-full rounded-lg border border-rand px-3"
						value={suche}
						autoFocus
						onChange={(ev) => setSuche(ev.target.value)}
						onKeyDown={(ev) => ev.key === 'Escape' && setSchnell(null)}
					/>
					<div className="max-h-64 overflow-y-auto">
						{!suche.trim() && einfuegen.zuletzt.length > 0 && (
							<>
								<h3 className="px-3 text-sm text-leise">Zuletzt genutzt</h3>
								<Liste
									posten={einfuegen.zuletzt}
									waehle={(p) => {
										setSchnell(null);
										einfuegen.fuegeEin(p, schnell.nr);
									}}
								/>
								<h3 className="px-3 text-sm text-leise">Alle</h3>
							</>
						)}
						<Liste
							posten={liste}
							waehle={(p) => {
								setSchnell(null);
								einfuegen.fuegeEin(p, schnell.nr);
							}}
						/>
					</div>
				</div>
			)}
			{slash && (
				<div
					className="absolute z-20 max-h-72 w-72 overflow-y-auto rounded-xl border border-rand bg-flaeche p-1 shadow-lg"
					data-slash-menue
					{...{ [TEXTWERKZEUG]: '' }}
					style={{ left: links + slash.x * skala, top: schwebend(slash.y * skala + 4, hoehe) }}
				>
					{slash.treffer.length === 0 ? (
						<p className="px-3 py-2 text-leise">Nichts gefunden</p>
					) : (
						<Liste posten={slash.treffer} aktiv={slash.index} waehle={slash.waehle} />
					)}
				</div>
			)}
		</>
	);
};

/** Stelle im Material unter dem Zeiger; `null` außerhalb des Blatts. */
const stelleUnter = (doc: Document, x: number, y: number) => {
	const rahmen = doc.defaultView?.frameElement;
	if (!(rahmen instanceof HTMLElement)) {
		return null;
	}
	const r = rahmen.getBoundingClientRect();
	if (x < r.left || x > r.right || y < r.top || y > r.bottom) {
		return null;
	}
	const skala = r.width / Math.max(1, rahmen.offsetWidth);
	const t = trefferAn(doc.elementFromPoint((x - r.left) / skala, (y - r.top) / skala));
	return t ? nrVon(t.element) : null;
};

/** Eigene Bausteine umbenennen und löschen (051). */
const EigenVerwalten = ({ id, name, neuLaden }: { id: string; name: string; neuLaden: () => void }) => {
	const [neu, setNeu] = useState<string | null>(null);
	const zeige = useHinweis();
	const sende2 = (pfad: string, daten: object) =>
		sende(`/api/eigene/sammlung/${id}/${pfad}`, daten).then(neuLaden, (grund: unknown) =>
			zeige({ text: meldung(grund), art: 'fehler' }),
		);
	return (
		<div className="flex flex-wrap items-center gap-2 border-t border-rand p-1" data-eigen-verwalten={id}>
			{neu === null ? (
				<Knopf art="zweit" onClick={() => setNeu(name)}>
					Umbenennen
				</Knopf>
			) : (
				<>
					<input
						aria-label="Neuer Name"
						className={`${FELD_KLASSEN} min-w-0 flex-1`}
						value={neu}
						onChange={(e) => setNeu(e.target.value)}
					/>
					<Knopf
						disabled={neu.trim() === ''}
						onClick={() => {
							setNeu(null);
							void sende2('aendern', { name: neu });
						}}
					>
						Speichern
					</Knopf>
				</>
			)}
			<Knopf
				art="gefahr"
				aria-label={`${name} aus der Sammlung löschen`}
				onClick={() => void sende2('loeschen', {})}
			>
				<Symbol name="papierkorb" />
			</Knopf>
		</div>
	);
};

const Karte = ({
	doc,
	einfuegen,
	eintrag,
	setAuswahl,
}: {
	eintrag: Posten;
	doc: Document | null;
	einfuegen: Einfuegen;
	setAuswahl: (nr: number | null) => void;
}) => {
	const [zug, setZug] = useState<{ x: number; y: number } | null>(null);
	const ziel = useRef<number | null>(null);

	const druck = (ev: ReactPointerEvent<HTMLButtonElement>) => {
		ev.currentTarget.setPointerCapture(ev.pointerId);
		ziel.current = null;
		setZug({ x: ev.clientX, y: ev.clientY });
	};
	const bewege = (ev: ReactPointerEvent<HTMLButtonElement>) => {
		if (!zug || !doc) {
			return;
		}
		setZug({ x: ev.clientX, y: ev.clientY });
		const nr = stelleUnter(doc, ev.clientX, ev.clientY);
		ziel.current = nr;
		if (nr !== null) {
			setAuswahl(nr);
		}
	};
	const los = () => {
		setZug(null);
		if (ziel.current !== null) {
			einfuegen.fuegeEin(eintrag, ziel.current);
		}
		ziel.current = null;
	};

	return (
		<li className="overflow-hidden rounded-lg border border-rand" data-bibliothek-eintrag={eintrag.id}>
			{!eintrag.eigen && (
				<iframe
					src={`/ansicht/_katalog/${eintrag.id}`}
					title={`Vorschau: ${eintrag.name}`}
					loading="lazy"
					tabIndex={-1}
					className="pointer-events-none h-44 w-[200%] origin-top-left scale-50 border-0 [margin-bottom:-5.5rem]"
				/>
			)}
			<div className="flex items-center gap-1 border-t border-rand p-1">
				<button
					type="button"
					className={klassen(ZEILE, 'flex-1 font-medium')}
					data-einfuegen={eintrag.id}
					onClick={() => einfuegen.fuegeEin(eintrag)}
				>
					{eintrag.name}
				</button>
				<button
					type="button"
					aria-label={`${eintrag.name} ins Blatt ziehen`}
					title="Ins Blatt ziehen"
					className="flex size-knopf flex-none cursor-grab touch-none items-center justify-center rounded-md hover:bg-flaeche-2"
					data-ziehgriff={eintrag.id}
					onPointerDown={druck}
					onPointerMove={bewege}
					onPointerUp={los}
					onPointerCancel={() => {
						ziel.current = null;
						setZug(null);
					}}
				>
					<Symbol name="plus" />
				</button>
			</div>
			{eintrag.eigen && <EigenVerwalten id={eintrag.eigen} name={eintrag.name} neuLaden={einfuegen.neuLaden} />}
			{zug && (
				<div
					className="pointer-events-none fixed z-meldung -translate-x-1/2 -translate-y-1/2 rounded-md bg-brand-500 px-2 py-1 font-medium text-white"
					data-zug-anzeige
					style={{ left: zug.x, top: zug.y }}
				>
					{eintrag.name}
				</div>
			)}
		</li>
	);
};

const ZULETZT_ANZAHL = 4;

/**
 * Links in der Leiste, in zwei Stufen: Suche, „Zuletzt benutzt“ und die Bereiche aus dem Katalog; ein Bereich zeigt
 * seine Einträge mit Vorschau. Einfügen per Klick oder über den Griff.
 */
export const Bibliothek = ({
	art,
	doc,
	einfuegen,
	mappe,
	setAuswahl,
}: {
	einfuegen: Einfuegen;
	mappe: { fach: Fach; klasse: Klasse };
	art: Art;
	doc: Document | null;
	setAuswahl: (nr: number | null) => void;
}) => {
	const [suche, setSuche] = useState('');
	const [bereich, setBereich] = useState<string | null>(null);
	const [nurPassend, setNurPassend] = useState(true);
	const passend = einfuegen.eintraege.filter((e) => !nurPassend || passtZu(e, mappe, art));
	const hatEigene = einfuegen.eintraege.some((e) => e.herkunft === 'eigen');
	const bereiche = [...KATALOG_KATEGORIEN, ...(hatEigene ? [MEINE_BAUSTEINE] : [])];
	const sucht = suche.trim() !== '';
	const liste = sucht
		? (sucheImKatalog(suche, passend) as Posten[])
		: passend.filter((e) => e.kategorie === bereich);
	const zuletzt = einfuegen.zuletzt.slice(0, ZULETZT_ANZAHL);
	return (
		<section data-bibliothek className="flex flex-col gap-2">
			<div className="relative">
				<Symbol name="suche" className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-dezent" />
				<input
					type="search"
					aria-label="Baustein suchen"
					placeholder="Baustein suchen …"
					className={`${FELD_KLASSEN} w-full pl-7`}
					value={suche}
					onChange={(ev) => setSuche(ev.target.value)}
				/>
			</div>
			{!sucht && bereich === null && (
				<>
					{zuletzt.length > 0 && (
						<div data-zuletzt-benutzt>
							<h2 className="mb-1 text-xs font-semibold text-leise">Zuletzt benutzt</h2>
							<ul className="grid grid-cols-2 gap-1">
								{zuletzt.map((e) => (
									<li key={e.id}>
										<Tooltip text={e.name}>
											<button
												type="button"
												className="h-knopf w-full truncate rounded-md border border-rand px-2 text-left hover:bg-flaeche-2"
												data-zuletzt={e.id}
												onClick={() => einfuegen.fuegeEin(e)}
											>
												{e.name}
											</button>
										</Tooltip>
									</li>
								))}
							</ul>
						</div>
					)}
					<div>
						<h2 className="mb-1 text-xs font-semibold text-leise">Alle Bereiche</h2>
						<ul className="flex flex-col">
							{bereiche.map((k) => (
								<li key={k}>
									<button
										type="button"
										className="flex h-zeile w-full items-center justify-between gap-2 rounded-md px-2 text-left hover:bg-flaeche-2"
										data-bereich={k}
										onClick={() => setBereich(k)}
									>
										<span className="truncate">{k}</span>
										<span className="flex-none text-xs text-dezent tabular-nums" data-bereich-anzahl>
											{passend.filter((e) => e.kategorie === k).length}
										</span>
									</button>
								</li>
							))}
						</ul>
					</div>
				</>
			)}
			{(sucht || bereich !== null) && (
				<>
					{!sucht && (
						<Knopf art="leise" className="-ml-1 self-start px-1" onClick={() => setBereich(null)}>
							<Symbol name="zurueck" />
							{bereich}
						</Knopf>
					)}
					{liste.length === 0 ? (
						<p className="text-leise">Nichts gefunden.</p>
					) : (
						<ul className="flex flex-col gap-2">
							{liste.map((e) => (
								<Karte key={e.id} eintrag={e} doc={doc} einfuegen={einfuegen} setAuswahl={setAuswahl} />
							))}
						</ul>
					)}
				</>
			)}
			<label className="flex items-center gap-1.5 text-xs text-leise">
				<input
					type="checkbox"
					className="size-3.5 flex-none accent-brand-500"
					checked={nurPassend}
					onChange={(ev) => setNurPassend(ev.target.checked)}
				/>
				Nur passend zu Fach und Klasse
			</label>
		</section>
	);
};

/** Alle Seiten und Aufgaben: Klick springt, ↑ ↓ ordnet um, auch über die Seitengrenze. */
export const Gliederung = ({
	aktiv,
	auswahl,
	doc,
	struktur,
}: {
	doc: Document | null;
	auswahl: number | null;
	aktiv: boolean;
	struktur: Struktur;
}) => {
	const liste = useRef<HTMLDivElement>(null);
	useEffect(() => {
		liste.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' });
	}, [auswahl]);
	if (!doc) {
		return null;
	}
	const seiten = [...doc.querySelectorAll('.seite:not([data-erzeugt])')];
	const aufgaben = [...doc.querySelectorAll('.seite:not([data-erzeugt]) > .aufgabe')];
	return (
		<section data-gliederung>
			<div ref={liste} className="flex flex-col gap-1">
				{seiten.map((s, i) => {
					const nr = nrVon(s);
					return (
						<div key={nr ?? i}>
							<button
								type="button"
								className={klassen(GLIEDERUNG_ZEILE, 'font-medium')}
								{...(auswahl === nr ? { 'aria-current': true as const } : {})}
								onClick={() => nr !== null && struktur.zeigeAn(nr)}
							>
								{`Seite ${i + 1}`}
							</button>
							<ul className="flex flex-col">
								{[...s.children]
									.filter((k) => k.classList.contains('aufgabe'))
									.map((k) => {
										const knr = nrVon(k);
										const stelle = aufgaben.indexOf(k);
										const vorher = aufgaben[stelle - 1];
										const nachher = aufgaben[stelle + 1];
										const nach = (ziel: Element | undefined, wo: 'vor' | 'nach') => {
											const znr = ziel ? nrVon(ziel) : null;
											if (knr !== null && znr !== null) {
												struktur.verschiebe(knr, { nr: znr, wo }, true);
											}
										};
										const titel = k.querySelector('.anw')?.textContent?.trim() || 'Aufgabe';
										return (
											<li
												key={knr}
												className="flex items-center gap-0.5 pl-2"
												data-gliederung-aufgabe
											>
												<Tooltip text={titel}>
													<button
														type="button"
														className={klassen(GLIEDERUNG_ZEILE, 'min-w-0 flex-1 truncate')}
														{...(auswahl === knr ? { 'aria-current': true as const } : {})}
														onClick={() => knr !== null && struktur.zeigeAn(knr)}
													>
														{titel}
													</button>
												</Tooltip>
												{auswahl === knr && (
													<>
														<SymbolKnopf
															symbol="hoch"
															beschriftung="Nach oben"
															groesse="klein"
															disabled={!aktiv || !vorher}
															onClick={() => nach(vorher, 'vor')}
														/>
														<SymbolKnopf
															symbol="runter"
															beschriftung="Nach unten"
															groesse="klein"
															disabled={!aktiv || !nachher}
															onClick={() => nach(nachher, 'nach')}
														/>
													</>
												)}
											</li>
										);
									})}
							</ul>
						</div>
					);
				})}
			</div>
		</section>
	);
};

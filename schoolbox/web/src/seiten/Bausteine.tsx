import { useState } from 'react';

import { Abschnitt } from '../bausteine/Abschnitt';
// >> 182
import { Farbreihe } from '../bausteine/Farbfeld';
// << 182
import { Feld } from '../bausteine/Feld';
import { Hilfetipp } from '../bausteine/Hilfetipp';
import { Karte } from '../bausteine/Karte';
// >> 182
import { FELD_KLASSEN, KACHEL } from '../bausteine/klassen';
// << 182
import { Knopf } from '../bausteine/Knopf';
import { Kuerzel } from '../bausteine/Kuerzel';
import { Menue } from '../bausteine/Menue';
import { useZeigeMenue } from '../bausteine/menue-kontext';
import { Popover } from '../bausteine/Popover';
import { Reiter } from '../bausteine/Reiter';
import { Schalter } from '../bausteine/Schalter';
import { Segment } from '../bausteine/Segment';
import { Stepper } from '../bausteine/Stepper';
import { SymbolKnopf } from '../bausteine/SymbolKnopf';
import { Tooltip } from '../bausteine/Tooltip';
// >> 182
import { Zeile } from '../bausteine/Zeile';
// << 182

const MENUE = [
	{ titel: 'Duplizieren', symbol: 'duplizieren' as const, kuerzel: '⇧⌘D', gruppe: 'a' },
	{ titel: 'Kopieren', symbol: 'kopieren' as const, kuerzel: '⌘C', gruppe: 'a' },
	{ titel: 'Gesperrt', aus: true, gruppe: 'a' },
	{
		titel: 'Sichtbarkeit',
		gruppe: 'b',
		untermenue: [
			{ titel: 'Immer', aktiv: true },
			{ titel: 'Nur im Arbeitsblatt', aktiv: false },
		],
	},
	{ titel: 'Löschen', symbol: 'papierkorb' as const, kuerzel: '⌫', gefahr: true, gruppe: 'c' },
];

/** Nur in der Entwicklung (`/_bausteine`): jeder Baustein in jedem Zustand, zum Nachsehen und für Screenshots. */
export const Bausteine = () => {
	const [segment, setSegment] = useState('a');
	const [schalter, setSchalter] = useState(true);
	const [zahl, setZahl] = useState(3);
	const [reiter, setReiter] = useState('auswahl');
	// >> 182
	const [farbe, setFarbe] = useState<string | null>('var(--haupt)');
	const [kachel, setKachel] = useState('a');
	// << 182
	const zeige = useZeigeMenue();
	return (
		<main className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
			<h1 className="text-2xl">Bausteine</h1>
			<Karte className="flex flex-wrap items-center gap-2 p-3">
				<Knopf>Haupt</Knopf>
				<Knopf art="zweit">Zweit</Knopf>
				<Knopf art="leise">Leise</Knopf>
				<Knopf art="gefahr">Gefahr</Knopf>
				<Knopf disabled>Aus</Knopf>
				<Knopf art="zweit" groesse="klein">
					Klein
				</Knopf>
				<SymbolKnopf symbol="rueckgaengig" beschriftung="Rückgängig" kuerzel="⌘Z" />
				<SymbolKnopf symbol="mehr" beschriftung="Mehr" groesse="klein" />
				<SymbolKnopf symbol="papierkorb" beschriftung="Aus" disabled />
				<Tooltip text="Mit Tooltip" kuerzel="⌘K">
					<Knopf art="zweit">Überfahren</Knopf>
				</Tooltip>
				<Kuerzel text="⇧⌘D" />
			</Karte>
			<Karte className="flex flex-wrap items-center gap-2 p-3">
				<Menue beschriftung="Menü" eintraege={MENUE} />
				<Knopf
					art="zweit"
					onClick={(e) => {
						const { left, top } = e.currentTarget.getBoundingClientRect();
						zeige({ x: left, y: top }, MENUE);
					}}
				>
					Menü am Punkt
				</Knopf>
				<Popover ausloeser={<Knopf art="zweit">Popover</Knopf>}>Kleines Fenster an einem Anker.</Popover>
				<span className="flex items-center gap-1">
					<span>Label</span>
					<Hilfetipp name="Label">Erklärt, was dauerhaft nicht dastehen soll.</Hilfetipp>
				</span>
			</Karte>
			<Karte className="flex flex-wrap items-center gap-3 p-3">
				<Segment
					beschriftung="Segment"
					wert={segment}
					waehle={setSegment}
					werte={[
						{ wert: 'a', titel: 'Arbeitsblatt' },
						{ wert: 'b', titel: 'Lösung' },
					]}
				/>
				<Segment
					aus
					beschriftung="Aus"
					wert="a"
					waehle={() => undefined}
					werte={[
						{ wert: 'a', titel: 'Farbe' },
						{ wert: 'b', titel: 's/w' },
					]}
				/>
				<Schalter name="Schalter" an={schalter} setze={setSchalter} />
				<Schalter name="Schalter aus" an={false} setze={() => undefined} aus />
				<Stepper name="Zahl" wert={zahl} setze={setZahl} min={1} max={6} />
				<Stepper name="Zahl aus" wert={2} setze={() => undefined} aus />
			</Karte>
			{/* >> 182 */}
			<Karte className="p-3">
				<div className="w-60" data-muster-inspektor>
					<Abschnitt name="muster-muster" titel="Muster">
						<Zeile titel="Farbreihe" darunter>
							<Farbreihe
								beschriftung="Farbreihe"
								keine="Keine Farbe"
								schwarz
								doc={null}
								wert={farbe}
								setze={setFarbe}
							/>
						</Zeile>
						<Zeile titel="Kacheln" darunter>
							<div role="group" aria-label="Kacheln" className="grid grid-cols-3 gap-1">
								{['a', 'b', 'c'].map((w) => (
									<button
										key={w}
										type="button"
										className={KACHEL}
										aria-pressed={kachel === w}
										onClick={() => setKachel(w)}
									>
										{`Kachel ${w.toUpperCase()}`}
									</button>
								))}
							</div>
						</Zeile>
						<Zeile titel="Segment mit vier Teilen" darunter>
							<Segment
								beschriftung="Vier Teile"
								wert={kachel}
								waehle={setKachel}
								voll
								werte={[
									{ wert: 'a', titel: 'Eins' },
									{ wert: 'b', titel: 'Zwei' },
									{ wert: 'c', titel: 'Drei' },
									{ wert: 'd', titel: 'Vier' },
								]}
							/>
						</Zeile>
						<Zeile titel="Stepper">
							<Stepper name="Stepper mit Einheit" wert={zahl} setze={setZahl} einheit="px" />
						</Zeile>
						<Zeile titel="Schalter">
							<Schalter name="Schalter im Muster" an={schalter} setze={setSchalter} />
						</Zeile>
					</Abschnitt>
				</div>
			</Karte>
			{/* << 182 */}
			<Karte className="p-3">
				<Reiter
					beschriftung="Reiter"
					wert={reiter}
					waehle={setReiter}
					werte={[
						{ wert: 'auswahl', titel: 'Auswahl' },
						{ wert: 'blatt', titel: 'Blatt' },
						{ wert: 'aus', titel: 'Aus', aus: true },
					]}
				/>
				<div className="mt-2 w-60">
					<Abschnitt name="muster-inhalt" titel="Inhalt" notiz="gilt für alle 4 Einträge">
						<Feld titel="Uhrzeit" lage="daneben">
							<input className={FELD_KLASSEN} defaultValue="3:00" />
						</Feld>
						<Feld titel="Mit Fehler" fehler="Das passt nicht.">
							<input className={FELD_KLASSEN} defaultValue="abc" />
						</Feld>
						<Feld titel="Auswahl" lage="daneben">
							<select className={FELD_KLASSEN}>
								<option>Eins</option>
							</select>
						</Feld>
					</Abschnitt>
					<Abschnitt name="muster-weitere" titel="Weitere" einklappbar zu>
						<p>Inhalt des eingeklappten Abschnitts.</p>
					</Abschnitt>
				</div>
			</Karte>
		</main>
	);
};

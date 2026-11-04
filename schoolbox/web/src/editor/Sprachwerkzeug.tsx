import { kann } from '@schoolbox/kern/src/bausteine';
import type { Bereich, LueckenRegel, SprachWerkzeug } from '@schoolbox/kern/src/sprache';
import { useEffect, useRef, useState } from 'react';

import { Hilfetipp } from '../bausteine/Hilfetipp';
import { useHinweis } from '../bausteine/hinweis';
import { Knopf } from '../bausteine/Knopf';
import type { PfadTeil } from './darstellung';
import { elementZu } from './darstellung';
import { halteFokus } from './halteFokus';
import type { Struktur } from './struktur';

const REGELN: { wert: LueckenRegel; name: string }[] = [
	{ wert: 'nte', name: 'Jedes n-te Wort' },
	{ wert: 'nomen', name: 'Nomen (groß, nicht am Satzanfang)' },
	{ wert: 'vokale', name: 'Vokale' },
	{ wert: 'konsonanten', name: 'Konsonanten' },
	{ wert: 'ie-ei', name: 'ie und ei' },
	{ wert: 'anfang', name: 'Anfangsbuchstaben (groß oder klein)' },
];

const FELD = 'h-knopf rounded-lg border border-linie bg-flaeche px-2';
const eng = (t: string) => t.replace(/\s+/g, ' ').replace(/^ /, '');

/** Bleibt beim Wechsel der Auswahl offen: Wer mit den Werkzeugen arbeitet, will sie nicht jedes Mal aufklappen. */
let zuletztOffen = false;

/** Lage der Markierung im sichtbaren Text, gezählt wie in `reinerText`. */
const bereichIn = (element: Element, auswahl: Selection | null): Bereich | null => {
	if (!auswahl || auswahl.rangeCount === 0 || auswahl.isCollapsed) {
		return null;
	}
	const r = auswahl.getRangeAt(0);
	if (!element.contains(r.startContainer) || !element.contains(r.endContainer)) {
		return null;
	}
	const davor = element.ownerDocument.createRange();
	davor.selectNodeContents(element);
	davor.setEnd(r.startContainer, r.startOffset);
	const text = davor.toString();
	return { von: eng(text).length, bis: eng(text + r.toString()).length };
};

/** Sprach-Werkzeuge (052): wirken auf den markierten Text, sonst auf den ganzen Textbaustein. */
export const Sprachwerkzeug = ({
	aktiv,
	bearbeitet,
	beende,
	geladen,
	pfad,
	struktur,
}: {
	aktiv: boolean;
	bearbeitet: boolean;
	beende: () => void;
	geladen: { doc: Document } | null;
	pfad: PfadTeil[];
	struktur: Struktur;
}) => {
	const doc = geladen?.doc ?? null;
	const gewaehlt = pfad.at(-1);
	const nr = gewaehlt?.nr ?? null;
	const zeige = useHinweis();
	const [offen, setOffen] = useState(zuletztOffen);
	const [regel, setRegel] = useState<LueckenRegel>('nte');
	const [n, setN] = useState(5);
	const [buchstaben, setBuchstaben] = useState('');
	const markiert = useRef<Bereich | null>(null);

	// Ein Feld im Panel nimmt dem Rahmen den Fokus. Darum gilt die letzte Markierung, bis im Rahmen eine neue entsteht.
	useEffect(() => {
		markiert.current = null;
		if (!doc || nr === null) {
			return undefined;
		}
		const merke = () => {
			const element = elementZu(doc, nr);
			const auswahl = doc.getSelection();
			if (!element || (auswahl?.isCollapsed && !doc.hasFocus())) {
				return;
			}
			markiert.current = bereichIn(element, auswahl);
		};
		doc.addEventListener('selectionchange', merke);
		return () => doc.removeEventListener('selectionchange', merke);
	}, [doc, nr]);

	if (!aktiv || !gewaehlt || nr === null || !kann(gewaehlt.baustein, 'text')) {
		return null;
	}

	const wende = async (name: string, werkzeug: SprachWerkzeug) => {
		const bereich = markiert.current ?? undefined;
		if (bearbeitet) {
			beende();
		}
		const { wendeSprachwerkzeugAn } = await import('@schoolbox/kern/src/sprache');
		let unsicher: string[] = [];
		const ok = struktur.fuehreAus(
			name,
			(q) => {
				const e = wendeSprachwerkzeugAn(q, nr, werkzeug, bereich);
				({ unsicher } = e);
				return e;
			},
			true,
		);
		if (ok && unsicher.length > 0) {
			zeige({
				text: `Prüfe diese Trennung: ${[...new Set(unsicher)].join(', ')}. Tippe die Silben an und ändere die Striche unter „Text“.`,
			});
		}
	};
	const nummeriere = async (wert: string) => {
		if (bearbeitet) {
			beende();
		}
		const { setzeZeilennummern } = await import('@schoolbox/kern/src/sprache');
		const schritt = ({ 1: 1, 5: 5 } as const)[wert] ?? null;
		struktur.fuehreAus('Zeilennummern', (q) => setzeZeilennummern(q, nr, schritt), true);
	};
	const nummern = doc ? (elementZu(doc, nr)?.getAttribute('data-zeilennummern') ?? '') : '';

	return (
		<div data-sprachwerkzeug>
			<Knopf
				art="zweit"
				aria-expanded={offen}
				data-sprache-oeffnen
				{...halteFokus}
				onClick={() => {
					zuletztOffen = !offen;
					setOffen(zuletztOffen);
				}}
			>
				Sprach-Werkzeuge
			</Knopf>
			<Hilfetipp name="Sprach-Werkzeuge">
				Sie wirken auf den markierten Text, sonst auf den ganzen Text hier.
			</Hilfetipp>
			{offen && (
				<>
					<div className="mt-2 flex flex-wrap gap-2">
						<Knopf
							art="zweit"
							data-sprache="silben-boegen"
							{...halteFokus}
							onClick={() => void wende('Silben', { art: 'silben', darstellung: 'boegen' })}
						>
							Silbenbögen
						</Knopf>
						<Knopf
							art="zweit"
							data-sprache="silben-farbe"
							{...halteFokus}
							onClick={() => void wende('Silben', { art: 'silben', darstellung: 'farbe' })}
						>
							Silben in Farbe
						</Knopf>
						<Knopf
							art="zweit"
							data-sprache="vokale"
							{...halteFokus}
							onClick={() => void wende('Vokale markiert', { art: 'markieren', buchstaben: 'vokale' })}
						>
							Vokale markieren
						</Knopf>
						<Knopf
							art="zweit"
							data-sprache="woerter-mischen"
							{...halteFokus}
							onClick={() => void wende('Wörter gemischt', { art: 'woerter-mischen' })}
						>
							Wörter mischen
						</Knopf>
						<Knopf
							art="zweit"
							data-sprache="buchstaben-mischen"
							{...halteFokus}
							onClick={() => void wende('Buchstaben gemischt', { art: 'buchstaben-mischen' })}
						>
							Buchstaben mischen
						</Knopf>
					</div>
					<div className="mt-3 flex flex-wrap items-end gap-2">
						<label className="block">
							Buchstaben
							<input
								className={`${FELD} mt-1 block w-24`}
								value={buchstaben}
								data-sprache-buchstaben
								onChange={(e) => setBuchstaben(e.target.value.trim())}
							/>
						</label>
						<Knopf
							art="zweit"
							data-sprache="markieren"
							disabled={buchstaben === ''}
							{...halteFokus}
							onClick={() => void wende('Buchstaben markiert', { art: 'markieren', buchstaben })}
						>
							Markieren
						</Knopf>
					</div>
					<div className="mt-3 flex flex-wrap items-end gap-2">
						<label className="block">
							Lücken
							<select
								className={`${FELD} mt-1 block max-w-64`}
								value={regel}
								data-sprache-regel
								onChange={(e) => setRegel(e.target.value as LueckenRegel)}
							>
								{REGELN.map((r) => (
									<option key={r.wert} value={r.wert}>
										{r.name}
									</option>
								))}
							</select>
						</label>
						{regel === 'nte' && (
							<label className="block">
								n
								<input
									className={`${FELD} mt-1 block w-16`}
									type="number"
									min={2}
									max={20}
									value={n}
									data-sprache-n
									onChange={(e) => setN(Number(e.target.value))}
								/>
							</label>
						)}
						<Knopf
							art="zweit"
							data-sprache="luecken"
							{...halteFokus}
							onClick={() => void wende('Lücken', { art: 'luecken', regel, n })}
						>
							Lücken machen
						</Knopf>
					</div>
					<label className="mt-3 block">
						Zeilennummern
						<select
							className={`${FELD} mt-1 block`}
							value={nummern}
							data-sprache-zeilennummern
							onChange={(e) => void nummeriere(e.target.value)}
						>
							<option value="">Keine</option>
							<option value="1">Jede Zeile</option>
							<option value="5">Alle 5 Zeilen</option>
						</select>
					</label>
				</>
			)}
		</div>
	);
};

import type * as SprachKern from '@schoolbox/kern/src/sprache';
import type { Bereich, LueckenRegel, SprachErgebnis, SprachWerkzeug } from '@schoolbox/kern/src/sprache';
import type { SilbenDarstellung, SilbenStand } from '@schoolbox/kern/src/sprachstand';
import { leseSprachstand } from '@schoolbox/kern/src/sprachstand';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Abschnitt } from '../bausteine/Abschnitt';
import { useHinweis } from '../bausteine/hinweis';
import { Knopf } from '../bausteine/Knopf';
import { Schalter } from '../bausteine/Schalter';
import { Segment } from '../bausteine/Segment';
import { Zeile } from '../bausteine/Zeile';
import type { PfadTeil } from './darstellung';
import { elementZu } from './darstellung';
import { halteFokus } from './halteFokus';
import type { Struktur } from './struktur';
import { EIGENE_GESCHICHTE } from './tasten';

const REGELN: { wert: LueckenRegel; name: string }[] = [
	{ wert: 'nte', name: 'Jedes n-te Wort' },
	{ wert: 'nomen', name: 'Nomen (groß, nicht am Satzanfang)' },
	{ wert: 'vokale', name: 'Vokale' },
	{ wert: 'konsonanten', name: 'Konsonanten' },
	{ wert: 'ie-ei', name: 'ie und ei' },
	{ wert: 'anfang', name: 'Anfangsbuchstaben (groß oder klein)' },
];

const SILBEN: { wert: SilbenStand; titel: string }[] = [
	{ wert: 'aus', titel: 'Aus' },
	{ wert: 'boegen', titel: 'Bögen' },
	{ wert: 'farbe', titel: 'Farbe' },
	{ wert: 'beides', titel: 'Beides' },
];
type NummernWert = 'aus' | '1' | '5';
const ZEILENNUMMERN: { wert: NummernWert; titel: string }[] = [
	{ wert: 'aus', titel: 'Aus' },
	{ wert: '1', titel: 'Jede Zeile' },
	{ wert: '5', titel: 'Alle 5' },
];

const FELD = 'h-knopf rounded-lg border border-linie bg-flaeche px-2';
const eng = (t: string) => t.replace(/\s+/g, ' ').replace(/^ /, '');

interface Markierung extends Bereich {
	text: string;
}

/** Lage der Markierung im sichtbaren Text, gezählt wie in `reinerText`. */
const markierungIn = (element: Element, auswahl: Selection | null): Markierung | null => {
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
	return {
		von: eng(text).length,
		bis: eng(text + r.toString()).length,
		text: eng(r.toString()).trim(),
	};
};

/** Überschrift über einem Regler, der in die Zeile daneben nicht passt. */
const Regler = ({ children, titel }: { children: ReactNode; titel: string }) => (
	<div className="flex flex-col gap-0.5">
		<span className="text-leise">{titel}</span>
		<div {...halteFokus}>{children}</div>
	</div>
);

/**
 * Lesehilfen und Übungen an einem Text (052, 083). Lesehilfen zeigen ihren Stand aus der Quelle (`leseSprachstand`) und
 * lassen sich dort abschalten; eine Übung macht aus dem Text einen neuen Baustein, deshalb ein Knopf statt eines Reglers.
 * Beides wirkt auf den markierten Text, sonst auf den ganzen Text hier.
 */
export const Sprachwerkzeug = ({
	aktiv,
	bearbeitet,
	beende,
	geladen,
	pfad,
	quelle,
	struktur,
}: {
	aktiv: boolean;
	bearbeitet: boolean;
	beende: () => void;
	geladen: { doc: Document } | null;
	pfad: PfadTeil[];
	quelle: string | null;
	struktur: Struktur;
}) => {
	const doc = geladen?.doc ?? null;
	const nr = pfad.at(-1)?.nr ?? null;
	const zeige = useHinweis();
	const stand = useMemo(
		() => (aktiv && quelle !== null && nr !== null ? leseSprachstand(quelle, nr) : null),
		[aktiv, quelle, nr],
	);
	const ziel = stand?.ziel ?? null;
	const [regel, setRegel] = useState<LueckenRegel>('nte');
	const [n, setN] = useState(5);
	const [eingabe, setEingabe] = useState<{ nr: number | null; text: string } | null>(null);
	const [gemerkt, setGemerkt] = useState<{ doc: Document; ziel: number; m: Markierung | null } | null>(null);
	// Die Markierung gehört zu diesem Text in diesem Dokument; nach einem Schritt ist sie vorbei.
	const markiert = gemerkt && gemerkt.doc === doc && gemerkt.ziel === ziel ? gemerkt.m : null;

	// Ein Feld im Panel nimmt dem Rahmen den Fokus. Darum gilt die letzte Markierung, bis im Rahmen eine neue entsteht.
	useEffect(() => {
		if (!doc || ziel === null) {
			return undefined;
		}
		const merke = () => {
			const element = elementZu(doc, ziel);
			const auswahl = doc.getSelection();
			if (!element || (auswahl?.isCollapsed && !doc.hasFocus())) {
				return;
			}
			setGemerkt({ doc, ziel, m: markierungIn(element, auswahl) });
		};
		doc.addEventListener('selectionchange', merke);
		return () => doc.removeEventListener('selectionchange', merke);
	}, [doc, ziel]);

	if (!stand || nr === null) {
		return null;
	}
	const bereich = markiert ? { von: markiert.von, bis: markiert.bis } : undefined;
	const buchstaben = eingabe?.nr === nr ? eingabe.text : (stand.buchstaben ?? '');

	const wende = async (
		name: string,
		rechne: (s: typeof SprachKern, q: string) => SprachErgebnis,
		{ uebung = false } = {},
	) => {
		if (bearbeitet) {
			beende();
		}
		const sprache = await import('@schoolbox/kern/src/sprache');
		let unsicher: string[] = [];
		const ok = struktur.fuehreAus(
			name,
			(q) => {
				const e = rechne(sprache, q);
				({ unsicher } = e);
				return e;
			},
			uebung,
			!uebung,
		);
		if (ok && unsicher.length > 0) {
			zeige({
				text: `Prüfe diese Trennung: ${[...new Set(unsicher)].join(', ')}. Tippe die Silben an und ändere die Striche unter „Weitere“, „Text“.`,
			});
		}
	};
	const setzeSilben = (wert: SilbenDarstellung | null) =>
		void wende(wert ? 'Silben' : 'Silben entfernt', (s, q) => s.setzeSilben(q, nr, wert, bereich));
	const entferneUeberall = () => void wende('Silben entfernt', (s, q) => s.setzeSilben(q, stand.ziel, null));
	const uebe = (name: string, werkzeug: SprachWerkzeug) =>
		void wende(name, (s, q) => s.wendeSprachwerkzeugAn(q, nr, werkzeug, bereich), { uebung: true });
	const nummeriere = async (wert: NummernWert) => {
		if (bearbeitet) {
			beende();
		}
		const { setzeZeilennummern } = await import('@schoolbox/kern/src/sprache');
		const schritt = ({ aus: null, 1: 1, 5: 5 } as const)[wert];
		struktur.aendereAttribute('Zeilennummern', (q) => setzeZeilennummern(q, nr, schritt).quelle);
	};
	/** Der Schalter ist an: Er nimmt weg, was markiert ist. Sonst markiert er, was im Feld steht. */
	const schalteBuchstaben = (an: boolean) => {
		const alt = stand.buchstaben;
		if (!an && alt) {
			setEingabe({ nr, text: alt });
			void wende('Buchstaben aus', (s, q) => s.schalteMarkierung(q, nr, alt, bereich, false));
		} else if (an && buchstaben.trim()) {
			void wende('Buchstaben', (s, q) => s.schalteMarkierung(q, nr, buchstaben, bereich, true));
		}
	};
	/** ⏎ im Feld, während der Schalter an ist: tauscht in einem Schritt, damit Rückgängig beides zurücknimmt. */
	const tauscheBuchstaben = () => {
		const alt = stand.buchstaben;
		if (!alt) {
			schalteBuchstaben(true);
		} else if (buchstaben.trim() && buchstaben !== alt) {
			void wende('Buchstaben', (s, q) => {
				const ohne = s.schalteMarkierung(q, nr, alt, bereich, false);
				return s.schalteMarkierung(ohne.quelle, nr, buchstaben, bereich, true);
			});
		}
	};
	const nummern: NummernWert = stand.zeilennummern === null ? 'aus' : stand.zeilennummern === 1 ? '1' : '5';

	return (
		<div className="contents" data-sprachwerkzeug>
			<Abschnitt name="lesehilfen" titel="Lesehilfen">
				{markiert && (
					<p className="truncate text-xs text-leise" data-sprache-markierung title={markiert.text}>
						Wirkt auf die Markierung: „
{markiert.text}
“
					</p>
				)}
				<Regler titel="Silben">
					<div data-sprache-silben>
						<Segment<SilbenStand>
							beschriftung="Silben"
							werte={SILBEN}
							wert={stand.silben}
							waehle={(w) => setzeSilben(w === 'aus' || w === 'teilweise' ? null : w)}
						/>
					</div>
				</Regler>
				{stand.silben === 'teilweise' && (
					<div className="flex items-center justify-between gap-2" data-sprache-teilweise>
						<span className="text-xs text-leise">In einem Teil des Texts</span>
						<Knopf art="zweit" groesse="klein" {...halteFokus} onClick={entferneUeberall}>
							Überall entfernen
						</Knopf>
					</div>
				)}
				{!stand.nurSilben && (
					<>
						<Zeile titel="Vokale" fuer="sprache-vokale">
							<span {...halteFokus} data-sprache-vokale>
								<Schalter
									id="sprache-vokale"
									name="Vokale"
									an={stand.vokale}
									setze={() =>
										void wende(stand.vokale ? 'Vokale aus' : 'Vokale', (s, q) =>
											s.schalteMarkierung(q, nr, 'vokale', bereich),
										)}
								/>
							</span>
						</Zeile>
						<Zeile
							titel="Buchstaben"
							fuer="sprache-buchstaben"
							hilfe="Hebt diese Buchstaben im Text hervor."
						>
							<input
								{...EIGENE_GESCHICHTE}
								id="sprache-buchstaben"
								className={`${FELD} w-24`}
								placeholder="z. B. ie, ei"
								value={buchstaben}
								data-sprache-buchstaben
								onChange={(e) => setEingabe({ nr, text: e.target.value })}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										tauscheBuchstaben();
									}
								}}
							/>
							<span {...halteFokus} data-sprache-buchstaben-an>
								<Schalter
									name="Buchstaben hervorheben"
									an={stand.buchstaben !== null}
									aus={stand.buchstaben === null && buchstaben.trim() === ''}
									setze={schalteBuchstaben}
								/>
							</span>
						</Zeile>
					</>
				)}
				{stand.mitZeilennummern && (
					<Regler titel="Zeilennummern">
						<div data-sprache-zeilennummern>
							<Segment<NummernWert>
								beschriftung="Zeilennummern"
								werte={ZEILENNUMMERN}
								wert={nummern}
								waehle={(w) => void nummeriere(w)}
							/>
						</div>
					</Regler>
				)}
			</Abschnitt>
			{stand.umwandelbar && (
				<Abschnitt name="uebung" titel="Übung daraus machen" einklappbar zu>
					<label className="block text-leise">
						Lücken
						<select
							className={`${FELD} mt-0.5 block w-full text-tinte`}
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
						<label className="flex items-center gap-1 text-leise">
							Jedes
							<input
								{...EIGENE_GESCHICHTE}
								className={`${FELD} w-14 text-tinte`}
								type="number"
								min={2}
								max={20}
								value={n}
								data-sprache-n
								onChange={(e) => setN(Number(e.target.value))}
							/>
							<span className="-ml-0.5">. Wort</span>
						</label>
					)}
					<Knopf
						art="zweit"
						className="self-start"
						data-sprache="luecken"
						{...halteFokus}
						onClick={() => uebe('Lücken', { art: 'luecken', regel, n })}
					>
						Lücken machen
					</Knopf>
					<Knopf
						art="zweit"
						className="mt-2 self-start"
						data-sprache="woerter-mischen"
						{...halteFokus}
						onClick={() => uebe('Wörter gemischt', { art: 'woerter-mischen' })}
					>
						Wörter mischen
					</Knopf>
					<p className="text-xs text-leise">Jeder Satz wird zu Wörtern, die die Kinder ordnen.</p>
					<Knopf
						art="zweit"
						className="mt-2 self-start"
						data-sprache="buchstaben-mischen"
						{...halteFokus}
						onClick={() => uebe('Buchstaben gemischt', { art: 'buchstaben-mischen' })}
					>
						Buchstaben mischen
					</Knopf>
					<p className="text-xs text-leise">Jedes Wort steht gemischt da, die Kinder schreiben es richtig.</p>
					<p className="mt-2 text-xs text-dezent" data-sprache-folge>
						Wird zu einem neuen Baustein. Rückgängig holt den Text zurück.
						{stand.ausgezeichnet && ' Silben, Hervorhebung und Fett fallen dabei weg.'}
					</p>
				</Abschnitt>
			)}
		</div>
	);
};

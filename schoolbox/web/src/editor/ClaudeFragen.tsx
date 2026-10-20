import type { Zerlegung } from '@schoolbox/kern/src/quelltext';
import type { Ort } from '@schoolbox/kern/src/referenz';
import { erzeugeReferenz } from '@schoolbox/kern/src/referenz';
import { useEffect, useRef, useState } from 'react';

import { Dialog } from '../bausteine/Dialog';
import { useHinweis } from '../bausteine/hinweis';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import type { PfadTeil } from './darstellung';

const KOPIERT = 'Kopiert. Füge es im Claude-Chat ein und schreib dahinter, was du ändern möchtest.';

const VonHand = ({ schliessen, text }: { text: string; schliessen: () => void }) => {
	const feld = useRef<HTMLTextAreaElement>(null);
	useEffect(() => feld.current?.select(), []);
	return (
		<Dialog titel="Claude fragen" schliessen={schliessen}>
			<label className="flex flex-col gap-2">
				<span>
					Kopiere diesen Text und füge ihn im Claude-Chat ein. Schreib dahinter, was du ändern möchtest.
				</span>
				<textarea
					ref={feld}
					readOnly
					rows={4}
					className="rounded-xl border-2 border-rand p-3 text-base"
					value={text}
					data-claude-text
				/>
			</label>
			<div>
				<Knopf onClick={schliessen}>Fertig</Knopf>
			</div>
		</Dialog>
	);
};

interface Eigenschaften {
	/** Nicht in der Vorschau einer Version und nicht bei einem Konflikt: Claude liest die gespeicherte Fassung. */
	aktiv: boolean;
	/** Die Quelle im Editor, nicht die Darstellung: Nach dem Tippen gilt schon der neue Text. */
	zerlegung: Zerlegung | null;
	/** Das gewählte Element; `null` für das ganze Blatt. */
	nr: number | null;
	/** Der Weg dorthin wie in der Breadcrumb. */
	pfad?: PfadTeil[];
	ort: Ort;
	loesung: boolean;
	/** Gleich danach speichern: Claude liest die Datei, nicht den Editor. */
	nachher: () => void;
}

/**
 * Kopiert eine Referenz auf das Gewählte für den Claude-Chat (021). Safari erlaubt die Zwischenablage nur direkt im
 * Klick; geht sie nicht, steht der Text markiert zum Kopieren von Hand da.
 */
export const ClaudeFragen = ({ aktiv, loesung, nachher, nr, ort, pfad, zerlegung }: Eigenschaften) => {
	const zeige = useHinweis();
	const [vonHand, setVonHand] = useState<string | null>(null);
	if (!aktiv) {
		return null;
	}
	const name = nr === null ? null : pfad?.at(-1)?.name;

	const frage = () => {
		if (!zerlegung) {
			return;
		}
		const inhalt = erzeugeReferenz(zerlegung, nr, ort, loesung);
		// Ohne sichere Verbindung gibt es `navigator.clipboard` nicht
		const kopieren =
			'clipboard' in navigator
				? navigator.clipboard.writeText(inhalt)
				: Promise.reject(new Error('Zwischenablage'));
		kopieren.then(
			() => zeige({ text: KOPIERT }),
			() => setVonHand(inhalt),
		);
		nachher();
	};

	return (
		<div className="mt-6 border-t border-rand pt-4" data-claude-fragen>
			<Knopf art="zweit" onClick={frage}>
				<Symbol name="sprechblase" />
				Claude fragen
			</Knopf>
			<p className="mt-2 text-leise">
				{name
					? `Für Wünsche wie „Mach das schwerer“: Kopiert, welcher Teil gemeint ist (${name}), für den Claude-Chat.`
					: 'Für Wünsche zum ganzen Blatt: Kopiert, welches Blatt gemeint ist, für den Claude-Chat.'}
			</p>
			{vonHand !== null && <VonHand text={vonHand} schliessen={() => setVonHand(null)} />}
		</div>
	);
};

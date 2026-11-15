import { verstaendlich } from '@schoolbox/kern/src/meldungen';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Dialog } from '../bausteine/Dialog';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import type { PdfMeldung } from '../typen';
import { bitteAnClaude, bitteImEditor, jeDokument } from './claude';
import { fasseZusammen } from './gleiche';

interface Eigenschaften {
	mappe: { id: string; titel: string };
	meldungen: PdfMeldung[];
	/** Bei „Alles als PDF“ steht immer dabei, welches Blatt betroffen ist, auch wenn es nur eins ist. */
	ganzeMappe?: boolean;
	/** „Trotzdem herunterladen“ bzw. „Trotzdem drucken“. */
	weiterTitel: string;
	weiter: () => void;
	schliessen: () => void;
}

/** Warnen statt sperren: Was die Prüfung fand, in verständlichen Sätzen, und der Weg zu Claude für die Reparatur. */
export const PdfWarnung = ({ ganzeMappe, mappe, meldungen, schliessen, weiter, weiterTitel }: Eigenschaften) => {
	const [kopiert, setKopiert] = useState<'ja' | 'von-hand' | null>(null);
	const feld = useRef<HTMLTextAreaElement>(null);
	const gruppen = jeDokument(meldungen);
	const bitte = bitteAnClaude(mappe, meldungen);
	const navigate = useNavigate();
	// 191-U2: Beim PDF eines Blatts führt der Knopf in dessen Editor, die Bitte steht dort in der Blase. „Alles als
	// PDF“ geht weiter über die Claude-App.
	const [nurEins] = !ganzeMappe && gruppen.length === 1 ? gruppen : [];
	const mappeDesBlatts = nurEins ? (nurEins.meldungen[0]?.mappe ?? mappe.id) : '';
	const imEditor = () => {
		if (!nurEins) {
			return;
		}
		schliessen();
		void navigate(`/m/${mappeDesBlatts}/${nurEins.dok}/bearbeiten`, {
			state: { claudeBitte: bitteImEditor(nurEins.meldungen) },
		});
	};

	const kopiere = async () => {
		try {
			await navigator.clipboard.writeText(bitte);
			setKopiert('ja');
		} catch {
			// Ohne Zugriff auf die Zwischenablage steht der Satz markiert da, zum Kopieren von Hand
			setKopiert('von-hand');
			requestAnimationFrame(() => feld.current?.select());
		}
	};

	const fussZeile = (
		<>
			<Knopf art="zweit" onClick={nurEins && mappeDesBlatts ? imEditor : () => void kopiere()}>
				<Symbol name={nurEins && mappeDesBlatts ? 'funken' : 'kopieren'} />
				Claude bitten, es zu reparieren
			</Knopf>
			<Knopf
				data-hauptaktion
				onClick={() => {
					schliessen();
					weiter();
				}}
			>
				{weiterTitel}
			</Knopf>
		</>
	);
	return (
		<Dialog titel="Beim Prüfen ist etwas aufgefallen" schliessen={schliessen} fuss={fussZeile}>
			<p>Du kannst das PDF trotzdem nehmen. Schau es dir aber vorher genau an:</p>
			<div className="flex flex-col gap-3 rounded-xl bg-papier p-4">
				{gruppen.map(({ dok, meldungen: liste, titel }) => (
					<div key={dok}>
						{(ganzeMappe || gruppen.length > 1) && <h3 className="text-lg">{titel}</h3>}
						<ul className="flex list-disc flex-col gap-1 pl-5">
							{fasseZusammen(liste.map(verstaendlich)).map((satz) => (
								<li key={satz}>{satz}</li>
							))}
						</ul>
					</div>
				))}
			</div>
			{kopiert === 'ja' && (
				<p className="flex items-center gap-2 font-medium text-tinte" role="status">
					<Symbol name="haken" />
					Kopiert. Füge den Text in der Claude-App ein und schick ihn ab.
				</p>
			)}
			{kopiert === 'von-hand' && (
				<label className="flex flex-col gap-1">
					<span>Kopiere diesen Text und füge ihn in der Claude-App ein:</span>
					<textarea
						ref={feld}
						readOnly
						rows={5}
						className="rounded-xl border border-rand p-3 text-base"
						value={bitte}
					/>
				</label>
			)}
		</Dialog>
	);
};

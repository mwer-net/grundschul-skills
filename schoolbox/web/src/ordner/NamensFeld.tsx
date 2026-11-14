import { useEffect, useRef, useState } from 'react';

import { meldung } from '../api';
import { klassen } from '../bausteine/klassen';
import { useAblage } from './kontext';
import type { Objekt } from './typen';

interface Eigenschaften {
	objekt: Objekt;
	className?: string;
}

/** Name direkt tippen. ⏎ speichert, Esc stellt den alten Namen her (bei einem frischen Ordner: behält den Vorschlag). */
export const NamensFeld = ({ className, objekt }: Eigenschaften) => {
	const { benennen, setBenennen, tu } = useAblage();
	// Der erste Name eines neuen Ordners ist kein Umbenennen: „Neuer Ordner angelegt.“ genügt (188-24).
	const frisch = benennen?.neu === true && benennen.schluessel === objekt.schluessel;
	const imDialog = benennen?.wo === 'dialog';
	/** Nach dem Benennen im Dialog steht der Fokus auf der Zeile des Ordners: ⏎ bewegt dorthin (188-09). */
	const fertigImDialog = () => {
		if (imDialog && objekt.istOrdner) {
			const id = objekt.ordner.id;
			requestAnimationFrame(() =>
				document.querySelector<HTMLElement>(`[data-bewegen-baum] [data-baum-ordner="${id}"]`)?.focus(),
			);
		}
	};
	const [wert, setWert] = useState(objekt.name);
	const [fehler, setFehler] = useState<string | null>(null);
	const feld = useRef<HTMLInputElement>(null);
	const fertig = useRef(false);

	useEffect(() => {
		feld.current?.focus();
		feld.current?.select();
	}, []);

	const speichere = async () => {
		if (fertig.current) {
			return;
		}
		const name = wert.trim();
		if (name === '' || name === objekt.name) {
			fertig.current = true;
			setBenennen(null);
			fertigImDialog();
			return;
		}
		fertig.current = true;
		try {
			await tu(
				{ art: 'umbenennen', knoten: objekt.knoten, name },
				frisch ? { stillerFehler: true } : { stillerFehler: true, text: () => `„${objekt.name}“ heißt jetzt „${name}“.` },
			);
			setBenennen(null);
			fertigImDialog();
		} catch (grund) {
			fertig.current = false;
			setFehler(meldung(grund));
			feld.current?.focus();
		}
	};

	return (
		<span className="relative block min-w-0" data-namensfeld>
			<input
				ref={feld}
				aria-label="Name"
				aria-invalid={fehler !== null}
				className={klassen(
					'w-full rounded-sm border border-brand-500 bg-flaeche px-1 text-sm font-medium text-tinte outline-none select-text',
					className,
				)}
				maxLength={120}
				value={wert}
				onChange={(e) => {
					setWert(e.target.value);
					setFehler(null);
				}}
				onClick={(e) => e.stopPropagation()}
				onDoubleClick={(e) => e.stopPropagation()}
				onPointerDown={(e) => e.stopPropagation()}
				onBlur={() => void speichere()}
				onKeyDown={(e) => {
					e.stopPropagation();
					if (e.key === 'Enter') {
						e.preventDefault();
						void speichere();
					} else if (e.key === 'Escape') {
						e.preventDefault();
						fertig.current = true;
						setBenennen(null);
						fertigImDialog();
					}
				}}
			/>
			{fehler && (
				<span
					role="alert"
					className="absolute top-full left-0 z-menue mt-1 w-max max-w-60 rounded-md border border-rand bg-flaeche px-2 py-1 text-xs text-fehler shadow-2"
				>
					{fehler}
				</span>
			)}
		</span>
	);
};

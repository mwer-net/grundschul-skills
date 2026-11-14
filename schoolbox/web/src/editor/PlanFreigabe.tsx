import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';

const FELD_ZEICHEN = 1000;

/**
 * Der Aufgabenplan zur Freigabe, für das neue Blatt und für die Einheit derselbe (190-35): Plan, darunter „So bauen“,
 * „Ändern …“ und „Verwerfen“. Vom ersten Klick bis zur Antwort des Servers sind alle drei gesperrt (190-32).
 */
export const PlanFreigabe = ({
	aendern,
	attribute,
	fokus = false,
	freigeben,
	gesperrt,
	klein = false,
	planKlasse,
	text,
	verwerfen,
}: {
	text: string;
	/** Das Limit lässt keinen Lauf zu: „So bauen“ und „Ändern …“ gehen nicht. */
	gesperrt: boolean;
	/** `false` oder ein Fehler: Der Server hat nicht angenommen, die Knöpfe gehen wieder. */
	freigeben: () => Promise<boolean | undefined | void>;
	aendern: (wunsch: string) => Promise<boolean | undefined | void>;
	verwerfen: () => Promise<unknown>;
	/** Band der Einheit: kleine Knöpfe. */
	klein?: boolean;
	/** Der Fokus liegt auf „So bauen“, ⏎ gibt frei (190-44). */
	fokus?: boolean;
	planKlasse?: string;
	/** Prüfanker der Stelle, z. B. `data-entwurf-plan`. */
	attribute?: Record<string, string>;
}) => {
	const [feldOffen, setFeldOffen] = useState(false);
	const [wunsch, setWunsch] = useState('');
	const [belegt, setBelegt] = useState(false);
	const unterwegs = useRef(false);
	const bauen = useRef<HTMLButtonElement>(null);
	const groesse = klein ? 'klein' : 'standard';

	// Ein neuer Plan ist eine neue Frage: Die Sperre der alten gilt nicht mehr.
	useEffect(() => {
		unterwegs.current = false;
		setBelegt(false);
	}, [text]);

	useEffect(() => {
		if (fokus && !feldOffen) {
			bauen.current?.focus({ preventScroll: true });
		}
	}, [fokus, feldOffen]);

	const tue = async (arbeit: () => Promise<unknown>) => {
		if (unterwegs.current) {
			return false;
		}
		unterwegs.current = true;
		setBelegt(true);
		let angenommen = false;
		try {
			angenommen = (await arbeit()) !== false;
		} catch {
			angenommen = false;
		}
		if (!angenommen) {
			unterwegs.current = false;
			setBelegt(false);
		}
		return angenommen;
	};

	const sendeWunsch = async (e?: FormEvent) => {
		e?.preventDefault();
		const t = wunsch.trim();
		if (t && (await tue(() => aendern(t)))) {
			setWunsch('');
			setFeldOffen(false);
		}
	};

	return (
		<>
			<div
				className={klassen(
					'max-w-[46rem] overflow-y-auto rounded-md border border-rand bg-papier px-3 py-2 whitespace-pre-wrap',
					planKlasse,
				)}
				{...attribute}
			>
				{text.trim()}
			</div>
			{feldOffen ? (
				<form className="mt-3 flex max-w-[46rem] flex-col gap-2" onSubmit={(e) => void sendeWunsch(e)}>
					<textarea
						autoFocus
						aria-label="Was soll am Plan anders sein?"
						placeholder="Was soll am Plan anders sein? Zum Beispiel: mehr Sachaufgaben, Aufgabe 3 weglassen, nur 15 Minuten."
						className="min-h-20 rounded-md border border-rand-feld bg-flaeche px-2 py-1.5"
						maxLength={FELD_ZEICHEN}
						value={wunsch}
						data-plan-feld
						onChange={(e) => setWunsch(e.target.value)}
						onKeyDown={(e) => {
							// Esc schließt das Feld, der Text bleibt bis zum Absenden (190-35).
							if (e.key === 'Escape') {
								e.preventDefault();
								e.stopPropagation();
								setFeldOffen(false);
							}
							if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
								void sendeWunsch(e);
							}
						}}
					/>
					<div className="flex gap-2">
						<Knopf type="submit" groesse={groesse} disabled={!wunsch.trim() || belegt}>
							Plan ändern
						</Knopf>
						<Knopf art="leise" groesse={groesse} onClick={() => setFeldOffen(false)}>
							Abbrechen
						</Knopf>
					</div>
				</form>
			) : (
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<Knopf
						ref={bauen}
						groesse={groesse}
						disabled={gesperrt || belegt}
						aria-busy={belegt}
						data-plan-freigeben
						onClick={() => void tue(freigeben)}
					>
						{belegt && <Symbol name="laden" className="animate-spin" />}
						So bauen
					</Knopf>
					<Knopf art="zweit" groesse={groesse} disabled={gesperrt || belegt} onClick={() => setFeldOffen(true)}>
						Ändern …
					</Knopf>
					<Knopf
						art="leise"
						groesse={groesse}
						disabled={belegt}
						data-plan-verwerfen
						onClick={() => void tue(verwerfen)}
					>
						Verwerfen
					</Knopf>
				</div>
			)}
		</>
	);
};

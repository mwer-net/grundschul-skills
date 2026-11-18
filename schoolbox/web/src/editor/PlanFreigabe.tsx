import type { FormEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { ClaudeWahl } from './ClaudeWahl';

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
	zusatz,
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
	/** Zwischen Plan und Knöpfen, damit die Knöpfe nach allem stehen, was zu prüfen ist (Einheit, 221). */
	zusatz?: ReactNode;
}) => {
	const [feldOffen, setFeldOffen] = useState(false);
	const [wunsch, setWunsch] = useState('');
	// Woran gerade gearbeitet wird: Der Kreisel steht am geklickten Knopf, gesperrt sind alle.
	const [arbeit, setArbeit] = useState<'bauen' | 'aendern' | 'verwerfen' | null>(null);
	const belegt = arbeit !== null;
	const unterwegs = useRef(false);
	const bauen = useRef<HTMLButtonElement>(null);
	const feld = useRef<HTMLTextAreaElement>(null);
	const groesse = klein ? 'klein' : 'standard';

	// Ein neuer Plan ist eine neue Frage: Die Sperre der alten gilt nicht mehr.
	useEffect(() => {
		unterwegs.current = false;
		setArbeit(null);
	}, [text]);

	// Das wieder geöffnete Feld setzt die Marke ans Ende des stehen gebliebenen Texts (190-N05).
	useEffect(() => {
		const f = feld.current;
		if (feldOffen && f) {
			f.focus();
			f.setSelectionRange(f.value.length, f.value.length);
		}
	}, [feldOffen]);

	useEffect(() => {
		if (fokus && !feldOffen) {
			bauen.current?.focus({ preventScroll: true });
		}
	}, [fokus, feldOffen]);

	const tue = async (was: 'bauen' | 'aendern' | 'verwerfen', aufgabe: () => Promise<unknown>) => {
		if (unterwegs.current) {
			return false;
		}
		unterwegs.current = true;
		setArbeit(was);
		let angenommen = false;
		try {
			angenommen = (await aufgabe()) !== false;
		} catch {
			angenommen = false;
		}
		if (!angenommen) {
			unterwegs.current = false;
			setArbeit(null);
		}
		return angenommen;
	};

	const sendeWunsch = async (e?: FormEvent) => {
		e?.preventDefault();
		const t = wunsch.trim();
		if (t && (await tue('aendern', () => aendern(t)))) {
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
			{zusatz}
			{feldOffen ? (
				<form className="mt-3 flex max-w-[46rem] flex-col gap-2" onSubmit={(e) => void sendeWunsch(e)}>
					<textarea
						ref={feld}
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
							// ↩ sendet, ⇧↩ macht eine neue Zeile, wie in der Blase und im Feld des Entwurfs (S-11).
							if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
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
						<ClaudeWahl className="ml-auto self-center" />
					</div>
				</form>
			) : (
				<div className="mt-3 flex max-w-[46rem] flex-wrap items-center gap-2">
					<Knopf
						ref={bauen}
						groesse={groesse}
						disabled={gesperrt || belegt}
						aria-busy={arbeit === 'bauen'}
						data-plan-freigeben
						onClick={() => void tue('bauen', freigeben)}
					>
						{arbeit === 'bauen' && <Symbol name="laden" className="animate-spin" />}
						So bauen
					</Knopf>
					<Knopf
						art="zweit"
						groesse={groesse}
						disabled={gesperrt || belegt}
						onClick={() => setFeldOffen(true)}
					>
						Ändern …
					</Knopf>
					<Knopf
						art="leise"
						groesse={groesse}
						disabled={belegt}
						data-plan-verwerfen
						onClick={() => void tue('verwerfen', verwerfen)}
					>
						{arbeit === 'verwerfen' && <Symbol name="laden" className="animate-spin" />}
						Verwerfen
					</Knopf>
					<ClaudeWahl className="ml-auto" />
				</div>
			)}
		</>
	);
};

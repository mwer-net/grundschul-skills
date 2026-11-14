import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { klassen } from './klassen';
import { Symbol } from './Symbol';

interface Eigenschaften {
	titel: string;
	schliessen: () => void;
	children: ReactNode;
	/** Für Inhalte, die Platz brauchen, z. B. eine Bildersammlung. */
	breit?: boolean;
	/**
	 * Knopfzeile unten rechts wie am Mac (187-05): Nebenaktionen zuerst, die Hauptaktion zuletzt mit
	 * `data-hauptaktion`. Eine dritte Aktion, die nichts abschließt („Neuer Ordner“), steht mit `className="mr-auto"`
	 * links. Die Hauptaktion bekommt beim Öffnen den Fokus, wenn es kein Feld gibt, und Enter löst sie aus.
	 */
	fuss?: ReactNode;
}

const ERSTER_FOKUS =
	'[autofocus],input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled)';

/** Nur ausdrücklich markiert: Ein Dialog ohne Hauptaktion bekommt nie zufällig „Verwerfen“ oder „Löschen“. */
const hauptaktion = (dialog: HTMLElement) =>
	dialog.querySelector<HTMLButtonElement>('[data-hauptaktion]:not(:disabled)');

/**
 * Enter bestätigt nur von Stellen ohne eigene Bedeutung für Enter: das Fenster selbst, ein einzeiliges Feld außerhalb
 * eines Formulars (das schickt sich selbst ab), ein Text nur zum Lesen. Knöpfe, Links, Listen und Bäume behalten
 * ihr Enter, mehrzeilige Felder ihren Zeilenumbruch.
 */
const enterBestaetigt = (ziel: EventTarget, dialog: HTMLDialogElement) =>
	ziel === dialog ||
	(ziel instanceof HTMLInputElement && ziel.form === null && !['checkbox', 'radio', 'button'].includes(ziel.type)) ||
	(ziel instanceof HTMLTextAreaElement && ziel.readOnly);

/**
 * Fenster über der Seite, mit dem `<dialog>` des Browsers: Der hält den Fokus im Fenster, schließt mit Esc und
 * legt den Rest der Seite still. Ein Klick neben das Fenster schließt es ebenfalls, aber nur, wenn er dort auch
 * begann (187-02: Markieren von Text, das neben dem Fenster endet, schließt nichts).
 *
 * Fokus beim Öffnen: das erste Feld, sonst die Hauptaktion, sonst das Fenster selbst (kein Ring am ×, 187-14).
 * Enter löst die Hauptaktion aus, ⌘⏎ auch aus einem Textfeld heraus.
 */
export const Dialog = ({ breit, children, fuss, schliessen, titel }: Eigenschaften) => {
	const dialog = useRef<HTMLDialogElement>(null);
	const druckDaneben = useRef(false);

	useEffect(() => {
		const element = dialog.current;
		if (!element || element.open) {
			return undefined;
		}
		const ausloeser = document.activeElement;
		element.showModal();
		(element.querySelector<HTMLElement>(ERSTER_FOKUS) ?? hauptaktion(element) ?? element).focus();
		return () => {
			if (ausloeser instanceof HTMLElement && ausloeser.isConnected) {
				ausloeser.focus();
			}
		};
	}, []);

	const daneben = (ereignis: MouseEvent<HTMLDialogElement>) => {
		if (ereignis.target === dialog.current && druckDaneben.current) {
			schliessen();
		}
		druckDaneben.current = false;
	};

	const taste = (ereignis: KeyboardEvent<HTMLDialogElement>) => {
		if (ereignis.key !== 'Enter' || ereignis.defaultPrevented || ereignis.nativeEvent.isComposing) {
			return;
		}
		const element = dialog.current;
		const mitBefehl = ereignis.metaKey || ereignis.ctrlKey;
		if (!element || ereignis.shiftKey || ereignis.altKey || (!mitBefehl && !enterBestaetigt(ereignis.target, element))) {
			return;
		}
		const knopf = hauptaktion(element);
		if (knopf) {
			ereignis.preventDefault();
			knopf.click();
		}
	};

	return (
		<dialog
			ref={dialog}
			tabIndex={-1}
			className={klassen(
				'm-auto max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-flaeche p-0 text-base text-tinte shadow-2 outline-none',
				breit ? 'w-[min(56rem,calc(100vw-2rem))]' : 'w-[min(30rem,calc(100vw-2rem))]',
			)}
			aria-labelledby="dialog-titel"
			onClose={schliessen}
			onPointerDown={(e) => {
				druckDaneben.current = e.target === dialog.current;
			}}
			onClick={daneben}
			onKeyDown={taste}
		>
			<div className="relative flex flex-col gap-3 p-4" data-dialog-inhalt>
				<h2 id="dialog-titel" className="pr-8 text-xl">
					{titel}
				</h2>
				{children}
				{fuss && (
					<div className="flex flex-wrap items-center justify-end gap-2" data-dialog-fuss>
						{fuss}
					</div>
				)}
				<button
					type="button"
					className="absolute top-3 right-3 flex size-knopf items-center justify-center rounded-md text-leise hover:bg-flaeche-2"
					aria-label="Schließen"
					data-dialog-schliessen
					onClick={schliessen}
				>
					<Symbol name="schliessen" />
				</button>
			</div>
		</dialog>
	);
};

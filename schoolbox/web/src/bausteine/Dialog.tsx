import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { klassen } from './klassen';
import { Symbol } from './Symbol';

interface Eigenschaften {
	titel: string;
	schliessen: () => void;
	children: ReactNode;
	/** Für Inhalte, die Platz brauchen, z. B. eine Bildersammlung. */
	breit?: boolean;
}

const ERSTER_FOKUS =
	'[autofocus],input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled)';

/** Ohne Feld die Hauptaktion: Sie steht zuletzt im Inhalt. Das × steht danach im DOM und zählt nicht. */
const hauptaktion = (dialog: HTMLElement) =>
	dialog.querySelector<HTMLElement>('[data-hauptaktion]') ??
	[
		...dialog.querySelectorAll<HTMLElement>(
			'[data-dialog-inhalt] button:not(:disabled):not([data-dialog-schliessen])',
		),
	].at(-1);

/**
 * Fenster über der Seite, mit dem `<dialog>` des Browsers: Der hält den Fokus im Fenster, schließt mit Esc und
 * legt den Rest der Seite still. Ein Tipp neben das Fenster schließt es ebenfalls.
 */
export const Dialog = ({ breit, children, schliessen, titel }: Eigenschaften) => {
	const dialog = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const element = dialog.current;
		if (!element || element.open) {
			return undefined;
		}
		const ausloeser = document.activeElement;
		element.showModal();
		(element.querySelector<HTMLElement>(ERSTER_FOKUS) ?? hauptaktion(element))?.focus();
		return () => {
			if (ausloeser instanceof HTMLElement && ausloeser.isConnected) {
				ausloeser.focus();
			}
		};
	}, []);

	const daneben = (ereignis: MouseEvent<HTMLDialogElement>) => {
		if (ereignis.target === dialog.current) {
			schliessen();
		}
	};

	return (
		<dialog
			ref={dialog}
			className={klassen(
				'm-auto max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-flaeche p-0 text-base text-tinte shadow-2',
				breit ? 'w-[min(56rem,calc(100vw-2rem))]' : 'w-[min(30rem,calc(100vw-2rem))]',
			)}
			aria-labelledby="dialog-titel"
			onClose={schliessen}
			onClick={daneben}
		>
			<div className="relative flex flex-col gap-3 p-4" data-dialog-inhalt>
				<h2 id="dialog-titel" className="pr-8 text-xl">
					{titel}
				</h2>
				{children}
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

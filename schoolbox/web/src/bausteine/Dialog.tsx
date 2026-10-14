import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { Symbol } from './Symbol';

interface Eigenschaften {
	titel: string;
	schliessen: () => void;
	children: ReactNode;
}

/**
 * Fenster über der Seite, mit dem `<dialog>` des Browsers: Der hält den Fokus im Fenster, schließt mit Esc und
 * legt den Rest der Seite still. Ein Tipp neben das Fenster schließt es ebenfalls.
 */
export const Dialog = ({ children, schliessen, titel }: Eigenschaften) => {
	const dialog = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const element = dialog.current;
		if (element && !element.open) {
			element.showModal();
		}
	}, []);

	const daneben = (ereignis: MouseEvent<HTMLDialogElement>) => {
		if (ereignis.target === dialog.current) {
			schliessen();
		}
	};

	return (
		<dialog
			ref={dialog}
			className="m-auto max-h-[calc(100dvh-2rem)] w-[min(38rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl bg-white p-0 text-tinte shadow-karte"
			aria-labelledby="dialog-titel"
			onClose={schliessen}
			onClick={daneben}
		>
			<div className="flex flex-col gap-4 p-6 max-md:p-4">
				<header className="flex items-start justify-between gap-4">
					<h2 id="dialog-titel" className="pt-2 text-2xl">
						{titel}
					</h2>
					<button
						type="button"
						className="-mt-1 -mr-2 flex size-12 flex-none items-center justify-center rounded-full text-leise hover:bg-brand-50"
						aria-label="Schließen"
						onClick={schliessen}
					>
						<Symbol name="schliessen" />
					</button>
				</header>
				{children}
			</div>
		</dialog>
	);
};

import { klassen } from './klassen';

interface Eigenschaften {
	an: boolean;
	setze: (an: boolean) => void;
	name: string;
	aus?: boolean;
	id?: string;
}

/** Ein/Aus. Sichtbar 24×14; der Knopf drum herum trägt die Trefferfläche, damit sie bei Touch 44 px misst. */
export const Schalter = ({ an, aus, id, name, setze }: Eigenschaften) => (
	<button
		id={id}
		type="button"
		role="switch"
		aria-checked={an}
		aria-label={name}
		disabled={aus}
		className="inline-flex size-knopf-status flex-none items-center justify-center disabled:opacity-50"
		onClick={() => setze(!an)}
	>
		<span
			className={klassen(
				'relative h-3.5 w-6 rounded-full transition-colors duration-[120ms]',
				an ? 'bg-brand-500' : 'bg-rand-feld',
			)}
		>
			<span
				className={klassen(
					'absolute top-0.5 size-2.5 rounded-full bg-flaeche transition-[left] duration-[120ms]',
					an ? 'left-3' : 'left-0.5',
				)}
			/>
		</span>
	</button>
);

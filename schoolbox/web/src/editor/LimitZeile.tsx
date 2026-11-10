import { useState } from 'react';

import { meldung } from '../api';
import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import type { limitHinweis } from './ki';

/** Der Stand des Limits am Chat und im Assistenten. Auch gesperrt kein toter Zustand: Der Knopf fragt das Konto neu. */
export const LimitZeile = ({
	className,
	hinweis,
	pruefeLimit,
}: {
	hinweis: NonNullable<ReturnType<typeof limitHinweis>>;
	pruefeLimit: () => Promise<void>;
	className?: string;
}) => {
	const [frage, setFrage] = useState<'ruhe' | 'fragt' | 'gefragt'>('ruhe');
	const [fehler, setFehler] = useState<string | null>(null);
	const versuche = async () => {
		setFrage('fragt');
		setFehler(null);
		try {
			await pruefeLimit();
		} catch (grund) {
			setFehler(meldung(grund));
		}
		setFrage('gefragt');
	};
	return (
		<div
			role="status"
			className={klassen('flex flex-none items-center justify-between gap-2 text-xs', className)}
			data-ki-limit={hinweis.art}
		>
			<p>
				{hinweis.text}
				{frage === 'gefragt' && ` ${fehler ?? 'Gerade neu gefragt: Es bleibt noch gesperrt.'}`}
			</p>
			{hinweis.art === 'gesperrt' && (
				<Knopf
					art="zweit"
					groesse="klein"
					className="flex-none"
					disabled={frage === 'fragt'}
					onClick={() => void versuche()}
				>
					Noch einmal versuchen
				</Knopf>
			)}
		</div>
	);
};

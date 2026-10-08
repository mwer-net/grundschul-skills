import { useEffect, useState } from 'react';

import { lade } from './api';

interface Inhalt {
	mappe: { id: string; titel: string };
	dokumente: { id: string; meta: { titel: string; hatLoesung: boolean } }[];
}

/** Vorläufige Seite für Teilen-Links: Titel und Dokumente zum Ansehen. Die eigentliche Ansicht kommt mit 009. */
export const Geteilt = ({ token }: { token: string }) => {
	const [inhalt, setInhalt] = useState<Inhalt | null>(null);
	const [fehler, setFehler] = useState<string | null>(null);

	useEffect(() => {
		lade<Inhalt>(`/f/${token}/api/inhalt`)
			.then(setInhalt)
			.catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)));
	}, [token]);

	if (fehler) {
		return (
			<main className="karte-seite">
				<div className="karte">
					<h1>Schade!</h1>
					<p>{fehler}</p>
					<p>Bitte frag nach einem neuen Link.</p>
				</div>
			</main>
		);
	}
	if (!inhalt) {
		return null;
	}
	const { dokumente, mappe } = inhalt;
	const ansicht = (dok: string) => `/f/${token}/ansicht/${mappe.id}/dokumente/${dok}/`;
	return (
		<main className="inhalt">
			<h1>{mappe.titel}</h1>
			<ul className="liste">
				{dokumente.map(({ id, meta }) => (
					<li key={id}>
						<span>{meta.titel}</span>
						<a className="knopf" href={ansicht(id)}>
							Ansehen
						</a>
						{meta.hatLoesung && (
							<a className="knopf knopf-zweit" href={`${ansicht(id)}?loesung=1`}>
								Lösung
							</a>
						)}
					</li>
				))}
			</ul>
		</main>
	);
};

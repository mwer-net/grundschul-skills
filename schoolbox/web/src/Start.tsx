import { useEffect, useState } from 'react';

import { ANMELDE_SEITE, lade, sende, zurAnmeldung } from './api';

export const Start = () => {
	const [angemeldet, setAngemeldet] = useState(false);
	const [fehler, setFehler] = useState<string | null>(null);

	useEffect(() => {
		lade<{ angemeldet: boolean }>('/api/sitzung')
			.then((sitzung) => {
				if (sitzung.angemeldet) {
					setAngemeldet(true);
				} else {
					zurAnmeldung();
				}
			})
			.catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)));
	}, []);

	const abmelden = async () => {
		try {
			await sende('/api/abmelden');
			window.location.assign(ANMELDE_SEITE);
		} catch (e) {
			setFehler(e instanceof Error ? e.message : String(e));
		}
	};

	if (fehler) {
		return (
			<main className="karte-seite">
				<p className="meldung">{fehler}</p>
			</main>
		);
	}
	if (!angemeldet) {
		return null;
	}
	return (
		<>
			<header className="kopf">
				<strong>Schoolbox</strong>
				<button className="knopf knopf-zweit" type="button" onClick={() => void abmelden()}>
					Abmelden
				</button>
			</header>
			<main className="inhalt">
				<p>Hier entsteht die Übersicht über deine Materialien.</p>
			</main>
		</>
	);
};

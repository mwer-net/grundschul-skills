import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';

import { lade, sende, sichererPfad } from './api';

const weiter = sichererPfad(new URLSearchParams(window.location.search).get('weiter'));

export const Anmeldung = () => {
	const [passwort, setPasswort] = useState('');
	const [bleiben, setBleiben] = useState(true);
	const [fehler, setFehler] = useState<string | null>(null);
	const [laeuft, setLaeuft] = useState(false);

	useEffect(() => {
		lade<{ angemeldet: boolean }>('/api/sitzung')
			.then(({ angemeldet }) => {
				if (angemeldet) {
					window.location.replace(weiter);
				}
			})
			.catch(() => undefined);
	}, []);

	const absenden = async (ereignis: FormEvent<HTMLFormElement>) => {
		ereignis.preventDefault();
		setLaeuft(true);
		setFehler(null);
		try {
			await sende('/api/anmelden', { passwort, angemeldetBleiben: bleiben });
			window.location.assign(weiter);
		} catch (e) {
			setFehler(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
			setLaeuft(false);
		}
	};

	return (
		<main className="karte-seite">
			<form className="karte" onSubmit={(e) => void absenden(e)}>
				<h1>Schoolbox</h1>
				<p>Schön, dass du da bist! Bitte gib dein Passwort ein.</p>
				{/* Safari speichert Passwörter zu einem Benutzernamen; diesen sieht niemand. */}
				<input
					className="unsichtbar"
					type="text"
					name="username"
					autoComplete="username"
					value="Schoolbox"
					readOnly
					tabIndex={-1}
					aria-hidden="true"
				/>
				<label htmlFor="passwort">Passwort</label>
				<input
					id="passwort"
					name="password"
					type="password"
					autoComplete="current-password"
					autoCapitalize="none"
					autoCorrect="off"
					spellCheck={false}
					required
					autoFocus
					value={passwort}
					onChange={(e) => setPasswort(e.target.value)}
				/>
				<label className="haken">
					<input type="checkbox" checked={bleiben} onChange={(e) => setBleiben(e.target.checked)} />
					<span>
						Auf diesem Gerät angemeldet bleiben
						<small>Nur an deinem eigenen Mac oder iPad.</small>
					</span>
				</label>
				{fehler && (
					<p className="meldung" role="alert">
						{fehler}
					</p>
				)}
				<button className="knopf" type="submit" disabled={laeuft || !passwort}>
					{laeuft ? 'Einen Moment …' : 'Anmelden'}
				</button>
			</form>
		</main>
	);
};

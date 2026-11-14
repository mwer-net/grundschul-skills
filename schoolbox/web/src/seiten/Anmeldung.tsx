import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { lade, meldung, sende, sichererPfad } from '../api';
import { Kachel } from '../bausteine/Kachel';
import { FELD_KLASSEN } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { useTitel } from '../lib/titel';

export const Anmeldung = () => {
	const [parameter] = useSearchParams();
	// Leitet der Server zur Anmeldung um, bleibt die Sprungmarke an dieser Adresse hängen statt in `weiter` (187-03).
	const ziel = sichererPfad(parameter.get('weiter'));
	const weiter = ziel.includes('#') ? ziel : `${ziel}${window.location.hash}`;
	const feld = useRef<HTMLInputElement>(null);
	const [passwort, setPasswort] = useState('');
	const [bleiben, setBleiben] = useState(true);
	const [fehler, setFehler] = useState<string | null>(null);
	const [laeuft, setLaeuft] = useState(false);
	useTitel('Anmelden');

	useEffect(() => {
		lade<{ angemeldet: boolean }>('/api/sitzung')
			.then(({ angemeldet }) => {
				if (angemeldet) {
					window.location.replace(weiter);
				}
			})
			.catch(() => undefined);
	}, [weiter]);

	const absenden = async (ereignis: FormEvent<HTMLFormElement>) => {
		ereignis.preventDefault();
		setLaeuft(true);
		setFehler(null);
		try {
			await sende('/api/anmelden', { passwort, angemeldetBleiben: bleiben });
			window.location.assign(weiter);
		} catch (grund) {
			setFehler(meldung(grund));
			setLaeuft(false);
			// Wie am Anmeldefenster des Mac: Neu tippen ersetzt das falsche Passwort (187-09).
			requestAnimationFrame(() => feld.current?.select());
		}
	};

	return (
		// Feste Oberkante: Die Fehlermeldung schiebt nur den Knopf nach unten (187-08).
		<main className="flex min-h-dvh items-start justify-center p-4 pt-[30vh]">
			<Kachel className="w-full max-w-sm">
				<form className="flex flex-col gap-3 p-5" onSubmit={(e) => void absenden(e)}>
					<h1 className="text-2xl font-semibold text-tinte">Schoolbox</h1>
					{/* Safari speichert Passwörter zu einem Benutzernamen; diesen sieht niemand. */}
					<input
						className="sr-only"
						type="text"
						name="username"
						autoComplete="username"
						value="Schoolbox"
						readOnly
						tabIndex={-1}
						aria-hidden="true"
					/>
					<label className="flex flex-col gap-1 font-medium">
						Passwort
						<input
							className={`${FELD_KLASSEN} w-full font-normal`}
							ref={feld}
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
					</label>
					<label className="flex items-start gap-2">
						<input
							className="mt-0.5 size-4 flex-none accent-brand-500"
							type="checkbox"
							checked={bleiben}
							onChange={(e) => setBleiben(e.target.checked)}
						/>
						<span>
							Auf diesem Gerät angemeldet bleiben
							<small className="block text-xs text-leise">Nur an deinem eigenen Mac oder iPad.</small>
						</span>
					</label>
					{fehler && (
						<p className="rounded-md bg-red-50 px-3 py-2 text-fehler" role="alert">
							{fehler}
						</p>
					)}
					<Knopf type="submit" disabled={laeuft || !passwort}>
						{laeuft ? 'Einen Moment …' : 'Anmelden'}
					</Knopf>
				</form>
			</Kachel>
		</main>
	);
};

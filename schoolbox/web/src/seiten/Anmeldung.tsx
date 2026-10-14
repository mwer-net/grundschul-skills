import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { lade, meldung, sende, sichererPfad } from '../api';
import { Kachel } from '../bausteine/Kachel';
import { Knopf } from '../bausteine/Knopf';
import { useTitel } from '../lib/titel';

export const Anmeldung = () => {
	const [parameter] = useSearchParams();
	const weiter = sichererPfad(parameter.get('weiter'));
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
		}
	};

	return (
		<main className="flex min-h-dvh items-center justify-center p-4">
			<Kachel className="w-full max-w-md">
				<form className="flex flex-col gap-4 p-8 max-md:p-5" onSubmit={(e) => void absenden(e)}>
					<h1 className="text-4xl text-brand-600">Schoolbox</h1>
					<p>Schön, dass du da bist! Bitte gib dein Passwort ein.</p>
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
					<label className="flex flex-col gap-1 font-bold">
						Passwort
						<input
							className="min-h-12 rounded-xl border-2 border-rand px-3 font-normal focus:border-brand-500 focus:outline-none"
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
					<label className="flex min-h-12 items-start gap-3">
						<input
							className="mt-1 size-6 flex-none accent-brand-500"
							type="checkbox"
							checked={bleiben}
							onChange={(e) => setBleiben(e.target.checked)}
						/>
						<span>
							Auf diesem Gerät angemeldet bleiben
							<small className="block text-sm text-leise">Nur an deinem eigenen Mac oder iPad.</small>
						</span>
					</label>
					{fehler && (
						<p className="rounded-xl bg-red-50 px-4 py-3 text-fehler" role="alert">
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

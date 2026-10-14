import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { meldung, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { Kachel } from '../bausteine/Kachel';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { melde, useEreignisse } from '../ereignisse';
import { useLaden } from '../lib/laden';
import { datum, FACH_NAME, klasseName, tageBis } from '../lib/text';
import { useTitel } from '../lib/titel';
import type { PapierkorbEintrag } from '../typen';

interface Inhalt {
	eintraege: PapierkorbEintrag[];
	tage: number;
}

const frist = (bis: string) => {
	const tage = tageBis(bis);
	if (tage <= 1) {
		return 'Wird morgen endgültig gelöscht';
	}
	return `Wird in ${tage} Tagen endgültig gelöscht`;
};

export const Papierkorb = () => {
	const { daten, fehler, neuLaden } = useLaden<Inhalt>('/api/papierkorb');
	const [laeuft, setLaeuft] = useState<string | null>(null);
	const navigate = useNavigate();
	const zeige = useHinweis();
	useTitel('Papierkorb');
	useEreignisse(({ typ }) => {
		if (typ === 'mappe-neu' || typ === 'mappe-entfernt' || typ === 'verbunden') {
			neuLaden();
		}
	});

	const stelleWiederHer = async ({ eintrag, id, mappe }: PapierkorbEintrag) => {
		setLaeuft(eintrag);
		try {
			await sende(`/api/papierkorb/${eintrag}/wiederherstellen`);
			melde({ typ: 'mappe-neu', mappe: id });
			zeige({
				text: `„${mappe?.titel ?? id}“ ist wieder bei deinen Mappen.`,
				aktion: { titel: 'Öffnen', ausfuehren: () => void navigate(`/m/${id}`) },
			});
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
			neuLaden();
		} finally {
			setLaeuft(null);
		}
	};

	if (!daten) {
		return fehler ? (
			<Zustand symbol="achtung" titel="Das hat gerade nicht geklappt">
				<p className="text-leise">{fehler.message}</p>
				<Knopf onClick={neuLaden}>Noch einmal versuchen</Knopf>
			</Zustand>
		) : null;
	}

	const { eintraege, tage } = daten;
	return (
		<>
			<KnopfLink to="/" art="leise" className="-ml-5">
				<Symbol name="zurueck" />
				Alle Mappen
			</KnopfLink>
			<h1 className="mt-2 text-3xl max-md:text-2xl">Papierkorb</h1>
			<p className="mt-1 text-leise">
				{`Gelöschte Mappen bleiben ${tage} Tage hier. So lange kannst du sie zurückholen.`}
			</p>
			{eintraege.length === 0 ? (
				<Zustand symbol="papierkorb" titel="Der Papierkorb ist leer" />
			) : (
				<ul className="mt-6 flex max-w-4xl flex-col gap-4">
					{eintraege.map((eintrag) => (
						<li key={eintrag.eintrag}>
							<Kachel className="flex items-center justify-between gap-4 p-5 max-md:flex-col max-md:items-stretch">
								<div>
									<h2 className="text-xl">{eintrag.mappe?.titel ?? eintrag.id}</h2>
									{eintrag.mappe && (
										<p className="text-leise">
											{`${FACH_NAME[eintrag.mappe.fach]} · ${klasseName(eintrag.mappe.klasse)}`}
										</p>
									)}
									<p className="mt-1 text-sm text-leise">
										{`Gelöscht: ${datum(eintrag.geloescht)} · ${frist(eintrag.bis)}`}
									</p>
								</div>
								<Knopf
									art="zweit"
									className="flex-none"
									disabled={laeuft !== null}
									onClick={() => void stelleWiederHer(eintrag)}
								>
									<Symbol name="zurueckholen" />
									Wiederherstellen
								</Knopf>
							</Kachel>
						</li>
					))}
				</ul>
			)}
		</>
	);
};

import { useParams } from 'react-router-dom';

import { Kachel } from '../bausteine/Kachel';
import { KnopfAdresse } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { useLaden } from '../lib/laden';
import { ART_NAME, FACH_NAME, klasseName } from '../lib/text';
import { useTitel } from '../lib/titel';
import type { DokumentMeta, Mappe } from '../typen';

interface Inhalt {
	mappe: Mappe;
	dokumente: { id: string; meta: DokumentMeta }[];
}

/** Vorläufige Seite für Teilen-Links: Titel und Dokumente zum Ansehen. Die eigentliche Ansicht kommt mit 009. */
export const Geteilt = () => {
	const { token = '' } = useParams();
	const { daten, fehler } = useLaden<Inhalt>(`/f/${token}/api/inhalt`);
	useTitel(daten?.mappe.titel);

	if (!daten) {
		return fehler ? (
			<Zustand symbol="achtung" titel="Schade!">
				<p>{fehler.message}</p>
				<p className="text-leise">Bitte frag nach einem neuen Link.</p>
			</Zustand>
		) : null;
	}

	const { dokumente, mappe } = daten;
	const ansicht = (dok: string) => `/f/${token}/ansicht/${mappe.id}/dokumente/${dok}/`;
	return (
		<main className="mx-auto w-full max-w-3xl px-4 py-10 max-md:py-6">
			<h1 className="text-3xl max-md:text-2xl">{mappe.titel}</h1>
			<p className="mt-1 text-leise">{`${FACH_NAME[mappe.fach]} · ${klasseName(mappe.klasse)}`}</p>
			<ul className="mt-6 flex flex-col gap-4">
				{dokumente.map(({ id, meta }) => (
					<li key={id}>
						<Kachel className="flex items-center justify-between gap-4 p-5 max-md:flex-col max-md:items-stretch">
							<div>
								<h2 className="text-xl">{meta.titel}</h2>
								<p className="text-leise">{ART_NAME[meta.art]}</p>
							</div>
							<div className="flex flex-none flex-wrap gap-2">
								<KnopfAdresse href={ansicht(id)}>
									<Symbol name="auge" />
									Ansehen
								</KnopfAdresse>
								{meta.hatLoesung && (
									<KnopfAdresse art="zweit" href={`${ansicht(id)}?loesung=1`}>
										Lösung
									</KnopfAdresse>
								)}
							</div>
						</Kachel>
					</li>
				))}
			</ul>
		</main>
	);
};

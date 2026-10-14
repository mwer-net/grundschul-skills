import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { meldung, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { Marke } from '../bausteine/Kachel';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { melde, useEreignisse } from '../ereignisse';
import { useLaden } from '../lib/laden';
import { datum, FACH_FARBE, FACH_NAME, klasseName } from '../lib/text';
import { useTitel } from '../lib/titel';
import { PdfKnopf } from '../pdf/PdfKnopf';
import { mappenWahl } from '../pdf/wahl';
import { TeilenDialog } from '../teilen/TeilenDialog';
import type { DokumentEintrag, Mappe, MappenEintrag, PapierkorbEintrag } from '../typen';
import { DokumentKachel } from './DokumentKachel';

const ZurUebersicht = () => (
	<KnopfLink to="/" art="leise" className="-ml-5">
		<Symbol name="zurueck" />
		Alle Mappen
	</KnopfLink>
);

export const Mappenansicht = () => {
	const { mappe: id = '' } = useParams();
	const { daten, fehler, neuLaden } = useLaden<MappenEintrag>(`/api/mappen/${id}`);
	const [teilen, setTeilen] = useState<{ dokument?: DokumentEintrag } | null>(null);
	const [laeuft, setLaeuft] = useState(false);
	const navigate = useNavigate();
	const zeige = useHinweis();
	useTitel(daten?.mappe.titel);
	useEreignisse(({ mappe, typ }) => {
		if (typ === 'verbunden' || (mappe === id && typ !== 'pdf-fertig')) {
			neuLaden();
		}
	});

	if (!daten) {
		if (!fehler) {
			return null;
		}
		return fehler.status === 404 ? (
			<Zustand symbol="suche" titel="Diese Mappe gibt es nicht mehr">
				<p className="text-leise">Vielleicht liegt sie im Papierkorb. Dort bleibt sie 30 Tage.</p>
				<div className="flex flex-wrap justify-center gap-2">
					<KnopfLink to="/">Zu meinen Mappen</KnopfLink>
					<KnopfLink to="/papierkorb" art="zweit">
						Im Papierkorb nachsehen
					</KnopfLink>
				</div>
			</Zustand>
		) : (
			<Zustand symbol="achtung" titel="Das hat gerade nicht geklappt">
				<p className="text-leise">{fehler.message}</p>
				<Knopf onClick={neuLaden}>Noch einmal versuchen</Knopf>
			</Zustand>
		);
	}

	const { dokumente, mappe } = daten;
	const zugang = { mappe: mappe.id, token: null };

	const hole = async ({ eintrag }: PapierkorbEintrag) => {
		try {
			await sende(`/api/papierkorb/${eintrag}/wiederherstellen`);
			melde({ typ: 'mappe-neu', mappe: mappe.id });
			zeige({ text: `„${mappe.titel}“ ist wieder da.` });
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
		}
	};

	const loesche = async () => {
		setLaeuft(true);
		try {
			const { eintrag } = await sende<{ eintrag: PapierkorbEintrag }>(`/api/mappen/${mappe.id}/loeschen`);
			void navigate('/');
			zeige({
				text: `„${mappe.titel}“ liegt jetzt im Papierkorb.`,
				aktion: { titel: 'Rückgängig', ausfuehren: () => void hole(eintrag) },
			});
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
			setLaeuft(false);
		}
	};

	const dupliziere = async () => {
		setLaeuft(true);
		try {
			const { mappe: kopie } = await sende<{ mappe: Mappe }>(`/api/mappen/${mappe.id}/duplizieren`);
			melde({ typ: 'mappe-neu', mappe: kopie.id });
			void navigate(`/m/${kopie.id}`);
			zeige({ text: `Das ist jetzt die Kopie: „${kopie.titel}“.` });
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
		} finally {
			setLaeuft(false);
		}
	};

	return (
		<>
			<ZurUebersicht />
			<div className="mt-2 flex items-start justify-between gap-6 max-lg:flex-col max-lg:gap-4">
				<div>
					<h1 className="flex flex-wrap items-center gap-3 text-3xl max-md:text-2xl">
						{mappe.titel}
						{mappe.status === 'entwurf' && <Marke>Entwurf</Marke>}
					</h1>
					<p className="mt-1 flex flex-wrap items-center gap-2 text-leise">
						<span
							className="size-3 flex-none rounded-full"
							style={{ background: FACH_FARBE[mappe.fach] }}
						/>
						{`${FACH_NAME[mappe.fach]} · ${klasseName(mappe.klasse)} · Zuletzt geändert: ${datum(mappe.geaendert)}`}
					</p>
				</div>
				<div className="flex flex-none flex-wrap gap-2">
					{dokumente.length > 0 && (
						<PdfKnopf
							beschriftung="Alles als PDF"
							wahl={mappenWahl(zugang, dokumente)}
							mappe={mappe}
							warnen
							ganzeMappe
						/>
					)}
					<Knopf art="zweit" onClick={() => setTeilen({})}>
						<Symbol name="teilen" />
						Mappe teilen
					</Knopf>
					<Knopf art="zweit" disabled={laeuft} onClick={() => void dupliziere()}>
						<Symbol name="kopieren" />
						Duplizieren
					</Knopf>
					<Knopf art="gefahr" disabled={laeuft} onClick={() => void loesche()}>
						<Symbol name="papierkorb" />
						Löschen
					</Knopf>
				</div>
			</div>
			{dokumente.length === 0 ? (
				<Zustand symbol="blatt" titel="Diese Mappe ist noch leer">
					<p className="text-leise">Schreib Claude, was hinein soll.</p>
				</Zustand>
			) : (
				<ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-6 max-md:gap-4">
					{dokumente.map((dokument) => (
						<DokumentKachel
							key={dokument.id}
							zugang={zugang}
							mappe={mappe}
							dokument={dokument}
							teile={() => setTeilen({ dokument })}
						/>
					))}
				</ul>
			)}
			{teilen && <TeilenDialog mappe={mappe} dokument={teilen.dokument} schliessen={() => setTeilen(null)} />}
		</>
	);
};

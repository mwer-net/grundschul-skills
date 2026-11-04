import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { meldung, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { Marke } from '../bausteine/Kachel';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import { Menue } from '../bausteine/Menue';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { melde, useEreignisse } from '../ereignisse';
import { useLaden } from '../lib/laden';
import { anzahl, datum, FACH_FARBE, FACH_NAME, klasseName } from '../lib/text';
import { useTitel } from '../lib/titel';
import { PdfKnopf } from '../pdf/PdfKnopf';
import { mappenWahl } from '../pdf/wahl';
import { TeilenDialog } from '../teilen/TeilenDialog';
import type { DokumentEintrag, Mappe, MappenEintrag, PapierkorbEintrag } from '../typen';
import { MaterialAnlegen } from './Anlegen';
import { DokumentKachel } from './DokumentKachel';

const ZurUebersicht = () => (
	<KnopfLink to="/" art="leise" className="-ml-2.5 text-leise">
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

	const legeVarianteAn = async (dok: string) => {
		setLaeuft(true);
		try {
			const { titel } = await sende<{ titel: string }>(`/api/mappen/${mappe.id}/dokumente/${dok}/variante`);
			melde({ typ: 'mappe-neu', mappe: mappe.id });
			zeige({ text: `Variante angelegt: „${titel}“.` });
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
		} finally {
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
			<div className="flex items-end justify-between gap-6 max-lg:flex-col max-lg:items-start max-lg:gap-3">
				<div className="min-w-0">
					<h1 className="flex flex-wrap items-center gap-3 text-2xl">
						{mappe.titel}
						{mappe.status === 'entwurf' && <Marke>Entwurf</Marke>}
					</h1>
					<p className="flex flex-wrap items-center gap-2 text-sm text-leise">
						<span className="size-2 flex-none rounded-full" style={{ background: FACH_FARBE[mappe.fach] }} />
						{`${FACH_NAME[mappe.fach]} · ${klasseName(mappe.klasse)} · ${anzahl(dokumente.length, 'Dokument', 'Dokumente')} · ${datum(mappe.geaendert).replace(/^(Heute|Gestern)$/, (t) => t.toLowerCase())} geändert`}
					</p>
				</div>
				<div className="flex flex-none flex-wrap items-center gap-1.5">
					<Knopf art="zweit" aria-label="Mappe teilen" onClick={() => setTeilen({})}>
						<Symbol name="teilen" />
						Teilen
					</Knopf>
					{dokumente.length > 0 && (
						<PdfKnopf
							beschriftung="Alles als PDF"
							wahl={mappenWahl(zugang, dokumente)}
							mappe={mappe}
							warnen
							ganzeMappe
						/>
					)}
					<Menue
						name="Mappe: weitere Aktionen"
						rechtsbuendig
						disabled={laeuft}
						ausloeser={
							<Knopf art="zweit" className="size-knopf px-0">
								<Symbol name="mehr" />
							</Knopf>
						}
						eintraege={[
							{ titel: 'Duplizieren', symbol: 'duplizieren', waehle: () => void dupliziere() },
							{ titel: 'Löschen', symbol: 'papierkorb', gefahr: true, waehle: () => void loesche() },
						]}
					/>
					<MaterialAnlegen mappe={mappe.id} />
				</div>
			</div>
			{dokumente.length === 0 ? (
				<Zustand symbol="blatt" titel="Diese Mappe ist noch leer">
					<p className="text-leise">Schreib Claude, was hinein soll.</p>
				</Zustand>
			) : (
				<ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
					{dokumente.map((dokument) => (
						<DokumentKachel
							key={dokument.id}
							zugang={zugang}
							mappe={mappe}
							dokument={dokument}
							teile={() => setTeilen({ dokument })}
							variante={laeuft ? undefined : () => void legeVarianteAn(dokument.id)}
						/>
					))}
				</ul>
			)}
			{teilen && <TeilenDialog mappe={mappe} dokument={teilen.dokument} schliessen={() => setTeilen(null)} />}
		</>
	);
};

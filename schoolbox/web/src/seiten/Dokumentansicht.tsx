import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Blattansicht } from '../bausteine/Blattansicht';
import { Chip } from '../bausteine/Chip';
import { useHinweis } from '../bausteine/hinweis';
import { Marke } from '../bausteine/Kachel';
import { Knopf, KnopfAdresse, KnopfLink } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { hatOffeneEntwuerfe } from '../entwuerfe/offen';
import { ClaudeHinweis } from '../entwuerfe/Teile';
import { useEreignisse } from '../ereignisse';
import { useLaden } from '../lib/laden';
import { anzahl, ART_NAME, FORMAT_NAME } from '../lib/text';
import { useTitel } from '../lib/titel';
import type { Zugang } from '../lib/zugang';
import {
	ansichtAdresse,
	druckSeite,
	entwuerfeSeite,
	inhaltAdresse,
	istGeteilt,
	mappenSeite,
	praesentationSeite,
} from '../lib/zugang';
import { PdfKnopf } from '../pdf/PdfKnopf';
import { dokumentWahl, materialName } from '../pdf/wahl';
import { TeilenDialog } from '../teilen/TeilenDialog';
import type { DokumentEintrag, Mappe, MappenEintrag } from '../typen';

interface Eigenschaften {
	zugang: Zugang;
	dok: string;
	/** Link zurück zur Mappe; nicht bei einem Teilen-Link auf genau dieses Dokument. */
	zurueckZurMappe: boolean;
}

const Druckhinweise = ({ liste }: { liste: string[] }) => (
	<div className="mt-4 flex items-start gap-3 rounded-2xl border-2 border-entwurf bg-[#fff8e1] px-5 py-3">
		<Symbol name="drucker" className="mt-0.5 size-6 flex-none" />
		<div>
			<h2 className="sr-only">Druckhinweise</h2>
			<ul className="flex flex-col gap-1 font-bold">
				{liste.map((hinweis) => (
					<li key={hinweis}>{hinweis}</li>
				))}
			</ul>
		</div>
	</div>
);

interface KnoepfeEigenschaften {
	zugang: Zugang;
	dokument: DokumentEintrag;
	mappe: Mappe;
	loesung: boolean;
	/** Es gibt Entwürfe, und die Lehrkraft darf sie sehen (kein Teilen-Link). */
	entwuerfe: boolean;
	teilen: () => void;
}

/** Was sich mit dem Dokument tun lässt. Bei Folien ist Präsentieren das Wichtigste; PDF und Drucken treten zurück. */
const Knoepfe = ({ dokument, entwuerfe, loesung, mappe, teilen, zugang }: KnoepfeEigenschaften) => {
	const { id: dok, meta } = dokument;
	const geteilt = istGeteilt(zugang);
	const praesentieren = meta.format === 'folie' && !(entwuerfe && hatOffeneEntwuerfe(meta));
	return (
		<div className="ml-auto flex flex-wrap gap-2 max-md:ml-0">
			{entwuerfe && (
				<KnopfLink to={entwuerfeSeite(zugang, dok)} art="zweit">
					<Symbol name="kopieren" />
					Entwürfe
				</KnopfLink>
			)}
			{praesentieren && (
				<KnopfLink to={praesentationSeite(zugang, dok)}>
					<Symbol name="praesentieren" />
					Präsentieren
				</KnopfLink>
			)}
			<PdfKnopf
				art={praesentieren ? 'zweit' : 'haupt'}
				beschriftung="PDF herunterladen"
				wahl={dokumentWahl(zugang, dokument)}
				mappe={mappe}
				warnen={!geteilt}
				rechtsbuendig
			/>
			<KnopfAdresse
				art="zweit"
				href={druckSeite(zugang, dok, loesung ? 'loesung' : 'arbeitsblatt')}
				target="_blank"
				rel="noopener"
			>
				<Symbol name="drucker" />
				Drucken
			</KnopfAdresse>
			{!geteilt && (
				<Knopf art="zweit" onClick={teilen}>
					<Symbol name="teilen" />
					Teilen
				</Knopf>
			)}
		</div>
	);
};

/**
 * Ein Dokument ansehen, als PDF herunterladen, drucken und teilen; für die Lehrkraft und genauso hinter Teilen-Links.
 * Ändert Claude das Material, lädt die Ansicht von selbst neu.
 */
export const Dokumentansicht = ({ dok, zugang, zurueckZurMappe }: Eigenschaften) => {
	const geteilt = istGeteilt(zugang);
	const { daten, fehler, neuLaden } = useLaden<MappenEintrag>(inhaltAdresse(zugang));
	const [suche, setSuche] = useSearchParams();
	const [stand, setStand] = useState(0);
	const [teilen, setTeilen] = useState(false);
	const zeige = useHinweis();
	const dokument = daten?.dokumente.find((d) => d.id === dok);
	useTitel(dokument?.meta.titel);

	useEreignisse(({ dok: geaendert, mappe, typ, wieder }) => {
		if (typ === 'dokument-geaendert' && mappe === zugang.mappe && geaendert === dok) {
			setStand((n) => n + 1);
			neuLaden();
			zeige({ text: 'Aktualisiert: Das Material wurde gerade geändert.' });
		} else if ((typ === 'verbunden' && wieder) || (typ === 'mappe-entfernt' && mappe === zugang.mappe)) {
			// Während die Verbindung weg war, kann sich etwas geändert haben.
			setStand((n) => n + 1);
			neuLaden();
		}
	}, !geteilt);

	if (!daten || !dokument) {
		if (!fehler && !daten) {
			return null;
		}
		return (
			<Zustand symbol="suche" titel="Dieses Dokument gibt es nicht mehr">
				<p className="text-leise">
					{fehler && fehler.status !== 404 ? fehler.message : 'Vielleicht wurde es gelöscht.'}
				</p>
				{!geteilt && <KnopfLink to="/">Zu meinen Mappen</KnopfLink>}
			</Zustand>
		);
	}

	const { mappe } = daten;
	const { meta } = dokument;
	const loesung = meta.hatLoesung && suche.get('fassung') === 'loesung';
	const entwuerfe = !geteilt && meta.entwuerfe.length > 0;
	const zeigeLoesung = (ja: boolean) => setSuche(ja ? { fassung: 'loesung' } : {}, { replace: true });

	return (
		<>
			{zurueckZurMappe && (
				<KnopfLink to={mappenSeite(zugang)} art="leise" className="-ml-5">
					<Symbol name="zurueck" />
					{mappe.titel}
				</KnopfLink>
			)}
			<h1 className="mt-2 flex flex-wrap items-center gap-3 text-3xl max-md:text-2xl">
				{meta.titel}
				{meta.status === 'entwurf' && <Marke>Entwurf</Marke>}
			</h1>
			<p className="mt-1 text-leise">
				{[
					ART_NAME[meta.art],
					FORMAT_NAME[meta.format],
					...(meta.seiten > 0 ? [anzahl(meta.seiten, 'Seite', 'Seiten')] : []),
				].join(' · ')}
			</p>

			<div className="sticky top-[var(--kopf,0px)] z-20 -mx-8 mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 bg-papier/95 px-8 py-3 backdrop-blur max-lg:-mx-4 max-lg:px-4">
				{meta.hatLoesung && (
					<div role="group" aria-label="Was zeigen?" className="flex gap-2">
						<Chip titel={materialName(dokument)} aktiv={!loesung} waehle={() => zeigeLoesung(false)} />
						<Chip titel="Lösung" aktiv={loesung} waehle={() => zeigeLoesung(true)} />
					</div>
				)}
				<Knoepfe
					zugang={zugang}
					dokument={dokument}
					mappe={mappe}
					loesung={loesung}
					entwuerfe={entwuerfe}
					teilen={() => setTeilen(true)}
				/>
			</div>

			{entwuerfe && hatOffeneEntwuerfe(meta) && (
				<div className="mt-4" data-entwuerfe-offen>
					<ClaudeHinweis>
						<p className="text-leise">
							{`Für dieses Material gibt es ${meta.entwuerfe.length === 1 ? 'einen Entwurf' : `${meta.entwuerfe.length} Entwürfe`}. Sobald Claude deine Wahl übernommen hat, steht es hier.`}
						</p>
						<KnopfLink to={entwuerfeSeite(zugang, dok)} className="mt-2">
							Entwürfe vergleichen
							<Symbol name="weiter" />
						</KnopfLink>
					</ClaudeHinweis>
				</div>
			)}
			{meta.druckhinweise.length > 0 && <Druckhinweise liste={meta.druckhinweise} />}
			<div className="mt-4">
				<Blattansicht
					adresse={ansichtAdresse(zugang, dok, loesung)}
					stand={stand}
					titel={loesung ? `${meta.titel} (Lösung)` : meta.titel}
				/>
			</div>
			{teilen && <TeilenDialog mappe={mappe} dokument={dokument} schliessen={() => setTeilen(false)} />}
		</>
	);
};

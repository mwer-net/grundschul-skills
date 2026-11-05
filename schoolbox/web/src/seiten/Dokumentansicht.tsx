import type { Druckprofil } from '@schoolbox/kern/src/werte';
import { useContext, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { ApiFehler } from '../api';
import { Blattansicht } from '../bausteine/Blattansicht';
import { useHinweis } from '../bausteine/hinweis';
import { Marke } from '../bausteine/Kachel';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import type { MenueEintrag } from '../bausteine/Menue';
import { Menue } from '../bausteine/Menue';
import { ProfilSchalter } from '../bausteine/ProfilSchalter';
import { Segment } from '../bausteine/Segment';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { ChatStandKontext, useChat } from '../editor/chat-kontext';
import { hatOffeneEntwuerfe } from '../entwuerfe/offen';
import { ClaudeHinweis } from '../entwuerfe/Teile';
import { useEreignisse } from '../ereignisse';
import { useInhalt } from '../lib/inhalt';
import { useAnsichtsProfil } from '../lib/profil';
import { anzahl, ART_NAME, FORMAT_NAME } from '../lib/text';
import { useTitel } from '../lib/titel';
import type { Zugang } from '../lib/zugang';
import {
	ansichtAdresse,
	druckSeite,
	editorSeite,
	entwuerfeSeite,
	istGeteilt,
	mappenSeite,
	praesentationSeite,
} from '../lib/zugang';
import { useOrdnerDesDokuments } from '../ordner/kontext';
import { PdfKnopf } from '../pdf/PdfKnopf';
import { pdfEintrag, usePdf } from '../pdf/usePdf';
import { dokumentWahl, folienWahl, materialName } from '../pdf/wahl';
import { TeilenDialog } from '../teilen/TeilenDialog';
import type { DokumentEintrag, Mappe } from '../typen';

interface Eigenschaften {
	zugang: Zugang;
	dok: string;
	/** Link zurück zur Mappe; nicht bei einem Teilen-Link auf genau dieses Dokument. */
	zurueckZurMappe: boolean;
}

const MEHR_KNOPF = (
	<Knopf art="zweit" className="size-knopf px-0">
		<Symbol name="mehr" />
	</Knopf>
);

const Druckhinweise = ({ liste }: { liste: string[] }) => (
	<div className="mt-3 flex items-start gap-3 rounded-lg border border-entwurf bg-warnung-hell px-4 py-2">
		<Symbol name="drucker" className="mt-0.5 size-4 flex-none" />
		<div>
			<h2 className="sr-only">Druckhinweise</h2>
			<ul className="flex flex-col gap-1 font-medium">
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
	profil: Druckprofil | undefined;
	/** Es gibt Entwürfe, und die Lehrkraft darf sie sehen (kein Teilen-Link). */
	entwuerfe: boolean;
	teilen: () => void;
}

/** Was sich mit dem Dokument tun lässt. Bei Folien ist Präsentieren das Wichtigste, sonst Bearbeiten. */
const Knoepfe = ({ dokument, entwuerfe, loesung, mappe, profil, teilen, zugang }: KnoepfeEigenschaften) => {
	const { id: dok, meta } = dokument;
	const geteilt = istGeteilt(zugang);
	const offen = entwuerfe && hatOffeneEntwuerfe(meta);
	const praesentieren = meta.format === 'folie' && !offen;
	const navigate = useNavigate();
	const zeige = useHinweis();
	const ohneInternet = usePdf({ mappe, warnen: !geteilt });
	const chat = useChat();
	const chatStand = useContext(ChatStandKontext);
	const eintraege: MenueEintrag[] = [
		...(entwuerfe
			? [
					{
						titel: 'Entwürfe',
						symbol: 'kopieren' as const,
						waehle: () => void navigate(entwuerfeSeite(zugang, dok)),
					},
				]
			: []),
		...(praesentieren
			? [
					pdfEintrag(
						ohneInternet.laeuft ? 'Wird erstellt …' : 'Ohne Internet',
						'herunterladen',
						folienWahl(zugang, dokument),
						(w) => void ohneInternet.hole(w),
						() => zeige({ text: 'Wird erstellt …' }),
					),
				]
			: []),
		{
			titel: 'Drucken',
			symbol: 'drucker',
			waehle: () => {
				window.open(druckSeite(zugang, dok, loesung ? 'loesung' : 'arbeitsblatt', profil), '_blank');
			},
		},
		...(geteilt ? [] : [{ titel: 'Teilen', symbol: 'teilen' as const, waehle: teilen }]),
		...(geteilt ? [] : [{ titel: 'Hilfe', symbol: 'hilfe' as const, waehle: () => void navigate('/hilfe') }]),
	];
	return (
		<div className="ml-auto flex flex-none flex-wrap items-center gap-1.5 max-md:ml-0">
			{!geteilt && chatStand?.ki.zustand.verfuegbar && (
				<Knopf
					art="leise"
					aria-label="Claude"
					aria-pressed={chatStand.fenster !== 'zu'}
					className="aria-pressed:bg-flaeche-2"
					onClick={() => chat.wechsle()}
				>
					<Symbol name="sprechblase" />
					Claude
				</Knopf>
			)}
			{!geteilt && !offen && (
				<KnopfLink to={editorSeite(zugang, dok)} art={praesentieren ? 'zweit' : 'haupt'}>
					<Symbol name="stift" />
					Bearbeiten
				</KnopfLink>
			)}
			{praesentieren && (
				<KnopfLink to={praesentationSeite(zugang, dok)}>
					<Symbol name="praesentieren" />
					Präsentieren
				</KnopfLink>
			)}
			<PdfKnopf
				art={geteilt && !praesentieren ? 'haupt' : 'zweit'}
				beschriftung="PDF"
				wahl={dokumentWahl(zugang, dokument, profil)}
				mappe={mappe}
				warnen={!geteilt}
				rechtsbuendig
			/>
			<Menue name="Weitere Aktionen" rechtsbuendig eintraege={eintraege} ausloeser={MEHR_KNOPF} />
			{ohneInternet.dialog}
		</div>
	);
};

const EntwuerfeOffen = ({ adresse, anzahlEntwuerfe }: { adresse: string; anzahlEntwuerfe: number }) => (
	<div className="mt-4" data-entwuerfe-offen>
		<ClaudeHinweis>
			<p className="text-leise">
				{`Für dieses Material gibt es ${anzahlEntwuerfe === 1 ? 'einen Entwurf' : `${anzahlEntwuerfe} Entwürfe`}. Sobald Claude deine Wahl übernommen hat, steht es hier.`}
			</p>
			<KnopfLink to={adresse} className="mt-2">
				Entwürfe vergleichen
				<Symbol name="weiter" />
			</KnopfLink>
		</ClaudeHinweis>
	</div>
);

const DokumentFehlt = ({ fehler, geteilt }: { fehler: ApiFehler | null; geteilt: boolean }) => (
	<Zustand symbol="suche" titel="Dieses Dokument gibt es nicht mehr">
		<p className="text-leise">
			{fehler && fehler.status !== 404 ? fehler.message : 'Vielleicht wurde es gelöscht.'}
		</p>
		{!geteilt && <KnopfLink to="/">Zu meinem Material</KnopfLink>}
	</Zustand>
);

/**
 * Ein Dokument ansehen, als PDF herunterladen, drucken und teilen; für die Lehrkraft und genauso hinter Teilen-Links.
 * Ändert Claude das Material, lädt die Ansicht von selbst neu.
 */
export const Dokumentansicht = ({ dok, zugang, zurueckZurMappe }: Eigenschaften) => {
	const geteilt = istGeteilt(zugang);
	const { daten, fehler, neuLaden } = useInhalt(zugang);
	const [suche, setSuche] = useSearchParams();
	const [stand, setStand] = useState(0);
	const [teilen, setTeilen] = useState(false);
	const zeige = useHinweis();
	const dokument = daten?.dokumente.find((d) => d.id === dok);
	const zurueckOrt = useOrdnerDesDokuments(geteilt ? null : zugang.mappe, dok);
	useTitel(dokument?.meta.titel);
	const ansicht = useAnsichtsProfil(zugang, dok, dokument?.meta);

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
		return <DokumentFehlt fehler={fehler} geteilt={geteilt} />;
	}

	const { mappe } = daten;
	const { meta } = dokument;
	const loesung = meta.hatLoesung && suche.get('fassung') === 'loesung';
	const entwuerfe = !geteilt && meta.entwuerfe.length > 0;
	const zeigeLoesung = (ja: boolean) => setSuche(ja ? { fassung: 'loesung' } : {}, { replace: true });
	const { profil } = ansicht;

	return (
		<>
			<div className="sticky top-[var(--kopf,0px)] z-kopf -mx-4 flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b border-rand bg-flaeche px-4 py-0.5">
				<div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
					{zurueckZurMappe && (
						<>
							<KnopfLink
								to={zurueckOrt ? zurueckOrt.adresse : mappenSeite(zugang)}
								art="leise"
								className="-ml-2.5 max-w-52 min-w-0 flex-none text-leise"
							>
								<Symbol name="zurueck" />
								<span className="truncate">{zurueckOrt ? zurueckOrt.name : mappe.titel}</span>
							</KnopfLink>
							<span aria-hidden className="text-dezent">
								/
							</span>
						</>
					)}
					<h1 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
						<span className="truncate">{meta.titel}</span>
						{meta.status === 'entwurf' && <Marke>Entwurf</Marke>}
					</h1>
					<p className="ml-1 truncate text-xs text-leise max-lg:hidden">
						{[
							ART_NAME[meta.art],
							FORMAT_NAME[meta.format],
							...(meta.seiten > 0 ? [anzahl(meta.seiten, 'Seite', 'Seiten')] : []),
						].join(' · ')}
					</p>
				</div>
				<div className="flex flex-none items-center gap-1.5">
					{meta.hatLoesung && (
						<Segment
							beschriftung="Was zeigen?"
							werte={[
								{ wert: 'material', titel: materialName(dokument) },
								{ wert: 'loesung', titel: 'Lösung' },
							]}
							wert={loesung ? 'loesung' : 'material'}
							waehle={(w) => zeigeLoesung(w === 'loesung')}
						/>
					)}
					<ProfilSchalter profil={profil} waehle={ansicht.waehle} />
				</div>
				<Knoepfe
					zugang={zugang}
					dokument={dokument}
					mappe={mappe}
					loesung={loesung}
					profil={profil}
					entwuerfe={entwuerfe}
					teilen={() => setTeilen(true)}
				/>
			</div>

			{entwuerfe && hatOffeneEntwuerfe(meta) && (
				<EntwuerfeOffen anzahlEntwuerfe={meta.entwuerfe.length} adresse={entwuerfeSeite(zugang, dok)} />
			)}
			{meta.druckhinweise.length > 0 && <Druckhinweise liste={meta.druckhinweise} />}
			<div className="mt-2">
				<Blattansicht
					adresse={ansichtAdresse(zugang, dok, loesung, profil)}
					stand={stand}
					titel={loesung ? `${meta.titel} (Lösung)` : meta.titel}
				/>
			</div>
			{teilen && <TeilenDialog mappe={mappe} dokument={dokument} schliessen={() => setTeilen(false)} />}
		</>
	);
};

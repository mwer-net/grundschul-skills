import type { ReactNode } from 'react';
import { useState } from 'react';

import { meldung, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { useEreignisse } from '../ereignisse';
import { useLaden } from '../lib/laden';
import { anzahl, datum, tageBis } from '../lib/text';
import type { PapierkorbEintrag } from '../typen';
import { useAblage } from './kontext';
import { WURZEL_NAME } from './objekte';
import type { Knoten } from './typen';

interface KorbObjekt {
	knoten: Knoten;
	name: string;
	geloescht: { zeit: string; herkunft: string[] };
	bis: string;
	objekte?: number;
	art?: string;
}

interface Inhalt {
	eintraege: PapierkorbEintrag[];
	objekte: KorbObjekt[];
	tage: number;
}

const frist = (bis: string) => {
	const tage = tageBis(bis);
	return tage <= 1 ? 'Noch 1 Tag' : `Noch ${tage} Tage`;
};

const RASTER = 'grid grid-cols-[minmax(0,1fr)_minmax(0,14rem)_6rem_6rem_auto] items-center gap-3 px-1';

const Zeile = ({
	bis,
	geloescht,
	herkunft,
	kopf,
	symbol,
	titel,
	unter,
}: {
	bis: string;
	geloescht: string;
	herkunft: string;
	kopf: ReactNode;
	symbol: 'ordner' | 'blatt';
	titel: string;
	unter?: string;
}) => (
	<li className={`${RASTER} min-h-[var(--hoehe-listenzeile)] rounded-md py-0.5 text-sm hover:bg-flaeche-2`} data-korb-eintrag={titel}>
		<span className="flex min-w-0 items-center gap-1.5">
			<Symbol name={symbol} className="size-3.5 flex-none text-leise" />
			<span className="truncate">{titel}</span>
			{unter && <span className="flex-none text-xs text-leise">{unter}</span>}
		</span>
		<span className="truncate text-xs text-leise">{herkunft}</span>
		<span className="truncate text-xs text-leise">{datum(geloescht)}</span>
		<span className="truncate text-xs text-leise">{frist(bis)}</span>
		{kopf}
	</li>
);

/** Löschen fragt nicht nach: Dafür liegt hier alles noch 30 Tage. */
export const PapierkorbSeite = () => {
	const { daten, fehler, neuLaden } = useLaden<Inhalt>('/api/papierkorb');
	const { neuLaden: ablageLaden, tu } = useAblage();
	const zeige = useHinweis();
	const [laeuft, setLaeuft] = useState<string | null>(null);
	useEreignisse(({ typ }) => {
		if (typ !== 'pdf-fertig' && typ !== 'ki-stand') {
			neuLaden();
		}
	});

	if (!daten) {
		return fehler ? (
			<Zustand symbol="achtung" titel="Das hat gerade nicht geklappt">
				<p className="text-leise">{fehler.message}</p>
				<Knopf onClick={neuLaden}>Noch einmal versuchen</Knopf>
			</Zustand>
		) : null;
	}
	const { eintraege, objekte, tage } = daten;
	if (eintraege.length === 0 && objekte.length === 0) {
		return (
			<Zustand symbol="papierkorb" titel="Der Papierkorb ist leer">
				<p className="text-leise">{`Was du löschst, bleibt hier ${tage} Tage.`}</p>
			</Zustand>
		);
	}

	const legeZurueck = async (o: KorbObjekt, schluessel: string) => {
		setLaeuft(schluessel);
		await tu(
			{ art: 'zuruecklegen', knoten: [o.knoten] },
			{ text: () => `„${o.name}“ ist wieder da.` },
		);
		setLaeuft(null);
		neuLaden();
	};
	const holeAlten = async (e: PapierkorbEintrag) => {
		setLaeuft(e.eintrag);
		try {
			await sende(`/api/papierkorb/${e.eintrag}/wiederherstellen`);
			zeige({ text: `„${e.mappe?.titel ?? e.id}“ ist wieder da.` });
			ablageLaden();
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
		} finally {
			setLaeuft(null);
			neuLaden();
		}
	};
	const zurueck = (schluessel: string, titel: string, wirkung: () => void) => (
		<Knopf
			art="leise"
			groesse="klein"
			aria-label={`${titel} wiederherstellen`}
			disabled={laeuft !== null && laeuft !== schluessel}
			onClick={wirkung}
		>
			<Symbol name="zurueckholen" />
			Wiederherstellen
		</Knopf>
	);

	return (
		<div data-papierkorb>
			<p className="mb-2 text-sm text-leise">{`Was du löschst, bleibt hier ${tage} Tage. So lange kannst du es zurückholen.`}</p>
			<div className={`${RASTER} h-6 border-b border-rand text-xs font-medium text-leise`}>
				<span>Name</span>
				<span>Ursprünglich in</span>
				<span>Gelöscht</span>
				<span>Frist</span>
				<span className="w-36" />
			</div>
			<ul>
				{objekte.map((o) => {
					const schluessel = 'ordner' in o.knoten ? o.knoten.ordner : `${o.knoten.mappe}/${o.knoten.dok}`;
					return (
						<Zeile
							key={schluessel}
							titel={o.name}
							symbol={'ordner' in o.knoten ? 'ordner' : 'blatt'}
							{...(o.objekte === undefined ? {} : { unter: anzahl(o.objekte, 'Objekt', 'Objekte').replace('Ein Objekt', '1 Objekt') })}
							herkunft={[WURZEL_NAME, ...o.geloescht.herkunft].join(' › ')}
							geloescht={o.geloescht.zeit}
							bis={o.bis}
							kopf={zurueck(schluessel, o.name, () => void legeZurueck(o, schluessel))}
						/>
					);
				})}
				{eintraege.map((e) => (
					<Zeile
						key={e.eintrag}
						titel={e.mappe?.titel ?? e.id}
						symbol="ordner"
						herkunft={WURZEL_NAME}
						geloescht={e.geloescht}
						bis={e.bis}
						kopf={zurueck(e.eintrag, e.mappe?.titel ?? e.id, () => void holeAlten(e))}
					/>
				))}
			</ul>
		</div>
	);
};

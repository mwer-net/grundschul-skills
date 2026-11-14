import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { meldung, sende } from '../api';
import { Dialog } from '../bausteine/Dialog';
import { FELD_KLASSEN, klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { useLaden } from '../lib/laden';
import { datum } from '../lib/text';
import type { DokumentEintrag, Freigabe, Mappe } from '../typen';

interface DokumentZiel {
	mappe: Pick<Mappe, 'id' | 'titel'>;
	dokument: Pick<DokumentEintrag, 'id' | 'meta'>;
}
/** Ein Ordner-Link zeigt, was jetzt darin liegt, mit Unterordnern (079). */
interface OrdnerZiel {
	ordner: { id: string; name: string };
}
type Eigenschaften = { schliessen: () => void } & (DokumentZiel | OrdnerZiel);

const adresse = ({ pfad, url }: Freigabe) => url ?? `${window.location.origin}${pfad}`;
const kannSenden = typeof navigator.share === 'function';

/** Der Fokus folgt der Handlung (191-06, 191-07): auf die Hauptaktion des Dialogs, nie auf `body`. */
const fokussiereHauptaktion = () =>
	document.querySelector<HTMLElement>('dialog[open] [data-hauptaktion]:not(:disabled)')?.focus();

interface ZeileEigenschaften {
	freigabe: Freigabe;
	titel: string;
	/** „den Ordner“ oder „das Material“ (191-28). */
	was: string;
	/** Die erste Zeile trägt die Hauptaktion: Enter kopiert ihren Link. */
	erste: boolean;
	gesperrt: boolean;
	widerrufe: () => void;
}

const LinkZeile = ({ erste, freigabe, gesperrt, titel, was, widerrufe }: ZeileEigenschaften) => {
	const feld = useRef<HTMLInputElement>(null);
	const abschalten = useRef<HTMLButtonElement>(null);
	const dochNicht = useRef<HTMLButtonElement>(null);
	const [kopiert, setKopiert] = useState<'ja' | 'markiert' | null>(null);
	const [frage, setFrage] = useState<boolean | null>(null);
	const link = adresse(freigabe);

	// Nach „Abschalten“ auf „Doch nicht“, danach zurück auf „Abschalten“ (191-07).
	useEffect(() => {
		if (frage === true) {
			dochNicht.current?.focus();
		} else if (frage === false) {
			abschalten.current?.focus();
		}
	}, [frage]);

	// Esc schließt nur die Nachfrage, nicht den ganzen Dialog (191-08).
	const tasteInFrage = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			setFrage(false);
		}
	};

	const kopiere = async () => {
		try {
			await navigator.clipboard.writeText(link);
			setKopiert('ja');
		} catch {
			// Ohne Zugriff auf die Zwischenablage bleibt der Link markiert, zum Kopieren von Hand
			feld.current?.focus();
			feld.current?.select();
			setKopiert('markiert');
		}
		setTimeout(() => setKopiert(null), 4000);
	};

	const sendeWeiter = () => {
		navigator.share({ title: titel, url: link }).catch(() => undefined);
	};

	return (
		<li className="flex flex-col gap-3 rounded-xl border border-rand p-4" data-freigabe={freigabe.token}>
			<input
				ref={feld}
				className={klassen(FELD_KLASSEN, 'select-text')}
				type="text"
				readOnly
				aria-label="Link zum Teilen"
				value={link}
				onFocus={(e) => e.target.select()}
			/>
			{frage ? (
				<div className="flex flex-col gap-3" role="alert" onKeyDown={tasteInFrage}>
					<p>{`Wer diesen Link hat, kann ${was} dann nicht mehr öffnen. Wirklich abschalten?`}</p>
					{/* Rechts, wo „Abschalten“ stand, und in dessen Farbe (191-09). */}
					<div className="flex flex-wrap justify-end gap-2">
						<Knopf ref={dochNicht} art="zweit" onClick={() => setFrage(false)}>
							Doch nicht
						</Knopf>
						<Knopf art="gefahr" disabled={gesperrt} onClick={widerrufe}>
							Ja, abschalten
						</Knopf>
					</div>
				</div>
			) : (
				<div className="flex flex-wrap items-center gap-2">
					<Knopf data-hauptaktion={erste ? '' : undefined} onClick={() => void kopiere()}>
						<Symbol name={kopiert === 'ja' ? 'haken' : 'kopieren'} />
						{kopiert === 'ja' ? 'Kopiert' : 'Link kopieren'}
					</Knopf>
					{kannSenden && (
						<Knopf art="zweit" onClick={sendeWeiter}>
							<Symbol name="teilen" />
							Senden
						</Knopf>
					)}
					<Knopf ref={abschalten} art="gefahr" className="ml-auto" onClick={() => setFrage(true)}>
						Abschalten
					</Knopf>
				</div>
			)}
			<p className="text-sm text-leise" aria-live="polite">
				{kopiert === 'markiert'
					? 'Der Link ist markiert. Du kannst ihn jetzt kopieren.'
					: `Erstellt: ${datum(freigabe.erstellt)}`}
			</p>
		</li>
	);
};

/** Links zum Ansehen ohne Anmeldung: anlegen, kopieren, weitergeben und wieder abschalten. */
export const TeilenDialog = (e: Eigenschaften) => {
	const { schliessen } = e;
	const imOrdner = 'ordner' in e;
	const titel = imOrdner ? e.ordner.name : e.dokument.meta.titel;
	const ziel = imOrdner ? { ordner: e.ordner.id } : { mappe: e.mappe.id, dok: e.dokument.id };
	const { daten, fehler, neuLaden } = useLaden<{ freigaben: Freigabe[] }>(
		imOrdner ? `/api/freigaben?ordner=${e.ordner.id}` : `/api/freigaben?mappe=${e.mappe.id}&dok=${e.dokument.id}`,
	);
	const [laeuft, setLaeuft] = useState(false);
	const [panne, setPanne] = useState<string | null>(null);
	// Nach dem Laden und nach jeder Aktion springt der Fokus auf die Hauptaktion, sobald die neue Liste steht.
	const [fokusDanach, setFokusDanach] = useState(true);
	useEffect(() => {
		if (daten && fokusDanach && !laeuft) {
			fokussiereHauptaktion();
			setFokusDanach(false);
		}
	}, [daten, fokusDanach, laeuft]);

	const fuehreAus = async (schritt: () => Promise<unknown>) => {
		setLaeuft(true);
		setPanne(null);
		try {
			await schritt();
		} catch (grund) {
			setPanne(meldung(grund));
		} finally {
			neuLaden();
			setFokusDanach(true);
			setLaeuft(false);
		}
	};
	const erstelle = () => fuehreAus(() => sende('/api/freigaben', ziel));
	const widerrufe = (token: string) => fuehreAus(() => sende(`/api/freigaben/${token}/widerrufen`));

	const aktive = (daten?.freigaben ?? [])
		.filter((f) => f.widerrufen === null && (imOrdner || ('dok' in f.ziel && f.ziel.dok === e.dokument.id)))
		.sort((a, b) => b.erstellt.localeCompare(a.erstellt));
	const meldungText = panne ?? fehler?.message;
	const umfang = imOrdner ? 'alles in diesem Ordner, auch in den Unterordnern,' : 'dieses Material';

	return (
		<Dialog titel={`„${titel}“ teilen`} schliessen={schliessen}>
			<p>{`Wer den Link hat, kann ${umfang} ansehen, ohne sich anzumelden – zum Beispiel eine Kollegin.`}</p>
			<p className="-mt-2">Ändern lässt sich darüber nichts.</p>
			{meldungText && (
				<p className="rounded-xl bg-red-50 px-4 py-3 text-fehler" role="alert">
					{meldungText}
				</p>
			)}
			{aktive.length > 0 && (
				<ul className="flex flex-col gap-3">
					{aktive.map((freigabe, nr) => (
						<LinkZeile
							key={freigabe.token}
							freigabe={freigabe}
							titel={titel}
							was={imOrdner ? 'den Ordner' : 'das Material'}
							erste={nr === 0}
							gesperrt={laeuft}
							widerrufe={() => void widerrufe(freigabe.token)}
						/>
					))}
				</ul>
			)}
			{/* Ein Link je Material oder Ordner (191-44): Wer jemanden ausschließen will, schaltet ab und erstellt neu. */}
			{daten && aktive.length === 0 && (
				<div>
					<Knopf data-hauptaktion disabled={laeuft} onClick={() => void erstelle()}>
						<Symbol name="plus" />
						Link erstellen
					</Knopf>
				</div>
			)}
		</Dialog>
	);
};

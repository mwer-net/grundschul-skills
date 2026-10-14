import { useRef, useState } from 'react';

import { meldung, sende } from '../api';
import { Dialog } from '../bausteine/Dialog';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { useLaden } from '../lib/laden';
import { datum } from '../lib/text';
import type { DokumentEintrag, Freigabe, Mappe } from '../typen';

interface Eigenschaften {
	mappe: Mappe;
	/** Fehlt es, gilt der Link für die ganze Mappe. */
	dokument?: DokumentEintrag;
	schliessen: () => void;
}

const adresse = ({ pfad, url }: Freigabe) => url ?? `${window.location.origin}${pfad}`;
const kannSenden = typeof navigator.share === 'function';

interface ZeileEigenschaften {
	freigabe: Freigabe;
	titel: string;
	gesperrt: boolean;
	widerrufe: () => void;
}

const LinkZeile = ({ freigabe, gesperrt, titel, widerrufe }: ZeileEigenschaften) => {
	const feld = useRef<HTMLInputElement>(null);
	const [kopiert, setKopiert] = useState<'ja' | 'markiert' | null>(null);
	const [frage, setFrage] = useState(false);
	const link = adresse(freigabe);

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
		<li className="flex flex-col gap-3 rounded-2xl border-2 border-rand p-4" data-freigabe={freigabe.token}>
			<input
				ref={feld}
				className="min-h-12 w-full rounded-xl border-2 border-rand bg-papier px-3 text-sm"
				type="text"
				readOnly
				aria-label="Link zum Teilen"
				value={link}
				onFocus={(e) => e.target.select()}
			/>
			{frage ? (
				<div className="flex flex-col gap-3" role="alert">
					<p>Wer diesen Link hat, kann das Material dann nicht mehr öffnen. Wirklich abschalten?</p>
					<div className="flex flex-wrap gap-2">
						<Knopf disabled={gesperrt} onClick={widerrufe}>
							Ja, abschalten
						</Knopf>
						<Knopf art="zweit" onClick={() => setFrage(false)}>
							Doch nicht
						</Knopf>
					</div>
				</div>
			) : (
				<div className="flex flex-wrap items-center gap-2">
					<Knopf onClick={() => void kopiere()}>
						<Symbol name={kopiert === 'ja' ? 'haken' : 'kopieren'} />
						{kopiert === 'ja' ? 'Kopiert' : 'Link kopieren'}
					</Knopf>
					{kannSenden && (
						<Knopf art="zweit" onClick={sendeWeiter}>
							<Symbol name="teilen" />
							Senden
						</Knopf>
					)}
					<Knopf art="gefahr" className="ml-auto" onClick={() => setFrage(true)}>
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
export const TeilenDialog = ({ dokument, mappe, schliessen }: Eigenschaften) => {
	const dok = dokument?.id ?? null;
	const titel = dokument?.meta.titel ?? mappe.titel;
	const { daten, fehler, neuLaden } = useLaden<{ freigaben: Freigabe[] }>(
		`/api/freigaben?mappe=${mappe.id}${dok ? `&dok=${dok}` : ''}`,
	);
	const [laeuft, setLaeuft] = useState(false);
	const [panne, setPanne] = useState<string | null>(null);

	const fuehreAus = async (schritt: () => Promise<unknown>) => {
		setLaeuft(true);
		setPanne(null);
		try {
			await schritt();
		} catch (grund) {
			setPanne(meldung(grund));
		} finally {
			neuLaden();
			setLaeuft(false);
		}
	};
	const erstelle = () => fuehreAus(() => sende('/api/freigaben', { mappe: mappe.id, dok }));
	const widerrufe = (token: string) => fuehreAus(() => sende(`/api/freigaben/${token}/widerrufen`));

	const aktive = (daten?.freigaben ?? [])
		.filter((f) => f.ziel.dok === dok && f.widerrufen === null)
		.sort((a, b) => b.erstellt.localeCompare(a.erstellt));
	const meldungText = panne ?? fehler?.message;
	const umfang = dokument ? 'dieses Dokument' : 'alle Dokumente dieser Mappe';

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
					{aktive.map((freigabe) => (
						<LinkZeile
							key={freigabe.token}
							freigabe={freigabe}
							titel={titel}
							gesperrt={laeuft}
							widerrufe={() => void widerrufe(freigabe.token)}
						/>
					))}
				</ul>
			)}
			{daten && (
				<div>
					<Knopf
						art={aktive.length === 0 ? 'haupt' : 'leise'}
						className={aktive.length === 0 ? undefined : '-ml-5'}
						disabled={laeuft}
						onClick={() => void erstelle()}
					>
						<Symbol name="plus" />
						{aktive.length === 0 ? 'Link erstellen' : 'Noch einen Link erstellen'}
					</Knopf>
				</div>
			)}
		</Dialog>
	);
};

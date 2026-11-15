import { verstaendlich } from '@schoolbox/kern/src/meldungen';
import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { Blattansicht } from '../bausteine/Blattansicht';
import { Gekuerzt } from '../bausteine/Gekuerzt';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import type { SymbolName } from '../bausteine/Symbol';
import { Symbol } from '../bausteine/Symbol';
import { useEntwuerfe } from '../entwuerfe/laden';
import { EntwurfStatus } from '../entwuerfe/Teile';
import { useEntwurfNehmen } from '../entwuerfe/waehlen';
import { useTitel } from '../lib/titel';
import type { Zugang } from '../lib/zugang';
import { entwuerfeSeite, entwurfAnsichtAdresse } from '../lib/zugang';
import { fasseZusammen } from '../pdf/gleiche';
import type { Entwurf } from '../typen';
import { NichtDa } from './Entwuerfe';
import { MaterialFehlt, NICHT_GEFUNDEN } from './NichtGefunden';

/** Mehr Meldungen erschlagen eher, als dass sie helfen; um den Rest kümmert sich Claude ohnehin. */
const MAX_MELDUNGEN = 3;

interface Eigenschaften {
	zugang: Zugang;
	dok: string;
	name: string;
}

/** In einem Feld tippt man, dort gehören ← und → dem Text. */
const imFeld = (ziel: EventTarget | null) =>
	ziel instanceof HTMLElement && (ziel.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(ziel.tagName));

/** Der Titel im Browser; ist alles da, aber der Entwurf nicht, „nicht gefunden“. */
const entwurfTitel = (titel: string | null, geladen: unknown) => {
	if (titel !== null) {
		return titel;
	}
	return geladen ? NICHT_GEFUNDEN : undefined;
};

/** Wohin eine Taste blättert: ← zum vorigen, → zum nächsten, Esc zur Übersicht (`''`); sonst `null`. */
const zielDerTaste = (taste: string, vorher: string | undefined, nachher: string | undefined) => {
	if (taste === 'ArrowLeft') {
		return vorher;
	}
	if (taste === 'ArrowRight') {
		return nachher;
	}
	return taste === 'Escape' ? '' : null;
};

/** Ein Knopf zum Blättern; ohne `ziel` gesperrt, an seinem Platz. */
const BlaetterKnopf = ({
	dok,
	symbol,
	titel,
	ziel,
	zugang,
}: {
	zugang: Zugang;
	dok: string;
	ziel: Entwurf | undefined;
	titel: string;
	symbol: SymbolName;
}) => (
	<KnopfLink
		to={ziel ? entwuerfeSeite(zugang, dok, ziel.name) : '#'}
		art="zweit"
		replace
		aria-label={ziel ? `Entwurf ${ziel.name}` : titel}
		aria-disabled={!ziel}
		tabIndex={ziel ? undefined : -1}
		className={ziel ? 'size-knopf px-0' : 'pointer-events-none size-knopf px-0 opacity-40'}
	>
		<Symbol name={symbol} />
	</KnopfLink>
);

/**
 * Ein Entwurf groß, mit allen Seiten; eine mitlaufende Leiste wie in der Ansicht (191-47): links zurück und der
 * Name, rechts Blättern, immer an derselben Stelle. ← und → blättern, Esc führt zur Übersicht (191 Urteil 3).
 */
export const EntwurfGross = ({ dok, name, zugang }: Eigenschaften) => {
	const { daten, dokument, fehler, stand } = useEntwuerfe(zugang, dok);
	const navigate = useNavigate();
	const nehmen = useEntwurfNehmen(zugang, dok);
	const liste = dokument?.meta.entwuerfe ?? [];
	const nr = liste.findIndex((e) => e.name === name);
	const entwurf = liste[nr];
	const vorher = liste[nr - 1];
	const nachher = liste[nr + 1];
	useTitel(
		entwurfTitel(entwurf && dokument ? `Entwurf ${entwurf.name}: ${dokument.meta.titel}` : null, daten || fehler),
	);

	const da = Boolean(entwurf);
	const vorherName = vorher?.name;
	const nachherName = nachher?.name;
	useEffect(() => {
		if (!da) {
			return undefined;
		}
		const taste = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || imFeld(e.target)) {
				return;
			}
			const ziel = zielDerTaste(e.key, vorherName, nachherName);
			if (ziel === null || ziel === undefined || document.querySelector('dialog[open], [role=menu]')) {
				return;
			}
			e.preventDefault();
			void navigate(entwuerfeSeite(zugang, dok, ziel || undefined), { replace: ziel !== '' });
		};
		window.addEventListener('keydown', taste);
		return () => window.removeEventListener('keydown', taste);
	}, [da, dok, nachherName, navigate, vorherName, zugang]);

	if (!dokument && (daten || fehler)) {
		return <MaterialFehlt fehler={fehler} />;
	}
	if (!dokument) {
		return daten || fehler ? <NichtDa /> : null;
	}
	// Einen Entwurf dieses Namens gibt es nicht (mehr): dann die Übersicht (191-25).
	if (!entwurf) {
		return <Navigate replace to={entwuerfeSeite(zugang, dok)} />;
	}

	const saetze = fasseZusammen((entwurf.pruefung?.meldungen ?? []).map(verstaendlich));
	const offen = !dokument.meta.gewaehlt;
	return (
		<>
			<div className="sticky top-[var(--kopf,0px)] z-kopf -mx-4 flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b border-rand bg-flaeche px-4 py-0.5">
				<div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
					<KnopfLink to={entwuerfeSeite(zugang, dok)} art="leise" className="-ml-2.5 flex-none text-leise">
						<Symbol name="zurueck" />
						Alle Entwürfe
					</KnopfLink>
					<span aria-hidden className="text-dezent">
						/
					</span>
					<h1 className="ml-[11px] flex min-w-0 items-center text-sm font-semibold">
						<Gekuerzt text={`Entwurf ${entwurf.name}: ${entwurf.titel}`} />
					</h1>
					<span className="ml-2 flex-none text-xs max-lg:hidden">
						<EntwurfStatus entwurf={entwurf} format={dokument.meta.format} />
					</span>
				</div>
				<div className="flex flex-none items-center gap-1.5">
					{/* Nach einer Wahl lässt sich umentscheiden; der bisherige Stand bleibt als Version (191-N03). */}
					{offen ? (
						<Knopf disabled={nehmen.laeuft} onClick={() => nehmen.nimm(entwurf.name)}>
							<Symbol name="haken" />
							Diesen Entwurf nehmen
						</Knopf>
					) : (
						entwurf.name !== dokument.meta.gewaehlt && (
							<Knopf art="zweit" disabled={nehmen.laeuft} onClick={() => nehmen.nimm(entwurf.name)}>
								Stattdessen diesen nehmen
							</Knopf>
						)
					)}
					{/* Zurück und vor stehen immer an derselben Stelle; was nicht geht, ist gesperrt (191-38). */}
					<BlaetterKnopf zugang={zugang} dok={dok} ziel={vorher} titel="Voriger Entwurf" symbol="zurueck" />
					<BlaetterKnopf zugang={zugang} dok={dok} ziel={nachher} titel="Nächster Entwurf" symbol="weiter" />
				</div>
			</div>

			{(entwurf.idee || offen) && (
				<p className="mt-2 text-leise">
					{[entwurf.idee, offen ? 'Nimm einen Entwurf, oder schreib Claude, was anders sein soll.' : null]
						.filter(Boolean)
						.join(' · ')}
				</p>
			)}
			{saetze.length > 0 && (
				<div
					className="mt-3 flex items-start gap-3 rounded-lg border border-entwurf bg-warnung-hell px-4 py-2"
					data-meldungen
				>
					<Symbol name="achtung" className="mt-0.5 size-4 flex-none" />
					<div>
						<h2 className="font-semibold">Das fällt auf</h2>
						<ul className="mt-1 list-disc pl-5">
							{saetze.slice(0, MAX_MELDUNGEN).map((satz) => (
								<li key={satz}>{satz}</li>
							))}
						</ul>
						{saetze.length > MAX_MELDUNGEN && (
							<p className="mt-1">{`… und ${saetze.length - MAX_MELDUNGEN} weitere.`}</p>
						)}
					</div>
				</div>
			)}
			<div className="mt-2">
				<Blattansicht
					adresse={entwurfAnsichtAdresse(zugang, dok, entwurf.name)}
					stand={stand}
					titel={`Entwurf ${entwurf.name}: ${entwurf.titel}`}
				/>
			</div>
		</>
	);
};

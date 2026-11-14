import type { CSSProperties } from 'react';
import { useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { Kachel } from '../bausteine/Kachel';
import { klassen } from '../bausteine/klassen';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { useRestHoehe } from '../entwuerfe/hoehe';
import { useEntwuerfe } from '../entwuerfe/laden';
import { Buchstabe, ClaudeHinweis, EntwurfBild, EntwurfStatus } from '../entwuerfe/Teile';
import { useEntwurfNehmen } from '../entwuerfe/waehlen';
import { useTitel } from '../lib/titel';
import type { Zugang } from '../lib/zugang';
import { dokumentSeite, entwuerfeSeite, mappenSeite } from '../lib/zugang';
import { useOrdnerDesDokuments } from '../ordner/kontext';
import { MaterialFehlt, NICHT_GEFUNDEN } from './NichtGefunden';

interface Eigenschaften {
	zugang: Zugang;
	dok: string;
}

export const NichtDa = () => {
	useTitel(NICHT_GEFUNDEN);
	return (
		<Zustand symbol="suche" titel="Diese Entwürfe gibt es nicht mehr">
			<p className="text-leise">Vielleicht wurde das Material gelöscht.</p>
			<KnopfLink to="/">Zu meinem Material</KnopfLink>
		</Zustand>
	);
};

/**
 * Die Entwürfe eines Dokuments zum Vergleichen: am Mac und auf dem iPad quer nebeneinander und ohne zu scrollen, auf
 * dem iPad hoch zum Durchwischen. „Diesen Entwurf nehmen“ übernimmt ihn als Material (191 Urteil 7); was anders
 * werden soll, schreibt die Lehrkraft Claude.
 */
export const Entwuerfe = ({ dok, zugang }: Eigenschaften) => {
	const { daten, dokument, fehler } = useEntwuerfe(zugang, dok);
	const nehmen = useEntwurfNehmen(zugang, dok);
	const zurueckOrt = useOrdnerDesDokuments(zugang.mappe, dok);
	const liste = useRef<HTMLUListElement>(null);
	useRestHoehe(liste, Boolean(dokument?.meta.entwuerfe.length));
	useTitel(dokument ? `Entwürfe: ${dokument.meta.titel}` : daten || fehler ? NICHT_GEFUNDEN : undefined);

	if (!dokument && (daten || fehler)) {
		return <MaterialFehlt fehler={fehler} />;
	}
	if (!daten || !dokument) {
		return daten || fehler ? <NichtDa /> : null;
	}
	// Das Material gibt es, nur keine Entwürfe: dann das Material selbst (191-25).
	if (dokument.meta.entwuerfe.length === 0) {
		return <Navigate replace to={dokumentSeite(zugang, dok)} />;
	}

	const { meta } = dokument;
	const gewaehlt = meta.entwuerfe.find((e) => e.name === meta.gewaehlt);
	return (
		<>
			<KnopfLink to={zurueckOrt?.adresse ?? mappenSeite(zugang)} art="leise" className="-ml-2.5">
				<Symbol name="zurueck" />
				{zurueckOrt?.name ?? daten.mappe.titel}
			</KnopfLink>
			<h1 className="mt-2 text-3xl max-md:text-2xl">{`Entwürfe: ${meta.titel}`}</h1>
			<div className="mt-3">
				{gewaehlt ? (
					<div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-rand bg-flaeche px-5 py-3">
						<p className="font-medium">{`Entwurf ${gewaehlt.name} ist gewählt.`}</p>
						<KnopfLink to={dokumentSeite(zugang, dok)} art="zweit" className="ml-auto max-md:ml-0">
							Zum Material
							<Symbol name="weiter" />
						</KnopfLink>
					</div>
				) : (
					<ClaudeHinweis />
				)}
			</div>
			{/* Mac und iPad quer: so hoch wie der Rest des Fensters, damit alle Entwürfe ohne Scrollen zu sehen sind. */}
			<ul
				ref={liste}
				className="mt-5 grid h-[max(22rem,var(--rest,40rem))] grid-cols-[repeat(var(--spalten),minmax(0,1fr))] gap-4 max-lg:-mx-4 max-lg:flex max-lg:h-auto max-lg:snap-x max-lg:snap-mandatory max-lg:gap-4 max-lg:overflow-x-auto max-lg:px-4 max-lg:pb-3"
				style={{ '--spalten': meta.entwuerfe.length } as CSSProperties}
				data-entwuerfe
			>
				{meta.entwuerfe.map((entwurf) => (
					<li
						key={entwurf.name}
						className="relative min-h-0 min-w-0 max-lg:w-[85%] max-lg:flex-none max-lg:snap-center"
						data-entwurf={entwurf.name}
					>
						<Link to={entwuerfeSeite(zugang, dok, entwurf.name)} className="group block h-full no-underline">
							{/* Hover wie die Kacheln der Ablage (191-35); nur der gewählte trägt den Auswahlrahmen (191-37). */}
							<Kachel
								className={klassen(
									'flex h-full flex-col group-hover:border-rand-feld',
									entwurf.name === meta.gewaehlt && 'border-tinte ring-1 ring-tinte group-hover:border-tinte',
								)}
							>
								{/* Rechts oben liegt „Diesen Entwurf nehmen“, neben dem Link (kein Knopf im Link). */}
								<div
									className={klassen(
										'flex flex-none items-start gap-2 p-3',
										entwurf.name !== meta.gewaehlt && (gewaehlt ? 'pr-56' : 'pr-48'),
									)}
								>
									<Buchstabe name={entwurf.name} />
									<div className="min-w-0">
										<h2 className="text-base font-semibold">
											<span className="sr-only">{`Entwurf ${entwurf.name}: `}</span>
											{entwurf.titel}
										</h2>
										{entwurf.idee && <p className="line-clamp-2 text-leise">{entwurf.idee}</p>}
										<div className="mt-1 flex flex-wrap gap-2">
											<EntwurfStatus entwurf={entwurf} format={meta.format} />
											{entwurf.name === meta.gewaehlt && (
												<span className="inline-flex items-center gap-1.5 font-medium text-tinte">
													<Symbol name="haken" className="size-3.5 flex-none" />
													Gewählt
												</span>
											)}
										</div>
									</div>
								</div>
								<div className="flex min-h-0 flex-1 justify-center bg-leinwand p-3 max-lg:h-[max(14rem,calc(100dvh-var(--kopf,0px)-24rem))] max-lg:flex-none">
									<EntwurfBild zugang={zugang} dokument={dokument} entwurf={entwurf} />
								</div>
							</Kachel>
						</Link>
						{/* Nach einer Wahl tragen die anderen Karten „Stattdessen diesen nehmen“ (191-N03). */}
						{entwurf.name !== meta.gewaehlt && (
							<Knopf
								art="zweit"
								groesse="klein"
								className="absolute top-3 right-3"
								disabled={nehmen.laeuft}
								onClick={() => nehmen.nimm(entwurf.name)}
							>
								{gewaehlt ? 'Stattdessen diesen nehmen' : 'Diesen Entwurf nehmen'}
							</Knopf>
						)}
					</li>
				))}
			</ul>
			{meta.entwuerfe.length > 1 && (
				<p className="mt-2 text-center text-leise lg:hidden">Wische zur Seite, um alle Entwürfe zu sehen.</p>
			)}
		</>
	);
};

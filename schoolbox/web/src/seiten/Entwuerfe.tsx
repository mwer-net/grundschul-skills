import type { CSSProperties } from 'react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';

import { Kachel } from '../bausteine/Kachel';
import { KnopfLink } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { useRestHoehe } from '../entwuerfe/hoehe';
import { useEntwuerfe } from '../entwuerfe/laden';
import { Buchstabe, ClaudeHinweis, EntwurfBild, EntwurfStatus } from '../entwuerfe/Teile';
import { useTitel } from '../lib/titel';
import type { Zugang } from '../lib/zugang';
import { dokumentSeite, entwuerfeSeite, mappenSeite } from '../lib/zugang';

interface Eigenschaften {
	zugang: Zugang;
	dok: string;
}

export const NichtDa = () => (
	<Zustand symbol="suche" titel="Diese Entwürfe gibt es nicht mehr">
		<p className="text-leise">Vielleicht wurde das Material gelöscht.</p>
		<KnopfLink to="/">Zu meinen Mappen</KnopfLink>
	</Zustand>
);

/**
 * Die Entwürfe eines Dokuments zum Vergleichen: am Mac und auf dem iPad quer nebeneinander und ohne zu scrollen, auf
 * dem iPad hoch zum Durchwischen. Wählen kann die Lehrkraft nur bei Claude; ein Knopf hier würde Claude nicht
 * erreichen und wäre deshalb irreführend.
 */
export const Entwuerfe = ({ dok, zugang }: Eigenschaften) => {
	const { daten, dokument, fehler } = useEntwuerfe(zugang, dok);
	const liste = useRef<HTMLUListElement>(null);
	useRestHoehe(liste, Boolean(dokument?.meta.entwuerfe.length));
	useTitel(dokument ? `Entwürfe: ${dokument.meta.titel}` : undefined);

	if (!daten || !dokument || dokument.meta.entwuerfe.length === 0) {
		return daten || fehler ? <NichtDa /> : null;
	}

	const { meta } = dokument;
	const gewaehlt = meta.entwuerfe.find((e) => e.name === meta.gewaehlt);
	return (
		<>
			<KnopfLink to={mappenSeite(zugang)} art="leise" className="-ml-5">
				<Symbol name="zurueck" />
				{daten.mappe.titel}
			</KnopfLink>
			<h1 className="mt-2 text-3xl max-md:text-2xl">{`Entwürfe: ${meta.titel}`}</h1>
			<div className="mt-3">
				{gewaehlt ? (
					<div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border-2 border-rand bg-white px-5 py-3">
						<p className="font-bold">{`Entwurf ${gewaehlt.name} ist gewählt. Claude arbeitet damit weiter.`}</p>
						<KnopfLink to={dokumentSeite(zugang, dok)} art="zweit" className="ml-auto max-md:ml-0">
							Zum Material
							<Symbol name="weiter" />
						</KnopfLink>
					</div>
				) : (
					<ClaudeHinweis>
						<p className="text-leise">Tippe einen Entwurf an, um ihn groß anzusehen.</p>
					</ClaudeHinweis>
				)}
			</div>
			{/* Mac und iPad quer: so hoch wie der Rest des Fensters, damit alle Entwürfe ohne Scrollen zu sehen sind. */}
			<ul
				ref={liste}
				className="mt-5 grid h-[max(22rem,var(--rest,40rem))] grid-cols-[repeat(var(--spalten),minmax(0,1fr))] gap-6 max-lg:-mx-4 max-lg:flex max-lg:h-auto max-lg:snap-x max-lg:snap-mandatory max-lg:gap-4 max-lg:overflow-x-auto max-lg:px-4 max-lg:pb-3"
				style={{ '--spalten': meta.entwuerfe.length } as CSSProperties}
				data-entwuerfe
			>
				{meta.entwuerfe.map((entwurf) => (
					<li
						key={entwurf.name}
						className="relative min-h-0 min-w-0 max-lg:w-[85%] max-lg:flex-none max-lg:snap-center"
						data-entwurf={entwurf.name}
					>
						<Link to={entwuerfeSeite(zugang, dok, entwurf.name)} className="block h-full no-underline">
							<Kachel
								className={
									entwurf.pruefung?.passt === false
										? 'flex h-full flex-col ring-4 ring-entwurf'
										: 'flex h-full flex-col'
								}
							>
								<div className="flex flex-none items-start gap-3 p-4">
									<Buchstabe name={entwurf.name} />
									<div className="min-w-0">
										<h2 className="text-xl">
											<span className="sr-only">{`Entwurf ${entwurf.name}: `}</span>
											{entwurf.titel}
										</h2>
										{entwurf.idee && <p className="line-clamp-2 text-leise">{entwurf.idee}</p>}
										<div className="mt-1 flex flex-wrap gap-2">
											<EntwurfStatus entwurf={entwurf} />
											{entwurf.name === meta.gewaehlt && (
												<span className="inline-flex items-center gap-1.5 font-bold text-brand-600">
													<Symbol name="haken" className="size-5 flex-none" />
													Gewählt
												</span>
											)}
										</div>
									</div>
								</div>
								<div className="flex min-h-0 flex-1 justify-center bg-[#e9e6df] p-4 max-lg:h-[max(14rem,calc(100dvh-var(--kopf,0px)-24rem))] max-lg:flex-none">
									<EntwurfBild zugang={zugang} dokument={dokument} entwurf={entwurf} />
								</div>
							</Kachel>
						</Link>
					</li>
				))}
			</ul>
			{meta.entwuerfe.length > 1 && (
				<p className="mt-2 text-center text-leise lg:hidden">Wische zur Seite, um alle Entwürfe zu sehen.</p>
			)}
		</>
	);
};

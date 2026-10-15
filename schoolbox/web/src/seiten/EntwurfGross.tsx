import { verstaendlich } from '@schoolbox/kern/src/meldungen';

import { Blattansicht } from '../bausteine/Blattansicht';
import { KnopfLink } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { useEntwuerfe } from '../entwuerfe/laden';
import { Buchstabe, ClaudeHinweis, EntwurfStatus } from '../entwuerfe/Teile';
import { useTitel } from '../lib/titel';
import type { Zugang } from '../lib/zugang';
import { entwuerfeSeite, entwurfAnsichtAdresse } from '../lib/zugang';
import { NichtDa } from './Entwuerfe';

/** Mehr Meldungen erschlagen eher, als dass sie helfen; um den Rest kümmert sich Claude ohnehin. */
const MAX_MELDUNGEN = 3;

interface Eigenschaften {
	zugang: Zugang;
	dok: string;
	name: string;
}

/** Ein Entwurf groß, mit allen Seiten und zum Zoomen; Blättern zu den anderen Entwürfen. */
export const EntwurfGross = ({ dok, name, zugang }: Eigenschaften) => {
	const { daten, dokument, fehler, stand } = useEntwuerfe(zugang, dok);
	const liste = dokument?.meta.entwuerfe ?? [];
	const nr = liste.findIndex((e) => e.name === name);
	const entwurf = liste[nr];
	useTitel(entwurf && dokument ? `Entwurf ${entwurf.name}: ${dokument.meta.titel}` : undefined);

	if (!dokument || !entwurf) {
		return daten || fehler ? <NichtDa /> : null;
	}

	const vorher = liste[nr - 1];
	const nachher = liste[nr + 1];
	const meldungen = entwurf.pruefung?.meldungen ?? [];
	return (
		<>
			<KnopfLink to={entwuerfeSeite(zugang, dok)} art="leise" className="-ml-5">
				<Symbol name="zurueck" />
				Alle Entwürfe
			</KnopfLink>
			<div className="mt-2 flex items-start gap-4">
				<Buchstabe name={entwurf.name} />
				<div className="min-w-0">
					<h1 className="text-3xl max-md:text-2xl">
						<span className="sr-only">{`Entwurf ${entwurf.name}: `}</span>
						{entwurf.titel}
					</h1>
					{entwurf.idee && <p className="mt-1 text-leise">{entwurf.idee}</p>}
					<div className="mt-1">
						<EntwurfStatus entwurf={entwurf} />
					</div>
				</div>
			</div>

			<div className="sticky top-[var(--kopf,0px)] z-20 -mx-8 mt-3 flex flex-wrap items-center gap-2 bg-papier/95 px-8 py-3 backdrop-blur max-lg:-mx-4 max-lg:px-4">
				{vorher && (
					<KnopfLink to={entwuerfeSeite(zugang, dok, vorher.name)} art="zweit" replace>
						<Symbol name="zurueck" />
						{`Entwurf ${vorher.name}`}
					</KnopfLink>
				)}
				{nachher && (
					<KnopfLink to={entwuerfeSeite(zugang, dok, nachher.name)} art="zweit" className="ml-auto" replace>
						{`Entwurf ${nachher.name}`}
						<Symbol name="weiter" />
					</KnopfLink>
				)}
			</div>

			<div className="mt-3 flex flex-col gap-3">
				{meldungen.length > 0 && (
					<div className="rounded-2xl border-2 border-entwurf bg-[#fff8e1] px-5 py-3" data-meldungen>
						<h2 className="text-lg">Das fällt auf</h2>
						<ul className="mt-1 list-disc pl-5">
							{meldungen.slice(0, MAX_MELDUNGEN).map((m, i) => (
								<li key={`${i}-${m.text}`}>{verstaendlich(m)}</li>
							))}
						</ul>
						{meldungen.length > MAX_MELDUNGEN && (
							<p className="mt-1">{`… und ${meldungen.length - MAX_MELDUNGEN} weitere Stellen.`}</p>
						)}
						<p className="mt-1 text-leise">Claude kann das beim Ausarbeiten richten.</p>
					</div>
				)}
				{!dokument.meta.gewaehlt && <ClaudeHinweis />}
			</div>
			<div className="mt-4">
				<Blattansicht
					adresse={entwurfAnsichtAdresse(zugang, dok, entwurf.name)}
					stand={stand}
					titel={`Entwurf ${entwurf.name}: ${entwurf.titel}`}
				/>
			</div>
		</>
	);
};

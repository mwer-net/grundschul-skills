import { Link } from 'react-router-dom';

import { Kachel, Marke } from '../bausteine/Kachel';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Vorschau } from '../bausteine/Vorschau';
import { hatOffeneEntwuerfe } from '../entwuerfe/offen';
import { anzahl, ART_NAME, FORMAT_NAME } from '../lib/text';
import type { Zugang } from '../lib/zugang';
import { dokumentSeite, entwuerfeSeite, istGeteilt, praesentationSeite } from '../lib/zugang';
import { PdfKnopf } from '../pdf/PdfKnopf';
import { dokumentWahl } from '../pdf/wahl';
import type { DokumentEintrag, Mappe } from '../typen';

interface Eigenschaften {
	zugang: Zugang;
	mappe: Pick<Mappe, 'id' | 'titel'>;
	dokument: DokumentEintrag;
	/** Fehlt bei Teilen-Links: Weiterteilen kann nur die Lehrkraft. */
	teile?: () => void;
}

export const DokumentKachel = ({ dokument, mappe, teile, zugang }: Eigenschaften) => {
	const { id, meta } = dokument;
	// Solange kein Entwurf gewählt ist, gibt es nur die Entwürfe zu sehen; material.html ist noch das leere Gerüst.
	const waehlen = !istGeteilt(zugang) && hatOffeneEntwuerfe(meta);
	const seite = waehlen ? entwuerfeSeite(zugang, id) : dokumentSeite(zugang, id);
	return (
		<li data-dokument={id}>
			<Kachel beschnitten={false} className="flex h-full flex-col">
				{/* Das Bild führt zum selben Ziel wie „Ansehen“; für Tastatur und Vorleser reicht der Knopf. */}
				<Link
					to={seite}
					className="relative block overflow-hidden rounded-t-2xl"
					tabIndex={-1}
					aria-hidden="true"
				>
					<Vorschau zugang={zugang} dokument={dokument} />
					{meta.status === 'entwurf' && (
						<span className="absolute top-3 left-3">
							<Marke>Entwurf</Marke>
						</span>
					)}
				</Link>
				<div className="flex flex-1 flex-col gap-1 border-t border-rand p-4">
					<h2 className="text-xl">{meta.titel}</h2>
					<p className="text-leise">
						{[
							ART_NAME[meta.art],
							FORMAT_NAME[meta.format],
							...(meta.seiten > 0 ? [anzahl(meta.seiten, 'Seite', 'Seiten')] : []),
						].join(' · ')}
					</p>
					<div className="mt-auto flex flex-wrap gap-2 pt-3">
						<KnopfLink to={seite}>
							<Symbol name="auge" />
							{waehlen ? 'Entwürfe vergleichen' : 'Ansehen'}
						</KnopfLink>
						{!waehlen && meta.format === 'folie' && (
							<KnopfLink to={praesentationSeite(zugang, id)} art="zweit">
								<Symbol name="praesentieren" />
								Präsentieren
							</KnopfLink>
						)}
						{!waehlen && (
							<PdfKnopf
								beschriftung="PDF"
								wahl={dokumentWahl(zugang, dokument)}
								mappe={mappe}
								warnen={!istGeteilt(zugang)}
							/>
						)}
						{teile && (
							<Knopf art="zweit" onClick={teile}>
								<Symbol name="teilen" />
								Teilen
							</Knopf>
						)}
					</div>
				</div>
			</Kachel>
		</li>
	);
};

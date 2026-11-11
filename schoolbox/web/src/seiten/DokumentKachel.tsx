import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Marke } from '../bausteine/Kachel';
import { Knopf, KnopfLink } from '../bausteine/Knopf';
import type { MenueEintrag } from '../bausteine/Menue';
import { Menue } from '../bausteine/Menue';
import { useZeigeMenue } from '../bausteine/menue-kontext';
import { Symbol } from '../bausteine/Symbol';
import { Vorschau } from '../bausteine/Vorschau';
import { hatOffeneEntwuerfe } from '../entwuerfe/offen';
import { ART_NAME, FORMAT_NAME } from '../lib/text';
import type { Zugang } from '../lib/zugang';
import { dokumentSeite, editorSeite, entwuerfeSeite, istGeteilt, praesentationSeite } from '../lib/zugang';
import { PdfKnopf } from '../pdf/PdfKnopf';
import { pdfEintrag, usePdf } from '../pdf/usePdf';
import { dokumentWahl } from '../pdf/wahl';
import type { DokumentEintrag, Mappe } from '../typen';

interface Eigenschaften {
	zugang: Zugang;
	mappe: Pick<Mappe, 'id' | 'titel'>;
	dokument: DokumentEintrag;
	/** Fehlt bei Teilen-Links: Weiterteilen kann nur die Lehrkraft. */
	teile?: () => void;
	/** Fehlt bei Teilen-Links: Eine Variante legt nur die Lehrkraft an. */
	variante?: () => void;
}

const MEHR_KNOPF = (
	<Knopf art="leise" groesse="klein" className="size-knopf-klein px-0">
		<Symbol name="mehr" />
	</Knopf>
);

/** Zu sehen ist das Material. Ein Klick darauf sieht es an, zwei Knöpfe bleiben sichtbar, der Rest liegt im ⋯. */
export const DokumentKachel = ({ dokument, mappe, teile, variante, zugang }: Eigenschaften) => {
	const { id, meta } = dokument;
	const geteilt = istGeteilt(zugang);
	// Solange kein Entwurf gewählt ist, gibt es nur die Entwürfe zu sehen; material.html ist noch das leere Gerüst.
	const waehlen = !geteilt && hatOffeneEntwuerfe(meta);
	const seite = waehlen ? entwuerfeSeite(zugang, id) : dokumentSeite(zugang, id);
	const folie = meta.format === 'folie';
	const navigate = useNavigate();
	const zeigeMenue = useZeigeMenue();
	const pdf = usePdf({ mappe, warnen: !geteilt });
	const wahl = dokumentWahl(zugang, dokument, folie ? undefined : meta.druckprofil);

	const mehr: MenueEintrag[] = [
		...(folie && !waehlen ? [pdfEintrag('PDF', 'herunterladen', wahl, (w) => void pdf.hole(w))] : []),
		...(variante && !waehlen ? [{ titel: 'Variante anlegen', symbol: 'variante' as const, waehle: variante }] : []),
		...(teile ? [{ titel: 'Teilen', symbol: 'teilen' as const, waehle: teile }] : []),
		...(!geteilt && !waehlen && meta.entwuerfe.length > 0
			? [
					{
						titel: 'Entwürfe vergleichen',
						symbol: 'kopieren' as const,
						waehle: () => void navigate(entwuerfeSeite(zugang, id)),
					},
				]
			: []),
	];

	const rechtsklick = (e: MouseEvent) => {
		if (mehr.length > 0) {
			e.preventDefault();
			zeigeMenue({ x: e.clientX, y: e.clientY }, mehr);
		}
	};

	return (
		<li
			data-dokument={id}
			className="flex flex-col overflow-hidden rounded-[10px] border border-rand bg-flaeche"
			onContextMenu={rechtsklick}
		>
			<Link
				to={seite}
				aria-label={`${waehlen ? 'Entwürfe' : 'Ansehen'}: ${meta.titel}`}
				className="block text-tinte no-underline"
			>
				<div className="relative">
					<Vorschau zugang={zugang} dokument={dokument} />
					{meta.status === 'entwurf' && (
						<span className="absolute top-2 left-2">
							<Marke>Entwurf</Marke>
						</span>
					)}
				</div>
				<div className="border-t border-rand px-2.5 pt-2">
					<h2 className="truncate text-sm font-medium">{meta.titel}</h2>
					<p className="truncate text-xs text-leise">{`${ART_NAME[meta.art]} · ${FORMAT_NAME[meta.format]}`}</p>
				</div>
			</Link>
			<div className="mt-auto flex items-center gap-1 px-1.5 py-1.5">
				{waehlen && (
					<KnopfLink to={seite} art="leise" groesse="klein">
						<Symbol name="kopieren" />
						Entwürfe vergleichen
					</KnopfLink>
				)}
				{!waehlen && !geteilt && (
					<KnopfLink to={editorSeite(zugang, id)} art="leise" groesse="klein" className="px-1.5!">
						<Symbol name="stift" />
						Bearbeiten
					</KnopfLink>
				)}
				{!waehlen && folie && (
					<KnopfLink to={praesentationSeite(zugang, id)} art="leise" groesse="klein" className="px-1.5!">
						<Symbol name="praesentieren" />
						Präsentieren
					</KnopfLink>
				)}
				{!waehlen && !folie && (
					<PdfKnopf
						knapp
						art="leise"
						groesse="klein"
						beschriftung="PDF"
						wahl={wahl}
						mappe={mappe}
						warnen={!geteilt}
					/>
				)}
				{mehr.length > 0 && (
					<span className="ml-auto">
						<Menue name="Weitere Aktionen" rechtsbuendig eintraege={mehr} ausloeser={MEHR_KNOPF} />
					</span>
				)}
			</div>
			{pdf.dialog}
		</li>
	);
};

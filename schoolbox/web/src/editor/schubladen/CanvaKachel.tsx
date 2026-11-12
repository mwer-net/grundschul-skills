/**
 * Besitzer: 176. Ein Canva-Auftrag in „Figuren“, solange er wartet, läuft oder gescheitert ist. Fertige Aufträge stehen
 * als normale Kachel der Bibliothek da.
 */
import type { CanvaStand } from '@schoolbox/kern/src/canva-auftrag';

import { klassen } from '../../bausteine/klassen';
import { Knopf } from '../../bausteine/Knopf';
import { KACHELNAME, SCHUBLADENKACHEL } from '../../bausteine/Schublade';
import { Symbol } from '../../bausteine/Symbol';
import { Tooltip } from '../../bausteine/Tooltip';
import { canvaAktion } from '../canva';

/** Das × oben rechts: klein am Mac, am iPad mit der Trefferfläche eines Knopfs. */
const Weg = ({ stand }: { stand: CanvaStand }) => {
	const fehler = stand.status === 'fehler';
	return (
		<button
			type="button"
			aria-label={fehler ? 'Entfernen' : 'Abbrechen'}
			className="group/weg absolute top-0 right-0 flex size-7 items-start justify-end p-1 [@media(any-pointer:coarse)]:size-11"
			onClick={() => void canvaAktion(stand.id, fehler ? 'verwerfen' : 'abbrechen')}
		>
			<span className="flex size-4 items-center justify-center rounded-full bg-flaeche text-leise shadow-1 group-hover/weg:text-tinte [@media(any-pointer:coarse)]:size-6">
				<Symbol name="schliessen" className="size-2.5 [@media(any-pointer:coarse)]:size-3.5" />
			</span>
		</button>
	);
};

/** Wie eine Posenkachel aus 177, nicht ziehbar. Der Auftragstext ist Tooltip und Name. */
export const CanvaKachel = ({
	form = 'pose',
	nochmal,
	stand,
}: {
	stand: CanvaStand;
	nochmal: (stand: CanvaStand) => void;
	/** `bild`: wie eine kleine Kachel in „Bilder“, Fläche und Name darunter. */
	form?: 'pose' | 'bild';
}) => {
	const fehler = stand.status === 'fehler';
	const bild = form === 'bild';
	const zustand = (
		<>
			{stand.status === 'wartet' && <Symbol name="uhr" className="size-4 text-leise" />}
			{stand.status === 'laeuft' && (
				<span className="flex size-full animate-pulse items-center justify-center rounded-md bg-brand-50">
					<Symbol name="laden" className="size-4 animate-spin text-brand-600" />
				</span>
			)}
		</>
	);
	const aussehen = bild
		? 'flex w-full flex-col items-center gap-1 p-2'
		: 'flex aspect-square items-center justify-center p-1.5';
	return (
		<Tooltip text={stand.text}>
			<figure
				aria-label={stand.text}
				data-canva-kachel={stand.id}
				data-status={stand.status}
				className={klassen(
					SCHUBLADENKACHEL,
					'relative m-0 hover:bg-flaeche-2!',
					fehler
						? klassen(bild ? 'w-full' : 'col-span-3', 'flex flex-col items-start gap-1.5 p-2.5 pr-8')
						: aussehen,
				)}
			>
				{!fehler && bild ? (
					<>
						<span className="flex h-24 w-full items-center justify-center">{zustand}</span>
						<span className={KACHELNAME}>{stand.text}</span>
					</>
				) : (
					zustand
				)}
				{fehler && (
					<>
						<p className="flex items-start gap-1.5 text-xs">
							<Symbol name="achtung" className="mt-px size-3.5 flex-none text-warnung" />
							{stand.fehler}
						</p>
						<Knopf art="zweit" groesse="klein" onClick={() => nochmal(stand)}>
							Noch einmal
						</Knopf>
					</>
				)}
				<Weg stand={stand} />
			</figure>
		</Tooltip>
	);
};

/** Die Aufträge mit diesem Ziel (`null`: „Neue Figur“), Fehler zuerst, weil sie die ganze Zeile nehmen. */
export const CanvaKacheln = ({
	figur,
	laeufe,
	nochmal,
}: {
	laeufe: readonly CanvaStand[];
	figur: string | null;
	nochmal: (stand: CanvaStand) => void;
}) =>
	laeufe
		.filter((l) => l.art === 'figur' && (l.ziel.figur ?? null) === figur)
		.sort((a, b) => Number(b.status === 'fehler') - Number(a.status === 'fehler'))
		.map((stand) => <CanvaKachel key={stand.id} stand={stand} nochmal={nochmal} />);

/** Je Auftrag ein `<li>` der Liste „Dieser Ordner“; ein Fehler nimmt die ganze Zeile. */
export const CanvaBildKacheln = ({
	laeufe,
	nochmal,
}: {
	laeufe: readonly CanvaStand[];
	nochmal: (stand: CanvaStand) => void;
}) =>
	laeufe.map((stand) => (
		<li key={stand.id} className={klassen('min-w-0', stand.status === 'fehler' && 'col-span-2')}>
			<CanvaKachel form="bild" stand={stand} nochmal={nochmal} />
		</li>
	));

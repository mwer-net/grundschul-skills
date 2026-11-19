import { LEITFIGUR_FELDER } from '@schoolbox/kern/src/assistent';
import type { EinheitLeitfigur } from '@schoolbox/kern/src/einheit-figuren';
import type { BibliotheksFigur } from '@schoolbox/kern/src/figuren';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { FELD_KLASSEN, klassen } from '../bausteine/klassen';
import { Symbol } from '../bausteine/Symbol';
import { useFiguren, vorschauVon } from '../editor/gestaltung/figuren-quelle';

/**
 * Die Leitfigur (242): Kacheln mit der Grundpose jeder Figur der Bibliothek, Willi und Wilma auch als Paar, dazu
 * „Eigene Figur“ mit Name und Aussehen und „Keine“. Ein Klick wählt. Der Assistent der Einheit nutzt sie, „Neues
 * Material“ später auch (253, dort ohne Paar).
 */

const KACHEL =
	'flex w-24 flex-col items-center gap-1 rounded-lg border p-1.5 text-sm font-medium transition-colors duration-[120ms]';

const Kachel = ({
	aktiv,
	children,
	titel,
	waehle,
}: {
	aktiv: boolean;
	children: ReactNode;
	titel: string;
	waehle: () => void;
}) => (
	<button
		type="button"
		aria-pressed={aktiv}
		title={titel}
		data-leitfigur={titel}
		className={klassen(
			KACHEL,
			aktiv ? 'border-brand-500 bg-brand-50 text-tinte' : 'border-rand bg-flaeche text-leise hover:bg-flaeche-2',
		)}
		onClick={waehle}
	>
		<span className="flex h-14 w-full items-center justify-center">{children}</span>
		<span className="w-full truncate text-center">{titel}</span>
	</button>
);

const Grundpose = ({ figur, klein }: { figur: BibliotheksFigur; klein?: boolean }) => {
	const pose = figur.posen[0];
	return pose ? (
		<img
			src={vorschauVon(pose)}
			alt=""
			className={klassen('max-h-full object-contain', klein ? 'max-w-[50%]' : 'max-w-full')}
		/>
	) : (
		<Symbol name="figuren" className="size-6" />
	);
};

const gleich = (wert: EinheitLeitfigur, ids: readonly string[]) =>
	wert.art === 'bibliothek' && wert.figuren.map((f) => f.id).join('|') === ids.join('|');

export const LeitfigurWahl = ({
	keine = true,
	paar = true,
	setze,
	wert,
}: {
	wert: EinheitLeitfigur;
	setze: (wert: EinheitLeitfigur) => void;
	/** Willi und Wilma zusammen als eine Kachel. */
	paar?: boolean;
	keine?: boolean;
}) => {
	const figuren = useFiguren().filter((f) => f.posen.length > 0);
	const [eigene, setEigene] = useState(() =>
		wert.art === 'neu' ? { name: wert.name, aussehen: wert.aussehen } : { name: '', aussehen: '' },
	);
	const willi = figuren.find((f) => f.id === 'willi');
	const wilma = figuren.find((f) => f.id === 'wilma');
	const bibliothek = (liste: readonly BibliotheksFigur[]) =>
		setze({ art: 'bibliothek', figuren: liste.map((f) => ({ id: f.id, name: f.name })) });
	const aendere = (teil: Partial<typeof eigene>) => {
		const neu = { ...eigene, ...teil };
		setEigene(neu);
		setze({ art: 'neu', ...neu });
	};
	return (
		<div>
			<div role="group" aria-label="Leitfigur" className="flex flex-wrap gap-2">
				{paar && willi && wilma && (
					<Kachel
						titel={`${willi.name} und ${wilma.name}`}
						aktiv={gleich(wert, [willi.id, wilma.id])}
						waehle={() => bibliothek([willi, wilma])}
					>
						<Grundpose figur={willi} klein />
						<Grundpose figur={wilma} klein />
					</Kachel>
				)}
				{figuren.map((f) => (
					<Kachel key={f.id} titel={f.name} aktiv={gleich(wert, [f.id])} waehle={() => bibliothek([f])}>
						<Grundpose figur={f} />
					</Kachel>
				))}
				<Kachel titel="Eigene Figur" aktiv={wert.art === 'neu'} waehle={() => setze({ art: 'neu', ...eigene })}>
					<Symbol name="plus" className="size-6" />
				</Kachel>
				{keine && (
					<Kachel titel="Keine" aktiv={wert.art === 'keine'} waehle={() => setze({ art: 'keine' })}>
						<Symbol name="schliessen" className="size-6" />
					</Kachel>
				)}
			</div>
			{wert.art === 'neu' && (
				<div className="mt-3 grid grid-cols-[12rem_1fr] gap-3" data-leitfigur-eigene>
					<input
						className={klassen(FELD_KLASSEN, 'w-full')}
						aria-label={LEITFIGUR_FELDER.name.name}
						placeholder={LEITFIGUR_FELDER.name.platz}
						maxLength={LEITFIGUR_FELDER.name.zeichen}
						value={eigene.name}
						autoFocus
						onChange={(e) => aendere({ name: e.target.value })}
					/>
					<input
						className={klassen(FELD_KLASSEN, 'w-full')}
						aria-label={LEITFIGUR_FELDER.aussehen.name}
						placeholder={LEITFIGUR_FELDER.aussehen.platz}
						maxLength={LEITFIGUR_FELDER.aussehen.zeichen}
						value={eigene.aussehen}
						onChange={(e) => aendere({ aussehen: e.target.value })}
					/>
				</div>
			)}
		</div>
	);
};

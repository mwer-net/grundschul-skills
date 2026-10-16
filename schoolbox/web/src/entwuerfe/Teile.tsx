import type { ReactNode } from 'react';

import { klassen } from '../bausteine/klassen';
import { Symbol } from '../bausteine/Symbol';
import type { Format } from '../lib/text';
import type { Zugang } from '../lib/zugang';
import { entwurfVorschauAdresse } from '../lib/zugang';
import type { DokumentEintrag, Entwurf } from '../typen';

export const Buchstabe = ({ className, name }: { name: string; className?: string }) => (
	<span
		className={klassen(
			'inline-flex flex-none items-center justify-center rounded-full bg-brand-500 font-display text-white',
			className ?? 'size-14 text-3xl',
		)}
		aria-hidden="true"
	>
		{name}
	</span>
);

/** Grün, wenn alles passt. Ein Entwurf, der übersteht, ist deutlich, aber ruhig markiert: Bernstein statt Rot. */
export const EntwurfStatus = ({ entwurf, format }: { entwurf: Entwurf; format: Format }) => {
	const { pruefung } = entwurf;
	if (!pruefung) {
		return null;
	}
	const seite = format === 'folie' ? 'die Folie' : 'die Seite';
	return pruefung.passt ? (
		<span className="inline-flex items-center gap-1.5 font-bold text-[#2e7d32]" data-status="passt">
			<Symbol name="haken" className="size-5 flex-none" />
			{`Passt auf ${seite}`}
		</span>
	) : (
		<span className="inline-flex items-start gap-1.5 font-bold text-[#7a5200]" data-status="passt-nicht">
			<span className="flex size-6 flex-none items-center justify-center rounded-full bg-entwurf">
				<Symbol name="achtung" className="size-4 flex-none" />
			</span>
			{`Passt nicht ganz auf ${seite}`}
		</span>
	);
};

interface BildEigenschaften {
	zugang: Zugang;
	dokument: DokumentEintrag;
	entwurf: Entwurf;
	className?: string;
}

/**
 * Erste Seite eines Entwurfs, so groß, wie ihr Rahmen es zulässt. Das Bild gibt es erst, wenn `schoolbox entwuerfe`
 * die Prüfung eingetragen hat.
 */
export const EntwurfBild = ({ className, dokument, entwurf, zugang }: BildEigenschaften) =>
	entwurf.pruefung ? (
		<img
			className={klassen('size-full object-contain object-top drop-shadow-md', className)}
			src={entwurfVorschauAdresse(zugang, dokument.id, entwurf.name, dokument.meta.geaendert)}
			alt=""
			decoding="async"
			draggable={false}
		/>
	) : (
		<div
			className="flex aspect-[210/297] h-full max-w-full items-center justify-center bg-white text-[#bdb8ad]"
			data-platzhalter
		>
			<Symbol name="blatt" className="size-12" />
		</div>
	);

/** Statt der Vorschau eines Dokuments: alle Entwürfe klein nebeneinander, mit Buchstaben. */
export const EntwurfMinis = ({ dokument, zugang }: { zugang: Zugang; dokument: DokumentEintrag }) => (
	<div className="flex size-full gap-4 px-5 pt-12 pb-3" data-entwurf-minis>
		{dokument.meta.entwuerfe.map((entwurf) => (
			<div key={entwurf.name} className="flex min-w-0 flex-1 flex-col items-center gap-2">
				<div className="flex min-h-0 w-full flex-1 justify-center">
					<EntwurfBild zugang={zugang} dokument={dokument} entwurf={entwurf} />
				</div>
				<Buchstabe name={entwurf.name} className="size-8 text-lg" />
			</div>
		))}
	</div>
);

export const ClaudeHinweis = ({ children }: { children?: ReactNode }) => (
	<div className="flex items-start gap-3 rounded-2xl border-2 border-brand-200 bg-brand-50 px-5 py-3">
		<Symbol name="sprechblase" className="mt-0.5 size-6 flex-none text-brand-600" />
		<div>
			<p className="font-bold">Schreib Claude, welcher Entwurf es werden soll, und was anders sein soll.</p>
			{children}
		</div>
	</div>
);

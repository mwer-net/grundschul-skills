import { vorschaubildAdresse } from '@schoolbox/kern/src/bildbefehle';

import { hatOffeneEntwuerfe } from '../entwuerfe/offen';
import { EntwurfMinis } from '../entwuerfe/Teile';
import { QUERFORMATE } from '../lib/text';
import type { Zugang } from '../lib/zugang';
import { vorschauAdresse } from '../lib/zugang';
import type { DokumentEintrag } from '../typen';
import { useBildFehler } from './bildFehler';
import { klassen } from './klassen';
import { Symbol } from './Symbol';

interface Eigenschaften {
	zugang: Zugang;
	dokument: DokumentEintrag | undefined;
	className?: string;
}

const Bild = ({ dokument, zugang }: { zugang: Zugang; dokument: DokumentEintrag | undefined }) => {
	const src = dokument?.vorschau
		? vorschaubildAdresse(vorschauAdresse(zugang, dokument.id, dokument.vorschau))
		: null;
	const { fehlt, onError } = useBildFehler(src);
	if (dokument !== undefined && zugang.token === null && hatOffeneEntwuerfe(dokument.meta)) {
		return <EntwurfMinis zugang={zugang} dokument={dokument} />;
	}
	if (!dokument || src === null || fehlt) {
		return (
			<div className="flex size-full items-center justify-center text-rand-feld" data-platzhalter>
				<Symbol name="blatt" className="size-16" />
			</div>
		);
	}
	const quer = QUERFORMATE.includes(dokument.meta.format);
	return (
		<div className={quer ? 'flex size-full items-center justify-center p-3' : 'px-[12%]'}>
			<img
				className={klassen('bg-flaeche shadow-1', quer ? 'max-h-full max-w-full' : 'w-full')}
				src={src}
				alt=""
				onError={onError}
				loading="lazy"
				decoding="async"
				draggable={false}
			/>
		</div>
	);
};

/**
 * Erste Seite eines Dokuments als Bild, wie ein Blatt auf dem Tisch. Hochformate zeigen den oberen Teil, Querformate
 * und Folien passen ganz hinein. Solange es noch kein Bild gibt (der Server baut es im Hintergrund), steht ein
 * ruhiger Platzhalter da. Wartet das Dokument auf die Wahl eines Entwurfs, stehen dort die Entwürfe (nur für die
 * Lehrkraft; Teilen-Links sehen keine Entwürfe).
 */
export const Vorschau = ({ className, dokument, zugang }: Eigenschaften) => (
	<div className={klassen('relative aspect-[8/7] overflow-hidden bg-leinwand', className)}>
		<Bild zugang={zugang} dokument={dokument} />
	</div>
);

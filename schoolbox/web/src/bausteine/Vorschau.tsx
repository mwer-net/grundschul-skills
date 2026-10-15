import { hatOffeneEntwuerfe } from '../entwuerfe/offen';
import { EntwurfMinis } from '../entwuerfe/Teile';
import { QUERFORMATE } from '../lib/text';
import type { Zugang } from '../lib/zugang';
import { vorschauAdresse } from '../lib/zugang';
import type { DokumentEintrag } from '../typen';
import { klassen } from './klassen';
import { Symbol } from './Symbol';

interface Eigenschaften {
	zugang: Zugang;
	dokument: DokumentEintrag | undefined;
	className?: string;
}

const Bild = ({ dokument, zugang }: { zugang: Zugang; dokument: DokumentEintrag | undefined }) => {
	if (dokument !== undefined && zugang.token === null && hatOffeneEntwuerfe(dokument.meta)) {
		return <EntwurfMinis zugang={zugang} dokument={dokument} />;
	}
	if (!dokument?.vorschau) {
		return (
			<div className="flex size-full items-center justify-center text-[#bdb8ad]" data-platzhalter>
				<Symbol name="blatt" className="size-16" />
			</div>
		);
	}
	const quer = QUERFORMATE.includes(dokument.meta.format);
	return (
		<div className={quer ? 'flex size-full items-center justify-center p-5' : 'px-10 pt-5'}>
			<img
				className={klassen('bg-white shadow-md', quer ? 'max-h-full max-w-full' : 'w-full')}
				src={vorschauAdresse(zugang, dokument.id, dokument.vorschau)}
				alt=""
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
	<div className={klassen('relative aspect-[4/3] overflow-hidden bg-[#e9e6df]', className)}>
		<Bild zugang={zugang} dokument={dokument} />
	</div>
);

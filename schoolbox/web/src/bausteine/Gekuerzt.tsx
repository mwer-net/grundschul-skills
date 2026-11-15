import type { HTMLAttributes } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

import { klassen } from './klassen';
import { Tooltip } from './Tooltip';

interface Eigenschaften {
	text: string;
	voll?: string;
	className?: string;
	/** Wie am `Tooltip`: daneben statt darüber, still während eines Zugs. */
	seite?: 'top' | 'right';
	aus?: boolean;
}

/** Was ein `span` sonst annimmt, ohne Kinder; dazu beliebige `data-*`. */
type SpanAttribute = Omit<HTMLAttributes<HTMLSpanElement>, 'children'>;
type DatenAttribute = Record<`data-${string}`, string | boolean | undefined>;

/**
 * Ein Name, der mit „…“ endet, wenn der Platz fehlt. Nur dann zeigt der Tooltip den vollen Text (`voll`, sonst der
 * Text selbst); ungekürzt bleibt er still. Gemessen wird bei jeder Größenänderung.
 */
export const Gekuerzt = ({
	aus = false,
	className,
	seite,
	text,
	voll,
	...rest
}: Eigenschaften & SpanAttribute & DatenAttribute) => {
	const feld = useRef<HTMLSpanElement>(null);
	const [gekuerzt, setGekuerzt] = useState(false);
	useLayoutEffect(() => {
		const el = feld.current;
		if (!el) {
			return;
		}
		const miss = () => setGekuerzt(el.scrollWidth > el.clientWidth + 1 || (voll !== undefined && voll !== text));
		miss();
		const beobachter = new ResizeObserver(miss);
		beobachter.observe(el);
		return () => beobachter.disconnect();
	}, [text, voll]);
	return (
		<Tooltip text={voll ?? text} aus={aus || !gekuerzt} seite={seite}>
			<span ref={feld} className={klassen('min-w-0 truncate', className)} {...rest}>
				{text}
			</span>
		</Tooltip>
	);
};

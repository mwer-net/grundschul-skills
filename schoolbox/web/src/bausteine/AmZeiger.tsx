import type { ComponentProps } from 'react';
import { createPortal } from 'react-dom';

import { klassen } from './klassen';

/** Was am Zeiger hängt, solange gezogen wird; über allem, auch über Menüs. */
export const AmZeiger = ({ className, x, y, ...rest }: ComponentProps<'div'> & { x: number; y: number }) =>
	createPortal(
		<div
			className={klassen('pointer-events-none fixed top-0 left-0 z-meldung', className)}
			style={{ transform: `translate(${x + 8}px, ${y + 8}px)` }}
			{...rest}
		/>,
		document.body,
	);

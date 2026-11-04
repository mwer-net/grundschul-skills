import type { MouseEvent } from 'react';

import { TEXTWERKZEUG } from './text';

/** Knöpfe, die beim Drücken den Cursor im Text lassen. */
export const halteFokus = { [TEXTWERKZEUG]: '', onMouseDown: (e: MouseEvent) => e.preventDefault() };

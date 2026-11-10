import type { Verlauf } from '@schoolbox/kern/src/aussehen';

/** Wie der Verlauf im Material aussieht, für die kleine Vorschau. */
export const verlaufCss = (doc: Document | null, { art, f1, f2, winkel }: Verlauf) => {
	const farbe = (f: string) => {
		const variable = /^var\((--[\w-]+)\)$/.exec(f)?.[1];
		return variable ? sichtbar(doc, variable) : f;
	};
	return art === 'radial'
		? `radial-gradient(circle, ${farbe(f1)}, ${farbe(f2)})`
		: `linear-gradient(${winkel + 90}deg, ${farbe(f1)}, ${farbe(f2)})`;
};

/** Wie die Variable im Material gerade aussieht; ohne Material ein neutrales Grau. */
export const sichtbar = (doc: Document | null, variable: string) => {
	const body = doc?.body;
	const fenster = doc?.defaultView;
	return (body && fenster?.getComputedStyle(body).getPropertyValue(variable).trim()) || '#999999';
};

import { elementZu, nrVon } from './darstellung';

/** Nummer des gesperrten Elements (`data-gesperrt`), in dem die Auswahl liegt, sonst `null`. */
export const gesperrtIn = (doc: Document | null, nr: number) => {
	const element = doc ? elementZu(doc, nr)?.closest('[data-gesperrt]') : null;
	return element ? nrVon(element) : null;
};

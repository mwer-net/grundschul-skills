/** Offen ist etwas, das die Tastatur für sich braucht. Dann ruhen die Tasten des Blatts. */
export const TASTEN_SPERRE_OHNE_LISTE =
	'dialog[open], [role="dialog"], [role="menu"], [data-kontextmenue], [data-zieht]';
/** Die Ablage ist selbst eine `listbox`, deshalb gilt dort die Fassung ohne Liste. */
export const TASTEN_SPERRE = `${TASTEN_SPERRE_OHNE_LISTE}, [role="listbox"]`;

/** Ereignisse kommen auch aus dem `iframe`: `instanceof` kennt dessen Klassen nicht. */
const element = (ziel: EventTarget | null) => {
	const e = ziel as Partial<Element> | null;
	return typeof e?.closest === 'function' ? (e as Element) : null;
};

export const istFeld = (ziel: EventTarget | null) => {
	const e = ziel as Partial<HTMLElement> | null;
	return Boolean(e?.isContentEditable) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e?.tagName ?? '');
};

const BEDIENELEMENT = 'button, a[href], summary, [role="button"], [role="tab"], [role="menuitem"], [role="radio"]';
const HAT_PFEILE = '[role="tab"], [role="radio"], [role="slider"], [role="menuitem"], [role="option"]';

/**
 * Ein Knopf mit Fokus behält ⏎, Leertaste und Tab, ein Reiter auch seine Pfeile. Sonst ließe sich die Bedienung nicht
 * mehr mit der Tastatur erreichen. ⌫ oder ein Kürzel mit ⌘ gehört weiter dem Blatt.
 */
export const gehoertDemElement = (e: KeyboardEvent) => {
	if (e.metaKey || e.ctrlKey || e.altKey) {
		return false;
	}
	const ziel = element(e.target);
	if (['Enter', ' ', 'Tab'].includes(e.key)) {
		return Boolean(ziel?.closest(BEDIENELEMENT));
	}
	return /^(Arrow|Home$|End$)/.test(e.key) && Boolean(ziel?.closest(HAT_PFEILE));
};

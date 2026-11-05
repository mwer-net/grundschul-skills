/** Offen ist etwas, das die Tastatur für sich braucht. Dann ruhen die Tasten des Blatts. */
export const TASTEN_SPERRE_OHNE_LISTE =
	'dialog[open], [role="dialog"], [role="menu"], [data-kontextmenue], [data-zieht]';
/** Die Fläche der Ablage ist selbst eine `listbox`, aber kein offenes Auswahlfeld: ⌘K und ⌘J gelten dort weiter. */
export const TASTEN_SPERRE = `${TASTEN_SPERRE_OHNE_LISTE}, [role="listbox"]:not([data-ablage-liste])`;

/** Ereignisse kommen auch aus dem `iframe`: `instanceof` kennt dessen Klassen nicht. */
const element = (ziel: EventTarget | null) => {
	const e = ziel as Partial<Element> | null;
	return typeof e?.closest === 'function' ? (e as Element) : null;
};

export const istFeld = (ziel: EventTarget | null) => {
	const e = ziel as Partial<HTMLElement> | null;
	return Boolean(e?.isContentEditable) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e?.tagName ?? '');
};

const TEXT_EINGABEN = ['text', 'search', 'url', 'email', 'password', 'tel', 'number'];

/**
 * Nur hier gibt es etwas, das der Browser selbst zurücknehmen könnte. Auswahllisten, Regler, Kästchen und Knöpfe haben
 * kein Text-Undo: Dort gehören ⌘Z und ⇧⌘Z immer dem Blatt.
 */
export const istTextfeld = (ziel: EventTarget | null) => {
	const e = ziel as Partial<HTMLInputElement> | null;
	if (e?.isContentEditable || e?.tagName === 'TEXTAREA') {
		return true;
	}
	return e?.tagName === 'INPUT' && TEXT_EINGABEN.includes(e.type ?? 'text');
};

/** Chat, Suche und was sonst nichts mit dem Blatt zu tun hat: Sein Inhalt steht in keinem Schritt. */
export const EIGENE_GESCHICHTE = { 'data-eigene-geschichte': '' };

const hatEigeneGeschichte = (ziel: EventTarget | null) => Boolean(element(ziel)?.closest('[data-eigene-geschichte]'));

const felder = new WeakMap<object, { wert: string; geaendert: boolean }>();

/** Merkt sich je Feld den Wert beim Fokus. ⏎ übernimmt den Wert: Ab da zählt er als unverändert. */
export const beobachteFelder = (fenster: Pick<Window, 'addEventListener' | 'removeEventListener'>) => {
	const merke = (e: Event) => {
		if (istTextfeld(e.target)) {
			felder.set(e.target as object, { wert: (e.target as HTMLInputElement).value, geaendert: false });
		}
	};
	const eingabe = (e: Event) => {
		const feld = e.target as HTMLInputElement;
		if (istTextfeld(feld)) {
			const stand = felder.get(feld);
			felder.set(feld, { wert: stand?.wert ?? '', geaendert: !stand || feld.value !== stand.wert });
		}
	};
	const taste = (e: Event) => {
		if ((e as KeyboardEvent).key === 'Enter' && (e.target as Partial<Element>).tagName !== 'TEXTAREA') {
			merke(e);
		}
	};
	fenster.addEventListener('focusin', merke);
	fenster.addEventListener('input', eingabe);
	fenster.addEventListener('keydown', taste, true);
	return () => {
		fenster.removeEventListener('focusin', merke);
		fenster.removeEventListener('input', eingabe);
		fenster.removeEventListener('keydown', taste, true);
	};
};

/**
 * Bleibt ⌘Z bei diesem Feld? Ja bei allem außerhalb des Blatts und bei einem Textfeld, das seit dem Fokus geändert
 * wurde: Sonst änderte das Korrigieren im Feld das Blatt.
 */
export const behaeltUndo = (ziel: EventTarget | null) =>
	istTextfeld(ziel) && (hatEigeneGeschichte(ziel) || Boolean(felder.get(ziel as object)?.geaendert));

/** Ein Feld des Inspektors übernimmt seinen Wert beim Verlassen. Felder mit eigener Geschichte bleiben, wie sie sind. */
export const loeseFeld = (ziel: Element | null) => {
	if (istTextfeld(ziel) && !hatEigeneGeschichte(ziel)) {
		(ziel as HTMLElement).blur();
	}
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

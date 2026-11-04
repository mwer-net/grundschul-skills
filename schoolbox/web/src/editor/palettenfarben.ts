import type { Palette } from '@schoolbox/kern/src/kit-einstellungen';

const FARBEN = /^body\.palette-(\w+)$/;

/** Liest die Farben aus den Regeln des Materials, damit das Panel keine Kopie von `blatt.css` führt. */
export const palettenFarben = (doc: Document | null) => {
	const farben: Partial<Record<Palette, { haupt: string; akzent: string }>> = {};
	for (const blatt of doc ? [...doc.styleSheets] : []) {
		let regeln: CSSRule[] = [];
		try {
			regeln = [...blatt.cssRules];
		} catch {
			continue;
		}
		for (const regel of regeln) {
			// `instanceof` ginge hier nicht: Die Regeln stammen aus dem Fenster des Materials.
			const { selectorText, style } = regel as CSSStyleRule;
			const name = FARBEN.exec(selectorText ?? '')?.[1] as Palette | undefined;
			if (name && style) {
				farben[name] = {
					haupt: style.getPropertyValue('--haupt').trim(),
					akzent: style.getPropertyValue('--akzent').trim(),
				};
			}
		}
	}
	return farben;
};

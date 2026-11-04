export const istMac = () => /Mac|iPhone|iPad/.test(navigator.platform) || navigator.userAgent.includes('Mac OS');

/** Anzeige eines Kürzels wie `⇧⌘D`: am Mac wie geschrieben, sonst `Strg+Umschalt+D`. */
export const kuerzelAnzeige = (text: string, mac = istMac()) =>
	mac
		? text
		: text
				.replace('⌥', 'Alt+')
				.replace('⇧', 'Umschalt+')
				.replace('⌘', 'Strg+')
				.replace('⌫', 'Rücktaste')
				.replace('⏎', 'Eingabe');

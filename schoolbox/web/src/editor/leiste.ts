/** Lücke zwischen den Miniaturen der Seitenleiste, in Pixeln des Materials. */
export const LUECKE = 140;

const STIL = [
	'@media screen{html,body{background:none!important;padding:0!important}',
	`.seite{margin:0 0 ${LUECKE}px!important;box-shadow:none!important}}`,
].join('');

/** Für die Miniaturen: Seiten ohne Schatten dicht untereinander, oben bündig. */
export const leistenHtml = (html: string) => html.replace('</head>', `<style>${STIL}</style></head>`);

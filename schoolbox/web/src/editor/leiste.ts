const STIL =
	'@media screen{html,body{background:none!important;padding:0!important}.seite{margin:0!important;box-shadow:none!important}}';

/** Für die Miniaturen: Seiten ohne Schatten und ohne Rand; wo sie liegen, bestimmt die Gliederung. */
export const leistenHtml = (html: string) => html.replace('</head>', `<style>${STIL}</style></head>`);

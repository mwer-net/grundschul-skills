/** Sichtbarer Text und Auszeichnung in einem Stück HTML. Ohne Silbentrennung, damit der Editor dies sofort laden kann. */

/** Zeichen im sichtbaren Text, mit zusammengefasstem Leerraum. */
export interface Bereich {
	von: number;
	bis: number;
}

export interface Stueck {
	roh: string;
	zeichen: string;
	tag: boolean;
	/** Ein `|` in `x-silben`: Es steht in der Quelle, sichtbar ist es nicht. */
	strich?: boolean;
	/** Steht in einem `x-silben`. */
	inSilben?: boolean;
}

const ENTITAETEN: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&nbsp;': ' ',
	'&shy;': '',
};
const entschluessele = (e: string) => {
	if (ENTITAETEN[e] !== undefined) {
		return ENTITAETEN[e];
	}
	const z = /^&#(x?)([0-9a-f]+);$/i.exec(e);
	return z?.[2] ? String.fromCodePoint(Number.parseInt(z[2], z[1] ? 16 : 10)) : e;
};
export const maskiere = (t: string) =>
	t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const SILBEN_AUF = /^<x-silben[\s>]/;
export const SILBEN_ZU = /^<\/x-silben\s*>/;

/**
 * Zerlegt HTML in Tags und Zeichen. Der Leerraum ist zusammengefasst wie im Browser, die Zählung passt zur Auswahl.
 * `inSilben`: Das HTML ist schon der Inhalt eines `x-silben`.
 */
export const stueckeVon = (html: string, inSilben = false) => {
	const stuecke: Stueck[] = [];
	let leer = true;
	let silben = inSilben;
	for (const m of html.matchAll(/<[^>]*>|&[#\w]+;|\s+|[\s\S]/gu)) {
		const roh = m[0];
		if (roh.startsWith('<')) {
			silben = SILBEN_AUF.test(roh) || (silben && !SILBEN_ZU.test(roh));
			// `abbildungen.js` zeichnet den Inhalt ohne Leerraum am Anfang.
			leer = leer || SILBEN_AUF.test(roh);
			stuecke.push({ roh, zeichen: '', tag: true });
			continue;
		}
		if (silben && roh === '|') {
			stuecke.push({ roh, zeichen: '', tag: false, strich: true, inSilben: true });
			continue;
		}
		const istLeer = /^\s+$/.test(roh);
		const zeichen = roh.startsWith('&') ? entschluessele(roh) : (istLeer && ' ') || roh;
		const weg = zeichen === ' ' && leer;
		stuecke.push({ roh, zeichen: weg ? '' : zeichen, tag: false, inSilben: silben });
		leer = zeichen === ' ';
	}
	return stuecke;
};

export const textVon = (stuecke: Stueck[]) => stuecke.map((s) => s.zeichen).join('');

export const reinerText = (html: string, inSilben = false) => textVon(stueckeVon(html, inSilben)).trimEnd();

const OHNE_ENDE = /^<(?:br|wbr|img|hr|input|!--)/i;
const tagName = (roh: string) => /^<\/?([a-z][\w-]*)/i.exec(roh)?.[1]?.toLowerCase() ?? '';

/** Was am Ende von `stuecke` noch offen ist, außen zuerst. */
export const offeneTags = (stuecke: Stueck[]) => {
	const offen: string[] = [];
	for (const s of stuecke) {
		if (s.tag && !OHNE_ENDE.test(s.roh)) {
			if (s.roh.startsWith('</')) {
				const i = offen.findLastIndex((t) => tagName(t) === tagName(s.roh));
				if (i >= 0) {
					offen.splice(i, 1);
				}
			} else {
				offen.push(s.roh);
			}
		}
	}
	return offen;
};
export const schliesser = (auf: string) => `</${tagName(auf)}>`;

/** Jedes Zeichen mit den Tags, die es umschließen; Silbenstriche zählen nicht. */
const zeichenMitHuelle = (innen: string) => {
	const zeichen: { z: string; huelle: string[] }[] = [];
	const offen: string[] = [];
	for (const s of innen.matchAll(/<[^>]*>|&[#\w]+;|[\s\S]/gu)) {
		const roh = s[0];
		if (!roh.startsWith('<')) {
			if (roh !== '|') {
				zeichen.push({ z: roh, huelle: [...offen] });
			}
		} else if (roh.startsWith('</')) {
			const i = offen.findLastIndex((t) => tagName(t) === tagName(roh));
			if (i >= 0) {
				offen.splice(i, 1);
			}
		} else if (!OHNE_ENDE.test(roh)) {
			offen.push(roh);
		}
	}
	return zeichen;
};

/**
 * Neuer Text für ein Element mit Auszeichnung (`<mark>`, `<b>` in `x-silben`): Was vorn und hinten gleich geblieben ist,
 * behält seine Hülle; neu Getipptes hat keine. `neu` ist maskiert, wie es in die Quelle kommt.
 */
export const uebertrageAuszeichnung = (altInnen: string, neu: string) => {
	const alt = zeichenMitHuelle(altInnen.trim());
	const teile = [...neu.matchAll(/&[#\w]+;|[\s\S]/gu)].map((m) => m[0]);
	const buchstaben = teile.filter((t) => t !== '|');
	let vorn = 0;
	while (vorn < alt.length && vorn < buchstaben.length && alt[vorn]?.z === buchstaben[vorn]) {
		vorn += 1;
	}
	let hinten = 0;
	while (
		hinten < alt.length - vorn &&
		hinten < buchstaben.length - vorn &&
		alt[alt.length - 1 - hinten]?.z === buchstaben[buchstaben.length - 1 - hinten]
	) {
		hinten += 1;
	}
	const huelleAn = (i: number) => {
		if (i < vorn) {
			return alt[i]?.huelle ?? [];
		}
		return i >= buchstaben.length - hinten ? (alt[alt.length - buchstaben.length + i]?.huelle ?? []) : [];
	};
	let aus = '';
	let offen: string[] = [];
	const wechsle = (ziel: string[]) => {
		let gemein = 0;
		while (gemein < offen.length && gemein < ziel.length && offen[gemein] === ziel[gemein]) {
			gemein += 1;
		}
		aus += offen.slice(gemein).reverse().map(schliesser).join('') + ziel.slice(gemein).join('');
		offen = ziel;
	};
	let nr = 0;
	for (const t of teile) {
		if (t === '|') {
			// Der Strich bleibt in der Hülle, wenn sie auf beiden Seiten gilt: dieselbe Form wie nach „Vokale“.
			wechsle(offen.filter((h, i) => huelleAn(nr)[i] === h));
		} else {
			wechsle(huelleAn(nr));
			nr += 1;
		}
		aus += t;
	}
	wechsle([]);
	return aus;
};

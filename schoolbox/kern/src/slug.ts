import type { Fach, Klasse } from './werte';
import { FACH_KUERZEL } from './werte';

const ERSATZ: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

export const slug = (text: string, maxLaenge = 48): string => {
	const roh = text
		.toLowerCase()
		.replace(/[äöüß]/g, (zeichen) => ERSATZ[zeichen] ?? zeichen)
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	if (roh.length <= maxLaenge) {
		return roh;
	}
	const kopf = roh.slice(0, maxLaenge + 1);
	const ende = kopf.lastIndexOf('-');
	return (ende > 0 ? kopf.slice(0, ende) : roh.slice(0, maxLaenge)).replace(/-+$/, '');
};

export const eindeutigeId = (basis: string, belegt: (id: string) => boolean): string => {
	if (!belegt(basis)) {
		return basis;
	}
	let n = 2;
	while (belegt(`${basis}-${n}`)) {
		n += 1;
	}
	return `${basis}-${n}`;
};

export const lokalesDatum = (zeit: Date): string =>
	[zeit.getFullYear(), zeit.getMonth() + 1, zeit.getDate()].map((n) => String(n).padStart(2, '0')).join('-');

export const mappenSlug = (titel: string, fach: Fach, klasse: Klasse, zeit: Date): string => {
	const stufe = klasse === 'gemischt' ? 'gemischt' : `kl${klasse}`;
	return [lokalesDatum(zeit), slug(titel, 40) || 'mappe', FACH_KUERZEL[fach], stufe].join('-');
};

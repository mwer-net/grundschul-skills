import { useEffect, useRef } from 'react';

import { useHinweis } from '../bausteine/hinweis';
import { nrVon } from './darstellung';
import { FOTO_HINWEIS, gesehen, merkeGesehen } from './Bildpanel';
import { legeAb } from './gestaltung/ablegen/ablegen';
import { bildBausteinAn, bildGut } from './gestaltung/ablegen/bild-gut';
import { eckeVon, markiereZiel, seiteUnter } from './gestaltung/ablegen/vorschau';
import { zielFuer } from './gestaltung/ablegen/ziele';
import { ordnungFuer } from './luecke';
import type { SchubladenTeile } from './schubladen';
import { platzAn } from './ziele';

const HEIC = /\.hei[cf]$/i;

const istBild = (datei: File) => datei.type.startsWith('image/') || HEIC.test(datei.name);

const mitDateien = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'));

/** Ein Gut ohne Datei, nur damit die Ziele schon beim Darüberziehen zeigen, was passieren wird. */
const PROBE = bildGut({ src: '', alt: '', natur: null });

/**
 * Eine Bilddatei aus dem Finder auf die Seite (103): hochladen wie „Foto hochladen“ (`bereiteVor`, `sendeDatei`), dann
 * frei an der Stelle des Drops ablegen. Mit ⌘ wird sie Bild-Baustein im Stapel, auf einem Bild tauscht sie aus, in
 * einem Platzhalter füllt sie ihn. Der Datenschutz-Hinweis kommt einmal je Sitzung vor dem ersten Hochladen. Andere
 * Dateien bleiben still liegen; Text, den man zieht, behandelt weiter `textdom.ts`.
 */
export const useBildAusFinder = (teile: Pick<SchubladenTeile, 'doc' | 'struktur' | 'bild' | 'einfuegen' | 'folien'>) => {
	const jetzt = useRef(teile);
	const zeige = useHinweis();
	useEffect(() => {
		jetzt.current = teile;
	});
	const { doc } = teile;

	useEffect(() => {
		if (!doc) {
			return undefined;
		}
		const ueber = (e: DragEvent) => {
			if (!mitDateien(e)) {
				return;
			}
			// Sonst öffnet der Browser die Datei an Stelle des Blatts.
			e.preventDefault();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'copy';
			}
			const ziel = jetzt.current.struktur.aktiv ? zielFuer(doc.elementFromPoint(e.clientX, e.clientY), PROBE) : null;
			markiereZiel(doc, ziel?.rahmen ?? null);
		};
		const weg = () => markiereZiel(doc, null);

		const lege = async (datei: File, x: number, y: number, cmd: boolean, unter: Element | null) => {
			const t = jetzt.current;
			const geladen = await t.bild.ladeHoch(datei);
			if (!geladen) {
				return;
			}
			const bild = { src: geladen.src, alt: geladen.alt, natur: { breite: geladen.breite, hoehe: geladen.hoehe } };
			const platz = t.einfuegen.eintraege.find((p) => p.id === 'platzhalter');
			const gut = bildGut(bild, { platz, jeSeite: t.folien, struktur: t.struktur });
			if (cmd) {
				const ordnung = gut.imStapel ? ordnungFuer(doc, gut.imStapel.html) : null;
				const ablage = ordnung ? platzAn(ordnung, x, y)?.ablage : undefined;
				if (platz && ablage) {
					t.struktur.fuehreAus('Bild eingefügt', bildBausteinAn(platz, bild, ablage, t.folien), true);
				}
				return;
			}
			const treffer = zielFuer(unter?.isConnected ? unter : doc.elementFromPoint(x, y), gut);
			if (treffer) {
				t.struktur.fuehreAus(treffer.text, treffer.lege);
				return;
			}
			const seite = seiteUnter(doc, x, y);
			const nr = seite ? nrVon(seite) : null;
			if (!seite || nr === null) {
				return;
			}
			const ecke = eckeVon(seite);
			const b = gut.groesse.b;
			const h = (b * bild.natur.hoehe) / Math.max(1, bild.natur.breite);
			legeAb(t.struktur, gut, { seite: nr, x: x - ecke.x - b / 2, y: y - ecke.y - h / 2 });
		};

		const fallen = (e: DragEvent) => {
			if (!mitDateien(e)) {
				return;
			}
			e.preventDefault();
			markiereZiel(doc, null);
			const datei = [...(e.dataTransfer?.files ?? [])].find(istBild);
			if (!datei || !jetzt.current.struktur.aktiv) {
				return;
			}
			const { clientX: x, clientY: y, metaKey: cmd } = e;
			const unter = doc.elementFromPoint(x, y);
			const weiter = () => void lege(datei, x, y, cmd, unter);
			if (gesehen()) {
				weiter();
				return;
			}
			zeige({
				text: FOTO_HINWEIS,
				aktion: {
					titel: 'Verstanden, hochladen',
					ausfuehren: () => {
						merkeGesehen();
						weiter();
					},
				},
			});
		};

		doc.addEventListener('dragover', ueber);
		doc.addEventListener('dragleave', weg);
		doc.addEventListener('drop', fallen);
		return () => {
			doc.removeEventListener('dragover', ueber);
			doc.removeEventListener('dragleave', weg);
			doc.removeEventListener('drop', fallen);
		};
	}, [doc, zeige]);
};

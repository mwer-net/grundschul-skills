import { useEffect, useRef } from 'react';

import { useHinweis } from '../bausteine/hinweis';
import { gesehen, merkeGesehen } from './bild-sammlung';
import { FOTO_HINWEIS } from './Bildpanel';
import { nrVon } from './darstellung';
import { legeAb, legeInMitte } from './gestaltung/ablegen/ablegen';
import { bildBausteinAn, bildGut } from './gestaltung/ablegen/bild-gut';
import { eckeVon, markiereZiel, seiteUnter } from './gestaltung/ablegen/vorschau';
import { zielFuer } from './gestaltung/ablegen/ziele';
import { ordnungFuer } from './luecke';
import type { SchubladenTeile } from './schubladen';
import { platzAn } from './ziele';

const HEIC = /\.hei[cf]$/i;

const istBild = (datei: File) => datei.type.startsWith('image/') || HEIC.test(datei.name);

const mitDateien = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'));

/** 199-18: Wie weit jedes weitere Bild aus demselben Drop nach rechts unten rückt (wie `legeInMitte`). */
const VERSATZ = 16;

/** Dort nimmt der Editor selbst Dateien an: die Schublade „Bilder“ lädt hoch (199). */
const NIMMT_DATEIEN = '[data-schublade-bilder]';

/** Ein Gut ohne Datei, nur damit die Ziele schon beim Darüberziehen zeigen, was passieren wird. */
const PROBE = bildGut({ src: '', alt: '', natur: null });

/**
 * Eine Bilddatei aus dem Finder auf die Seite (103): hochladen wie „Foto hochladen“ (`bereiteVor`, `sendeDatei`), dann
 * frei an der Stelle des Drops ablegen. Mit ⌘ wird sie Bild-Baustein im Stapel, auf einem Bild tauscht sie aus, in
 * einem Platzhalter füllt sie ihn. Der Datenschutz-Hinweis kommt einmal je Sitzung vor dem ersten Hochladen. Mehrere
 * Bilder legt sie je 16 px versetzt ab, das letzte ist gewählt; ohne Bild sagt ein Hinweis, warum nichts geschieht
 * (199-18). Neben dem Blatt öffnet der Browser die Datei nie (199-04). Text, den man zieht, behandelt `textdom.ts`.
 */
export const useBildAusFinder = (
	teile: Pick<SchubladenTeile, 'doc' | 'struktur' | 'bild' | 'einfuegen' | 'folien'>,
) => {
	const jetzt = useRef(teile);
	const zeige = useHinweis();
	useEffect(() => {
		jetzt.current = teile;
	});
	const { doc } = teile;

	// 199-04: Außerhalb des Blatts und der Schublade „Bilder“ fällt eine Datei ins Leere, statt den Editor zu verlassen.
	useEffect(() => {
		const draussen = (e: DragEvent) => {
			if (!mitDateien(e) || (e.target instanceof Element && e.target.closest(NIMMT_DATEIEN))) {
				return;
			}
			e.preventDefault();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'none';
			}
		};
		window.addEventListener('dragover', draussen);
		window.addEventListener('drop', draussen);
		return () => {
			window.removeEventListener('dragover', draussen);
			window.removeEventListener('drop', draussen);
		};
	}, []);

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
			const ziel = jetzt.current.struktur.aktiv
				? zielFuer(doc.elementFromPoint(e.clientX, e.clientY), PROBE)
				: null;
			markiereZiel(doc, ziel?.rahmen ?? null);
		};
		const weg = () => markiereZiel(doc, null);

		/**
		 * Ein Schritt gilt erst, wenn sein Bild steht (171); bis dahin nähme die Struktur das nächste Bild nicht an. Höchstens
		 * etwa fünf Sekunden, dann versucht es das Bild trotzdem.
		 */
		const bisBereit = async () => {
			for (let i = 0; i < 250 && !jetzt.current.struktur.gezeigt?.gleich; i++) {
				await new Promise((weiter) => setTimeout(weiter, 20));
			}
		};

		/** `frei`: das zweite und jedes weitere Bild eines Drops, nie auf ein Ziel (sonst tauschte es das erste aus). */
		const lege = async (datei: File, x: number, y: number, cmd: boolean, unter: Element | null, frei = false) => {
			const geladen = await jetzt.current.bild.ladeHoch(datei);
			if (frei) {
				await bisBereit();
			}
			const t = jetzt.current;
			// Nach jeder Änderung steht ein neues Dokument im `iframe`: immer das jüngste nehmen.
			const blatt = t.doc;
			if (!geladen || !blatt) {
				return;
			}
			const bild = {
				src: geladen.src,
				alt: geladen.alt,
				natur: { breite: geladen.breite, hoehe: geladen.hoehe },
			};
			const platz = t.einfuegen.eintraege.find((p) => p.id === 'platzhalter');
			const gut = bildGut(bild, { platz, jeSeite: t.folien, struktur: t.struktur });
			// 199-N03: Wo es keinen Ort gibt (neben der Seite, ⌘ ohne Stapel), kommt das Bild frei in die Mitte der
			// sichtbaren Seite wie aus der Schublade; hochgeladen und nirgends zu sehen gibt es nicht.
			const inDieMitte = () => void legeInMitte({ doc: blatt, folien: t.folien, struktur: t.struktur }, gut);
			if (cmd) {
				const ordnung = gut.imStapel ? ordnungFuer(blatt, gut.imStapel.html) : null;
				const ablage = ordnung ? platzAn(ordnung, x, y)?.ablage : undefined;
				if (platz && ablage) {
					t.struktur.fuehreAus('Bild eingefügt', bildBausteinAn(platz, bild, ablage, t.folien), true);
				} else {
					inDieMitte();
				}
				return;
			}
			const treffer = frei ? null : zielFuer(unter?.isConnected ? unter : blatt.elementFromPoint(x, y), gut);
			if (treffer) {
				t.struktur.fuehreAus(treffer.text, treffer.lege);
				return;
			}
			const seite = seiteUnter(blatt, x, y);
			const nr = seite ? nrVon(seite) : null;
			if (!seite || nr === null) {
				inDieMitte();
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
			if (!jetzt.current.struktur.aktiv) {
				return;
			}
			const dateien = [...(e.dataTransfer?.files ?? [])].filter(istBild);
			if (dateien.length === 0) {
				zeige({ text: 'Hier lassen sich nur Bilder ablegen.' });
				return;
			}
			const { clientX: x, clientY: y, metaKey: cmd } = e;
			const unter = doc.elementFromPoint(x, y);
			// Nacheinander, damit jedes Bild in die Quelle nach dem vorigen kommt und das letzte gewählt bleibt.
			const weiter = () =>
				void dateien.reduce(
					(vorher, datei, i) =>
						vorher.then(() =>
							i === 0
								? lege(datei, x, y, cmd, unter)
								: lege(datei, x + i * VERSATZ, y + i * VERSATZ, false, null, true),
						),
					Promise.resolve(),
				);
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

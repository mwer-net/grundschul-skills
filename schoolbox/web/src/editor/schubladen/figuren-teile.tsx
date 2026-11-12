import type { BibliotheksFigur, Pose } from '@schoolbox/kern/src/figuren';
import { poseName } from '@schoolbox/kern/src/figuren';
import { useEffect, useState } from 'react';

import { klassen } from '../../bausteine/klassen';
import {
	nichtsPasst,
	raster,
	Schublade,
	Schubladenabschnitt,
	SCHUBLADENKACHEL,
	Schubladenleer,
	Schubladensuche,
} from '../../bausteine/Schublade';
import { falte } from '../bild-sammlung';
import { mitGeholtemBild } from '../gestaltung/ablegen/bild-gut';
import { useHolenAmZeiger } from '../gestaltung/ablegen/holen-am-zeiger';
import { AblageKachel } from '../gestaltung/ablegen/Kachel';
import { ladeVor, useFiguren, vorschauVon } from '../gestaltung/figuren-quelle';
import type { SchubladenTeile } from '.';
import { gutFuer, srcFuer } from './figuren-daten';
import { kopf } from './reihe';

// Später: 128 setzt einen Abschnitt „Sticker“ unter die Figuren (nur bei „ja“ zu F3), als eigenen Abschnitt in `Inhalt`.

/** Jedes Wort der Suche steht im Namen der Figur, der Pose oder in den Suchwörtern; ohne Groß/klein und Umlaute. */
const passt = (figur: BibliotheksFigur, pose: Pose, woerter: readonly string[]) => {
	const text = falte([figur.name, poseName(figur, pose), ...figur.suchwoerter].join(' '));
	return woerter.every((wort) => text.includes(wort));
};

/** Figuren (177): je Figur ein Abschnitt mit allen Posen. Eine Pose kommt erst beim Ablegen ins Dokument. */
export const Inhalt = (t: SchubladenTeile) => {
	const figuren = useFiguren();
	const [suche, setSuche] = useState('');
	const { anzeige: holen, zeige } = useHolenAmZeiger();
	const woerter = falte(suche).split(' ').filter(Boolean);
	const gezeigt = figuren
		.map((figur) => ({ figur, posen: figur.posen.filter((p) => passt(figur, p, woerter)) }))
		.filter((f) => f.posen.length > 0);

	// Jedes neue Dokument im `iframe` (nach jeder Änderung) bekommt die Bilder vorgeladen.
	const vorschauen = figuren.flatMap((f) => f.posen.map(vorschauVon)).join('|');
	useEffect(() => ladeVor(t.doc, vorschauen.split('|')), [t.doc, vorschauen]);

	const { doc, folien, struktur } = t;
	const kachel = (figur: BibliotheksFigur, pose: Pose) => {
		// Dieselbe Adresse wie das Bild der Kachel; `mitGeholtemBild` tauscht genau diese gegen den echten `src`.
		const vorschau = vorschauVon(pose);
		const name = poseName(figur, pose);
		return (
			<AblageKachel
				key={pose.id}
				teile={{ doc, folien, struktur: mitGeholtemBild(struktur, vorschau, () => srcFuer(t, pose), zeige) }}
				gut={gutFuer(t, figur, pose, vorschau, zeige)}
				beschriftung={name}
				className={klassen(
					SCHUBLADENKACHEL,
					'flex aspect-square items-center justify-center p-1.5',
					!struktur.aktiv && 'pointer-events-none opacity-50',
				)}
			>
				<img
					src={vorschau}
					alt=""
					draggable={false}
					className="size-full object-contain"
					data-figur-kachel={pose.id}
				/>
			</AblageKachel>
		);
	};

	return (
		<>
			<Schublade
				titel={kopf('figuren').titel}
				daten={{ 'data-schublade-figuren': '' }}
				steuerung={<Schubladensuche beschriftung="Figuren suchen" wert={suche} setWert={setSuche} />}
			>
				{gezeigt.map(({ figur, posen }) => (
					<Schubladenabschnitt key={figur.id} titel={figur.name} daten={{ 'data-figuren-gruppe': figur.id }}>
						<div className={raster(3)}>{posen.map((pose) => kachel(figur, pose))}</div>
					</Schubladenabschnitt>
				))}
				{gezeigt.length === 0 && <Schubladenleer>{nichtsPasst(suche)}</Schubladenleer>}
			</Schublade>
			{holen}
		</>
	);
};

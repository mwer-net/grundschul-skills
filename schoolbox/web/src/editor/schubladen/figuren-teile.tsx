import type { Blick } from '@schoolbox/kern/src/figuren';
import { FIGUREN, figurSchluessel, spiegelnFuer } from '@schoolbox/kern/src/figuren';
import { useEffect, useState } from 'react';

import { klassen } from '../../bausteine/klassen';
import {
	KACHELNAME,
	raster,
	Schublade,
	Schubladenabschnitt,
	SCHUBLADENKACHEL,
	STEUER_SEGMENT,
} from '../../bausteine/Schublade';
import { Segment } from '../../bausteine/Segment';
import { AblageKachel } from '../gestaltung/ablegen/Kachel';
import { adresseVon, ladeVor, useFigurSrc } from '../gestaltung/figuren-quelle';
import type { SchubladenTeile } from '.';
import { blickJetzt, gutFuer, merkeBlick } from './figuren-daten';
import { kopf } from './reihe';

// Später: 128 setzt einen Abschnitt „Sticker“ unter „Willi & Co.“ (nur bei „ja“ zu F3), als eigenen Abschnitt in
// `Inhalt`; die Liste der Figuren bleibt.

const BLICKE: { wert: Blick; titel: string }[] = [
	{ wert: 'links', titel: 'schaut nach links' },
	{ wert: 'rechts', titel: 'schaut nach rechts' },
];

export const Inhalt = (t: SchubladenTeile) => {
	const [blick, setBlick] = useState<Blick>(blickJetzt);
	const adresse = adresseVon(t.doc) ?? t.bild.adresse;
	const srcVon = useFigurSrc(adresse);
	const srcs = FIGUREN.map(srcVon);
	const schluessel = srcs.join('|');

	// Jedes neue Dokument im `iframe` (nach jeder Änderung) bekommt die Bilder vorgeladen.
	useEffect(() => ladeVor(t.doc, schluessel.split('|')), [t.doc, schluessel]);

	const waehleBlick = (neu: Blick) => {
		setBlick(neu);
		merkeBlick(neu);
	};

	return (
		<Schublade
			titel={kopf('figuren').titel}
			daten={{ 'data-schublade-figuren': '' }}
			steuerung={
				<Segment
					beschriftung="Blickrichtung"
					className={STEUER_SEGMENT}
					werte={BLICKE}
					wert={blick}
					waehle={waehleBlick}
				/>
			}
		>
			<Schubladenabschnitt titel="Willi & Co." daten={{ 'data-figuren-gruppe': 'willi-co' }}>
				<div className={raster(2)}>
					{FIGUREN.map((f) => (
						<AblageKachel
							key={f.id}
							teile={t}
							gut={gutFuer(t, f, srcVon(f), blick)}
							beschriftung={f.name}
							className={klassen(
								SCHUBLADENKACHEL,
								'flex flex-col items-center gap-1 p-2',
								!t.struktur.aktiv && 'pointer-events-none opacity-50',
							)}
						>
							<img
								src={`/ansicht/${figurSchluessel(f)}`}
								alt=""
								draggable={false}
								className={klassen(
									'h-24 w-full object-contain',
									spiegelnFuer(f, blick) && '-scale-x-100',
								)}
								data-figur-kachel={f.id}
							/>
							<span className={KACHELNAME}>{f.name}</span>
						</AblageKachel>
					))}
				</div>
			</Schubladenabschnitt>
		</Schublade>
	);
};

import type { ReactNode } from 'react';
import { Route, Routes, useParams } from 'react-router-dom';

import { useKopfHoehe } from '../bausteine/kopf';
import { Zustand } from '../bausteine/Zustand';
import { useLaden } from '../lib/laden';
import { FACH_NAME, klasseName } from '../lib/text';
import { useTitel } from '../lib/titel';
import type { Zugang } from '../lib/zugang';
import { PdfKnopf } from '../pdf/PdfKnopf';
import { mappenWahl } from '../pdf/wahl';
import type { DokumentEintrag, Mappe } from '../typen';
import { Dokumentansicht } from './Dokumentansicht';
import { DokumentKachel } from './DokumentKachel';
import { Drucken } from './Drucken';
import { Praesentation } from './Praesentation';

interface Inhalt {
	ziel: { mappe: string; dok: string | null };
	mappe: Mappe;
	dokumente: DokumentEintrag[];
}

const GeteilteMappe = ({ inhalt, zugang }: { zugang: Zugang; inhalt: Inhalt }) => {
	const { dokumente, mappe } = inhalt;
	useTitel(mappe.titel);
	return (
		<>
			<div className="flex items-start justify-between gap-6 max-lg:flex-col max-lg:gap-4">
				<div>
					<h1 className="text-3xl max-md:text-2xl">{mappe.titel}</h1>
					<p className="mt-1 text-leise">{`${FACH_NAME[mappe.fach]} · ${klasseName(mappe.klasse)}`}</p>
				</div>
				{dokumente.length > 0 && (
					<PdfKnopf
						beschriftung="Alles als PDF"
						wahl={mappenWahl(zugang, dokumente)}
						mappe={mappe}
						warnen={false}
					/>
				)}
			</div>
			<ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-6 max-md:gap-4">
				{dokumente.map((dokument) => (
					<DokumentKachel key={dokument.id} zugang={zugang} mappe={mappe} dokument={dokument} />
				))}
			</ul>
		</>
	);
};

const GeteiltesDokument = ({ einzeln, zugang }: { zugang: Zugang; einzeln: boolean }) => {
	const { dok = '' } = useParams();
	return <Dokumentansicht zugang={zugang} dok={dok} zurueckZurMappe={!einzeln} />;
};

const GeteiltDrucken = ({ zugang }: { zugang: Zugang }) => {
	const { dok = '' } = useParams();
	return <Drucken zugang={zugang} dok={dok} />;
};

const GeteiltPraesentieren = ({ zugang }: { zugang: Zugang }) => {
	const { dok = '' } = useParams();
	return <Praesentation key={dok} zugang={zugang} dok={dok} />;
};

const GeteiltRahmen = ({ children }: { children: ReactNode }) => {
	const kopf = useKopfHoehe<HTMLElement>();
	return (
		<div className="flex min-h-dvh flex-col">
			<header ref={kopf} className="sticky top-0 z-30 border-b border-rand bg-white/95 backdrop-blur">
				<div className="mx-auto flex min-h-12 max-w-[90rem] items-center px-8 py-3 font-display text-3xl text-brand-600 max-lg:px-4 max-md:text-2xl">
					Schoolbox
				</div>
			</header>
			<main className="mx-auto w-full max-w-[90rem] flex-1 px-8 pt-8 pb-24 max-lg:px-4 max-md:pt-5">
				{children}
			</main>
		</div>
	);
};

/**
 * Teilen-Links: ein Dokument oder eine ganze Mappe ansehen, als PDF holen und drucken, ohne Anmeldung. Weiterteilen
 * und Ändern gehen hier nicht.
 */
export const Geteilt = () => {
	const { token = '' } = useParams();
	const { daten, fehler } = useLaden<Inhalt>(`/f/${token}/api/inhalt`);

	if (!daten) {
		return fehler ? (
			<Zustand symbol="achtung" titel="Schade!">
				<p>{fehler.message}</p>
				<p className="text-leise">Bitte frag nach einem neuen Link.</p>
			</Zustand>
		) : null;
	}

	const zugang: Zugang = { mappe: daten.mappe.id, token };
	const einzeln = daten.ziel.dok;
	const start =
		einzeln === null ? (
			<GeteilteMappe zugang={zugang} inhalt={daten} />
		) : (
			<Dokumentansicht zugang={zugang} dok={einzeln} zurueckZurMappe={false} />
		);
	const ansehen = (
		<GeteiltRahmen>
			<Routes>
				<Route index element={start} />
				<Route path="d/:dok" element={<GeteiltesDokument zugang={zugang} einzeln={einzeln !== null} />} />
			</Routes>
		</GeteiltRahmen>
	);
	return (
		<Routes>
			<Route path="d/:dok/drucken" element={<GeteiltDrucken zugang={zugang} />} />
			<Route path="d/:dok/praesentation" element={<GeteiltPraesentieren zugang={zugang} />} />
			{einzeln !== null && (
				<Route path="praesentation" element={<Praesentation zugang={zugang} dok={einzeln} />} />
			)}
			<Route path="*" element={ansehen} />
		</Routes>
	);
};

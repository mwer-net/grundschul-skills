import { standardSortierung } from '@schoolbox/kern/src/ordner-sortierung';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';

import { useKopfHoehe } from '../bausteine/kopf';
import { Symbol } from '../bausteine/Symbol';
import { Zustand } from '../bausteine/Zustand';
import { useLaden } from '../lib/laden';
import { useTitel } from '../lib/titel';
import type { Zugang } from '../lib/zugang';
import { kinder } from '../ordner/objekte';
import type { AblageDok, AblageOrdner, AblageStand } from '../ordner/typen';
import { PdfKnopf } from '../pdf/PdfKnopf';
import { mappenWahl } from '../pdf/wahl';
import type { DokumentEintrag, Mappe } from '../typen';
import { Dokumentansicht } from './Dokumentansicht';
import { DokumentKachel } from './DokumentKachel';
import { Drucken } from './Drucken';
import { Praesentation } from './Praesentation';

interface InhaltDok extends DokumentEintrag {
	mappe: string;
	fach: AblageDok['fach'];
	klasse: AblageDok['klasse'];
	ordner: string | null;
}

interface Inhalt {
	ziel: { mappe: string; dok: string | null } | { ordner: string };
	titel: string;
	wurzel: string | null;
	wurzelBehaelter: string | null;
	wurzelName: string | null;
	ordner: Omit<AblageOrdner, never>[];
	dokumente: InhaltDok[];
	mappe?: Mappe;
}

/** `d/<mappe>~<dok>`; das alte `d/<dok>` gehört zum Behälter des Links. */
const zugangVon = (token: string, adresse: string, standard: string): { zugang: Zugang; dok: string } => {
	const [links = '', rechts] = adresse.split('~');
	return rechts === undefined
		? { zugang: { mappe: standard, token }, dok: links }
		: { zugang: { mappe: links, token }, dok: rechts };
};

/** Nur lesend: Ein Klick öffnet, es gibt keine Auswahl. Unterordner und Pfad wie in der Ablage. */
const GeteilteAblage = ({ inhalt, token }: { inhalt: Inhalt; token: string }) => {
	const { ordner: offen } = useParams();
	const wurzelOrdner: AblageOrdner | null = inhalt.wurzel
		? {
				id: inhalt.wurzel,
				name: inhalt.wurzelName ?? inhalt.titel,
				eltern: null,
				behaelter: inhalt.wurzelBehaelter,
				erstellt: '',
				geaendert: '',
			}
		: null;
	const ordner = useMemo<AblageOrdner[]>(
		() => [...(wurzelOrdner ? [wurzelOrdner] : []), ...inhalt.ordner],
		// eslint-disable-next-line react-hooks/exhaustive-deps -- wurzelOrdner entsteht aus `inhalt`
		[inhalt],
	);
	const stand: AblageStand = {
		rev: 0,
		ordner,
		dokumente: inhalt.dokumente.map((d) => d),
		defekt: [],
		geteilt: { ordner: [], dokumente: [] },
	};
	const hier = ordner.find((o) => o.id === offen) ?? wurzelOrdner;
	useTitel(hier?.name ?? inhalt.titel);
	const objekte = kinder(stand, hier?.id ?? null, standardSortierung(hier));
	const pfad: AblageOrdner[] = [];
	for (let o = hier; o; o = ordner.find((x) => x.id === o?.eltern) ?? null) {
		pfad.unshift(o);
		if (o.id === inhalt.wurzel) {
			break;
		}
	}
	const zugangWurzel: Zugang = { mappe: inhalt.dokumente[0]?.mappe ?? '', token };
	const pdfBezug = { id: '', titel: inhalt.titel };
	return (
		<>
			<div className="flex items-start justify-between gap-4 max-lg:flex-col max-lg:gap-3">
				<div className="min-w-0">
					<nav
						aria-label="Pfad"
						className="flex flex-wrap items-center gap-1 text-sm text-leise"
						data-geteilt-pfad
					>
						{pfad.slice(0, -1).map((o) => (
							<span key={o.id} className="flex items-center gap-1">
								<Link
									className="text-leise"
									to={o.id === inhalt.wurzel ? `/f/${token}` : `/f/${token}/o/${o.id}`}
								>
									{o.name}
								</Link>
								<Symbol name="rechts" className="size-3 text-dezent" />
							</span>
						))}
					</nav>
					<h1 className="text-2xl">{hier?.name ?? inhalt.titel}</h1>
				</div>
				{inhalt.dokumente.length > 0 && (
					<PdfKnopf
						beschriftung="Alles als PDF"
						wahl={mappenWahl(zugangWurzel, inhalt.dokumente)}
						mappe={pdfBezug}
						warnen={false}
					/>
				)}
			</div>
			{objekte.length === 0 ? (
				<Zustand symbol="ordner" titel="Dieser Ordner ist leer" />
			) : (
				<ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-4">
					{objekte.map((o) =>
						o.istOrdner ? (
							<li
								key={o.schluessel}
								data-geteilt-ordner={o.ordner.id}
								className="overflow-hidden rounded-[10px] border border-rand bg-flaeche"
							>
								<Link to={`/f/${token}/o/${o.ordner.id}`} className="block text-tinte no-underline">
									<div className="flex aspect-[8/5] items-center justify-center bg-leinwand">
										<Symbol name="ordner" className="size-20 text-brand-200" />
									</div>
									<div className="border-t border-rand px-2.5 py-2">
										<h2 className="truncate text-sm font-medium">{o.name}</h2>
										<p className="truncate text-xs text-leise">
											{o.anzahl === 1 ? '1 Objekt' : `${o.anzahl} Objekte`}
										</p>
									</div>
								</Link>
							</li>
						) : (
							<DokumentKachel
								key={o.schluessel}
								zugang={{ mappe: o.dok.mappe, token }}
								mappe={{ id: o.dok.mappe, titel: inhalt.titel }}
								dokument={o.dok}
							/>
						),
					)}
				</ul>
			)}
		</>
	);
};

const GeteiltesDokument = ({ einzeln, standard, token }: { token: string; standard: string; einzeln: boolean }) => {
	const { dok = '' } = useParams();
	const ort = zugangVon(token, dok, standard);
	return <Dokumentansicht zugang={ort.zugang} dok={ort.dok} zurueckZurMappe={!einzeln} />;
};

const GeteiltDrucken = ({ standard, token }: { token: string; standard: string }) => {
	const { dok = '' } = useParams();
	const ort = zugangVon(token, dok, standard);
	return <Drucken zugang={ort.zugang} dok={ort.dok} />;
};

const GeteiltPraesentieren = ({ standard, token }: { token: string; standard: string }) => {
	const { dok = '' } = useParams();
	const ort = zugangVon(token, dok, standard);
	return <Praesentation key={dok} zugang={ort.zugang} dok={ort.dok} />;
};

const GeteiltRahmen = ({ children }: { children: ReactNode }) => {
	const kopf = useKopfHoehe<HTMLElement>();
	return (
		<div className="flex min-h-dvh flex-col">
			<header ref={kopf} className="sticky top-0 z-kopf border-b border-rand bg-flaeche">
				<div className="flex h-10 items-center px-4 text-base font-semibold text-tinte">Schoolbox</div>
			</header>
			<main className="w-full flex-1 px-4 pt-3 pb-16">{children}</main>
		</div>
	);
};

/**
 * Teilen-Links: ein Dokument oder einen ganzen Ordner ansehen, als PDF holen und drucken, ohne Anmeldung. Weiterteilen
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

	const standard = 'mappe' in daten.ziel ? daten.ziel.mappe : '';
	const einzeln = 'dok' in daten.ziel ? daten.ziel.dok : null;
	const zugang: Zugang = { mappe: standard, token };
	const start =
		einzeln === null ? (
			<GeteilteAblage token={token} inhalt={daten} />
		) : (
			<Dokumentansicht zugang={zugang} dok={einzeln} zurueckZurMappe={false} />
		);
	const ansehen = (
		<GeteiltRahmen>
			<Routes>
				<Route index element={start} />
				<Route path="o/:ordner" element={<GeteilteAblage token={token} inhalt={daten} />} />
				<Route
					path="d/:dok"
					element={<GeteiltesDokument token={token} standard={standard} einzeln={einzeln !== null} />}
				/>
			</Routes>
		</GeteiltRahmen>
	);
	return (
		<Routes>
			<Route path="d/:dok/drucken" element={<GeteiltDrucken token={token} standard={standard} />} />
			<Route path="d/:dok/praesentation" element={<GeteiltPraesentieren token={token} standard={standard} />} />
			{einzeln !== null && (
				<Route path="praesentation" element={<Praesentation zugang={zugang} dok={einzeln} />} />
			)}
			<Route path="*" element={ansehen} />
		</Routes>
	);
};

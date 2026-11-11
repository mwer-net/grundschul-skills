import type { EinheitStand, PlanDokument } from '@schoolbox/kern/src/einheit';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { meldung } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { laufzeit, useJetzt } from '../editor/entwurf';
import { ART_NAME } from '../lib/text';
import { einheitAktion, fertig, fortschritt, geplant } from './einheiten';

/** „Einheit: 3 von 12“ im Kopf jeder Seite, solange eine läuft (140). Ersetzt für Einheiten den globalen Chat. */
export const EinheitPille = ({ einheiten }: { einheiten: EinheitStand[] }) => {
	const laufend = einheiten.find((e) => e.status === 'laeuft');
	if (!laufend) {
		return null;
	}
	return (
		<Link
			to={`/o/${laufend.ordner}`}
			className="flex h-knopf-klein items-center gap-1.5 rounded-full border border-rand bg-flaeche-2 px-2.5 text-xs font-medium text-brand-700 no-underline hover:bg-rand"
			title={`Claude baut die Einheit „${laufend.titel}“`}
			data-einheit-pille
		>
			<Symbol name="laden" className="size-3 animate-spin" />
			{`Einheit: ${fortschritt(laufend)}`}
		</Link>
	);
};

const StandMarke = ({ d, s }: { d: PlanDokument; s: EinheitStand }) => {
	if (s.befunde.some((b) => b.slug === d.slug && !s.importiert[d.slug])) {
		return (
			<span className="flex items-center gap-1 text-warnung">
				<Symbol name="achtung" className="size-3" />
				mit Befund
			</span>
		);
	}
	if (d.fertig) {
		return (
			<span className="flex items-center gap-1">
				<Symbol name="haken" className="size-3" />
				fertig
			</span>
		);
	}
	const erstesOffenes = s.plan?.dokumente.find((x) => !x.fertig)?.slug === d.slug;
	return s.status === 'laeuft' && erstesOffenes ? (
		<span className="flex items-center gap-1 text-brand-700">
			<Symbol name="laden" className="size-3 animate-spin" />
			in Arbeit
		</span>
	) : (
		<span>geplant</span>
	);
};

/**
 * Platzhalter je geplantem, noch nicht übernommenem Material. Sie sind kein Material: kein `data-objekt`, also weder
 * auswählbar noch verschiebbar, teilbar oder im PDF.
 */
const Platzhalter = ({ s }: { s: EinheitStand }) => {
	const offen = (s.plan?.dokumente ?? []).filter((d) => !s.importiert[d.slug]);
	if (offen.length === 0) {
		return null;
	}
	return (
		<ul className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3" data-einheit-platzhalter>
			{offen.map((d) => (
				<li
					key={d.slug}
					className="flex min-h-28 flex-col justify-between gap-2 rounded-lg border border-dashed border-rand p-3 text-sm"
				>
					<span className="line-clamp-3 font-medium">{d.titel}</span>
					<span className="flex items-center justify-between gap-2 text-xs text-leise">
						<span>{ART_NAME[d.art]}</span>
						<StandMarke d={d} s={s} />
					</span>
				</li>
			))}
		</ul>
	);
};

const Aufklapp = ({ children, titel }: { titel: string; children: ReactNode }) => (
	<details className="text-sm">
		<summary className="cursor-pointer text-leise hover:text-tinte">{titel}</summary>
		<div className="mt-1 pl-4">{children}</div>
	</details>
);

const KOPF: Record<EinheitStand['status'], (titel: string) => string> = {
	laeuft: (t) => `Claude baut die Einheit „${t}“`,
	fertig: (t) => `Die Einheit „${t}“ ist fertig`,
	unvollstaendig: (t) => `Die Einheit „${t}“ ist unvollständig`,
	verworfen: (t) => `Die Einheit „${t}“ ist verworfen`,
};

/** Das Band oben im Ordner einer Einheit (140, A2 S. 6): Stand, Abbrechen, Weiterbauen, Verwerfen, Annahmen, Befunde. */
export const EinheitBand = ({ s }: { s: EinheitStand }) => {
	const laeuft = s.status === 'laeuft';
	const jetzt = useJetzt(laeuft);
	const zeige = useHinweis();
	const navigate = useNavigate();
	const [warte, setWarte] = useState(false);
	const tue = (aktion: 'abbrechen' | 'weiter' | 'verwerfen') => async () => {
		setWarte(true);
		try {
			await einheitAktion(s.id, aktion);
			if (aktion === 'verwerfen') {
				zeige({ text: `„${s.titel}“ liegt im Papierkorb.` });
				void navigate('/');
			}
		} catch (grund) {
			zeige({ text: meldung(grund), art: 'fehler' });
		} finally {
			setWarte(false);
		}
	};
	const zahl = s.plan ? `${fertig(s)} von ${geplant(s)} fertig` : 'Claude plant die Einheit …';
	const kopf = KOPF[s.status](s.titel);
	const befunde = s.befunde.filter((b) => b.texte.length > 0);
	return (
		<section
			className="mb-3 flex flex-col gap-2 rounded-lg border border-rand bg-flaeche-2 px-3 py-2"
			data-einheit-band={s.status}
			aria-live="polite"
		>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				{laeuft && <Symbol name="laden" className="size-4 animate-spin text-brand-700" />}
				<span className="font-medium">{kopf}</span>
				{laeuft && <span className="text-leise tabular-nums">{laufzeit(s.start, jetzt)}</span>}
				<span className="text-leise">{zahl}</span>
				{s.grund && !laeuft && <span className="text-sm text-leise">{s.grund}</span>}
				<span className="ml-auto flex gap-2">
					{laeuft && (
						<Knopf art="zweit" groesse="klein" disabled={warte} onClick={() => void tue('abbrechen')()}>
							Abbrechen
						</Knopf>
					)}
					{s.status === 'unvollstaendig' && (
						<>
							<Knopf groesse="klein" disabled={warte} onClick={() => void tue('weiter')()}>
								Weiterbauen
							</Knopf>
							<Knopf art="zweit" groesse="klein" disabled={warte} onClick={() => void tue('verwerfen')()}>
								Verwerfen
							</Knopf>
						</>
					)}
				</span>
			</div>
			{(s.plan?.annahmen.length ?? 0) > 0 && (
				<Aufklapp titel="Annahmen">
					<ul className="list-disc pl-4">
						{s.plan?.annahmen.map((a) => (
							<li key={a}>{a}</li>
						))}
					</ul>
				</Aufklapp>
			)}
			<Aufklapp titel="Auftrag">
				<p className="whitespace-pre-wrap">{s.auftrag}</p>
			</Aufklapp>
			{!laeuft && befunde.length > 0 && (
				<Aufklapp titel={`Befunde der Prüfung (${befunde.length})`}>
					<ul className="flex flex-col gap-1">
						{befunde.map((b) => (
							<li key={b.slug}>
								{b.dok ? <Link to={`/m/${s.mappe}/${b.dok}`}>{b.slug}</Link> : b.slug}
								{`: ${b.texte.join(' · ')}`}
							</li>
						))}
					</ul>
				</Aufklapp>
			)}
			<Platzhalter s={s} />
		</section>
	);
};

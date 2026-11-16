import type { EinheitStand, PlanDokument } from '@schoolbox/kern/src/einheit';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { meldung, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import { laufzeit, useJetzt } from '../editor/entwurf';
import { limitHinweis, useKiZustand } from '../editor/ki';
import { PlanFreigabe } from '../editor/PlanFreigabe';
import { ART_NAME } from '../lib/text';
import { einheitAktion, einheitFreigeben, fertig, fortschritt, geplant } from './einheiten';
import { useAblage } from './kontext';

/** „Einheit: 3 von 12“ im Kopf jeder Seite, solange eine läuft (140). Ersetzt für Einheiten den globalen Chat. */
export const EinheitPille = ({ einheiten }: { einheiten: EinheitStand[] }) => {
	const laufend = einheiten.find((e) => e.status === 'laeuft') ?? einheiten.find((e) => e.status === 'plan');
	if (!laufend) {
		return null;
	}
	const wartet = laufend.status === 'plan';
	return (
		<Tooltip
			text={
				wartet
					? `Der Plan der Einheit „${laufend.titel}“ wartet auf deine Freigabe`
					: `Claude baut die Einheit „${laufend.titel}“`
			}
		>
			{/* Maße und Farben der Claude-Pille im Editor (190-28). */}
			<Link
				to={`/o/${laufend.ordner}`}
				className="inline-flex h-7 flex-none items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 text-xs font-medium text-brand-700 tabular-nums no-underline hover:bg-brand-100 [@media(any-pointer:coarse)]:h-11"
				data-einheit-pille
			>
				<Symbol name={wartet ? 'funken' : 'laden'} className={wartet ? 'size-3' : 'size-3 animate-spin'} />
				{`Einheit: ${fortschritt(laufend)}`}
			</Link>
		</Tooltip>
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
	return s.status === 'laeuft' && s.inArbeit === d.slug ? (
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

/** Klappt mit dem Pfeil der Ebenenliste, nicht mit dem Dreieck des Browsers (190-29). */
const Aufklapp = ({ children, titel }: { titel: string; children: ReactNode }) => (
	<details className="group text-sm">
		<summary className="flex cursor-pointer list-none items-center gap-1 text-leise hover:text-tinte [&::-webkit-details-marker]:hidden">
			<Symbol name="runter" className="size-3 -rotate-90 transition-transform group-open:rotate-0" />
			{titel}
		</summary>
		<div className="mt-1 pl-4">{children}</div>
	</details>
);

const KOPF: Record<EinheitStand['status'], (titel: string) => string> = {
	laeuft: (t) => `Claude baut die Einheit „${t}“`,
	plan: (t) => `Plan für die Einheit „${t}“`,
	fertig: (t) => `Die Einheit „${t}“ ist fertig`,
	unvollstaendig: (t) => `Die Einheit „${t}“ ist unvollständig`,
	verworfen: (t) => `Die Einheit „${t}“ ist verworfen`,
};

/** Neben dem Kopf: der Fortschritt; vor dem ersten Material sagt er, dass Claude erst Aussehen und Bilder macht. */
const zahlText = (s: EinheitStand, plant: boolean) => {
	if (s.status === 'plan') {
		return `${geplant(s)} Materialien geplant`;
	}
	if (!s.plan || plant) {
		return 'Claude plant die Einheit …';
	}
	const stand = `${fertig(s)} von ${geplant(s)} fertig`;
	if (s.status !== 'laeuft' || s.inArbeit || fertig(s) > 0) {
		return stand;
	}
	return `${stand} · Claude bereitet ${s.bilder ? 'Aussehen und Bilder' : 'das Aussehen'} vor`;
};

/** Das Band oben im Ordner einer Einheit (140, A2 S. 6): Stand, Abbrechen, Weiterbauen, Verwerfen, Annahmen, Befunde. */
export const EinheitBand = ({ s }: { s: EinheitStand }) => {
	const laeuft = s.status === 'laeuft';
	const jetzt = useJetzt(laeuft);
	const zeige = useHinweis();
	const navigate = useNavigate();
	const { stand: ablage } = useAblage();
	const ki = useKiZustand();
	const limitGesperrt = limitHinweis(ki.zustand.limit, ki.zustand.warnAb)?.art === 'gesperrt';
	const [warte, setWarte] = useState(false);
	const fehler = (grund: unknown) => {
		zeige({ text: meldung(grund), art: 'fehler' });
		return false;
	};
	// Wie Löschen in der Ablage: Der Ordner darüber öffnet, die Meldung hat „Rückgängig“; gefragt wird nicht (190-30).
	const verwerfen = async () => {
		const eltern = ablage?.ordner.find((o) => o.id === s.ordner)?.eltern ?? null;
		const { rueckgaengig } = await sende<{ rueckgaengig: boolean }>(`/api/einheiten/${s.id}/verwerfen`);
		void navigate(eltern === null ? '/' : `/o/${eltern}`);
		zeige({
			text: `Ordner „${s.titel}“ in den Papierkorb gelegt.`,
			...(rueckgaengig
				? {
						aktion: {
							titel: 'Rückgängig',
							ausfuehren: () => {
								sende(`/api/einheiten/${s.id}/zurueckholen`).then(() => {
									void navigate(`/o/${s.ordner}`);
									zeige({ text: 'Rückgängig gemacht.' });
								}, fehler);
							},
						},
					}
				: {}),
		});
	};
	const tue = (aktion: 'abbrechen' | 'weiter' | 'verwerfen' | 'schliessen') => async () => {
		if (warte) {
			return;
		}
		setWarte(true);
		try {
			if (aktion === 'verwerfen') {
				await verwerfen();
			} else if (aktion === 'schliessen') {
				await sende(`/api/einheiten/${s.id}/schliessen`);
			} else {
				await einheitAktion(s.id, aktion);
			}
		} catch (grund) {
			fehler(grund);
		} finally {
			setWarte(false);
		}
	};
	const plant = s.freigegeben === false;
	const zahl = zahlText(s, plant);
	const kopf = laeuft && plant ? `Claude plant die Einheit „${s.titel}“` : KOPF[s.status](s.titel);
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
				{laeuft && <span className="text-leise tabular-nums">{laufzeit(s.laufSeit ?? s.start, jetzt)}</span>}
				<span className="text-leise">{zahl}</span>
				{s.grund && !laeuft && <span className="text-sm text-leise">{s.grund}</span>}
				<span className="ml-auto flex items-center gap-2">
					{laeuft && (
						<Knopf art="zweit" groesse="klein" disabled={warte} onClick={() => void tue('abbrechen')()}>
							Abbrechen
						</Knopf>
					)}
					{s.status === 'unvollstaendig' && (
						<>
							<Knopf groesse="klein" disabled={warte} onClick={() => void tue('weiter')()}>
								{plant ? 'Nochmal planen' : 'Weiterbauen'}
							</Knopf>
							<Knopf art="zweit" groesse="klein" disabled={warte} onClick={() => void tue('verwerfen')()}>
								Verwerfen
							</Knopf>
						</>
					)}
					{/* Das Band gehört zum Bau, nicht zum Ordner: Fertig lässt es sich schließen (190-42). */}
					{s.status === 'fertig' && (
						<Tooltip text="Schließen">
							<Knopf
								art="leise"
								groesse="klein"
								aria-label="Schließen"
								disabled={warte}
								data-einheit-schliessen
								onClick={() => void tue('schliessen')()}
							>
								<Symbol name="schliessen" />
							</Knopf>
						</Tooltip>
					)}
				</span>
			</div>
			{s.status === 'plan' && (
				<div className="flex flex-col gap-2" data-einheit-plan>
					<p className="text-sm text-leise">
						So würde Claude die Einheit bauen. Passt das? Gebaut wird erst nach deiner Freigabe; das dauert
						dann je nach Umfang eine bis drei Stunden.
					</p>
					{/* Dieselbe Freigabe wie beim neuen Blatt (190-35); die Sperre gegen den Doppelklick liegt dort (190-32). */}
					<PlanFreigabe
						text={s.planText ?? ''}
						gesperrt={limitGesperrt}
						klein
						planKlasse="max-h-[60vh] bg-flaeche text-sm"
						freigeben={() => einheitFreigeben(s.id).then(() => true, fehler)}
						aendern={(wunsch) => einheitFreigeben(s.id, wunsch).then(() => true, fehler)}
						verwerfen={() => verwerfen().catch(fehler)}
					/>
				</div>
			)}
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
			{!plant && <Platzhalter s={s} />}
		</section>
	);
};

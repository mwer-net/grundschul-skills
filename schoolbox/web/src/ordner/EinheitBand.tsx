import type { EinheitPlan, EinheitStand, PlanDokument, PlanGeschichte } from '@schoolbox/kern/src/einheit';
import { einheitBauDauer } from '@schoolbox/kern/src/einheit';
import { BILDER_SCHRITT } from '@schoolbox/kern/src/einheit-bau';
import { gepruefteZahl, SCHLUSS_SCHRITT } from '@schoolbox/kern/src/einheit-pruefung';
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
import { kanonAbschnitte } from './einheit-kanon-text';
import { einheitAktion, einheitFreigeben, fertig, fortschritt, geplant } from './einheiten';
import {
	AufgabenTabelle,
	Aufklapp,
	FachPruefpunkte,
	KanonDetails,
	RechercheKurz,
	RechercheQuellen,
	StundenKurz,
} from './EinheitPlanDetails';
import { PlanGeprueft } from './EinheitPlanPruefung';
import { BibliothekNeu, BilderHinweise, PruefungDetails } from './EinheitPruefung';
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
	if (d.fertig || s.importiert[d.slug]) {
		return (
			<span className="flex items-center gap-1">
				<Symbol name="haken" className="size-3" />
				fertig
			</span>
		);
	}
	if (s.inArbeit === d.slug && s.status === 'laeuft') {
		return (
			<span className="flex items-center gap-1 text-brand-700">
				<Symbol name="laden" className="size-3 animate-spin" />
				wird gebaut
			</span>
		);
	}
	// Weiterbauen setzt an dem Material an, bei dem der letzte Durchgang stand (220).
	if (s.inArbeit === d.slug && s.status === 'unvollstaendig' && s.freigegeben !== false) {
		return <span className="font-medium text-tinte">hier geht es weiter</span>;
	}
	return <span>{s.status === 'laeuft' && s.freigegeben !== false ? 'wartet' : 'geplant'}</span>;
};

/**
 * Platzhalter je geplantem, noch nicht übernommenem Material. Sie sind kein Material: kein `data-objekt`, also weder
 * auswählbar noch verschiebbar, teilbar oder im PDF.
 */
const Platzhalter = ({ s }: { s: EinheitStand }) => {
	// In der Reihenfolge des Baus, sobald der Server sie festgelegt hat.
	const rang = (slug: string) => s.reihenfolge?.indexOf(slug) ?? -1;
	const offen = (s.plan?.dokumente ?? [])
		.filter((d) => !s.importiert[d.slug])
		.map((d, i) => ({ d, i }))
		.sort((a, b) => (rang(a.d.slug) === -1 || rang(b.d.slug) === -1 ? a.i - b.i : rang(a.d.slug) - rang(b.d.slug)))
		.map(({ d }) => d);
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

/** Was das Vorleseheft tragen muss (216); die Kurzfassung steht schon im Plan-Text. */
const GeschichteDetails = ({ g }: { g: PlanGeschichte }) => (
	<div className="flex flex-col gap-1">
		{g.kurz && <p>{g.kurz}</p>}
		{g.verdaechtige.length > 0 && (
			<p>
				<b>Verdächtige:</b>
				{` ${g.verdaechtige.join(' · ')}`}
			</p>
		)}
		{g.falscheFaehrte && (
			<p>
				<b>Falsche Fährte:</b>
				{` ${g.falscheFaehrte}`}
			</p>
		)}
		{g.aufloesung && (
			<p>
				<b>Auflösung:</b>
				{` ${g.aufloesung}`}
			</p>
		)}
		{g.kapitel.length > 0 && (
			<ul className="list-disc pl-4">
				{g.kapitel.map((k) => (
					<li key={k.nr}>
						<b>{k.titel || (k.nr === 0 ? 'Auftakt' : `Kapitel ${k.nr}`)}</b>
						{k.offenesEnde && ` · endet mit: ${k.offenesEnde}`}
						{k.bildfolien.length > 0 && ` · Bildfolien: ${k.bildfolien.join(' · ')}`}
					</li>
				))}
			</ul>
		)}
	</div>
);

const aufgabenZahl = (plan: EinheitPlan) => (plan.stunden ?? []).reduce((n, st) => n + st.aufgaben.length, 0);

const KOPF: Record<EinheitStand['status'], (titel: string) => string> = {
	laeuft: (t) => `Claude baut die Einheit „${t}“`,
	plan: (t) => `Plan für die Einheit „${t}“`,
	fertig: (t) => `Die Einheit „${t}“ ist fertig`,
	unvollstaendig: (t) => `Die Einheit „${t}“ ist unvollständig`,
	verworfen: (t) => `Die Einheit „${t}“ ist verworfen`,
};

/** Neben dem Kopf: der Fortschritt und woran Claude gerade baut; ein Material je Lauf (220). */
const zahlText = (s: EinheitStand, plant: boolean) => {
	if (s.status === 'plan') {
		return `${geplant(s)} Materialien geplant`;
	}
	if (plant && s.planSchritt === 'pruefung') {
		return 'Claude prüft den Plan mit frischem Blick …';
	}
	if (plant && s.planSchritt === 'rueckrunde') {
		return 'Claude arbeitet die Hinweise der Prüfung ein …';
	}
	if (!s.plan || plant) {
		return 'Claude plant die Einheit …';
	}
	const stand = `${fertig(s)} von ${geplant(s)} fertig`;
	if (s.status !== 'laeuft' || !s.inArbeit) {
		return stand;
	}
	const titel = s.plan.dokumente.find((d) => d.slug === s.inArbeit)?.titel;
	if (s.inArbeit === BILDER_SCHRITT) {
		return `${stand} · Claude macht die Bilder`;
	}
	if (s.inArbeit === SCHLUSS_SCHRITT) {
		return `${stand} · Claude gleicht alle Materialien ab`;
	}
	if (titel && s.pruefung?.[s.inArbeit]?.status === 'laeuft') {
		return `${stand} · Claude prüft „${titel}“ mit Kinderaugen`;
	}
	return titel ? `${stand} · Claude baut „${titel}“` : stand;
};

const bandKopf = (s: EinheitStand, recherchiert: boolean, plant: boolean) => {
	if (recherchiert) {
		return `Claude recherchiert für die Einheit „${s.titel}“`;
	}
	return plant ? `Claude plant die Einheit „${s.titel}“` : KOPF[s.status](s.titel);
};

type BandAktion = 'abbrechen' | 'weiter' | 'verwerfen' | 'schliessen';

/** Abbrechen im Lauf, Weiterbauen und Verwerfen, wenn unvollständig, Schließen, wenn fertig. */
const BandKnoepfe = ({
	plant,
	s,
	tue,
	warte,
}: {
	s: EinheitStand;
	plant: boolean;
	warte: boolean;
	tue: (aktion: BandAktion) => () => Promise<void>;
}) => {
	const laeuft = s.status === 'laeuft';
	return (
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
	);
};

/** Der Plan zur Freigabe: Dauer, Plantext, Stunden und Recherche. */
const BandPlan = ({
	fehler,
	gesperrt,
	s,
	verwerfen,
}: {
	s: EinheitStand;
	gesperrt: boolean;
	fehler: (grund: unknown) => boolean;
	verwerfen: () => Promise<void>;
}) => (
	<div className="flex flex-col gap-2" data-einheit-plan>
		<p className="text-sm text-leise">
			{`So würde Claude die Einheit bauen. Passt das? Gebaut wird erst nach deiner Freigabe, jedes Material für sich; das dauert dann ${einheitBauDauer(geplant(s), s.bilder, gepruefteZahl(s.plan?.dokumente ?? []))}.`}
		</p>
		{/* Dieselbe Freigabe wie beim neuen Blatt (190-35); die Sperre gegen den Doppelklick liegt dort (190-32). */}
		<PlanFreigabe
			text={s.planText ?? ''}
			gesperrt={gesperrt}
			klein
			planKlasse="max-h-[60vh] bg-flaeche text-sm"
			freigeben={() => einheitFreigeben(s.id).then(() => true, fehler)}
			aendern={(wunsch) => einheitFreigeben(s.id, wunsch).then(() => true, fehler)}
			verwerfen={() => verwerfen().catch(fehler)}
			zusatz={
				s.plan && (
					<div className="mt-3 flex flex-col gap-3">
						<PlanGeprueft stand={s.planPruefung} />
						<StundenKurz plan={s.plan} />
						<RechercheKurz plan={s.plan} recherche={s.recherche} />
					</div>
				)
			}
		/>
	</div>
);

/** Aufgaben, Quellen, Geschichte und Annahmen des Plans zum Aufklappen. */
const BandDetails = ({ s }: { s: EinheitStand }) => {
	const quellen = s.recherche?.status === 'fertig' ? s.recherche.quellen : [];
	return (
		<>
			{s.status !== 'plan' && <PlanGeprueft stand={s.planPruefung} zu />}
			{s.plan && (s.plan.stunden?.length ?? 0) > 0 && (
				<Aufklapp titel={`Alle Aufgaben der Reihe (${aufgabenZahl(s.plan)})`}>
					<div className="flex flex-col gap-3">
						{s.status !== 'plan' && <StundenKurz plan={s.plan} />}
						<AufgabenTabelle plan={s.plan} />
					</div>
				</Aufklapp>
			)}
			<FachPruefpunkte
				recherche={s.recherche?.status === 'fertig' ? s.recherche.text : null}
				berichtigungen={s.plan?.berichtigungen ?? []}
				planOffen={s.status === 'plan'}
			/>
			{quellen.length > 0 && (
				<Aufklapp titel={`Quellen der Recherche (${quellen.length})`}>
					<RechercheQuellen quellen={quellen} />
				</Aufklapp>
			)}
			{s.plan?.geschichte && (
				<Aufklapp titel="Geschichte und Vorleseheft">
					<GeschichteDetails g={s.plan.geschichte} />
				</Aufklapp>
			)}
			<KanonDetails
				abschnitte={kanonAbschnitte(
					s.plan?.kanon,
					s.kanonNachtrag,
					(slug) => s.plan?.dokumente.find((d) => d.slug === slug)?.titel ?? slug,
				)}
				planOffen={s.status === 'plan'}
			/>
			{(s.plan?.annahmen.length ?? 0) > 0 && (
				<Aufklapp titel="Annahmen">
					<ul className="list-disc pl-4">
						{s.plan?.annahmen.map((a) => (
							<li key={a}>{a}</li>
						))}
					</ul>
				</Aufklapp>
			)}
		</>
	);
};

/** Befunde der Prüfung je Material, mit Verweis aufs Dokument. */
const BandBefunde = ({ s }: { s: EinheitStand }) => {
	const befunde = s.befunde.filter((b) => b.texte.length > 0);
	if (befunde.length === 0) {
		return null;
	}
	return (
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
	);
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
	const tue = (aktion: BandAktion) => async () => {
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
	const recherchiert = laeuft && s.recherche?.status === 'laeuft';
	const zahl = recherchiert ? `${s.recherche?.schritt ?? 'Bildungsplan und Fachdidaktik'} …` : zahlText(s, plant);
	const kopf = bandKopf(s, recherchiert, laeuft && plant);
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
				<BandKnoepfe s={s} plant={plant} warte={warte} tue={tue} />
			</div>
			{s.status === 'plan' && <BandPlan s={s} gesperrt={limitGesperrt} fehler={fehler} verwerfen={verwerfen} />}
			<BandDetails s={s} />
			<Aufklapp titel="Auftrag">
				<p className="whitespace-pre-wrap">{s.auftrag}</p>
			</Aufklapp>
			{!laeuft && <BandBefunde s={s} />}
			<BilderHinweise s={s} />
			<BibliothekNeu s={s} />
			<PruefungDetails s={s} />
			{!plant && <Platzhalter s={s} />}
		</section>
	);
};

import type { EinheitPlan } from '@schoolbox/kern/src/einheit';
import type { PlanStunde } from '@schoolbox/kern/src/einheit-aufgaben';
import { FORMAT_HOECHSTENS, formatTitel, formatZaehlung } from '@schoolbox/kern/src/einheit-aufgaben';
import type { RechercheStand } from '@schoolbox/kern/src/recherche';
import { pruefpunkteAus, quellenAus } from '@schoolbox/kern/src/recherche';
import type { ReactNode } from 'react';

import { Symbol } from '../bausteine/Symbol';
import type { KanonAbschnitt } from './einheit-kanon-text';
import { kanonZahl } from './einheit-kanon-text';

/**
 * Der Plan einer Einheit für die Lehrkraft (221): kurz, was die Kinder je Stunde tun und was die Recherche ergab;
 * zum Aufklappen alle Aufgaben der Reihe und die Quellen. Keine Feldnamen, keine Codes.
 */

/** Klappt mit dem Pfeil der Ebenenliste, nicht mit dem Dreieck des Browsers (190-29). */
export const Aufklapp = ({ children, titel }: { titel: string; children: ReactNode }) => (
	<details className="group text-sm">
		<summary className="flex cursor-pointer list-none items-center gap-1 text-leise hover:text-tinte [&::-webkit-details-marker]:hidden">
			<Symbol name="runter" className="size-3 -rotate-90 transition-transform group-open:rotate-0" />
			{titel}
		</summary>
		<div className="mt-1 pl-4">{children}</div>
	</details>
);

const kapitelTitel = (plan: EinheitPlan, nr: number) => plan.geschichte?.kapitel.find((k) => k.nr === nr)?.titel ?? '';

/** „Echt oder nachgemacht?“ bekommt keinen Doppelpunkt dahinter. */
const mitDoppelpunkt = (titel: string) => (/[?!.:]$/.test(titel) ? `${titel} ` : `${titel}: `);

const woerter = (s: PlanStunde) =>
	s.begriffe.length ? ` ${s.begriffe.length === 1 ? 'Neues Wort' : 'Neue Wörter'}: ${s.begriffe.join(', ')}.` : '';

/** „ Ziel: Ich kann … (45 min)“ aus den Feldern von 247; leer bei Plänen davor. */
const zielUndZeit = (plan: EinheitPlan, s: PlanStunde) => {
	const ziel = plan.ziele?.find((z) => z.nr === s.ziel)?.text;
	return [ziel ? ` Ziel: ${ziel}` : '', s.minuten ? ` (${s.minuten} min)` : ''].join('');
};

/** Je Stunde eine Zeile „Was die Kinder tun“. */
export const StundenKurz = ({ plan }: { plan: EinheitPlan }) => {
	const stunden = plan.stunden ?? [];
	if (stunden.length === 0) {
		return null;
	}
	return (
		<div className="flex max-w-[46rem] flex-col gap-1 text-sm" data-einheit-stunden>
			<h3 className="font-medium">Was die Kinder tun</h3>
			<dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
				{stunden.map((s) => (
					<div key={s.nr} className="contents">
						<dt className="text-leise tabular-nums">{`Stunde ${s.nr}`}</dt>
						<dd>
							{kapitelTitel(plan, s.nr) && (
								<span className="text-leise">{mitDoppelpunkt(kapitelTitel(plan, s.nr))}</span>
							)}
							{s.handlung || 'noch offen'}
							{s.kontrolle && <span className="text-leise"> (Lernzielkontrolle)</span>}
							{woerter(s) && <span className="text-leise">{woerter(s)}</span>}
							{zielUndZeit(plan, s) && <span className="text-leise">{zielUndZeit(plan, s)}</span>}
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
};

/** Drei, vier Sätze zur Recherche; ist sie gescheitert, sagt das ein Satz. */
export const RechercheKurz = ({ plan, recherche }: { plan: EinheitPlan; recherche?: RechercheStand }) => {
	const gescheitert = recherche?.status === 'gescheitert';
	if (!plan.recherche && !gescheitert) {
		return null;
	}
	return (
		<div className="flex max-w-[46rem] flex-col gap-1 text-sm" data-einheit-recherche>
			<h3 className="font-medium">Aus der Recherche</h3>
			<p>
				{plan.recherche ||
					'Die Suche nach Bildungsplan und Fachdidaktik hat diesmal nicht geklappt. Claude plant nach den Grundschul-Skills; das steht auch in den Annahmen.'}
			</p>
		</div>
	);
};

const zelle = 'border-b border-rand px-2 py-1 align-top';

/** Letzte Spalte der Tabelle: neu, das zweite Mal mit höherem Anspruch, oder Wiederholung in der Kontrolle. */
const vorkommen = (kontrolle: boolean | undefined, zweitesMal: boolean | undefined) => {
	if (kontrolle) {
		return 'Wiederholung';
	}
	return zweitesMal ? '2. Mal' : 'neu';
};

/** Alle Aufgaben der Reihe als Tabelle, darunter, ob ein Format zu oft vorkommt. */
export const AufgabenTabelle = ({ plan }: { plan: EinheitPlan }) => {
	const stunden = (plan.stunden ?? []).filter((s) => s.aufgaben.length > 0);
	const titel = new Map(plan.dokumente.map((d) => [d.slug, d.titel]));
	const zuOft = formatZaehlung(plan).filter((f) => f.stunden.length > FORMAT_HOECHSTENS);
	return (
		<div className="flex flex-col gap-2" data-einheit-aufgaben>
			<table className="w-full max-w-[64rem] border-collapse text-left text-sm">
				<thead className="text-leise">
					<tr>
						<th className={`${zelle} font-normal`}>Stunde</th>
						<th className={`${zelle} font-normal`}>Aufgabe</th>
						<th className={`${zelle} font-normal`}>Material</th>
						<th className={`${zelle} font-normal`}>Format</th>
						<th className={`${zelle} font-normal`}>Anforderung</th>
						<th className={`${zelle} font-normal`}>Vorkommen</th>
					</tr>
				</thead>
				<tbody>
					{stunden.map((s) =>
						s.aufgaben.map((a, i) => (
							<tr key={`${s.nr}-${i}`}>
								{i === 0 && (
									<td rowSpan={s.aufgaben.length} className={`${zelle} text-leise tabular-nums`}>
										{s.nr}
									</td>
								)}
								<td className={zelle}>{a.inhalt}</td>
								<td className={`${zelle} text-leise`}>{titel.get(a.dokument) ?? ''}</td>
								<td className={zelle}>{formatTitel(a.format)}</td>
								<td className={`${zelle} tabular-nums`}>{a.bereich ?? ''}</td>
								<td className={`${zelle} text-leise`}>{vorkommen(s.kontrolle, a.zweitesMal)}</td>
							</tr>
						)),
					)}
				</tbody>
			</table>
			{zuOft.length > 0 ? (
				<p className="text-warnung" data-einheit-zu-oft>
					{`Öfter als zweimal: ${zuOft.map((f) => `${formatTitel(f.format)} (${f.stunden.length}-mal)`).join(', ')}. Schreib bei „Ändern …“, was stattdessen kommen soll.`}
				</p>
			) : (
				<p className="text-leise">Kein Format kommt öfter als zweimal vor.</p>
			)}
			<p className="text-leise">
				Anforderung: I wiedergeben und nachmachen, II anwenden und verknüpfen, III erklären und erfinden. Die
				Lernzielkontrolle wiederholt Formate mit neuen Aufgaben.
			</p>
		</div>
	);
};

const kurzeAdresse = (url: string) => url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');
const seiteVon = (url: string) => kurzeAdresse(url).split('/')[0] ?? url;

/** „Wahr: … Falsch wäre: … (https://…)“ in Aussage, Gegenbeispiel und Quellen. */
const pruefpunktTeile = (punkt: string) => {
	const quellen = quellenAus(punkt);
	const ohne = punkt
		.replace(/\(?\s*(?:Quelle:\s*)?https:\/\/[^\s)]+\s*\)?/gi, '')
		.replace(/\s*(?:Quelle|Quellen):?\s*$/i, '')
		.replace(/\s+([.,;])/g, '$1')
		.trim();
	const [wahr = '', falsch = ''] = ohne.split(/\s*Falsch wäre:\s*/i);
	return { wahr: wahr.replace(/^Wahr:\s*/i, ''), falsch, quellen };
};

/**
 * Was in jedem Material fachlich stimmen muss (243): die Prüfpunkte der Recherche, darüber die Berichtigungen der
 * Lehrkraft aus dem Plan. Je Punkt eine Zeile, das Gegenbeispiel leise dahinter, die Quelle als kurzer Link.
 */
export const FachPruefpunkte = ({
	berichtigungen,
	planOffen,
	recherche,
}: {
	recherche: string | null;
	berichtigungen: string[];
	planOffen: boolean;
}) => {
	const punkte = pruefpunkteAus(recherche);
	if (punkte.length === 0 && berichtigungen.length === 0) {
		return null;
	}
	const zeile = (punkt: string, berichtigt: boolean) => {
		const t = pruefpunktTeile(punkt);
		return (
			<li key={`${berichtigt ? 'b' : 'r'}-${punkt}`}>
				{berichtigt && <span className="font-medium">Berichtigt: </span>}
				{t.wahr}
				{t.falsch && <span className="text-leise">{` Falsch wäre: ${t.falsch}`}</span>}
				{t.quellen.map((q) => (
					<a
						key={q}
						href={q}
						target="_blank"
						rel="noreferrer"
						title={q}
						className="ml-1 text-xs text-brand-700 hover:underline"
					>
						{seiteVon(q)}
					</a>
				))}
			</li>
		);
	};
	return (
		<Aufklapp titel={`Was fachlich stimmen muss (${punkte.length + berichtigungen.length})`}>
			<div className="flex max-w-[64rem] flex-col gap-1" data-einheit-pruefpunkte>
				<ul className="list-disc pl-4">
					{berichtigungen.map((b) => zeile(b, true))}
					{punkte.map((p) => zeile(p, false))}
				</ul>
				<p className="text-leise">
					{planOffen
						? 'Jedes Material wird daran gebaut und geprüft. Stimmt etwas nicht, schreib es bei „Ändern …“; die Berichtigung gilt dann für alle Materialien.'
						: 'Jedes Material wird daran gebaut und geprüft.'}
				</p>
			</div>
		</Aufklapp>
	);
};

/**
 * Was für alle Materialien gilt (246): der Kanon des Plans, dicht als Liste je Abschnitt. Ändern geht wie beim
 * übrigen Plan über „Ändern …“; nach der Freigabe gilt er für jeden Lauf.
 */
export const KanonDetails = ({ abschnitte, planOffen }: { abschnitte: KanonAbschnitt[]; planOffen: boolean }) => {
	if (abschnitte.length === 0) {
		return null;
	}
	return (
		<Aufklapp titel={`Was für alle Materialien gilt (${kanonZahl(abschnitte)})`}>
			<div className="flex max-w-[64rem] flex-col gap-1" data-einheit-kanon>
				<dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
					{abschnitte.map((a) => (
						<div key={a.titel} className="contents">
							<dt className="text-leise">{a.titel}</dt>
							<dd>
								<ul>
									{a.zeilen.map((z) => (
										<li key={z}>{z}</li>
									))}
								</ul>
							</dd>
						</div>
					))}
				</dl>
				<p className="text-leise">
					{planOffen
						? 'Jedes Material wird daran gebaut und geprüft. Stimmt etwas nicht, schreib es bei „Ändern …“.'
						: 'Jedes Material wird daran gebaut und geprüft.'}
				</p>
			</div>
		</Aufklapp>
	);
};

/** Die Quellen der Recherche als Links. */
export const RechercheQuellen = ({ quellen }: { quellen: string[] }) => (
	<ul className="flex flex-col gap-0.5" data-einheit-quellen>
		{quellen.map((q) => (
			<li key={q} className="truncate">
				<a href={q} target="_blank" rel="noreferrer" title={q} className="text-brand-700 hover:underline">
					{kurzeAdresse(q)}
				</a>
			</li>
		))}
	</ul>
);

import type { TextFeld } from '@schoolbox/kern/src/abbildungen';
import type { Aussage, Frage } from '@schoolbox/kern/src/aufgabenzeilen';
import {
	aussagenText,
	aussagenVerlustfrei,
	aussagenVon,
	fragenText,
	fragenVerlustfrei,
	fragenVon,
	VERBOTEN,
} from '@schoolbox/kern/src/aufgabenzeilen';
import type { ReactNode, RefObject } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { Griff } from '../bausteine/Griff';
import { klassen } from '../bausteine/klassen';
import { Knopf } from '../bausteine/Knopf';
import { Schalter as Umschalter } from '../bausteine/Schalter';
import { Symbol } from '../bausteine/Symbol';
import type { AbbildungSteuerung } from './abbildung';
import type { FeldEigenschaften } from './Abbildungspanel';
import { EINGABE, fertigMitEnter, Rahmen, Text, useZeilenZug, wertVon, ZeilenMenue } from './Abbildungspanel';

/**
 * S-06 (UX 186): Ankreuzen und Richtig/falsch zeigen Zeilen wie Zuordnen und Sortieren. Die Kurzschrift im Attribut
 * bleibt, wie sie ist; sie steht hinter „Als Text bearbeiten“. Was die Zeilen nicht verlustfrei zeigen, öffnet als
 * Text. Jede Änderung einer Zeile ist ein Schritt im Verlauf; getippt wird beim Verlassen übernommen.
 */

/** Ein Trennzeichen der Kurzschrift wurde nicht übernommen. */
const ZEICHEN_HINWEIS = {
	fragen: 'Semikolon trennt die Fragen, Komma und Doppelpunkt die Antworten; sie gehen in einer Zeile nicht.',
	aussagen: 'Semikolon trennt die Aussagen und geht in einer Zeile nicht.',
};

/** Die Zeilen als Zustand: Folgen dem Wert, sobald er sich von außen ändert (⌘Z, Claude, Text). */
const useZeilen = <T,>(
	wert: string | null,
	lesen: (roh: string | null) => T[],
	text: (zeilen: T[]) => string | null,
) => {
	const [zeilen, setZeilen] = useState(() => lesen(wert));
	const [gesehen, setGesehen] = useState(wert);
	if (gesehen !== wert) {
		setGesehen(wert);
		if (text(zeilen) !== wert) {
			setZeilen(lesen(wert));
		}
	}
	return [zeilen, setZeilen] as const;
};

/** Nach „Zeile hinzufügen“ steht der Fokus im ersten Feld der neuen Zeile, der Text markiert. */
const useFokusNach = (behaelter: RefObject<HTMLDivElement | null>) => {
	const ziel = useRef<number | null>(null);
	useEffect(() => {
		if (ziel.current === null) {
			return;
		}
		const eingabe = behaelter.current?.querySelector<HTMLInputElement>(
			`:scope > [data-zeile="${String(ziel.current)}"] input[type="text"]`,
		);
		if (eingabe) {
			eingabe.focus();
			eingabe.select();
			ziel.current = null;
		}
	});
	return ziel;
};

const Zelle = ({
	abb,
	name,
	setze,
	verboten,
	wert,
	zuViel,
}: {
	abb: AbbildungSteuerung;
	name: string;
	wert: string;
	verboten: RegExp;
	setze: (wert: string, sofort: boolean) => void;
	zuViel: () => void;
}) => (
	<input
		type="text"
		aria-label={name}
		placeholder={name}
		enterKeyHint="done"
		autoComplete="off"
		className={`${EINGABE} w-full min-w-0`}
		value={wert}
		onChange={(e) => {
			const sauber = e.target.value.replace(verboten, '');
			if (sauber !== e.target.value) {
				zuViel();
			}
			setze(sauber, false);
		}}
		onBlur={abb.uebernimm}
		onKeyDown={fertigMitEnter}
	/>
);

/** Liste oder Text, mit dem Knopf zum Wechseln. Passt der Wert nicht in Zeilen, bleibt es beim Text. */
const ZeilenOderText = ({
	abb,
	feld,
	liste,
	verlustfrei,
}: FeldEigenschaften<TextFeld> & {
	verlustfrei: (roh: string | null) => boolean;
	liste: (umschalten: ReactNode) => ReactNode;
}) => {
	const wert = wertVon(feld, abb)?.wert ?? null;
	const [alsText, setAlsText] = useState(() => !verlustfrei(wert));
	const passt = verlustfrei(wert);
	const text = alsText || !passt;
	const umschalten = (
		<Knopf
			art="zweit"
			groesse="klein"
			disabled={text && !passt}
			onClick={() => setAlsText(!alsText)}
			data-liste-als-text={feld.attribut}
		>
			{text ? 'Als Liste bearbeiten' : 'Als Text bearbeiten'}
		</Knopf>
	);
	return text ? (
		<>
			<Text feld={feld} abb={abb} />
			<div className="mt-1 flex flex-wrap items-center gap-1" data-zeilen-umschalten={feld.attribut}>
				{umschalten}
				{!passt && <span className="text-xs text-leise">Dieser Text passt nicht in Zeilen.</span>}
			</div>
		</>
	) : (
		liste(umschalten)
	);
};

/** Je Frage eine Zeile, darunter die Antworten mit Haken „richtig“. */
const FragenZeilen = ({ abb, feld, umschalten }: FeldEigenschaften<TextFeld> & { umschalten: ReactNode }) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? null;
	const [fragen, setFragen] = useZeilen(wert, fragenVon, fragenText);
	const [zuViel, setZuViel] = useState(false);
	const schreibe = (neu: Frage[], sofort = true) => {
		setFragen(neu);
		abb.aendere(feld, fragenText(neu), { uebernehmen: sofort });
	};
	const mitFrage = (i: number, f: (alt: Frage) => Frage) => fragen.map((alt, n) => (n === i ? f(alt) : alt));
	const verschiebe = (von: number, nach: number) => {
		const ziel = nach > von ? nach - 1 : nach;
		const neu = [...fragen];
		const [frage] = neu.splice(von, 1);
		if (frage && ziel !== von) {
			neu.splice(ziel, 0, frage);
			schreibe(neu);
		}
	};
	const { behaelter, greife, zug } = useZeilenZug(verschiebe);
	const fokus = useFokusNach(behaelter);
	const griffAn = (i: number) =>
		behaelter.current?.querySelectorAll<HTMLButtonElement>('[data-zeile-griff]')[i]?.focus();
	const neueAntwort = (f: Frage) => {
		let n = f.antworten.length + 1;
		while (f.antworten.some((a) => a.text === `Antwort ${String(n)}`)) {
			n += 1;
		}
		return { text: `Antwort ${String(n)}`, richtig: false };
	};
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div ref={behaelter} className="flex flex-col gap-2" data-liste={feld.attribut}>
				{fragen.map((frage, i) => (
					<div
						key={String(i)}
						className={klassen(
							'flex flex-col gap-0.5 rounded-sm',
							zug?.von === i && 'opacity-40',
							zug?.nach === i && 'shadow-[0_-2px_0_0_var(--color-brand-500)]',
							zug?.nach === fragen.length && i === fragen.length - 1 && 'shadow-[0_2px_0_0_var(--color-brand-500)]',
						)}
						data-zeile={i}
					>
						<div className="flex items-center gap-1">
							<Griff
								beschriftung={`Frage ${String(i + 1)} verschieben`}
								className="h-feld"
								data-zeile-griff={i}
								onPointerDown={(e) => greife(i, e)}
								onKeyDown={(e) => {
									const zu = { ArrowUp: i - 1, ArrowDown: i + 1 }[e.key];
									if (zu !== undefined && zu >= 0 && zu < fragen.length) {
										e.preventDefault();
										verschiebe(i, zu > i ? zu + 1 : zu);
										griffAn(zu);
									}
								}}
							/>
							<Zelle
								abb={abb}
								name={`Frage ${String(i + 1)}`}
								wert={frage.frage}
								verboten={VERBOTEN.frage}
								zuViel={() => setZuViel(true)}
								setze={(w, sofort) => schreibe(mitFrage(i, (f) => ({ ...f, frage: w })), sofort)}
							/>
							<ZeilenMenue
								abb={abb}
								u={[]}
								zeile={[]}
								i={i}
								aendere={() => undefined}
								uebernimm={abb.uebernimm}
								entfernen={fragen.length <= 1 ? null : () => schreibe(fragen.filter((_, n) => n !== i))}
								nachOben={i === 0 ? null : () => verschiebe(i, i - 1)}
								nachUnten={i === fragen.length - 1 ? null : () => verschiebe(i, i + 2)}
							/>
						</div>
						<div className="flex flex-col gap-0.5 pl-6" data-antworten={i}>
							{frage.antworten.map((a, j) => (
								<div key={String(j)} className="flex items-center gap-1" data-antwort={j}>
									<button
										type="button"
										role="checkbox"
										aria-checked={a.richtig}
										aria-label={`Antwort ${String(j + 1)} zu Frage ${String(i + 1)} richtig`}
										title="Richtig"
										className={klassen(
											'flex size-5 flex-none items-center justify-center rounded-sm border',
											a.richtig ? 'border-brand-500 bg-brand-500 text-white' : 'border-rand-feld bg-flaeche',
										)}
										onClick={() =>
											schreibe(
												mitFrage(i, (f) => ({
													...f,
													antworten: f.antworten.map((b, m) => (m === j ? { ...b, richtig: !b.richtig } : b)),
												})),
											)
										}
									>
										{a.richtig && <Symbol name="haken" className="size-3" />}
									</button>
									<Zelle
										abb={abb}
										name={`Antwort ${String(j + 1)} zu Frage ${String(i + 1)}`}
										wert={a.text}
										verboten={VERBOTEN.antwort}
										zuViel={() => setZuViel(true)}
										setze={(w, sofort) =>
											schreibe(
												mitFrage(i, (f) => ({
													...f,
													antworten: f.antworten.map((b, m) => (m === j ? { ...b, text: w } : b)),
												})),
												sofort,
											)
										}
									/>
									<button
										type="button"
										aria-label={`Antwort ${String(j + 1)} zu Frage ${String(i + 1)} entfernen`}
										title="Antwort entfernen"
										disabled={frage.antworten.length <= 1}
										className="flex size-(--hoehe-feld) flex-none items-center justify-center rounded-md text-leise hover:bg-flaeche-2 disabled:opacity-40"
										onClick={() =>
											schreibe(mitFrage(i, (f) => ({ ...f, antworten: f.antworten.filter((_, m) => m !== j) })))
										}
									>
										<Symbol name="schliessen" className="size-3" />
									</button>
								</div>
							))}
							<Knopf
								art="zweit"
								groesse="klein"
								className="self-start"
								data-antwort-neu={i}
								onClick={() => {
									schreibe(mitFrage(i, (f) => ({ ...f, antworten: [...f.antworten, neueAntwort(f)] })));
									const n = frage.antworten.length;
									requestAnimationFrame(() => {
										const neu = behaelter.current?.querySelector<HTMLInputElement>(
											`[data-antworten="${String(i)}"] [data-antwort="${String(n)}"] input`,
										);
										neu?.focus();
										neu?.select();
									});
								}}
							>
								<Symbol name="plus" />
								Antwort hinzufügen
							</Knopf>
						</div>
					</div>
				))}
			</div>
			{zuViel && <p className="mt-1 text-xs text-leise">{ZEICHEN_HINWEIS.fragen}</p>}
			<div className="mt-1 flex flex-wrap gap-1">
				<Knopf
					art="zweit"
					groesse="klein"
					onClick={() => {
						fokus.current = fragen.length;
						schreibe([
							...fragen,
							{
								frage: 'Neue Frage',
								antworten: [
									{ text: 'Antwort 1', richtig: true },
									{ text: 'Antwort 2', richtig: false },
								],
							},
						]);
					}}
					data-zeile-neu={feld.attribut}
				>
					<Symbol name="plus" />
					Zeile hinzufügen
				</Knopf>
				{umschalten}
			</div>
		</Rahmen>
	);
};

/** Je Aussage eine Zeile mit dem Umschalter „richtig“ (aus: falsch). */
const AussagenZeilen = ({ abb, feld, umschalten }: FeldEigenschaften<TextFeld> & { umschalten: ReactNode }) => {
	const id = useId();
	const wert = wertVon(feld, abb)?.wert ?? null;
	const [aussagen, setAussagen] = useZeilen(wert, aussagenVon, aussagenText);
	const [zuViel, setZuViel] = useState(false);
	const schreibe = (neu: Aussage[], sofort = true) => {
		setAussagen(neu);
		abb.aendere(feld, aussagenText(neu), { uebernehmen: sofort });
	};
	const mitAussage = (i: number, a: Partial<Aussage>) => aussagen.map((alt, n) => (n === i ? { ...alt, ...a } : alt));
	const verschiebe = (von: number, nach: number) => {
		const ziel = nach > von ? nach - 1 : nach;
		const neu = [...aussagen];
		const [zeile] = neu.splice(von, 1);
		if (zeile && ziel !== von) {
			neu.splice(ziel, 0, zeile);
			schreibe(neu);
		}
	};
	const { behaelter, greife, zug } = useZeilenZug(verschiebe);
	const fokus = useFokusNach(behaelter);
	const griffAn = (i: number) =>
		behaelter.current?.querySelectorAll<HTMLButtonElement>('[data-zeile-griff]')[i]?.focus();
	return (
		<Rahmen feld={feld} abb={abb} id={id}>
			<div ref={behaelter} className="flex flex-col gap-0.5" data-liste={feld.attribut}>
				{aussagen.length > 0 && (
					<div
						className="flex items-center gap-1 pr-[calc(var(--hoehe-feld)+0.25rem)] pl-6 text-xs text-leise"
						data-liste-kopf
					>
						<span className="min-w-0 flex-1 truncate">Aussage</span>
						<span className="flex-none">Richtig</span>
					</div>
				)}
				{aussagen.map((a, i) => (
					<div
						key={String(i)}
						className={klassen(
							'flex items-center gap-1 rounded-sm',
							zug?.von === i && 'opacity-40',
							zug?.nach === i && 'shadow-[0_-2px_0_0_var(--color-brand-500)]',
							zug?.nach === aussagen.length &&
								i === aussagen.length - 1 &&
								'shadow-[0_2px_0_0_var(--color-brand-500)]',
						)}
						data-zeile={i}
					>
						<Griff
							beschriftung={`Zeile ${String(i + 1)} verschieben`}
							className="h-feld"
							data-zeile-griff={i}
							onPointerDown={(e) => greife(i, e)}
							onKeyDown={(e) => {
								const zu = { ArrowUp: i - 1, ArrowDown: i + 1 }[e.key];
								if (zu !== undefined && zu >= 0 && zu < aussagen.length) {
									e.preventDefault();
									verschiebe(i, zu > i ? zu + 1 : zu);
									griffAn(zu);
								}
							}}
						/>
						<Zelle
							abb={abb}
							name={`Aussage ${String(i + 1)}`}
							wert={a.text}
							verboten={VERBOTEN.aussage}
							zuViel={() => setZuViel(true)}
							setze={(w, sofort) => schreibe(mitAussage(i, { text: w }), sofort)}
						/>
						<Umschalter
							name={`Aussage ${String(i + 1)} richtig`}
							an={a.wert === 'r'}
							setze={(an) => schreibe(mitAussage(i, { wert: an ? 'r' : 'f' }))}
						/>
						<ZeilenMenue
							abb={abb}
							u={[]}
							zeile={[]}
							i={i}
							aendere={() => undefined}
							uebernimm={abb.uebernimm}
							entfernen={aussagen.length <= 1 ? null : () => schreibe(aussagen.filter((_, n) => n !== i))}
							nachOben={i === 0 ? null : () => verschiebe(i, i - 1)}
							nachUnten={i === aussagen.length - 1 ? null : () => verschiebe(i, i + 2)}
						/>
					</div>
				))}
			</div>
			{zuViel && <p className="mt-1 text-xs text-leise">{ZEICHEN_HINWEIS.aussagen}</p>}
			<div className="mt-1 flex flex-wrap gap-1">
				<Knopf
					art="zweit"
					groesse="klein"
					onClick={() => {
						fokus.current = aussagen.length;
						schreibe([...aussagen, { text: 'Neue Aussage', wert: 'r' }]);
					}}
					data-zeile-neu={feld.attribut}
				>
					<Symbol name="plus" />
					Zeile hinzufügen
				</Knopf>
				{umschalten}
			</div>
		</Rahmen>
	);
};

/** Felder, die Zeilen statt Kurzschrift zeigen; sonst `null`. */
export const aufgabenZeilen = (abb: AbbildungSteuerung, feld: TextFeld) => {
	if (abb.schema?.name === 'Ankreuzen' && feld.attribut === 'fragen') {
		return (
			<ZeilenOderText
				abb={abb}
				feld={feld}
				verlustfrei={fragenVerlustfrei}
				liste={(u) => <FragenZeilen abb={abb} feld={feld} umschalten={u} />}
			/>
		);
	}
	if (abb.schema?.name === 'Richtig oder falsch' && feld.attribut === 'aussagen') {
		return (
			<ZeilenOderText
				abb={abb}
				feld={feld}
				verlustfrei={aussagenVerlustfrei}
				liste={(u) => <AussagenZeilen abb={abb} feld={feld} umschalten={u} />}
			/>
		);
	}
	return null;
};

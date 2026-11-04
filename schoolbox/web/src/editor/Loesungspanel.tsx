import type { MouseEvent } from 'react';
import { useId } from 'react';

import { Knopf } from '../bausteine/Knopf';
import { Schalter } from '../bausteine/Schalter';
import { Symbol } from '../bausteine/Symbol';
import { Zeile } from '../bausteine/Zeile';
import type { LoesungSteuerung } from './loesung';

/** Sonst übernimmt das Feld schon beim Drücken, der Hinweis darüber verschwindet, und der Knopf springt weg. */
const HALTE = { onMouseDown: (e: MouseEvent) => e.preventDefault() };

const EINGABE =
	'h-feld w-full rounded-md border border-rand-feld bg-flaeche px-1.5 text-sm focus:border-brand-500 focus:outline-none';

const Fehlt = ({ children }: { children: string }) => (
	<p className="flex gap-2 rounded-md bg-warnung-hell p-2 text-xs" role="status" data-hinweis="fehlt">
		<Symbol name="achtung" className="size-3.5 flex-none text-warnung" />
		{children}
	</p>
);

/** Die richtige Antwort einer Antwortlinie; sie steht nur auf dem Lösungsblatt (und im Beispiel). */
const Antwort = ({ l }: { l: LoesungSteuerung }) => {
	const id = useId();
	const weitere = l.fehlend.filter((nr) => nr !== l.antwort).length;
	return (
		<div data-loesungswerkzeug="antwort">
			<label htmlFor={id} className="flex h-zeile items-center text-leise">
				Richtige Antwort
			</label>
			<input
				key={l.antwort}
				id={id}
				type="text"
				enterKeyHint="done"
				autoComplete="off"
				autoFocus
				className={EINGABE}
				value={l.wert}
				onChange={(e) => l.tippe(e.target.value)}
				onBlur={l.uebernimm}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						l.uebernimm();
					} else if (e.key === 'Escape') {
						l.verwirf();
						e.currentTarget.blur();
					}
				}}
			/>
			{weitere > 0 && (
				<Knopf art="zweit" className="mt-2" {...HALTE} onClick={l.naechsteFehlende}>
					<Symbol name="weiter" />
					{weitere === 1 ? 'Zur anderen fehlenden Lösung' : `Nächste fehlende Lösung (${weitere})`}
				</Knopf>
			)}
			{/* Gleich hoch mit und ohne Lösung: Am iPad hoch wächst das Panel mit, und ein Antippen ginge daneben. */}
			<div className="mt-1 h-knopf">
				{l.wert.trim() ? (
					<p className="text-xs text-leise">
						{l.imBeispiel
							? 'Das ist das Beispiel: Die Antwort steht auch auf dem Arbeitsblatt.'
							: 'Steht nur auf dem Lösungsblatt.'}
					</p>
				) : (
					<Fehlt>Hier fehlt noch die Lösung.</Fehlt>
				)}
			</div>
		</div>
	);
};

const Beispiel = ({ l }: { l: LoesungSteuerung }) => {
	const id = useId();
	const { beispiel } = l;
	if (!beispiel) {
		return null;
	}
	return (
		<div data-loesungswerkzeug="beispiel">
			<Zeile
				titel="Als Beispiel zeigen"
				fuer={id}
				hilfe="Die Lösung dieses Eintrags steht dann schon auf dem Arbeitsblatt, als Vorbild für die Kinder."
			>
				<Schalter id={id} name="Als Beispiel zeigen" an={beispiel.an} setze={l.setzeAlsBeispiel} />
			</Zeile>
			{!beispiel.an && beispiel.andere.length > 0 && (
				<p className="mt-2 flex gap-2 rounded-xl bg-brand-50 p-3" data-hinweis="anderes-beispiel">
					<Symbol name="blatt" className="size-3.5 flex-none" />
					{`In dieser Aufgabe ist schon ${beispiel.andere.join(', ')} das Beispiel. Es gibt nur eines je Aufgabe.`}
				</p>
			)}
		</div>
	);
};

/** Lösung der gewählten Antwortlinie bzw. „Als Beispiel zeigen“ für das gewählte Item. */
export const Loesungswerkzeug = ({ l }: { l: LoesungSteuerung }) => {
	if (!l.aktiv) {
		return null;
	}
	return l.antwort === null ? <Beispiel l={l} /> : <Antwort l={l} />;
};

/** Ohne Auswahl in der Lösungsansicht: Wo fehlt noch eine Lösung? */
export const Loesungsuebersicht = ({ l }: { l: LoesungSteuerung }) => {
	if (!l.aktiv || l.antwortlinien === 0) {
		return null;
	}
	const anzahl = l.fehlend.length;
	return (
		<div data-loesungsuebersicht>
			<Zeile titel="Lösungsübersicht" hilfe="Tippe auf eine Antwortlinie, um ihre Lösung zu ändern.">
				<span />
			</Zeile>
			{anzahl === 0 ? (
				<p className="flex gap-2 text-xs">
					<Symbol name="haken" className="size-3.5 flex-none text-tinte" />
					Jede Antwortlinie hat eine Lösung.
				</p>
			) : (
				<>
					<div>
						<Fehlt>
							{anzahl === 1
								? 'Bei einer Antwortlinie fehlt noch die Lösung.'
								: `Bei ${anzahl} Antwortlinien fehlt noch die Lösung.`}
						</Fehlt>
					</div>
					<Knopf art="zweit" className="mt-1" onClick={l.naechsteFehlende}>
						<Symbol name="weiter" />
						Zeigen
					</Knopf>
				</>
			)}
		</div>
	);
};

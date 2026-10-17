import { useId } from 'react';

import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import type { LoesungSteuerung } from './loesung';

const EINGABE =
	'min-h-12 w-full rounded-xl border-2 border-rand bg-white px-3 text-lg focus:border-brand-500 focus:outline-none';

const Fehlt = ({ children }: { children: string }) => (
	<p className="flex gap-2 rounded-xl bg-[#fff8e1] p-3" role="status" data-hinweis="fehlt">
		<Symbol name="achtung" className="size-5 flex-none text-[#b45309]" />
		{children}
	</p>
);

/** Die richtige Antwort einer Antwortlinie; sie steht nur auf dem Lösungsblatt (und im Beispiel). */
const Antwort = ({ l }: { l: LoesungSteuerung }) => {
	const id = useId();
	const weitere = l.fehlend.filter((nr) => nr !== l.antwort).length;
	return (
		<div className="mt-3" data-loesungswerkzeug="antwort">
			<label htmlFor={id} className="font-bold">
				Richtige Antwort
			</label>
			<input
				key={l.antwort}
				id={id}
				type="text"
				enterKeyHint="done"
				autoComplete="off"
				autoFocus
				className={`${EINGABE} mt-2`}
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
				<Knopf art="zweit" className="mt-2" onClick={l.naechsteFehlende}>
					<Symbol name="weiter" />
					{weitere === 1 ? 'Zur anderen fehlenden Lösung' : `Nächste fehlende Lösung (${weitere})`}
				</Knopf>
			)}
			{/* Gleich hoch mit und ohne Lösung: Am iPad hoch wächst das Panel mit, und ein Antippen ginge daneben. */}
			<div className="mt-2 min-h-12">
				{l.wert.trim() ? (
					<p className="text-leise">
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
	const { beispiel } = l;
	if (!beispiel) {
		return null;
	}
	return (
		<div className="mt-4" data-loesungswerkzeug="beispiel">
			<label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold">
				<input
					type="checkbox"
					className="size-6 flex-none accent-brand-500"
					checked={beispiel.an}
					onChange={(e) => l.setzeAlsBeispiel(e.target.checked)}
				/>
				Als Beispiel zeigen
			</label>
			<p className="mt-1 text-leise">
				{beispiel.an
					? 'Die Lösung dieses Items steht schon auf dem Arbeitsblatt.'
					: 'Die Lösung dieses Items steht dann schon auf dem Arbeitsblatt, als Vorbild für die Kinder.'}
			</p>
			{!beispiel.an && beispiel.andere.length > 0 && (
				<p className="mt-2 flex gap-2 rounded-xl bg-brand-50 p-3" data-hinweis="anderes-beispiel">
					<Symbol name="blatt" className="size-5 flex-none" />
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
		<div className="mt-6 border-t border-rand pt-4" data-loesungsuebersicht>
			<h2 className="text-xl">Lösungen</h2>
			{anzahl === 0 ? (
				<p className="mt-2 flex gap-2">
					<Symbol name="haken" className="size-5 flex-none text-brand-600" />
					Jede Antwortlinie hat eine Lösung.
				</p>
			) : (
				<>
					<div className="mt-2">
						<Fehlt>
							{anzahl === 1
								? 'Bei einer Antwortlinie fehlt noch die Lösung.'
								: `Bei ${anzahl} Antwortlinien fehlt noch die Lösung.`}
						</Fehlt>
					</div>
					<Knopf art="zweit" className="mt-3" onClick={l.naechsteFehlende}>
						<Symbol name="weiter" />
						Zeigen
					</Knopf>
				</>
			)}
			<p className="mt-3 text-leise">Tippe auf eine Antwortlinie, um ihre Lösung zu ändern.</p>
		</div>
	);
};

import type { EinheitStand } from '@schoolbox/kern/src/einheit';
import type { PruefBefund, PruefStand, SchlussStand } from '@schoolbox/kern/src/einheit-pruefung';
import { befundZeile, FACHLICH_PRUEFEN, fachlichOffen } from '@schoolbox/kern/src/einheit-pruefung';

import { Aufklapp } from './EinheitPlanDetails';

/** Was nach der Prüfung offen ist: Befunde von Claude und Meldungen des Servers zusammen. */
const offenVon = (p: { offen: PruefBefund[]; server: string[] }) => p.offen.length + p.server.length;

const anzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

const offenText = (offen: number, gefunden: number) => {
	if (offen) {
		return `${offen} offen`;
	}
	return gefunden ? 'alles behoben' : '';
};

const pruefZeile = (p: PruefStand) => {
	if (p.status === 'laeuft') {
		return 'wird geprüft';
	}
	if (p.status === 'abgebrochen') {
		return 'Prüfung abgebrochen';
	}
	if (p.status === 'gescheitert') {
		return 'Prüfung gescheitert, das Material bleibt';
	}
	const offen = offenVon(p);
	const fachlich = fachlichOffen(p).length;
	return [
		p.gefunden.length ? `${anzahl(p.gefunden.length, 'Befund', 'Befunde')}` : 'ohne Befund',
		p.korrekturen ? anzahl(p.korrekturen, 'Korrekturrunde', 'Korrekturrunden') : '',
		offenText(offen, p.gefunden.length),
		fachlich ? `davon ${fachlich} ${FACHLICH_PRUEFEN}` : '',
	]
		.filter(Boolean)
		.join(' · ');
};

const schlussZeile = (s: SchlussStand) => {
	if (s.status === 'laeuft') {
		return 'läuft';
	}
	if (s.status === 'abgebrochen') {
		return 'abgebrochen, Weiterbauen wiederholt ihn';
	}
	const offen = offenVon(s);
	return [
		s.status === 'gescheitert' ? 'an der Grenze beendet' : '',
		s.neuGebaut.length
			? `${anzahl(s.neuGebaut.length, 'Material', 'Materialien')} neu gebaut`
			: 'nichts neu gebaut',
		offen ? `${offen} offen` : 'nichts offen',
	]
		.filter(Boolean)
		.join(' · ');
};

const Liste = ({ titel, zeilen }: { titel: string; zeilen: string[] }) =>
	zeilen.length > 0 && (
		<div>
			<p className="text-leise">{titel}</p>
			<ul className="list-disc pl-4">
				{zeilen.map((z) => (
					<li key={z}>{z}</li>
				))}
			</ul>
		</div>
	);

/**
 * Fachliche Befunde, die nach der letzten Korrekturrunde offen blieben (244): Sie stehen über der Prüfung, nicht
 * zugeklappt, je Befund eine Zeile mit dem Material. Die Lehrkraft prüft sie selbst, bevor das Material in die Klasse
 * geht.
 */
const FachlichPruefen = ({ zeilen }: { zeilen: string[] }) =>
	zeilen.length > 0 && (
		<div className="text-sm" data-fachlich-pruefen>
			<p className="text-warnung">
				{zeilen.length === 1 ? 'Ein fachlicher Befund' : `${zeilen.length} fachliche Befunde`} nach den
				Korrekturrunden offen: bitte {FACHLICH_PRUEFEN}.
			</p>
			<ul className="list-disc pl-4">
				{zeilen.map((z) => (
					<li key={z}>{z}</li>
				))}
			</ul>
		</div>
	);

/**
 * Was die Prüfläufe mit Kinderaugen, der Fachblick und der Schlusslauf gefunden haben (220, Teil 2; 244): je Material
 * eine Zeile, die Befunde zum Aufklappen; fachlich Offenes steht darüber. Während des Baus wächst die Liste mit.
 */
export const PruefungDetails = ({ s }: { s: EinheitStand }) => {
	const titel = (slug: string) => s.plan?.dokumente.find((d) => d.slug === slug)?.titel ?? slug;
	const geprueft = (s.plan?.dokumente ?? []).flatMap((d) => {
		const p = s.pruefung?.[d.slug];
		return p ? [{ d, p }] : [];
	});
	if (geprueft.length === 0 && !s.schluss) {
		return null;
	}
	const offen = geprueft.reduce((n, { p }) => n + offenVon(p), 0) + (s.schluss ? offenVon(s.schluss) : 0);
	const fachlich = [
		...geprueft.flatMap(({ d, p }) => fachlichOffen(p).map((b) => `„${d.titel}“, ${befundZeile(b)}`)),
		...(s.schluss && s.schluss.status !== 'laeuft'
			? s.schluss.offen
					.filter((b) => b.art === 'fach')
					.map(({ material, ...b }) => (material ? `„${titel(material)}“, ${befundZeile(b)}` : befundZeile(b)))
			: []),
	];
	return (
		<>
			<FachlichPruefen zeilen={fachlich} />
			<Aufklapp
				titel={`Prüfung der Materialien (${offen ? `${offen} offen` : 'nichts offen'}${fachlich.length ? `, davon ${fachlich.length} ${FACHLICH_PRUEFEN}` : ''})`}
			>
			<ul className="flex flex-col gap-1" data-einheit-pruefung>
				{geprueft.map(({ d, p }) => (
					<li key={d.slug}>
						<Aufklapp titel={`${d.titel}: ${pruefZeile(p)}`}>
							<div className="flex flex-col gap-1">
								{p.grund && <p>{p.grund}</p>}
								<Liste titel="Gefunden" zeilen={p.gefunden.map(befundZeile)} />
								<Liste titel="Offen" zeilen={[...p.offen.map(befundZeile), ...p.server]} />
							</div>
						</Aufklapp>
					</li>
				))}
				{s.schluss && (
					<li>
						<Aufklapp titel={`Abgleich der ganzen Einheit: ${schlussZeile(s.schluss)}`}>
							<div className="flex flex-col gap-1">
								{s.schluss.grund && <p>{s.schluss.grund}</p>}
								<Liste titel="Neu gebaut" zeilen={s.schluss.neuGebaut.map(titel)} />
								<Liste
									titel="Offen"
									zeilen={[
										...s.schluss.offen.map(({ material, ...b }) =>
											material ? `„${titel(material)}“, ${befundZeile(b)}` : befundZeile(b),
										),
										...s.schluss.server,
									]}
								/>
							</div>
						</Aufklapp>
					</li>
				)}
			</ul>
			</Aufklapp>
		</>
	);
};

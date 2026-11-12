import type { FormParameter } from '@schoolbox/kern/src/formen';
import { FORMEN, formVon } from '@schoolbox/kern/src/formen';
import { leseForm, setzeFormParameter, wechsleForm } from '@schoolbox/kern/src/formen-aendern';
import { zahl } from '@schoolbox/kern/src/formen-geometrie';

import { FELD_KLASSEN } from '../../../bausteine/klassen';
import { Segment } from '../../../bausteine/Segment';
import { Stepper } from '../../../bausteine/Stepper';
import { Zeile } from '../../../bausteine/Zeile';
import { zeichneFormAnzeige } from '../anzeige-folgen';
import { Regler } from '../blatt/regler';
import type { GestaltungKontext } from '../kontext';
import type { InspektorTeile } from './abschnitte';

/** Nur ansehen, ohne Schritt: der Parameter am Element im `iframe`, die Form neu gezeichnet. */
const zeigeParameter = (k: GestaltungKontext, attr: string, wert: number) => {
	const { element } = k;
	element.setAttribute(attr, zahl(wert));
	const stil = element.ownerDocument.defaultView?.getComputedStyle(element);
	zeichneFormAnzeige(element, parseFloat(stil?.width ?? '') || 1, parseFloat(stil?.height ?? '') || 1);
};

const Parameter = ({ aus, k, p, wert }: { k: GestaltungKontext; p: FormParameter; wert: number; aus: boolean }) => {
	const setze = (neu: number) =>
		k.fuehreAus(`${p.name} geändert`, (q) => ({
			quelle: setzeFormParameter(q, k.nr, { [p.attr]: neu }),
			nr: k.nr,
		}));
	// 107: Auswahl (Blase, Enden der Linie) als Segment, der Wert ist der Index in `p.werte`.
	if (p.werte) {
		const werte = p.werte.map((w, i) => ({ wert: String(i), titel: w.name }));
		return (
			<div data-form-parameter={p.attr}>
				<Zeile titel={p.name} name={p.name}>
					<Segment
						beschriftung={p.name}
						werte={werte}
						wert={String(Math.round(wert))}
						aus={aus}
						waehle={(w) => setze(Number(w))}
					/>
				</Zeile>
			</div>
		);
	}
	// Anzahlen (Ecken, Zacken, Bögen) mit − und +, alles Stufenlose am Regler: Anzeige beim Ziehen, Schritt beim Loslassen.
	if (p.einheit === undefined) {
		return (
			<div data-form-parameter={p.attr}>
				<Zeile titel={p.name} name={p.name}>
					<Stepper
						name={p.name}
						wert={wert}
						min={p.min}
						max={p.max}
						schritt={p.schritt}
						aus={aus}
						setze={setze}
					/>
				</Zeile>
			</div>
		);
	}
	const faktor = p.einheit === '%' ? 100 : 1;
	return (
		<div data-form-parameter={p.attr}>
			<Regler
				name={p.attr}
				titel={p.name}
				einheit={p.einheit === '%' ? ' %' : ' px'}
				min={Math.round(p.min * faktor)}
				max={Math.round(p.max * faktor)}
				schritt={Math.round(p.schritt * faktor)}
				wert={Math.round(wert * faktor)}
				aus={aus}
				zeige={(w) => zeigeParameter(k, p.attr, w / faktor)}
				setze={(w) => setze(w / faktor)}
			/>
		</div>
	);
};

/**
 * Abschnitt 2 „Form“ (5.8, 185): oben das Menü der Formen derselben Klasse über die volle Breite, ohne eigene
 * Beschriftung (der Abschnitt heißt so), darunter die Parameter. Hat die Klasse nur eine Form (Linie, eigene Form),
 * fehlt das Menü; ohne Parameter fehlt der ganze Teil. Jede Änderung ist ein Schritt.
 */
export const FormTeil = ({ aktiv, k, quelle }: InspektorTeile) => {
	const stand = leseForm(quelle, k.nr);
	const form = formVon(stand?.art);
	if (!stand || !form) {
		return null;
	}
	const auswahl = Object.values(FORMEN).filter((f) => f.klasse === form.klasse);
	if (auswahl.length < 2 && form.parameter.length === 0) {
		return null;
	}
	return (
		<div className="flex flex-col gap-1" data-gestaltung-form={form.art}>
			{auswahl.length > 1 && (
				<select
					className={FELD_KLASSEN}
					aria-label="Form"
					data-form-art
					disabled={!aktiv}
					value={form.art}
					onChange={(e) => {
						const art = e.target.value;
						k.fuehreAus(`Form: ${formVon(art)?.name ?? art}`, (q) => ({
							quelle: wechsleForm(q, k.nr, art),
							nr: k.nr,
						}));
					}}
				>
					{auswahl.map((f) => (
						<option key={f.art} value={f.art}>
							{f.name}
						</option>
					))}
				</select>
			)}
			{form.parameter.map((p) => (
				<Parameter key={p.attr} k={k} p={p} wert={stand.param[p.attr] ?? p.standard} aus={!aktiv} />
			))}
		</div>
	);
};

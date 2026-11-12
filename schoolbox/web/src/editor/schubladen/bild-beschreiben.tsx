/**
 * Besitzer: 179. „Bild beschreiben …“ in der Steuerzeile von „Bilder“: oben das Feld für den Wunsch, unten „Foto
 * hochladen“, die Bildchen der erkannten Figuren und Senden. Das Bild malt Claude in Canva (176); es landet in „Dieser
 * Ordner“. Optik und Senden wie „Figur beschreiben …“ in „Figuren“.
 */
import { CANVA_TEXT_ZEICHEN } from '@schoolbox/kern/src/canva-auftrag';
import { figurenFuerBild } from '@schoolbox/kern/src/figuren-namen';
import type { ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

import { meldung } from '../../api';
import { Symbol } from '../../bausteine/Symbol';
import { Tooltip } from '../../bausteine/Tooltip';
import { starteBild } from '../canva';
import { useFiguren, vorschauVon } from '../gestaltung/figuren-quelle';
import { LimitZeile } from '../LimitZeile';
import type { SchubladenTeile } from '.';

/** Bis vier Zeilen wächst das Feld, danach rollt es (wie `FELD_MAX` in `Blase.tsx`). */
const ZEILEN = 4;

export const BildBeschreiben = ({
	fehler,
	gesendet,
	hochladen,
	ki,
	ort,
	setFehler,
}: {
	ki: SchubladenTeile['ki'];
	ort: SchubladenTeile['dokument'];
	/** „Foto hochladen“ oder „Foto wird hochgeladen …“ in der unteren Zeile. */
	hochladen: ReactNode;
	/** Nach der Antwort des Servers: „Dieser Ordner“ zeigen, die Suche leeren. */
	gesendet: () => void;
	fehler: string | null;
	setFehler: (fehler: string | null) => void;
}) => {
	const [text, setText] = useState('');
	const [sendet, setSendet] = useState(false);
	const feld = useRef<HTMLTextAreaElement>(null);
	const bibliothek = useFiguren();
	const figuren = figurenFuerBild(text, bibliothek);
	const gesperrt = ki.hinweis?.art === 'gesperrt';
	const kannSenden = text.trim() !== '' && !sendet && !gesperrt;

	useLayoutEffect(() => {
		const el = feld.current;
		if (el) {
			el.style.height = 'auto';
			const zeile = Number.parseFloat(getComputedStyle(el).lineHeight) || 20;
			el.style.height = `${Math.min(zeile * ZEILEN, el.scrollHeight)}px`;
		}
	}, [text]);

	const schicke = async () => {
		if (!kannSenden) {
			return;
		}
		setSendet(true);
		try {
			await starteBild(ort, text);
			gesendet();
			feld.current?.focus();
			feld.current?.select();
		} catch (grund) {
			setFehler(meldung(grund));
		}
		setSendet(false);
	};

	return (
		<>
			<form
				data-bild-beschreiben
				className="flex flex-col gap-1 rounded-lg border border-rand bg-papier p-1 has-[textarea:focus]:border-brand-500 has-[textarea:focus]:bg-flaeche"
				onSubmit={(ev) => {
					ev.preventDefault();
					void schicke();
				}}
			>
				<div className="flex items-start gap-1.5 pt-0.5 pr-1 pl-1.5">
					<Symbol name="funken" className="mt-[3px] size-3.5 flex-none text-brand-600" />
					<textarea
						ref={feld}
						// Wie `EIGENE_GESCHICHTE`: ⌘Z im Feld gehört dem Feld.
						data-eigene-geschichte=""
						id="bild-beschreiben"
						aria-label="Bild beschreiben"
						placeholder="Bild beschreiben …"
						maxLength={CANVA_TEXT_ZEICHEN}
						rows={1}
						autoComplete="off"
						enterKeyHint="send"
						value={text}
						onChange={(ev) => {
							setText(ev.target.value);
							setFehler(null);
						}}
						onKeyDown={(ev) => {
							if (ev.key === 'Enter' && !ev.shiftKey && !ev.nativeEvent.isComposing) {
								ev.preventDefault();
								void schicke();
							}
						}}
						className="min-w-0 flex-1 resize-none bg-transparent text-sm leading-5 outline-none placeholder:text-leise"
					/>
				</div>
				<div className="flex flex-wrap items-center gap-1.5">
					{hochladen}
					<span className="ml-auto flex items-center gap-1.5">
						{figuren.length > 0 && (
							<span className="flex items-center">
								{figuren.map((figur) => (
									<Tooltip key={figur.id} text={figur.name}>
										<span
											data-bild-figur={figur.id}
											className="-ml-[5px] flex size-5 flex-none overflow-hidden rounded-full bg-flaeche ring-2 ring-white first:ml-0 [@media(any-pointer:coarse)]:size-7"
										>
											{figur.posen[0] && (
												<img
													src={vorschauVon(figur.posen[0])}
													alt=""
													draggable={false}
													className="size-full origin-top scale-[1.8] object-cover object-top"
												/>
											)}
										</span>
									</Tooltip>
								))}
							</span>
						)}
						{/* Am iPad bleibt die Trefferfläche 44 px, in der Zeile zählt nur der Kreis. */}
						<button
							type="submit"
							aria-label="Senden"
							disabled={!kannSenden}
							className="group/senden flex size-knopf-klein flex-none items-center justify-center [@media(any-pointer:coarse)]:-m-1.5"
						>
							<span className="flex size-5 items-center justify-center rounded-full bg-brand-500 text-white group-hover/senden:bg-brand-600 group-disabled/senden:bg-rand group-disabled/senden:text-leise [@media(any-pointer:coarse)]:size-8">
								<Symbol name="senden" className="size-3 [@media(any-pointer:coarse)]:size-4" />
							</span>
						</button>
					</span>
				</div>
			</form>
			{fehler && (
				<p role="alert" className="text-xs text-fehler" data-bild-fehler>
					{fehler}
				</p>
			)}
			{gesperrt && ki.hinweis && <LimitZeile hinweis={ki.hinweis} pruefeLimit={ki.pruefeLimit} />}
		</>
	);
};

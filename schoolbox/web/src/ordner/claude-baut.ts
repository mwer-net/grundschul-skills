import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { lade } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { useEreignisse } from '../ereignisse';
import { useAblage } from './kontext';
import type { ClaudeBaut } from './darstellung';

/**
 * Welche Dokumente Claude gerade als neues Blatt baut (133), mit dem Beginn des Laufs, und an welchen ein Aufgabenplan
 * auf die Freigabe wartet (190-34). Schlüssel `mappe/dok`.
 */
export const useClaudeBaut = (an = true) => {
	const [laufend, setLaufend] = useState<ReadonlyMap<string, ClaudeBaut>>(new Map());
	const neu = useCallback(() => {
		if (!an) {
			return;
		}
		lade<{ entwuerfe: { mappe: string; dok: string; seit?: string; status: string; plan?: boolean }[] }>(
			'/api/ki/entwuerfe',
		).then(
			({ entwuerfe }) =>
				setLaufend(
					new Map(
						entwuerfe.map((a) => [
							`${a.mappe}/${a.dok}`,
							{ seit: a.seit ?? null, plan: a.status === 'fertig' && a.plan === true },
						]),
					),
				),
			() => undefined,
		);
	}, [an]);
	useEffect(neu, [neu]);
	useEreignisse((e) => {
		if (e.typ === 'ki-stand' || e.typ === 'verbunden') {
			neu();
		}
	}, an);
	return laufend;
};

/** Kommt ein Aufgabenplan, während eine andere Seite offen ist: Meldung mit „Öffnen“ (190-34). */
export const usePlanDaMeldung = () => {
	const baut = useClaudeBaut();
	const zeige = useHinweis();
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const { stand } = useAblage();
	const ort = useRef(pathname);
	ort.current = pathname;
	const titel = useRef(stand);
	titel.current = stand;
	const vorher = useRef<ReadonlyMap<string, ClaudeBaut> | null>(null);
	useEffect(() => {
		const alt = vorher.current;
		vorher.current = baut;
		if (alt === null) {
			return;
		}
		for (const [schluessel, b] of baut) {
			const [mappe, dok] = schluessel.split('/');
			const editor = `/m/${mappe}/${dok}/bearbeiten`;
			if (!b.plan || alt.get(schluessel)?.plan || ort.current.startsWith(editor)) {
				continue;
			}
			const name = titel.current?.dokumente.find((d) => d.mappe === mappe && d.id === dok)?.meta.titel ?? 'dein Blatt';
			zeige({
				text: `Aufgabenplan für „${name}“ ist da`,
				aktion: { titel: 'Öffnen', ausfuehren: () => void navigate(editor) },
			});
		}
	}, [baut, navigate, zeige]);
};

import type { EinheitStand } from '@schoolbox/kern/src/einheit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { lade, sende } from '../api';
import { useHinweis } from '../bausteine/hinweis';
import { useEreignisse } from '../ereignisse';

/** Die Einheiten des Servers (139, 140): laufende, unterbrochene und eben fertige. Ereignisse halten den Stand frisch. */
export const useEinheiten = () => {
	const [einheiten, setEinheiten] = useState<EinheitStand[]>([]);
	const neu = useCallback(() => {
		lade<{ einheiten: EinheitStand[] }>('/api/einheiten').then(
			({ einheiten: liste }) => setEinheiten(liste),
			() => undefined,
		);
	}, []);
	useEffect(neu, [neu]);
	useEreignisse((e) => {
		if (e.typ === 'einheit-stand' || e.typ === 'verbunden' || e.typ === 'ordner-geaendert') {
			neu();
		}
	});
	return { einheiten, neu };
};

export const geplant = (s: EinheitStand) => s.plan?.dokumente.length ?? 0;
export const fertig = (s: EinheitStand) => Object.keys(s.importiert).length;

/** „3 von 12“; ohne Plan „plant …“. */
export const fortschritt = (s: EinheitStand) => (s.plan ? `${fertig(s)} von ${geplant(s)}` : 'plant …');

export const einheitAktion = (id: string, aktion: 'abbrechen' | 'weiter' | 'verwerfen') =>
	sende(`/api/einheiten/${id}/${aktion}`);

/** Die jüngste Einheit dieses Ordners, verworfene zählen nicht. */
export const einheitFuer = (einheiten: EinheitStand[], ordner: string | undefined) =>
	einheiten
		.filter((e) => e.ordner === ordner && e.status !== 'verworfen')
		.sort((a, b) => (a.start < b.start ? 1 : -1))[0] ?? null;

/** Meldung unten rechts, wenn eine Einheit fertig wird, die in diesem Tab lief (A2 S. 7). */
export const useEinheitFertigMeldung = (einheiten: EinheitStand[]) => {
	const zeige = useHinweis();
	const navigate = useNavigate();
	const vorher = useRef(new Map<string, string>());
	useEffect(() => {
		for (const e of einheiten) {
			if (vorher.current.get(e.id) === 'laeuft' && e.status === 'fertig') {
				zeige({
					text: `„${e.titel}“ ist fertig: ${fertig(e)} Materialien`,
					aktion: { titel: 'Öffnen', ausfuehren: () => void navigate(`/o/${e.ordner}`) },
				});
			}
		}
		vorher.current = new Map(einheiten.map((e) => [e.id, e.status]));
	}, [einheiten, navigate, zeige]);
};

import { useSyncExternalStore } from 'react';

import type { Hilfslinie } from './einrasten';

/**
 * Die Hilfslinien des Einrastens (100): dünn, kräftiges Rosa (`--color-hilfslinie` in `stil.css`), nur in der
 * Überlagerung, nie im `iframe`. Die Linien kommen in Koordinaten des Behälters, `ursprung` ist dessen Ecke im Material.
 */
export const Hilfslinien = ({
	links,
	linien,
	skala,
	ursprung,
}: {
	links: number;
	linien: readonly Hilfslinie[];
	skala: number;
	ursprung: { x: number; y: number };
}) =>
	linien.length === 0 ? null : (
		<svg
			className="pointer-events-none absolute overflow-visible"
			style={{ left: links + ursprung.x * skala, top: ursprung.y * skala }}
			width={1}
			height={1}
			aria-hidden
		>
			{linien.map((l) => (
				<line
					key={`${l.x1}:${l.y1}:${l.x2}:${l.y2}`}
					data-hilfslinie
					x1={l.x1 * skala}
					y1={l.y1 * skala}
					x2={l.x2 * skala}
					y2={l.y2 * skala}
					className="stroke-hilfslinie"
					strokeWidth={1}
				/>
			))}
		</svg>
	);

// ── Beim Ablegen aus der Schublade ──────────────────────────────────────────
// Das Ablegen (098) läuft über `zieheVonAussen` und kennt die Überlagerung nicht; es meldet seine Linien hier.

interface AblageLinien {
	doc: Document;
	ursprung: { x: number; y: number };
	linien: readonly Hilfslinie[];
}

let ablage: AblageLinien | null = null;
const hoerer = new Set<() => void>();

/** `null` oder keine Linien: weg damit. */
export const zeigeAblageLinien = (stand: AblageLinien | null) => {
	const neu = stand && stand.linien.length > 0 ? stand : null;
	if (neu === ablage) {
		return;
	}
	ablage = neu;
	for (const h of hoerer) {
		h();
	}
};

const abonniere = (h: () => void) => {
	hoerer.add(h);
	return () => {
		hoerer.delete(h);
	};
};

/** Die Linien beim Ablegen in dieses Dokument, sonst `null`. */
export const useAblageLinien = (doc: Document) => {
	const stand = useSyncExternalStore(abonniere, () => ablage);
	return stand?.doc === doc ? stand : null;
};

import type { Hilfslinie } from './einrasten';

/**
 * Die Hilfslinien des Einrastens (100): dünn, kräftiges Rosa (`--color-hilfslinie` in `stil.css`), nur in der
 * Überlagerung, nie im `iframe`. Die Linien kommen in Koordinaten des Behälters, `ursprung` ist dessen Ecke im Material.
 */
export const Hilfslinien = ({
	linien,
	links,
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

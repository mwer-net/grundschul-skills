const PFADE = {
	suche: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.1-4.1',
	papierkorb: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v6m4-6v6',
	teilen: 'M12 15V3m0 0L8 7m4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7',
	kopieren:
		'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Zm-4 6H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
	zurueck: 'M19 12H5m0 0 6-6m-6 6 6 6',
	schliessen: 'M6 6l12 12M18 6 6 18',
	auge: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
	abmelden: 'M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l4-4m0 0-4-4m4 4H4',
	haken: 'M5 12.5 10 17 19 7',
	blatt: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5M9 13h6m-6 4h6',
	zurueckholen: 'M4 9h10a5 5 0 0 1 0 10H8M4 9l4-4M4 9l4 4',
	achtung: 'M12 4 2.5 20h19L12 4Zm0 6v5m0 2.5v.5',
	plus: 'M12 5v14M5 12h14',
	herunterladen: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
	drucker: 'M7 9V3h10v6M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v7H7v-7Z',
	runter: 'm6 9 6 6 6-6',
	laden: 'M12 3a9 9 0 1 0 9 9',
} as const;

export type SymbolName = keyof typeof PFADE;

/** Schlichte Strichsymbole. Sie schmücken nur; die Bedeutung steht immer als Text daneben oder im `aria-label`. */
export const Symbol = ({ className, name }: { name: SymbolName; className?: string }) => (
	<svg
		className={className ?? 'size-6 flex-none'}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d={PFADE[name]} />
	</svg>
);

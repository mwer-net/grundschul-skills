const PFADE = {
	suche: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.1-4.1',
	papierkorb: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v6m4-6v6',
	teilen: 'M12 15V3m0 0L8 7m4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7',
	kopieren:
		'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Zm-4 6H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
	zurueck: 'M19 12H5m0 0 6-6m-6 6 6 6',
	weiter: 'M5 12h14m0 0-6-6m6 6-6 6',
	sprechblase: 'M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z',
	schliessen: 'M6 6l12 12M18 6 6 18',
	auge: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
	hilfe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.6-11.4a2.6 2.6 0 1 1 3.7 2.4c-.7.3-1.1.9-1.1 1.6V14m0 3.2v.1',
	abmelden: 'M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l4-4m0 0-4-4m4 4H4',
	haken: 'M5 12.5 10 17 19 7',
	blatt: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5M9 13h6m-6 4h6',
	zurueckholen: 'M4 9h10a5 5 0 0 1 0 10H8M4 9l4-4M4 9l4 4',
	achtung: 'M12 4 2.5 20h19L12 4Zm0 6v5m0 2.5v.5',
	plus: 'M12 5v14M5 12h14',
	herunterladen: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
	drucker: 'M7 9V3h10v6M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v7H7v-7Z',
	runter: 'm6 9 6 6 6-6',
	hoch: 'm6 15 6-6 6 6',
	links: 'm15 6-6 6 6 6',
	rechts: 'm9 6 6 6-6 6',
	laden: 'M12 3a9 9 0 1 0 9 9',
	praesentieren: 'M3 4h18M4 4v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V4m-8 11v3m-4 3 4-3 4 3M10.5 7v5l4-2.5-4-2.5Z',
	vollbild: 'M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5',
	bildschirm: 'M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm5 16h6m-3-4v4',
	nummer: 'M10 4 8 20m8-16-2 16M5 9h15M4 15h15',
	stift: 'm4 20 1-4L16 5a2 2 0 0 1 3 3L8 19l-4 1Zm10-13 3 3',
	rueckgaengig: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
	wiederholen: 'm15 14 5-5-5-5m5 5H9a5 5 0 0 0 0 10h3',
	uhr: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',
	minus: 'M5 12h14',
	bild: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 12 5-5 4 4 3-3 5 5M15 8.5h.01',
	hochladen: 'M12 16V4m0 0-4 4m4-4 4 4M5 20h14',
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

/** Der Wert während der Geste, am Zeiger wie der Name beim Ziehen im Stapel: „240 × 96“, „−12°“, „X 238 · Y 708“. */
export const WertAmZeiger = ({
	links,
	skala,
	text,
	zeiger,
}: {
	links: number;
	skala: number;
	text: string;
	/** In Koordinaten des Materials. */
	zeiger: { x: number; y: number };
}) => (
	<span
		className="pointer-events-none absolute z-ueberlagerung rounded-lg bg-tinte px-3 py-1 font-medium whitespace-nowrap text-white tabular-nums shadow-2"
		data-wert-am-zeiger
		style={{ left: links + zeiger.x * skala + 18, top: zeiger.y * skala + 18 }}
	>
		{text}
	</span>
);

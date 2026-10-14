export type Begrenzung = <T>(arbeit: () => Promise<T>) => Promise<T>;

/** Lässt höchstens `plaetze` Arbeiten gleichzeitig laufen, die übrigen warten der Reihe nach. */
export const erstelleBegrenzung = (plaetze: number): Begrenzung => {
	let frei = plaetze;
	const wartend: (() => void)[] = [];
	return async <T>(arbeit: () => Promise<T>) => {
		if (frei > 0) {
			frei -= 1;
		} else {
			await new Promise<void>((resolve) => wartend.push(resolve));
		}
		try {
			return await arbeit();
		} finally {
			const naechste = wartend.shift();
			if (naechste) {
				naechste();
			} else {
				frei += 1;
			}
		}
	};
};

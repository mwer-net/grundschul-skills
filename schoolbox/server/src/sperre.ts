export type Sperre = <T>(schluessel: string, arbeit: () => Promise<T>) => Promise<T>;

/** Führt Arbeiten mit demselben Schlüssel nacheinander aus (z. B. Speichern und Versionieren eines Dokuments). */
export const erstelleSperre = (): Sperre => {
	const ketten = new Map<string, Promise<unknown>>();
	return <T>(schluessel: string, arbeit: () => Promise<T>) => {
		const lauf = (ketten.get(schluessel) ?? Promise.resolve()).then(arbeit);
		const ende = lauf.catch(() => undefined);
		ketten.set(schluessel, ende);
		void ende.then(() => {
			if (ketten.get(schluessel) === ende) {
				ketten.delete(schluessel);
			}
		});
		return lauf;
	};
};

import type { AktionsAntwort, AblageStand, Objekt } from './typen';
import { ortName } from './objekte';

const anzahlText = (objekte: readonly Pick<Objekt, 'name'>[], knotenzahl: number) => {
	const [erstes] = objekte;
	return knotenzahl === 1 && erstes ? `„${erstes.name}“` : `${knotenzahl} Objekte`;
};

const zusatz = (stand: AblageStand, { ergebnis: { geteilt, umbenannt, uebersprungen } }: AktionsAntwort) => {
	const teile: string[] = [];
	const [erstes] = umbenannt;
	if (umbenannt.length === 1 && erstes) {
		teile.push(`Eines hieß dort schon so und heißt jetzt „${erstes.nach}“.`);
	} else if (umbenannt.length > 1) {
		teile.push(`${umbenannt.length} hießen dort schon so und tragen jetzt eine Nummer.`);
	}
	if (uebersprungen > 0) {
		teile.push(
			uebersprungen === 1
				? 'Eines lag inzwischen im Papierkorb und wurde übersprungen.'
				: `${uebersprungen} lagen inzwischen im Papierkorb und wurden übersprungen.`,
		);
	}
	if (geteilt) {
		const name = stand.ordner.find((o) => o.id === geteilt)?.name ?? geteilt;
		teile.push(`Der Ordner „${name}“ ist geteilt: Wer den Link hat, sieht das jetzt auch.`);
	}
	return teile.length > 0 ? ` ${teile.join(' ')}` : '';
};

export const bewegtText = (stand: AblageStand, objekte: readonly Objekt[], ziel: string | null, a: AktionsAntwort) =>
	`${anzahlText(objekte, objekte.length)} nach „${ortName(stand, ziel)}“ bewegt.${zusatz(stand, a)}`;

export const kopiertText = (stand: AblageStand, objekte: readonly Objekt[], ziel: string | null, a: AktionsAntwort) =>
	`${anzahlText(objekte, objekte.length)} nach „${ortName(stand, ziel)}“ kopiert.${zusatz(stand, a)}`;

export const geloeschtText = (objekte: readonly Objekt[]) =>
	`${anzahlText(objekte, objekte.length)} in den Papierkorb gelegt.`;

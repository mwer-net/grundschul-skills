import type { PlanPruefPunkt, PlanPruefStand } from '@schoolbox/kern/src/einheit-plan-pruefung';
import { PRUEF_ART_NAME } from '@schoolbox/kern/src/einheit-pruefung';

export interface PlanPruefAnzeige {
	titel: string;
	offen: PlanPruefPunkt[];
	behoben: PlanPruefPunkt[];
	/** Ein Satz, wenn die Prüfung scheiterte oder der Plan danach geändert wurde. */
	hinweis: string | null;
}

const zahl = (n: number, eins: string, viele: string) => (n === 1 ? `1 ${eins}` : `${n} ${viele}`);

/** Was „Geprüft“ im Plan zeigt (247); ohne Stand (Einheiten davor) nichts. */
export const planPruefAnzeige = (stand: PlanPruefStand | undefined): PlanPruefAnzeige | null => {
	if (!stand) {
		return null;
	}
	const offen = stand.punkte.filter((p) => p.stand === 'offen');
	const behoben = stand.punkte.filter((p) => p.stand === 'behoben');
	const teile = [
		offen.length ? zahl(offen.length, 'Hinweis offen', 'Hinweise offen') : '',
		behoben.length ? `${behoben.length} behoben` : '',
	].filter(Boolean);
	const hinweis = [
		stand.pruefung === 'gescheitert'
			? `Die Prüfung mit frischem Blick hat diesmal nicht geklappt${stand.grund ? ` (${stand.grund.replace(/\.$/, '')})` : ''}; nachgerechnet hat die Schoolbox trotzdem.`
			: '',
		stand.geaendert
			? 'Nach deiner Änderung neu nachgerechnet; die Hinweise der Prüfung stammen vom Plan davor.'
			: '',
	]
		.filter(Boolean)
		.join(' ');
	return {
		titel: teile.length ? `Geprüft: ${teile.join(', ')}` : 'Geprüft: nichts gefunden',
		offen,
		behoben,
		hinweis: hinweis || null,
	};
};

/** „Stunde 2 · Aufbau der Reihe“ oder „Nachgerechnet“ vor dem Text eines Punkts. */
export const punktKopf = (p: PlanPruefPunkt) =>
	p.von === 'rechnung' ? 'Nachgerechnet' : [p.wo, p.art ? PRUEF_ART_NAME[p.art] : ''].filter(Boolean).join(' · ');

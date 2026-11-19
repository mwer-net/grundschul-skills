import { FACHLICH_PRUEFEN } from '@schoolbox/kern/src/einheit-pruefung';

/** Der Satz über den offenen fachlichen Befunden der Prüfung (244). */
export const fachlichOffenSatz = (n: number) =>
	`${n === 1 ? 'Ein fachlicher Befund' : `${n} fachliche Befunde`} nach den Korrekturrunden offen: bitte ${FACHLICH_PRUEFEN}.`;

export class ApiFehler extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = 'ApiFehler';
	}
}

const NICHT_ERREICHBAR = 'Die Schoolbox ist gerade nicht erreichbar. Bitte versuch es gleich noch einmal.';

const auswerten = async <T>(antwort: Response): Promise<T> => {
	const daten = (await antwort.json().catch(() => ({}))) as T & { fehler?: string };
	if (!antwort.ok) {
		throw new ApiFehler(antwort.status, daten.fehler ?? NICHT_ERREICHBAR);
	}
	return daten;
};

const anfrage = async <T>(url: string, init?: RequestInit): Promise<T> => {
	let antwort: Response;
	try {
		antwort = await fetch(url, { credentials: 'same-origin', ...init });
	} catch {
		throw new ApiFehler(0, NICHT_ERREICHBAR);
	}
	return auswerten<T>(antwort);
};

export const lade = <T>(url: string) => anfrage<T>(url);

/** Schreibende Anfragen: JSON plus eigener Kopf, sonst lehnt der Server sie ab (CSRF-Schutz). */
export const sende = <T>(url: string, daten: unknown = {}) =>
	anfrage<T>(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'x-schoolbox': '1' },
		body: JSON.stringify(daten),
	});

export const ANMELDE_SEITE = '/anmelden';

/** Nur Pfade auf dieser Seite; `//andere.seite` oder `https://…` würden sonst nach außen führen. */
export const sichererPfad = (weiter: string | null) =>
	weiter && weiter.startsWith('/') && !weiter.startsWith('//') && !weiter.startsWith('/\\') ? weiter : '/';

export const zurAnmeldung = () => {
	const weiter = `${window.location.pathname}${window.location.search}`;
	window.location.replace(`${ANMELDE_SEITE}?weiter=${encodeURIComponent(weiter)}`);
};

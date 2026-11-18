/**
 * Die Bild-API von OpenAI (237): ein Bild je Aufruf über die Images API, als JSON. Ohne Referenz an `generations`, mit
 * Referenzen oder beim Bearbeiten an `edits` mit den Bildern als Data-URLs. Nur der Server ruft sie auf; Claude sieht
 * den Schlüssel nie. Parameter und Fehlerbehandlung begründet der „Doku-Befund“ im Ticket: `input_fidelity`,
 * `complexity`, `moderation`, `mask`, `markup` und `stream` gehen bewusst nicht mit.
 */
import type { BildFormat, BildQualitaet } from '@schoolbox/kern';
import { bildGroesse } from '@schoolbox/kern';

import { typAus } from './bild-datei';

export const BILD_API_URL = 'https://api.openai.com/v1/images';
/** Die Kennung, an der Claude und der Lauf erkennen, dass kein Bild mehr kommt. */
export const BILD_API_GESPERRT = 'bild-api-gesperrt';
/** OpenAI: Beim Bearbeiten die Transparenz im Prompt wiederholen. */
export const TRANSPARENT_SATZ = 'Der Hintergrund bleibt vollständig transparent.';
/** Laut Doku bis 16; die Werkzeuge nehmen höchstens 4. */
export const MAX_REFERENZEN = 16;
/** Je Data-URL höchstens 20 MB; Base64 macht aus 3 Bytes 4 Zeichen. */
export const MAX_REFERENZ_BYTES = Math.floor((20 * 1024 * 1024 * 3) / 4) - 64;
/** Dreimal wiederholen, ohne `Retry-After` nach 20, 40 und 80 s. */
const WARTEN_MS = [20_000, 40_000, 80_000];
/** Mehr als zwei Minuten verlangt ein `Retry-After` nur, wenn etwas anderes nicht stimmt. */
const MAX_RETRY_AFTER_MS = 120_000;
const ZUFALL_MS = 5000;
const STANDARD_ZEIT_MS = 180_000;
/** Aus dem Modellvergleich (Doku-Befund): $ je Token für Bild- und Texteingabe und Ausgabe bei 2.6. */
const USD_JE_TOKEN = { bild: 8e-6, text: 5e-6, ausgabe: 30e-6 };

const GESPERRT_CODES = new Set([
	'credit_balance_exhausted',
	'organization_spend_limit_exceeded',
	'project_spend_limit_exceeded',
	'organization_usage_limit_exceeded',
	'insufficient_quota',
]);
const NOCHMAL_CODES = new Set(['rate_limit_exceeded', 'slow_down']);
const NOCHMAL_STATUS = new Set([500, 502, 503, 504]);

export interface BildAnfrage {
	prompt: string;
	format: BildFormat;
	typ: 'png' | 'jpg';
	transparent: boolean;
	/** PNG oder JPEG; beim Bearbeiten ist das erste das Bild selbst. */
	referenzen: Buffer[];
	bearbeiten?: boolean;
}

export interface BildApiEinstellung {
	schluessel: string;
	modell: string;
	qualitaet: BildQualitaet;
}

/** Für Tests einspritzbar: `fetch`, die Wartezeit und der Zufall. */
export interface BildApiUmgebung {
	laden?: typeof fetch;
	warte?: (ms: number) => Promise<void>;
	zufall?: () => number;
	jetzt?: () => number;
	/** Frist je HTTP-Aufruf. */
	zeitMs?: number;
	/** Bis zu diesem Zeitpunkt (ms seit 1970) muss alles fertig sein, Wiederholungen eingeschlossen. */
	bis?: number;
}

export interface BildVerbrauch {
	bildToken: number;
	textToken: number;
	ausgabeToken: number;
}

export interface BildErgebnis {
	inhalt: Buffer;
	verbrauch: BildVerbrauch;
	/** Geschätzt aus `usage` und den Preisen des Vergleichs. */
	kostenUsd: number;
	wiederholungen: number;
}

export type BildFehlerArt = 'gesperrt' | 'ausgelastet' | 'sicherheit' | 'abgelehnt' | 'zeit' | 'netz' | 'antwort';

export class BildApiFehler extends Error {
	constructor(
		readonly art: BildFehlerArt,
		message: string,
	) {
		super(message);
		this.name = 'BildApiFehler';
	}
}

const warteEcht = (ms: number) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});

const dataUrl = (inhalt: Buffer) => {
	const typ = typAus(inhalt);
	if (!typ) {
		throw new BildApiFehler('abgelehnt', 'Eine Referenz ist kein PNG oder JPEG.');
	}
	if (inhalt.length > MAX_REFERENZ_BYTES) {
		throw new BildApiFehler('abgelehnt', 'Eine Referenz ist größer als 15 MB.');
	}
	return `data:${typ === 'png' ? 'image/png' : 'image/jpeg'};base64,${inhalt.toString('base64')}`;
};

/** Der Körper des Aufrufs; ohne Referenz an `generations`, sonst an `edits`. */
export const bildAnfrageKoerper = (anfrage: BildAnfrage, einstellung: Pick<BildApiEinstellung, 'modell' | 'qualitaet'>) => {
	if (anfrage.referenzen.length > MAX_REFERENZEN) {
		throw new BildApiFehler('abgelehnt', `Höchstens ${MAX_REFERENZEN} Referenzen.`);
	}
	const transparent = anfrage.transparent && anfrage.typ === 'png';
	const prompt = anfrage.bearbeiten && transparent ? `${anfrage.prompt.trim()} ${TRANSPARENT_SATZ}` : anfrage.prompt;
	const koerper: Record<string, unknown> = {
		model: einstellung.modell,
		prompt,
		n: 1,
		size: bildGroesse(anfrage.format),
		quality: einstellung.qualitaet,
		output_format: anfrage.typ === 'png' ? 'png' : 'jpeg',
		...(anfrage.typ === 'jpg' ? { output_compression: 90 } : {}),
		...(transparent ? { background: 'transparent' } : {}),
	};
	const mitBildern = anfrage.bearbeiten === true || anfrage.referenzen.length > 0;
	if (mitBildern) {
		koerper.images = anfrage.referenzen.map((r) => ({ image_url: dataUrl(r) }));
	}
	return { url: `${BILD_API_URL}/${mitBildern ? 'edits' : 'generations'}`, koerper };
};

const zahl = (w: unknown) => (typeof w === 'number' && Number.isFinite(w) && w >= 0 ? w : 0);

const verbrauchAus = (usage: unknown): BildVerbrauch => {
	const u = (usage ?? {}) as { input_tokens_details?: { image_tokens?: unknown; text_tokens?: unknown }; output_tokens?: unknown };
	return {
		bildToken: zahl(u.input_tokens_details?.image_tokens),
		textToken: zahl(u.input_tokens_details?.text_tokens),
		ausgabeToken: zahl(u.output_tokens),
	};
};

export const kostenAus = (v: BildVerbrauch) =>
	Math.round((v.bildToken * USD_JE_TOKEN.bild + v.textToken * USD_JE_TOKEN.text + v.ausgabeToken * USD_JE_TOKEN.ausgabe) * 1e4) /
	1e4;

const kurz = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 300);

/** `Retry-After` in Sekunden oder als Datum, `retry-after-ms` in Millisekunden; `null` ohne Angabe. */
const retryAfterMs = (kopf: Headers, jetzt: number): number | null => {
	const ms = Number(kopf.get('retry-after-ms'));
	if (kopf.get('retry-after-ms') !== null && Number.isFinite(ms) && ms >= 0) {
		return ms;
	}
	const roh = kopf.get('retry-after');
	if (roh === null) {
		return null;
	}
	const sekunden = Number(roh);
	if (Number.isFinite(sekunden) && sekunden >= 0) {
		return sekunden * 1000;
	}
	const datum = Date.parse(roh);
	return Number.isNaN(datum) ? null : Math.max(0, datum - jetzt);
};

interface ApiFehler {
	status: number;
	code: string;
	typ: string;
	text: string;
}

const leseFehler = async (antwort: Response): Promise<ApiFehler> => {
	let fehler: { code?: unknown; type?: unknown; message?: unknown } = {};
	try {
		fehler = ((await antwort.json()) as { error?: typeof fehler }).error ?? {};
	} catch {
		// Kein JSON: Dann zählt nur der Status.
	}
	return {
		status: antwort.status,
		code: typeof fehler.code === 'string' ? fehler.code : '',
		typ: typeof fehler.type === 'string' ? fehler.type : '',
		text: typeof fehler.message === 'string' ? kurz(fehler.message) : '',
	};
};

const GESPERRT_TEXT = `${BILD_API_GESPERRT}: OpenAI erzeugt keine Bilder mehr (Guthaben, Ausgabenlimit oder Schlüssel).`;

/** Unterschieden wird an `error.code` und `error.type`: Guthaben und Ausgabenlimit kommen ebenfalls als 429. */
const einordnen = (f: ApiFehler): BildApiFehler | 'nochmal' => {
	if (f.status === 401 || f.status === 403 || GESPERRT_CODES.has(f.code) || f.typ === 'insufficient_quota') {
		return new BildApiFehler('gesperrt', GESPERRT_TEXT);
	}
	if (f.code === 'moderation_blocked') {
		return new BildApiFehler('sicherheit', 'Sicherheitsfilter: Motiv harmloser formulieren.');
	}
	if ((f.status === 429 && NOCHMAL_CODES.has(f.code)) || NOCHMAL_STATUS.has(f.status)) {
		return 'nochmal';
	}
	return new BildApiFehler('abgelehnt', f.text ? `Bild-API: ${f.text}` : `Bild-API: HTTP ${f.status}.`);
};

const liesErgebnis = async (antwort: Response, typ: 'png' | 'jpg', wiederholungen: number): Promise<BildErgebnis> => {
	let roh: { data?: { b64_json?: unknown }[]; usage?: unknown };
	try {
		roh = (await antwort.json()) as typeof roh;
	} catch (fehler) {
		const name = (fehler as { name?: unknown })?.name;
		if (name === 'TimeoutError' || name === 'AbortError') {
			throw new BildApiFehler('zeit', 'Die Bild-API hat nicht rechtzeitig geantwortet.');
		}
		throw new BildApiFehler('antwort', 'Die Antwort der Bild-API war unlesbar.');
	}
	const b64 = roh.data?.[0]?.b64_json;
	const inhalt = typeof b64 === 'string' ? Buffer.from(b64, 'base64') : Buffer.alloc(0);
	if (typAus(inhalt) !== typ) {
		throw new BildApiFehler('antwort', `Die Bild-API hat kein ${typ === 'png' ? 'PNG' : 'JPEG'} geliefert.`);
	}
	const verbrauch = verbrauchAus(roh.usage);
	return { inhalt, verbrauch, kostenUsd: kostenAus(verbrauch), wiederholungen };
};

/** Ein Bild. Wirft `BildApiFehler`; bei Ratenlimit und Überlastung bis zu dreimal wiederholt. */
export const erzeugeBild = async (
	anfrage: BildAnfrage,
	einstellung: BildApiEinstellung,
	umgebung: BildApiUmgebung = {},
): Promise<BildErgebnis> => {
	const laden = umgebung.laden ?? fetch;
	const warte = umgebung.warte ?? warteEcht;
	const zufall = umgebung.zufall ?? Math.random;
	const jetzt = umgebung.jetzt ?? Date.now;
	const zeitMs = umgebung.zeitMs ?? STANDARD_ZEIT_MS;
	const { koerper, url } = bildAnfrageKoerper(anfrage, einstellung);
	const text = JSON.stringify(koerper);
	for (let versuch = 0; ; versuch += 1) {
		const frist = umgebung.bis === undefined ? zeitMs : Math.min(zeitMs, umgebung.bis - jetzt());
		if (frist <= 0) {
			throw new BildApiFehler('zeit', 'Die Bild-API hat nicht rechtzeitig geantwortet.');
		}
		let antwort: Response;
		try {
			antwort = await laden(url, {
				method: 'POST',
				headers: { 'Authorization': `Bearer ${einstellung.schluessel}`, 'Content-Type': 'application/json' },
				body: text,
				signal: AbortSignal.timeout(frist),
			});
		} catch (fehler) {
			const name = (fehler as { name?: unknown })?.name;
			throw name === 'TimeoutError' || name === 'AbortError'
				? new BildApiFehler('zeit', 'Die Bild-API hat nicht rechtzeitig geantwortet.')
				: new BildApiFehler('netz', 'Die Bild-API ist nicht erreichbar.');
		}
		if (antwort.ok) {
			return await liesErgebnis(antwort, anfrage.typ, versuch);
		}
		const fehler = einordnen(await leseFehler(antwort));
		if (fehler !== 'nochmal') {
			throw fehler;
		}
		const ausgelastet = new BildApiFehler('ausgelastet', 'Bild-API ausgelastet. Versuche es später noch einmal.');
		if (versuch >= WARTEN_MS.length) {
			throw ausgelastet;
		}
		const vorgabe = retryAfterMs(antwort.headers, jetzt());
		const ms =
			vorgabe === null
				? (WARTEN_MS[versuch] ?? 0)
				: Math.min(vorgabe, MAX_RETRY_AFTER_MS) + Math.round(zufall() * ZUFALL_MS);
		if (umgebung.bis !== undefined && jetzt() + ms >= umgebung.bis) {
			throw ausgelastet;
		}
		await warte(ms);
	}
};

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { baueAusgabe, baueFolienZusatz, dokumentDir, pruefeFassung } from '@schoolbox/kern';

import type { Begrenzung } from './begrenzung';
import { erstelleBegrenzung } from './begrenzung';
import type { Bremse } from './bremse';
import { erstelleBremse } from './bremse';
import type { CanvaLaeufe } from './canva-lauf';
import { erstelleCanvaLaeufe } from './canva-lauf';
import type { Einheiten } from './einheit';
import { erstelleEinheiten } from './einheit';
import type { Ereignisse } from './ereignisse';
import { erstelleEreignisse } from './ereignisse';
import type { Ki, KiPruefer } from './ki';
import { erstelleKi } from './ki';
import type { ServerKonfig } from './konfig';
import type { OrdnerSpeicher } from './ordner-speicher';
import { erstelleOrdnerSpeicher } from './ordner-speicher';
import type { FolienBauer, Pdf, PdfBauer } from './pdf';
import { erstellePdf } from './pdf';
import type { Sperre } from './sperre';
import { erstelleSperre } from './sperre';
import type { Vorschau, VorschauBauer } from './vorschau';
import { erstelleVorschau } from './vorschau';

/** Inhalts-Hashes, die der Server zuletzt gesehen oder selbst geschrieben hat. */
export interface Bekannt {
	quelle: string;
	meta: string;
}

export interface Kontext {
	konfig: ServerKonfig;
	ereignisse: Ereignisse;
	sperre: Sperre;
	bekannt: Map<string, Bekannt>;
	bremse: Bremse;
	vorschau: Vorschau;
	pdf: Pdf;
	ki: Ki;
	einheiten: Einheiten;
	canva: CanvaLaeufe;
	ordner: OrdnerSpeicher;
	version: string;
}

/** Jeder Bau startet Chromium und braucht entsprechend Speicher: Vorschauen und PDFs zusammen höchstens so viele. */
export const GLEICHZEITIGE_BAUTEN = 2;

export interface Bauer {
	/** Ohne (Tests) entstehen keine Vorschauen; vorhandene werden trotzdem gemeldet. */
	vorschau?: VorschauBauer;
	/** Ohne baut blatt.py. */
	pdf?: PdfBauer;
	/** Ohne baut blatt.py. */
	folien?: FolienBauer;
	/** Ohne prüft blatt.py die Vorschläge von Claude. */
	kiPruefer?: KiPruefer;
}

export const erstelleKontext = (konfig: ServerKonfig, version: string, bauer: Bauer = {}): Kontext => {
	const ereignisse = erstelleEreignisse();
	const sperre = erstelleSperre();
	const begrenzung: Begrenzung = erstelleBegrenzung(GLEICHZEITIGE_BAUTEN);
	const { materialDir } = konfig;
	const pruefer: KiPruefer = bauer.kiPruefer ?? ((dokDir, html) => pruefeFassung(konfig, dokDir, html));
	const kontext: Omit<Kontext, 'canva' | 'einheiten'> & Partial<Pick<Kontext, 'canva' | 'einheiten'>> = {
		konfig,
		ereignisse,
		sperre,
		bekannt: new Map(),
		bremse: erstelleBremse(),
		vorschau: erstelleVorschau({ materialDir, ereignisse, sperre, begrenzung, bauer: bauer.vorschau ?? null }),
		pdf: erstellePdf({
			materialDir,
			ereignisse,
			sperre,
			begrenzung,
			bauer: bauer.pdf ?? ((dokDir, profil) => baueAusgabe(konfig, dokDir, profil)),
			folienBauer: bauer.folien ?? ((dokDir, art) => baueFolienZusatz(konfig, dokDir, art)),
		}),
		ki: erstelleKi({
			konfig,
			ereignisse,
			pruefer,
		}),
		ordner: erstelleOrdnerSpeicher(materialDir, sperre, ereignisse),
		version,
	};
	// Die Einheiten brauchen den fertigen Kontext (Ordner, Sperre, Quelle schreiben).
	kontext.einheiten = erstelleEinheiten(kontext as Kontext, pruefer);
	kontext.canva = erstelleCanvaLaeufe(kontext as Kontext);
	return kontext as Kontext;
};

/** Schlüssel der Sperre für `_freigaben.json`; kann mit keiner Dokument-ID kollidieren. */
export const FREIGABEN_SPERRE = '_freigaben';

export const dokSchluessel = (mappe: string, dok: string) => `${mappe}/${dok}`;

/** Versionskennung für `basisVersion`: hängt nur vom Inhalt ab, ein bloßes `touch` ändert sie nicht. */
export const kennung = (inhalt: string | Buffer) => createHash('sha256').update(inhalt).digest('hex').slice(0, 16);

const kennungDatei = async (datei: string) => kennung(await readFile(datei).catch(() => Buffer.alloc(0)));

export const leseBekannt = async (kontext: Kontext, mappe: string, dok: string): Promise<Bekannt> => {
	const dir = dokumentDir(kontext.konfig.materialDir, mappe, dok);
	const [quelle, meta] = await Promise.all([
		kennungDatei(path.join(dir, 'material.html')),
		kennungDatei(path.join(dir, 'meta.json')),
	]);
	return { quelle, meta };
};

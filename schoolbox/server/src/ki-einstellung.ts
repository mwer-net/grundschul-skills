/**
 * Besitzer: 232. Modell und Gründlichkeit für Claude, eine Einstellung für die ganze Schoolbox. Jede Handlung liest sie
 * beim Start einmal; was der Server danach ohne neue Handlung nachschiebt, behält diesen Stand.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Konfig } from '@schoolbox/kern';
import { schreibeJson } from '@schoolbox/kern';
import type { Router as RouterTyp } from 'express';

import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';

export type KiEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type KiEffortWahl = 'auto' | KiEffort;

/** `modell: null`: der Standard aus der Konfiguration (`SCHOOLBOX_KI_MODELL`). */
export interface KiEinstellung {
	modell: string | null;
	effort: KiEffortWahl;
}

/** Was ein Lauf bekommt: `--model` und `--effort`. */
export interface KiLauf {
	modell: string;
	effort: KiEffort;
}

export const KI_MODELLE = [
	{ id: 'opus', name: 'Opus' },
	{ id: 'sonnet', name: 'Sonnet' },
	{ id: 'haiku', name: 'Haiku' },
] as const;

export const KI_EFFORTS: readonly KiEffortWahl[] = ['auto', 'low', 'medium', 'high', 'xhigh', 'max'];

/** Änderungen und Canva-Bilder bei `auto`. */
export const KI_EFFORT: KiEffort = 'medium';
/** Neue Blätter, Einheiten und die Recherche bei `auto`: Hier zählt das Ergebnis, nicht die Minute. */
export const KI_EFFORT_GROSS: KiEffort = 'high';

export const KI_EINSTELLUNG_DATEI = '_ki-einstellung.json';
export const KI_EINSTELLUNG_STANDARD: KiEinstellung = { modell: null, effort: 'auto' };

const istModell = (wert: unknown): wert is string => KI_MODELLE.some((m) => m.id === wert);
const istEffort = (wert: unknown): wert is KiEffortWahl => KI_EFFORTS.some((e) => e === wert);

const datei = (materialDir: string) => path.join(materialDir, KI_EINSTELLUNG_DATEI);

/** Fehlt die Datei oder ist ein Teil unbrauchbar, gilt dort der Standard. */
export const leseKiEinstellung = async (materialDir: string): Promise<KiEinstellung> => {
	let roh: unknown;
	try {
		roh = JSON.parse(await readFile(datei(materialDir), 'utf8'));
	} catch {
		return { ...KI_EINSTELLUNG_STANDARD };
	}
	const { effort, modell } = (typeof roh === 'object' && roh !== null ? roh : {}) as Record<string, unknown>;
	return {
		modell: istModell(modell) ? modell : null,
		effort: istEffort(effort) ? effort : 'auto',
	};
};

export const schreibeKiEinstellung = (materialDir: string, einstellung: KiEinstellung) =>
	schreibeJson(datei(materialDir), einstellung);

/** `klein`: Änderungen und Canva-Bilder; `gross`: neue Blätter, Einheiten, Recherche und Prüfläufe. */
export const waehleLauf = (
	einstellung: KiEinstellung,
	konfig: Pick<Konfig, 'kiModell'>,
	art: 'klein' | 'gross',
): KiLauf => {
	const auto = art === 'gross' ? KI_EFFORT_GROSS : KI_EFFORT;
	return {
		modell: einstellung.modell ?? konfig.kiModell,
		effort: einstellung.effort === 'auto' ? auto : einstellung.effort,
	};
};

/** Liest die Einstellung jetzt, beim Start einer Handlung. */
export const kiLaufJetzt = async (konfig: Pick<Konfig, 'kiModell' | 'materialDir'>, art: 'klein' | 'gross') =>
	waehleLauf(await leseKiEinstellung(konfig.materialDir), konfig, art);

/** Ein Teil der Einstellung aus der Anfrage; was fehlt, bleibt wie es ist. */
const pruefeTeil = (body: unknown, jetzt: KiEinstellung): KiEinstellung => {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		throw new HttpFehler(400, 'Die Einstellung ist ungültig.');
	}
	const { effort, modell } = body as Record<string, unknown>;
	if (modell !== undefined && modell !== null && !istModell(modell)) {
		throw new HttpFehler(400, 'Dieses Modell gibt es nicht.');
	}
	if (effort !== undefined && !istEffort(effort)) {
		throw new HttpFehler(400, 'Diese Gründlichkeit gibt es nicht.');
	}
	return {
		modell: modell === undefined ? jetzt.modell : modell,
		effort: effort ?? jetzt.effort,
	};
};

/** Die Routen; hängen am `apiRouter` vor `/ki/:id`, also mit Sitzung und CSRF-Schutz wie die übrigen `/ki`-Routen. */
export const kiEinstellungApi = (router: RouterTyp, kontext: Kontext) => {
	const { konfig } = kontext;
	const antwort = (e: KiEinstellung) => ({ ...e, standardModell: konfig.kiModell, modelle: KI_MODELLE });

	router.get('/ki/einstellung', async (_req, res) => {
		res.json(antwort(await leseKiEinstellung(konfig.materialDir)));
	});

	router.put('/ki/einstellung', async (req, res) => {
		const neu = pruefeTeil(req.body, await leseKiEinstellung(konfig.materialDir));
		await schreibeKiEinstellung(konfig.materialDir, neu);
		res.json(antwort(neu));
	});
};

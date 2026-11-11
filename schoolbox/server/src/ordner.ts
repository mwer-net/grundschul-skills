import { existsSync } from 'node:fs';
import path from 'node:path';

import type {
	AblageKnoten,
	Aktion,
	Art,
	Baum,
	DokumentMeta,
	Effekt,
	Fach,
	Format,
	Freigabe,
	Klasse,
	Umgebung,
} from '@schoolbox/kern';
import {
	aktualisiereMappe,
	ART_FORMATE,
	ARTEN,
	dokKnotenSchluessel,
	dokumentDir,
	dokumentGeloescht,
	FAECHER,
	KLASSEN,
	kopiereKnoten,
	lebenderOrdner,
	leseAktion,
	leseFreigaben,
	mappenDir,
	MAX_NAME,
	namenIn,
	neueMappe,
	neuesDokument,
	ordnerGeloescht,
	ordnerMitBehaelter,
	ordnerPfad,
	sammleMappen,
	setzeTitel,
	verfuegbareVorlagen,
	VORLAGE_FORMAT,
	wendeAktionAn,
} from '@schoolbox/kern';
import { Router } from 'express';

import { leseQuelle, schreibeQuelle } from './dokumente';
import { HttpFehler } from './fehler';
import type { Kontext } from './kontext';
import { dokSchluessel } from './kontext';
import { MAX_SAMMLUNG, pdfAntwort, sendeSammlung, waehleMappenVariante, waehleProfil } from './pdf';

const MAX_VORSCHAUEN = 200;

const text = (wert: unknown) => (typeof wert === 'string' ? wert : undefined);

/** Titel aller Dokumente, auch der gelöschten: Beim Zurücklegen zählen sie mit. */
const leseTitel = async (materialDir: string) => {
	const { mappen } = await sammleMappen(materialDir, { mitGeloeschten: true });
	const titel = new Map<string, string>();
	for (const { dokumente, mappe } of mappen) {
		for (const { id, meta } of dokumente) {
			titel.set(dokKnotenSchluessel(mappe.id, id), meta.titel);
		}
	}
	return titel;
};

const umgebung = async (materialDir: string, jetzt = new Date()): Promise<Umgebung> => {
	const titel = await leseTitel(materialDir);
	return { jetzt, titel: (mappe, dok) => titel.get(dokKnotenSchluessel(mappe, dok)) };
};

/** Material umbenennen heißt `<title>` und `meta.titel`, mit Version. Ordner aus einer Mappe nehmen ihren Titel mit. */
export const wendeEffekteAn = async (kontext: Kontext, effekte: readonly Effekt[], jetzt = new Date()) => {
	const { materialDir } = kontext.konfig;
	for (const e of effekte) {
		if (e.art === 'mappe-titel') {
			await aktualisiereMappe(materialDir, e.mappe, jetzt, (m) => {
				m.titel = e.titel;
			});
		} else {
			await kontext.sperre(dokSchluessel(e.mappe, e.dok), async () => {
				const quelle = await leseQuelle(dokumentDir(materialDir, e.mappe, e.dok));
				await schreibeQuelle(kontext, e.mappe, e.dok, setzeTitel(quelle, e.titel), { zusammenfassen: false });
			});
		}
	}
};

/** Liegt das Objekt noch im Lebenden? Sonst wird es beim Einfügen übersprungen und gemeldet. */
const lebt = (baum: Baum, k: AblageKnoten) =>
	'ordner' in k
		? lebenderOrdner(baum, k.ordner) !== null
		: baum.dokumente[dokKnotenSchluessel(k.mappe, k.dok)] !== undefined && !dokumentGeloescht(baum, k.mappe, k.dok);

/** Die Freigaben, die gerade gelten, als Ordner-IDs und Dokument-Schlüssel. Alte Mappen-Links zählen für ihren Ordner. */
export const aktiveFreigaben = (baum: Baum, freigaben: readonly Freigabe[]) => {
	const ordner = new Set<string>();
	const dokumente = new Set<string>();
	for (const { widerrufen, ziel } of freigaben) {
		if (widerrufen !== null) {
			continue;
		}
		if ('ordner' in ziel) {
			ordner.add(ziel.ordner);
		} else if (ziel.dok === null) {
			const eintrag = ordnerMitBehaelter(baum, ziel.mappe);
			if (eintrag) {
				ordner.add(eintrag.id);
			}
		} else {
			dokumente.add(dokKnotenSchluessel(ziel.mappe, ziel.dok));
		}
	}
	return { ordner: [...ordner], dokumente: [...dokumente] };
};

/** Name des Ordners, durch den ein Ziel öffentlich ist: er selbst oder einer darüber. */
const geteilterOrdner = (baum: Baum, ziel: string | null, geteilt: readonly string[]) => {
	const stelle = ordnerPfad(baum, ziel)
		.reverse()
		.find((o) => geteilt.includes(o.id));
	return stelle?.name ?? null;
};

const zielDerAktion = (aktion: Aktion) => {
	if (aktion.art === 'bewegen' || aktion.art === 'kopieren') {
		return aktion.ziel;
	}
	return null;
};

const pruefeTitel = (titel: unknown) => {
	const name = typeof titel === 'string' ? titel.trim() : '';
	if (name === '') {
		throw new HttpFehler(400, 'Bitte gib einen Titel ein.');
	}
	if (name.length > MAX_NAME) {
		throw new HttpFehler(400, `Der Titel ist zu lang (höchstens ${MAX_NAME} Zeichen).`);
	}
	return name;
};

const gleich = (a: string, b: string) => a.trim().toLocaleLowerCase('de') === b.toLocaleLowerCase('de');

/** Die Ablage als Ordner (unter `/api/ordner`). Alle Änderungen laufen durch `aktion`, jede liefert ihre Umkehr. */
export const ordnerApi = (kontext: Kontext) => {
	const { materialDir } = kontext.konfig;
	const router = Router();

	router.get('/', async (_req, res) => {
		const baum = await kontext.ordner.abgleichen();
		const { defekt, mappen } = await sammleMappen(materialDir, { mitGeloeschten: true });
		const dokumente = await Promise.all(
			mappen.flatMap(({ dokumente: doks, mappe }) =>
				doks
					.filter(({ id }) => {
						const platz = baum.dokumente[dokKnotenSchluessel(mappe.id, id)];
						return platz !== undefined && !dokumentGeloescht(baum, mappe.id, id);
					})
					.map(async ({ id, meta }: { id: string; meta: DokumentMeta }) => ({
						mappe: mappe.id,
						id,
						meta,
						fach: mappe.fach,
						klasse: mappe.klasse,
						ordner: baum.dokumente[dokKnotenSchluessel(mappe.id, id)]?.ordner ?? null,
						vorschau: await kontext.vorschau.stand(mappe.id, id, false),
					})),
			),
		);
		const hinweis = kontext.ordner.hinweis();
		res.json({
			rev: baum.rev,
			ordner: baum.ordner.filter((o) => !ordnerGeloescht(baum, o.id)),
			dokumente,
			defekt,
			geteilt: aktiveFreigaben(baum, await leseFreigaben(materialDir)),
			...(hinweis ? { hinweis } : {}),
		});
	});

	router.post('/aktion', async (req, res) => {
		const aktion = leseAktion(req.body);
		const antwort = await kontext.ordner.aendere(async (baum) => {
			const u = await umgebung(materialDir);
			let uebersprungen = 0;
			const nurLebende = (knoten: AblageKnoten[]) => {
				const lebende = knoten.filter((k) => lebt(baum, k));
				uebersprungen = knoten.length - lebende.length;
				if (lebende.length === 0) {
					throw new HttpFehler(409, 'Das liegt inzwischen im Papierkorb oder ist nicht mehr da.');
				}
				return lebende;
			};
			const r =
				aktion.art === 'kopieren'
					? await kopiereKnoten(
							materialDir,
							baum,
							{ knoten: nurLebende(aktion.knoten), ziel: aktion.ziel },
							u,
						)
					: wendeAktionAn(
							baum,
							aktion.art === 'bewegen' ? { ...aktion, knoten: nurLebende(aktion.knoten) } : aktion,
							u,
						);
			await wendeEffekteAn(kontext, r.effekte, u.jetzt);
			const { ordner: geteilt } = aktiveFreigaben(r.baum, await leseFreigaben(materialDir));
			return {
				baum: r.baum,
				loescht: r.loescht,
				ergebnis: {
					rev: r.baum.rev,
					umkehr: r.umkehr,
					ergebnis: {
						knoten: r.knoten,
						umbenannt: r.umbenannt,
						uebersprungen,
						geteilt: geteilterOrdner(r.baum, zielDerAktion(aktion), geteilt),
						...(r.neu === undefined ? {} : { neu: r.neu }),
					},
				},
			};
		});
		res.json(antwort);
	});

	router.post('/vorschauen', async (req, res) => {
		const { dokumente } = (req.body ?? {}) as { dokumente?: unknown };
		if (!Array.isArray(dokumente) || dokumente.length > MAX_VORSCHAUEN) {
			throw new HttpFehler(400, `Bitte höchstens ${MAX_VORSCHAUEN} Dokumente auf einmal.`);
		}
		const baum = kontext.ordner.baum();
		const staende: Record<string, string | null> = {};
		for (const roh of dokumente as unknown[]) {
			const { dok, mappe } = (roh ?? {}) as { dok?: unknown; mappe?: unknown };
			if (typeof mappe === 'string' && typeof dok === 'string' && !dokumentGeloescht(baum, mappe, dok)) {
				const schluessel = dokKnotenSchluessel(mappe, dok);
				try {
					staende[schluessel] = await kontext.vorschau.stand(mappe, dok, true);
				} catch {
					// Ungültige ID: dokumentDir wirft. Das Objekt bekommt einfach keine Vorschau.
				}
			}
		}
		res.json({ staende });
	});

	router.post('/material', async (req, res) => {
		const b = (req.body ?? {}) as Record<string, unknown>;
		const name = pruefeTitel(b.titel);
		const ordnerId = b.ordner === null || b.ordner === undefined ? null : text(b.ordner);
		if (ordnerId === undefined) {
			throw new HttpFehler(400, 'Der Ordner ist ungültig.');
		}
		const { art, format, vorlage, zusatz } = b;
		if (!ARTEN.includes(art as Art)) {
			throw new HttpFehler(400, 'Bitte wähle aus, was du anlegen möchtest.');
		}
		const fest = typeof vorlage === 'string' ? VORLAGE_FORMAT[vorlage]?.format : undefined;
		if (fest !== format && !ART_FORMATE[art as Art].includes(format as Format)) {
			throw new HttpFehler(400, 'Dieses Format passt nicht zu dieser Art.');
		}
		if (vorlage !== undefined && (typeof vorlage !== 'string' || !verfuegbareVorlagen().includes(vorlage))) {
			throw new HttpFehler(400, 'Diese Vorlage gibt es nicht.');
		}
		const w = (zusatz ?? {}) as Record<string, unknown>;
		const angaben = {
			titel: name,
			art: art as Art,
			format: format as Format,
			druckprofil: 'farbe' as const,
			...(typeof vorlage === 'string' ? { vorlage } : {}),
			druckhinweise: [],
			urheber: 'lehrkraft' as const,
			zusatz: {
				selbsteinschaetzung: w.selbsteinschaetzung === true,
				niveaus: w.niveaus === true,
				sternchen: w.sternchen === true,
			},
		};
		const antwort = await kontext.ordner.aendere(async (baum) => {
			const ziel = ordnerId === null ? null : lebenderOrdner(baum, ordnerId);
			if (ordnerId !== null && !ziel) {
				throw new HttpFehler(404, 'Diesen Ordner gibt es nicht mehr.');
			}
			const u = await umgebung(materialDir);
			if (namenIn(baum, ordnerId, u).some((n) => gleich(n, name))) {
				throw new HttpFehler(409, `In diesem Ordner gibt es „${name}“ schon. Wähle bitte einen anderen Titel.`);
			}
			const behaelter =
				ziel?.behaelter && existsSync(path.join(mappenDir(materialDir, ziel.behaelter), 'mappe.json'))
					? ziel.behaelter
					: null;
			let mappe = behaelter;
			if (mappe === null) {
				if (!FAECHER.includes(b.fach as Fach) || !KLASSEN.includes(b.klasse as Klasse)) {
					throw new HttpFehler(400, 'Bitte wähle Fach und Klasse aus.');
				}
				mappe = (
					await neueMappe(materialDir, { titel: name, fach: b.fach as Fach, klasse: b.klasse as Klasse })
				).mappe.id;
			}
			const { id } = await neuesDokument(materialDir, mappe, angaben);
			const neu = structuredClone(baum);
			neu.rev += 1;
			neu.dokumente[dokKnotenSchluessel(mappe, id)] = { ordner: ordnerId, geloescht: null };
			return { baum: neu, ergebnis: { mappe, id, knoten: { mappe, dok: id } } };
		});
		res.status(201).json(antwort);
	});

	router.post('/pdf', async (req, res) => {
		const b = (req.body ?? {}) as Record<string, unknown>;
		const variante = waehleMappenVariante(b.variante);
		const profil = waehleProfil(b.profil);
		const roh = Array.isArray(b.teile) ? (b.teile as unknown[]) : [];
		const name = text(b.name)?.trim() || 'Material';
		if (roh.length > MAX_SAMMLUNG) {
			throw new HttpFehler(400, `Das sind ${roh.length} Dokumente. Bitte höchstens ${MAX_SAMMLUNG} auf einmal.`);
		}
		if (roh.length === 0) {
			throw new HttpFehler(404, 'Hier gibt es noch kein Material.');
		}
		const baum = await kontext.ordner.abgleichen();
		const teile = roh.map((t) => {
			const { dok, mappe } = (t ?? {}) as { dok?: unknown; mappe?: unknown };
			const gibtEs =
				typeof mappe === 'string' &&
				typeof dok === 'string' &&
				dokKnotenSchluessel(mappe, dok) in baum.dokumente &&
				!dokumentGeloescht(baum, mappe, dok);
			if (!gibtEs) {
				throw new HttpFehler(404, 'Dieses Material gibt es nicht mehr.');
			}
			return { mappe, dok };
		});
		const pdf = await kontext.pdf.sammlung(teile, variante, profil, name);
		res.json(pdfAntwort(`/api/ordner/pdf/${pdf.schluessel}`, pdf));
	});

	router.get('/pdf/:schluessel{/:datei}', async (req, res) => {
		await sendeSammlung(req, res, kontext.pdf.sammlungsDatei(req.params.schluessel));
	});

	return router;
};

/** Hilfsfunktion für die Freigaben-Verwaltung: Einen Ordner kann nur teilen, wer noch lebt. */
export const verlangeLebendenOrdner = (kontext: Kontext, ordner: string) => {
	if (!lebenderOrdner(kontext.ordner.baum(), ordner)) {
		throw new HttpFehler(404, 'Diesen Ordner gibt es nicht mehr.');
	}
};

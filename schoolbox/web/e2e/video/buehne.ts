/**
 * Regie für die Aufnahme: Playwright zeichnet keinen Mauszeiger, also bekommt jede Seite einen eigenen (Pfeil mit
 * Klick-Kreis, auf dem iPad ein Fingerpunkt). Alle Bewegungen laufen langsam und mit Pausen, damit man ohne Ton folgen
 * kann. Nebenbei merkt sich eine Szene, was später geschnitten wird: welche Seite gerade „im Bild“ ist, wo Wartezeit
 * herausfällt oder schneller läuft und wann welcher Einblendtext steht. Alles in Wanduhrzeit; `schnitt.ts` rechnet sie
 * in Videozeit um.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { Browser, BrowserContext, CDPSession, Locator, Page } from '@playwright/test';

export const AUFNAHME_DIR = path.join(tmpdir(), 'schoolbox-video-aufnahme');
export const BASIS = 'http://schoolbox.example';

export type Geraet = 'mac' | 'ipad';

export const GROESSE: Record<Geraet, { width: number; height: number }> = {
	mac: { width: 1920, height: 1080 },
	ipad: { width: 1180, height: 820 },
};

const IPAD_UA =
	'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

export interface Abschnitt {
	quelle: string;
	von: number;
	bis: number;
	tempo: number;
}

export interface Einblendung {
	art: 'text' | 'banner';
	text: string;
	von: number;
	bis: number;
}

export interface Drehplan {
	name: string;
	geraet: Geraet;
	quellen: Record<string, { datei: string; t0: number }>;
	abschnitte: Abschnitt[];
	einblendungen: Einblendung[];
}

interface Punkt {
	x: number;
	y: number;
}

interface BuehnenApi {
	zeiger: (x: number, y: number, ms: number) => void;
	klick: (x: number, y: number) => void;
	finger: (x: number, y: number, zustand: 'ab' | 'zieh' | 'auf') => void;
	versteck: (aus: boolean) => void;
}

declare global {
	interface Window {
		__buehne?: BuehnenApi;
	}
}

/**
 * Läuft in jeder Seite (nur im obersten Frame). Der Zeiger liegt in einem Popover, damit er über Dialogen und dem
 * Vollbild der Präsentation bleibt: Beide kommen in die oberste Ebene des Browsers, und ein Popover, das danach neu
 * gezeigt wird, liegt darüber.
 */
const buehnenSkript = (geraet: 'mac' | 'ipad') => {
	if (window.top !== window) {
		return;
	}
	const POS = '__buehne_pos';
	const PFEIL =
		'<svg width="30" height="40" viewBox="0 0 30 40"><path d="M2 2 L2 31 L9.5 24 L14.5 36 L19.5 34 L14.5 22.5 L25 22.5 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg>';
	const CSS = `
		:host { all: initial; }
		.zeiger { position: fixed; left: 0; top: 0; width: 30px; height: 40px; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); will-change: transform; }
		.zeiger.aus { display: none; }
		.kreis { position: fixed; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%;
			border: 4px solid rgba(46,111,183,.85); background: rgba(46,111,183,.18); animation: kreis .55s ease-out forwards; }
		@keyframes kreis { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.35); opacity: 0; } }
		.finger { position: fixed; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%;
			background: rgba(255,255,255,.55); border: 3px solid rgba(30,40,60,.45); box-shadow: 0 3px 10px rgba(0,0,0,.3);
			opacity: 0; transform: scale(.6); transition: opacity .15s, transform .15s; }
		.finger.ab { opacity: 1; transform: scale(1); }
	`;
	let x = 960;
	let y = 640;
	try {
		const gemerkt = JSON.parse(sessionStorage.getItem(POS) ?? 'null') as { x: number; y: number } | null;
		if (gemerkt) {
			({ x, y } = gemerkt);
		}
	} catch {
		// ohne gemerkte Stelle beginnt der Zeiger in der Mitte
	}
	const host = document.createElement('div');
	host.setAttribute('popover', 'manual');
	host.setAttribute('aria-hidden', 'true');
	host.style.cssText =
		'position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:visible;pointer-events:none;z-index:2147483647';
	const wurzel = host.attachShadow({ mode: 'closed' });
	wurzel.innerHTML = `<style>${CSS}</style><div class="zeiger${geraet === 'ipad' ? ' aus' : ''}">${PFEIL}</div><div class="finger"></div>`;
	const zeiger = wurzel.querySelector<HTMLElement>('.zeiger');
	const finger = wurzel.querySelector<HTMLElement>('.finger');
	const setze = () => {
		if (zeiger) {
			zeiger.style.transform = `translate(${x - 2}px, ${y - 2}px)`;
		}
		sessionStorage.setItem(POS, JSON.stringify({ x, y }));
	};
	const hebe = () => {
		if (!host.isConnected) {
			document.body.append(host);
		}
		try {
			if (host.matches(':popover-open')) {
				host.hidePopover();
			}
			host.showPopover();
		} catch {
			// Popover gibt es nicht: dann liegt er nur per z-index oben
		}
	};
	let animation = 0;
	const api: BuehnenApi = {
		zeiger: (zx, zy, ms) => {
			cancelAnimationFrame(animation);
			const [x0, y0, start] = [x, y, performance.now()];
			const schritt = (jetzt: number) => {
				const t = ms <= 0 ? 1 : Math.min(1, (jetzt - start) / ms);
				const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
				x = x0 + (zx - x0) * e;
				y = y0 + (zy - y0) * e;
				setze();
				if (t < 1) {
					animation = requestAnimationFrame(schritt);
				}
			};
			animation = requestAnimationFrame(schritt);
		},
		klick: (kx, ky) => {
			const kreis = document.createElement('div');
			kreis.className = 'kreis';
			kreis.style.left = `${kx}px`;
			kreis.style.top = `${ky}px`;
			wurzel.append(kreis);
			setTimeout(() => kreis.remove(), 700);
		},
		finger: (fx, fy, zustand) => {
			if (!finger) {
				return;
			}
			finger.style.left = `${fx}px`;
			finger.style.top = `${fy}px`;
			finger.classList.toggle('ab', zustand !== 'auf');
		},
		versteck: (aus) => {
			host.style.visibility = aus ? 'hidden' : 'visible';
		},
	};
	window.__buehne = api;
	const beginne = () => {
		setze();
		hebe();
		new MutationObserver((eintraege) => {
			if (eintraege.some((e) => e.target !== host)) {
				hebe();
			}
		}).observe(document.documentElement, { attributes: true, attributeFilter: ['open'], subtree: true });
		document.addEventListener('fullscreenchange', () => setTimeout(hebe, 50));
		document.addEventListener('toggle', (e) => e.target !== host && setTimeout(hebe, 0), true);
	};
	if (document.body) {
		beginne();
	} else {
		document.addEventListener('DOMContentLoaded', beginne);
	}
};

export const warte = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Wie lange ein Ziel auf sich warten lassen darf, bevor die Szene scheitert (statt bis zum Test-Timeout). */
const SUCHE_MS = 20_000;

const sanft = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Wie lange eine Bewegung dauert: kurze Wege schnell, lange ruhig. */
const dauerFuer = (von: Punkt, nach: Punkt) =>
	Math.min(850, Math.max(300, 220 + Math.hypot(nach.x - von.x, nach.y - von.y) * 0.42));

type Ziel = Locator | Punkt;

interface KlickOptionen {
	/** Pause danach in ms, damit man sieht, was der Klick bewirkt hat. */
	pause?: number;
	/** Stelle im Element, als Bruchteil von Breite und Höhe (Standard Mitte). */
	bei?: Punkt;
	tasten?: ('Shift' | 'Meta' | 'Control')[];
}

export interface Szene {
	name: string;
	geraet: Geraet;
	kontext: BrowserContext;
	seite: Page;
	/** Neue Seite, auch in einem anderen Kontext der Szene. Wird auch aufgenommen. */
	neueSeite: (kontext?: BrowserContext) => Promise<Page>;
	/** Zweites Fenster ohne Anmeldung, z. B. für einen geteilten Link. */
	zweiterKontext: () => Promise<BrowserContext>;
	/** Seite, die ein Klick auf einen Link mit `target` öffnet; danach ist sie im Bild. */
	folge: (ausloeser: () => Promise<void>) => Promise<Page>;
	/** Diese Seite ab jetzt im Bild. */
	zeige: (seite: Page) => void;
	/** Ab jetzt nichts aufnehmen (Wartezeit), bis `an()`. */
	aus: () => void;
	an: () => void;
	/** Ab jetzt so viel schneller (Zeitraffer), `tempo(1)` beendet ihn. */
	tempo: (faktor: number) => void;
	text: (text: string) => void;
	textAus: () => void;
	banner: (text: string) => void;
	bannerAus: () => void;
	pause: (ms?: number) => Promise<void>;
	gehe: (ziel: Ziel, bei?: Punkt) => Promise<Punkt>;
	klicke: (ziel: Ziel, optionen?: KlickOptionen) => Promise<void>;
	doppelklicke: (ziel: Ziel, optionen?: KlickOptionen) => Promise<void>;
	ziehe: (von: Ziel, nach: Ziel, optionen?: { pause?: number; dauer?: number }) => Promise<void>;
	tippe: (text: string, optionen?: { verzoegerung?: number; pause?: number }) => Promise<void>;
	/** Wert in einer Auswahlliste setzen; die native Liste klappt in der Aufnahme nicht sichtbar auf. */
	waehle: (liste: Locator, wert: string, pause?: number) => Promise<void>;
	taste: (taste: string, pause?: number) => Promise<void>;
	scrolle: (dy: number, bei?: Ziel) => Promise<void>;
	/** Scrollt sanft, bis das Element ganz zu sehen ist. */
	inSicht: (ziel: Locator) => Promise<void>;
	tippeFinger: (ziel: Ziel, optionen?: { pause?: number; bei?: Punkt }) => Promise<void>;
	wische: (von: Ziel, nach: Ziel, optionen?: { pause?: number; dauer?: number }) => Promise<void>;
	/** Mit dem Finger halten und ziehen (Bausteine im Editor). */
	zieheFinger: (von: Ziel, nach: Ziel, optionen?: { pause?: number; dauer?: number }) => Promise<void>;
	ende: () => Promise<Drehplan>;
}

interface SzenenOptionen {
	geraet?: Geraet;
	storageState?: string;
}

const GEMEINSAM = { baseURL: BASIS, locale: 'de-DE', timezoneId: 'Europe/Berlin' };

export const kontextOptionen = (geraet: Geraet, dir: string) => ({
	...GEMEINSAM,
	viewport: GROESSE[geraet],
	deviceScaleFactor: geraet === 'ipad' ? 2 : 1,
	recordVideo: { dir, size: GROESSE[geraet] },
	permissions: ['clipboard-read', 'clipboard-write'],
	...(geraet === 'ipad' ? { isMobile: true, hasTouch: true, userAgent: IPAD_UA } : {}),
});

export const neueSzene = async (
	browser: Browser,
	name: string,
	szenenOptionen: SzenenOptionen = {},
): Promise<Szene> => {
	const { geraet = 'mac', storageState } = szenenOptionen;
	const dir = path.join(AUFNAHME_DIR, name);
	await rm(dir, { recursive: true, force: true });
	await mkdir(dir, { recursive: true });

	const plan: Drehplan = { name, geraet, quellen: {}, abschnitte: [], einblendungen: [] };
	const kennung = new Map<Page, string>();
	const position = new Map<Page, Punkt>();
	const touch = new Map<Page, CDPSession>();
	const offen: Partial<Record<Einblendung['art'], Omit<Einblendung, 'bis'>>> = {};
	let aktiv: { quelle: string; von: number; tempo: number } | null = null;
	let bildQuelle = '';
	let bildTempo = 1;
	let laeuft = true;

	const merkeSeite = (page: Page) => {
		const id = `s${kennung.size}`;
		kennung.set(page, id);
		position.set(page, { x: GROESSE[geraet].width / 2, y: GROESSE[geraet].height * 0.6 });
		plan.quellen[id] = { datei: '', t0: Date.now() };
		return id;
	};

	const schliesse = (jetzt: number) => {
		if (aktiv && jetzt > aktiv.von) {
			plan.abschnitte.push({ ...aktiv, bis: jetzt });
		}
		aktiv = null;
	};

	const oeffne = (jetzt: number) => {
		schliesse(jetzt);
		if (laeuft && bildQuelle) {
			aktiv = { quelle: bildQuelle, von: jetzt, tempo: bildTempo };
		}
	};

	const kontextAnlegen = async (zustand?: string) => {
		const k = await browser.newContext({
			...kontextOptionen(geraet, dir),
			...(zustand ? { storageState: zustand } : {}),
		});
		await k.addInitScript(buehnenSkript, geraet);
		k.on('page', (p) => {
			if (!kennung.has(p)) {
				merkeSeite(p);
			}
		});
		return k;
	};

	const kontext = await kontextAnlegen(storageState);
	const seite = await kontext.newPage();
	bildQuelle = kennung.get(seite) ?? '';
	oeffne(Date.now());

	const seiteIm = () => [...kennung.entries()].find(([, id]) => id === bildQuelle)?.[0] ?? seite;

	const punktVon = async (ziel: Ziel, bei: Punkt = { x: 0.5, y: 0.5 }): Promise<Punkt> => {
		if (!('boundingBox' in ziel)) {
			return ziel;
		}
		await ziel.waitFor({ state: 'visible', timeout: SUCHE_MS });
		const box = await ziel.boundingBox({ timeout: SUCHE_MS });
		if (!box) {
			throw new Error(`Kein Ort für ${ziel.toString()}`);
		}
		return { x: Math.round(box.x + box.width * bei.x), y: Math.round(box.y + box.height * bei.y) };
	};

	const bewege = async (page: Page, nach: Punkt, ms?: number) => {
		const von = position.get(page) ?? nach;
		const dauer = ms ?? dauerFuer(von, nach);
		await page.evaluate(([x, y, d]) => window.__buehne?.zeiger(x, y, d), [nach.x, nach.y, dauer] as const);
		const schritte = Math.max(6, Math.round(dauer / 40));
		const start = Date.now();
		for (let i = 1; i <= schritte; i++) {
			const t = i / schritte;
			const e = sanft(t);
			await page.mouse.move(von.x + (nach.x - von.x) * e, von.y + (nach.y - von.y) * e);
			const rest = start + dauer * t - Date.now();
			if (rest > 0) {
				await warte(rest);
			}
		}
		position.set(page, nach);
	};

	const cdp = async (page: Page) => {
		const da = touch.get(page);
		if (da) {
			return da;
		}
		const neu = await page.context().newCDPSession(page);
		touch.set(page, neu);
		return neu;
	};

	const finger = (page: Page, p: Punkt, zustand: 'ab' | 'zieh' | 'auf') =>
		page.evaluate(([x, y, z]) => window.__buehne?.finger(x, y, z), [p.x, p.y, zustand] as const);

	const fingerWeg = async (a: Punkt, b: Punkt, dauer: number, halten: number) => {
		const page = seiteIm();
		const session = await cdp(page);
		await finger(page, a, 'ab');
		await warte(200);
		await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
		await warte(halten);
		const schritte = Math.max(8, Math.round(dauer / 25));
		const start = Date.now();
		for (let i = 1; i <= schritte; i++) {
			const t = i / schritte;
			const e = halten > 0 ? sanft(t) : t;
			const q = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
			await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [q] });
			await finger(page, q, 'zieh');
			const rest = start + dauer * t - Date.now();
			if (rest > 0) {
				await warte(rest);
			}
		}
		await warte(halten > 0 ? 250 : 0);
		await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await finger(page, b, 'auf');
		position.set(page, b);
	};

	const einblendung = (art: Einblendung['art'], text: string | null) => {
		const jetzt = Date.now();
		const alt = offen[art];
		if (alt) {
			plan.einblendungen.push({ ...alt, bis: jetzt });
		}
		offen[art] = text === null ? undefined : { art, text, von: jetzt };
	};

	const szene: Szene = {
		name,
		geraet,
		kontext,
		seite,
		neueSeite: async (k = kontext) => {
			const p = await k.newPage();
			if (!kennung.has(p)) {
				merkeSeite(p);
			}
			return p;
		},
		zweiterKontext: () => kontextAnlegen(),
		folge: async (ausloeser) => {
			const [neu] = await Promise.all([seiteIm().context().waitForEvent('page'), ausloeser()]);
			await neu.waitForLoadState();
			szene.zeige(neu);
			return neu;
		},
		zeige: (page) => {
			if (!kennung.has(page)) {
				merkeSeite(page);
			}
			bildQuelle = kennung.get(page) ?? '';
			oeffne(Date.now());
			const p = position.get(page);
			if (p) {
				page.evaluate(([x, y]) => window.__buehne?.zeiger(x, y, 0), [p.x, p.y] as const).catch(() => undefined);
			}
		},
		aus: () => {
			laeuft = false;
			schliesse(Date.now());
		},
		an: () => {
			laeuft = true;
			oeffne(Date.now());
		},
		tempo: (faktor) => {
			bildTempo = faktor;
			oeffne(Date.now());
		},
		text: (text) => einblendung('text', text),
		textAus: () => einblendung('text', null),
		banner: (text) => einblendung('banner', text),
		bannerAus: () => einblendung('banner', null),
		pause: (ms = 900) => warte(ms),
		gehe: async (ziel, bei) => {
			const page = seiteIm();
			const p = await punktVon(ziel, bei);
			await bewege(page, p);
			return p;
		},
		klicke: async (ziel, optionen = {}) => {
			const { bei, pause = 800, tasten = [] } = optionen;
			const page = seiteIm();
			if ('boundingBox' in ziel) {
				await szene.inSicht(ziel);
			}
			const p = await punktVon(ziel, bei);
			await bewege(page, p);
			await warte(120);
			for (const t of tasten) {
				await page.keyboard.down(t);
			}
			await page.evaluate(([x, y]) => window.__buehne?.klick(x, y), [p.x, p.y] as const);
			await page.mouse.down();
			await warte(70);
			await page.mouse.up();
			for (const t of tasten) {
				await page.keyboard.up(t);
			}
			await warte(pause);
		},
		doppelklicke: async (ziel, optionen = {}) => {
			const { bei, pause = 800 } = optionen;
			const page = seiteIm();
			const p = await punktVon(ziel, bei);
			await bewege(page, p);
			await warte(120);
			await page.evaluate(([x, y]) => window.__buehne?.klick(x, y), [p.x, p.y] as const);
			await page.mouse.dblclick(p.x, p.y);
			await warte(pause);
		},
		ziehe: async (von, nach, optionen = {}) => {
			const { dauer = 1100, pause = 800 } = optionen;
			const page = seiteIm();
			const a = await punktVon(von);
			await bewege(page, a);
			await warte(200);
			await page.evaluate(([x, y]) => window.__buehne?.klick(x, y), [a.x, a.y] as const);
			await page.mouse.down();
			await warte(250);
			const b = await punktVon(nach);
			await bewege(page, b, dauer);
			await warte(250);
			await page.mouse.up();
			await warte(pause);
		},
		tippe: async (text, optionen = {}) => {
			const { pause = 700, verzoegerung = 75 } = optionen;
			await seiteIm().keyboard.type(text, { delay: verzoegerung });
			await warte(pause);
		},
		waehle: async (liste, wert, pause = 900) => {
			const page = seiteIm();
			const p = await punktVon(liste);
			await bewege(page, p);
			await warte(150);
			await page.evaluate(([x, y]) => window.__buehne?.klick(x, y), [p.x, p.y] as const);
			await liste.selectOption(wert);
			await warte(pause);
		},
		taste: async (taste, pause = 700) => {
			await seiteIm().keyboard.press(taste);
			await warte(pause);
		},
		scrolle: async (dy, bei) => {
			const page = seiteIm();
			if (bei) {
				await bewege(page, await punktVon(bei));
			}
			const schritte = Math.max(4, Math.round(Math.abs(dy) / 60));
			for (let i = 0; i < schritte; i++) {
				await page.mouse.wheel(0, dy / schritte);
				await warte(22);
			}
			await warte(400);
		},
		inSicht: async (ziel) => {
			const page = seiteIm();
			const { height, width } = GROESSE[geraet];
			await ziel.waitFor({ state: 'visible', timeout: SUCHE_MS });
			for (let i = 0; i < 12; i++) {
				const box = await ziel.boundingBox({ timeout: SUCHE_MS });
				if (!box) {
					return;
				}
				const oben = 90 - box.y;
				const unten = box.y + box.height - (height - 150);
				if (oben <= 0 && unten <= 0) {
					return;
				}
				const dy = oben > 0 ? -oben - 40 : Math.min(unten + 40, box.y - 100);
				const x = Math.min(width - 20, Math.max(20, box.x + box.width / 2));
				await szene.scrolle(dy, { x, y: height / 2 });
				const nachher = (await ziel.boundingBox())?.y ?? box.y;
				if (Math.abs(nachher - box.y) < 2) {
					await ziel.scrollIntoViewIfNeeded();
					await page.waitForTimeout(300);
					return;
				}
			}
		},
		tippeFinger: async (ziel, optionen = {}) => {
			const { bei, pause = 800 } = optionen;
			const page = seiteIm();
			const p = await punktVon(ziel, bei);
			await finger(page, p, 'ab');
			await warte(180);
			await page.touchscreen.tap(p.x, p.y);
			await warte(220);
			await finger(page, p, 'auf');
			position.set(page, p);
			await warte(pause);
		},
		wische: async (von, nach, optionen = {}) => {
			const { dauer = 450, pause = 900 } = optionen;
			await fingerWeg(await punktVon(von), await punktVon(nach), dauer, 0);
			await warte(pause);
		},
		zieheFinger: async (von, nach, optionen = {}) => {
			const { dauer = 1200, pause = 900 } = optionen;
			const a = await punktVon(von);
			await fingerWeg(a, await punktVon(nach), dauer, 650);
			await warte(pause);
		},
		ende: async () => {
			const jetzt = Date.now();
			schliesse(jetzt);
			einblendung('text', null);
			einblendung('banner', null);
			const seiten = [...kennung.keys()];
			const kontexte = new Set(seiten.map((p) => p.context()));
			await Promise.all([...kontexte].map((k) => k.close()));
			for (const p of seiten) {
				const video = p.video();
				const id = kennung.get(p);
				const quelle = id ? plan.quellen[id] : undefined;
				if (video && quelle) {
					quelle.datei = await video.path();
				}
			}
			await writeFile(path.join(dir, 'plan.json'), `${JSON.stringify(plan, null, '\t')}\n`);
			return plan;
		},
	};
	return szene;
};

/** Ein Kontext ohne Aufnahme, z. B. um sich anzumelden oder etwas vorzubereiten. */
export const stillerKontext = (browser: Browser, geraet: Geraet = 'mac', storageState?: string) =>
	browser.newContext({
		...GEMEINSAM,
		viewport: GROESSE[geraet],
		deviceScaleFactor: geraet === 'ipad' ? 2 : 1,
		...(storageState ? { storageState } : {}),
		...(geraet === 'ipad' ? { isMobile: true, hasTouch: true, userAgent: IPAD_UA } : {}),
	});

/**
 * Schnitt: aus den Aufnahmen und Drehplänen der Szenen ein MP4 (H.264, 1920 × 1080, 30 fps). Einblendtexte, Titelkarten,
 * der iPad-Rahmen und der Abspann sind HTML, das Playwright als PNG fotografiert; ffmpeg legt sie über die Aufnahme.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { Browser } from '@playwright/test';
import { ASSETS } from '@schoolbox/kern';

import type { Drehplan } from './buehne';
import { AUFNAHME_DIR, GROESSE } from './buehne';

const ausfuehren = promisify(execFile);

const BREITE = 1920;
const HOEHE = 1080;
const FPS = 30;
const BLENDE = 0.4;
/**
 * Wo Untertitel und Banner im Bild liegen. Nur dieser Streifen wird überblendet, und nur solange er zu sehen ist; ein
 * ganzes Bild je Einblendung über die ganze Szene machte den Schnitt auf dem kleinen Server mehrfach langsamer.
 */
const STREIFEN = { text: { y: 860, hoehe: 220 }, banner: { y: 60, hoehe: 160 } } as const;
const SCHNITT_DIR = path.join(AUFNAHME_DIR, 'schnitt');

/** Wo der Bildschirm des iPads im Bild liegt. */
const IPAD = { x: (BREITE - GROESSE.ipad.width) / 2, y: 74 };

interface Vorspann {
	art: 'vorspann';
}
interface Karte {
	art: 'karte';
	nr: number;
	titel: string;
}
interface Szenenteil {
	art: 'szene';
	name: string;
}
interface Abspann {
	art: 'abspann';
}
export type Teil = Vorspann | Karte | Szenenteil | Abspann;

export interface Kapitelmarke {
	zeit: number;
	titel: string;
}

/** Mit `nice`: Der Server ist klein, und neben dem Schnitt laufen die echten Seiten weiter. */
const ffmpeg = async (args: string[]) => {
	try {
		await ausfuehren('nice', ['-n', '15', 'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', ...args], {
			maxBuffer: 64 * 1024 * 1024,
		});
	} catch (fehler) {
		const { stderr } = fehler as { stderr?: string };
		throw new Error(`ffmpeg: ${stderr ?? String(fehler)}`);
	}
};

export const dauerVon = async (datei: string) => {
	const { stdout } = await ausfuehren('ffprobe', [
		'-v',
		'error',
		'-show_entries',
		'format=duration',
		'-of',
		'default=nw=1:nk=1',
		datei,
	]);
	return Number(stdout.trim());
};

/** `VIDEO_PRESET=veryfast` für Probeschnitte. */
const X264 = [
	'-c:v',
	'libx264',
	'-preset',
	process.env.VIDEO_PRESET ?? 'medium',
	'-crf',
	'18',
	'-pix_fmt',
	'yuv420p',
	'-r',
	String(FPS),
];

const schrift = async (datei: string) => (await readFile(path.join(ASSETS, 'fonts', datei))).toString('base64');

const grundstil = async () => `
	@font-face { font-family: 'Fredoka'; font-weight: 600; src: url(data:font/woff2;base64,${await schrift('Fredoka-SemiBold.woff2')}) format('woff2'); }
	@font-face { font-family: 'Andika'; font-weight: 400; src: url(data:font/woff2;base64,${await schrift('Andika-Regular.woff2')}) format('woff2'); }
	@font-face { font-family: 'Andika'; font-weight: 700; src: url(data:font/woff2;base64,${await schrift('Andika-Bold.woff2')}) format('woff2'); }
	html, body { margin: 0; width: ${BREITE}px; height: ${HOEHE}px; overflow: hidden; }
	body { font-family: 'Andika', sans-serif; color: #1d2a3a; }
	.fredoka { font-family: 'Fredoka', sans-serif; font-weight: 600; }
`;

const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const fotografiere = async (browser: Browser, html: string, datei: string, transparent: boolean) => {
	const kontext = await browser.newContext({ viewport: { width: BREITE, height: HOEHE } });
	const seite = await kontext.newPage();
	await seite.setContent(
		`<!doctype html><html><head><meta charset="utf-8"><style>${await grundstil()}</style></head><body>${html}</body></html>`,
	);
	await seite.evaluate(() => document.fonts.ready);
	await seite.screenshot({ path: datei, omitBackground: transparent });
	await kontext.close();
};

const TITEL_HINTERGRUND = 'background: radial-gradient(circle at 30% 20%, #ffffff 0%, #eef4fb 55%, #dbe8f6 100%);';

const karteHtml = (nr: number, titel: string) => `
	<div style="${TITEL_HINTERGRUND} width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; padding-left:220px; box-sizing:border-box;">
		<div class="fredoka" style="font-size:44px; color:#2e6fb7; letter-spacing:.02em;">${nr}</div>
		<div class="fredoka" style="font-size:104px; color:#1d2a3a; line-height:1.1; margin-top:10px;">${escape(titel)}</div>
		<div style="width:140px; height:10px; border-radius:5px; background:#2e6fb7; margin-top:38px;"></div>
	</div>`;

const vorspannHtml = () => `
	<div style="${TITEL_HINTERGRUND} width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
		<div class="fredoka" style="font-size:150px; color:#24588f;">Schoolbox</div>
		<div class="fredoka" style="font-size:54px; color:#1d2a3a; margin-top:18px;">Vom Wunsch im Claude-Chat bis ins Klassenzimmer.</div>
		<div style="font-size:30px; color:#5a6b7d; margin-top:70px;">Alle Inhalte sind Testdaten. Der Claude-Chat ist nachgestellt.</div>
	</div>`;

export const ABSPANN = [
	'Die Schoolbox ist der Ort für alles, was Claude für deinen Unterricht erstellt.',
	'Ansehen, drucken, präsentieren, selbst ändern und teilen, am Mac und am iPad.',
	'Zum Anfangen: Claude-App öffnen, Umgebung „schoolbox“ wählen und schreiben, was du brauchst.',
];

const abspannHtml = () => `
	<div style="${TITEL_HINTERGRUND} width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; padding:0 240px; box-sizing:border-box; gap:46px;">
		<div class="fredoka" style="font-size:96px; color:#24588f;">Schoolbox</div>
		${ABSPANN.map((satz) => `<div class="fredoka" style="font-size:50px; line-height:1.3; color:#1d2a3a;">${escape(satz)}</div>`).join('')}
		<div style="font-size:28px; color:#5a6b7d; margin-top:20px;">Alle Inhalte sind Testdaten. Der Claude-Chat ist nachgestellt.</div>
	</div>`;

/** Links unten und schmal: Unten in der Mitte zeigt die Schoolbox ihre eigenen Meldungen. */
const textHtml = (text: string) => `
	<div style="position:absolute; left:40px; bottom:44px; max-width:640px;">
		<div class="fredoka" style="display:inline-block; font-size:36px; line-height:1.15; color:#fff; background:rgba(22,34,52,.88); padding:13px 30px 16px; border-radius:24px; box-shadow:0 8px 30px rgba(0,0,0,.25);">${escape(text)}</div>
	</div>`;

const bannerHtml = (text: string) => `
	<div style="position:absolute; left:0; right:0; top:96px; display:flex; justify-content:center;">
		<div class="fredoka" style="font-size:34px; color:#5a3d00; background:#ffe08a; border:3px solid #e0b030; padding:10px 34px 13px; border-radius:999px; box-shadow:0 6px 20px rgba(0,0,0,.18);">${escape(text)}</div>
	</div>`;

const rahmenHtml = () => {
	const { height, width } = GROESSE.ipad;
	const rand = 26;
	return `
	<div style="position:absolute; left:${IPAD.x - rand}px; top:${IPAD.y - rand}px; width:${width}px; height:${height}px;
		border:${rand}px solid #1c1c1e; border-radius:${rand + 22}px; box-shadow:0 0 0 3000px #e6edf5;">
		<div style="position:absolute; inset:-${rand}px; border-radius:${rand + 22}px; box-shadow:inset 0 0 0 2px #3a3a3c; pointer-events:none;"></div>
	</div>
	<div class="fredoka" style="position:absolute; left:${IPAD.x - rand}px; top:${IPAD.y + height + rand + 10}px; font-size:26px; color:#5a6b7d;">iPad</div>`;
};

/** Wanduhrzeit → Zeit im geschnittenen Video der Szene. Liegt sie in einer herausgeschnittenen Stelle: deren Ende. */
const ausgabeZeit = (plan: Drehplan, wand: number) => {
	let t = 0;
	for (const a of plan.abschnitte) {
		if (wand < a.von) {
			return t;
		}
		if (wand <= a.bis) {
			return t + (wand - a.von) / 1000 / a.tempo;
		}
		t += (a.bis - a.von) / 1000 / a.tempo;
	}
	return t;
};

const szenenDauer = (plan: Drehplan) => plan.abschnitte.reduce((s, a) => s + (a.bis - a.von) / 1000 / a.tempo, 0);

const schneideSzene = async (browser: Browser, plan: Drehplan, ziel: string) => {
	const dauer = szenenDauer(plan);
	const eingaben: string[] = [];
	const filter: string[] = [];
	plan.abschnitte.forEach((a, i) => {
		const quelle = plan.quellen[a.quelle];
		if (!quelle?.datei) {
			throw new Error(`${plan.name}: Aufnahme ${a.quelle} fehlt`);
		}
		const start = Math.max(0, (a.von - quelle.t0) / 1000);
		eingaben.push('-ss', start.toFixed(3), '-t', ((a.bis - a.von) / 1000).toFixed(3), '-i', quelle.datei);
		filter.push(`[${i}:v]setpts=(PTS-STARTPTS)/${a.tempo},fps=${FPS},format=yuv420p,setsar=1[a${i}]`);
	});
	const n = plan.abschnitte.length;
	filter.push(`${plan.abschnitte.map((_, i) => `[a${i}]`).join('')}concat=n=${n}:v=1:a=0[roh]`);
	let letzte = 'roh';
	let eingabe = n;
	const bild = async (name: string, html: string) => {
		const datei = path.join(SCHNITT_DIR, `${plan.name}-${name}.png`);
		await fotografiere(browser, html, datei, true);
		eingaben.push('-loop', '1', '-framerate', String(FPS), '-t', dauer.toFixed(3), '-i', datei);
		return eingabe++;
	};
	if (plan.geraet === 'ipad') {
		const rahmen = await bild('rahmen', rahmenHtml());
		filter.push(`color=c=#e6edf5:s=${BREITE}x${HOEHE}:r=${FPS}:d=${dauer.toFixed(3)}[grund]`);
		filter.push(`[grund][roh]overlay=${IPAD.x}:${IPAD.y}:shortest=1[mit]`);
		filter.push(`[mit][${rahmen}:v]overlay=0:0:shortest=1[ipad]`);
		letzte = 'ipad';
	}
	const einblendungen = plan.einblendungen
		.map((e) => ({ ...e, a: ausgabeZeit(plan, e.von), b: ausgabeZeit(plan, e.bis) }))
		.filter((e) => e.b - e.a > 0.5);
	for (const [i, e] of einblendungen.entries()) {
		const datei = path.join(SCHNITT_DIR, `${plan.name}-${e.art}${i}.png`);
		await fotografiere(browser, e.art === 'text' ? textHtml(e.text) : bannerHtml(e.text), datei, true);
		const laenge = e.b - e.a;
		eingaben.push('-loop', '1', '-framerate', String(FPS), '-t', laenge.toFixed(3), '-i', datei);
		const { hoehe, y } = STREIFEN[e.art];
		const aus = Math.max(BLENDE, laenge - 0.3);
		const blenden = `fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=${aus.toFixed(3)}:d=0.3:alpha=1`;
		const zeit = `setpts=PTS-STARTPTS+${e.a.toFixed(3)}/TB`;
		filter.push(`[${eingabe}:v]crop=${BREITE}:${hoehe}:0:${y},format=rgba,${blenden},${zeit}[e${i}]`);
		filter.push(`[${letzte}][e${i}]overlay=0:${y}:eof_action=pass[m${i}]`);
		eingabe++;
		letzte = `m${i}`;
	}
	filter.push(
		`[${letzte}]fade=t=in:st=0:d=${BLENDE},fade=t=out:st=${(dauer - BLENDE).toFixed(3)}:d=${BLENDE},format=yuv420p[aus]`,
	);
	await ffmpeg([
		...eingaben,
		'-filter_complex',
		filter.join(';'),
		'-map',
		'[aus]',
		'-t',
		dauer.toFixed(3),
		...X264,
		ziel,
	]);
};

const standbild = async (browser: Browser, html: string, name: string, dauer: number) => {
	const png = path.join(SCHNITT_DIR, `${name}.png`);
	const ziel = path.join(SCHNITT_DIR, `${name}.mp4`);
	await fotografiere(browser, html, png, false);
	await ffmpeg([
		'-loop',
		'1',
		'-framerate',
		String(FPS),
		'-t',
		String(dauer),
		'-i',
		png,
		'-vf',
		`fade=t=in:st=0:d=${BLENDE},fade=t=out:st=${dauer - BLENDE}:d=${BLENDE},format=yuv420p`,
		...X264,
		ziel,
	]);
	return ziel;
};

/** Aufgenommen wird in Echtzeit; das Video läuft etwas schneller. `VIDEO_TEMPO` zum Ausprobieren ohne neue Aufnahme. */
const GRUNDTEMPO = Number(process.env.VIDEO_TEMPO ?? 1.2);

const ladePlan = async (name: string) => {
	const plan = JSON.parse(await readFile(path.join(AUFNAHME_DIR, name, 'plan.json'), 'utf8')) as Drehplan;
	return { ...plan, abschnitte: plan.abschnitte.map((a) => ({ ...a, tempo: a.tempo * GRUNDTEMPO })) };
};

const titelVon = (teil: Teil) => {
	if (teil.art === 'karte') {
		return `${teil.nr} · ${teil.titel}`;
	}
	return teil.art === 'vorspann' ? 'Vorspann' : 'Abspann';
};

/** Schneidet alles zusammen; gibt die Kapitelmarken (Sekunden ab Anfang) zurück. */
export const schneide = async (browser: Browser, folge: Teil[], ziel: string): Promise<Kapitelmarke[]> => {
	await rm(SCHNITT_DIR, { recursive: true, force: true });
	await mkdir(SCHNITT_DIR, { recursive: true });
	const teile: string[] = [];
	const marken: Kapitelmarke[] = [];
	let zeit = 0;
	for (const [i, teil] of folge.entries()) {
		let datei: string;
		if (teil.art === 'szene') {
			datei = path.join(SCHNITT_DIR, `${String(i).padStart(2, '0')}-${teil.name}.mp4`);
			await schneideSzene(browser, await ladePlan(teil.name), datei);
		} else if (teil.art === 'karte') {
			datei = await standbild(
				browser,
				karteHtml(teil.nr, teil.titel),
				`${String(i).padStart(2, '0')}-karte`,
				1.5,
			);
		} else if (teil.art === 'vorspann') {
			datei = await standbild(browser, vorspannHtml(), '00-vorspann', 4);
		} else {
			datei = await standbild(browser, abspannHtml(), `${String(i).padStart(2, '0')}-abspann`, 9);
		}
		if (teil.art !== 'szene') {
			marken.push({ zeit, titel: titelVon(teil) });
		}
		teile.push(datei);
		zeit += await dauerVon(datei);
	}
	const liste = path.join(SCHNITT_DIR, 'teile.txt');
	await writeFile(liste, teile.map((t) => `file '${t}'`).join('\n'));
	await mkdir(path.dirname(ziel), { recursive: true });
	await ffmpeg(['-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', '-movflags', '+faststart', ziel]);
	return marken;
};

/** Alle `abstand` Sekunden ein Standbild, je vier auf einem Bogen, zum Durchsehen. */
export const kontrollbilder = async (video: string, abstand = 5) => {
	const dir = path.join(AUFNAHME_DIR, 'kontrolle');
	await rm(dir, { recursive: true, force: true });
	await mkdir(dir, { recursive: true });
	await ffmpeg(['-i', video, '-vf', `fps=1/${abstand},scale=960:540,tile=2x2`, path.join(dir, 'bogen-%02d.png')]);
	await ffmpeg(['-i', video, '-vf', `fps=1/${abstand}`, path.join(dir, 'bild-%03d.png')]);
	return dir;
};

export const zeitText = (sekunden: number) => {
	const s = Math.round(sekunden);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Der Claude-Chat im Video ist nachgestellt: eine schlichte Seite, sichtbar beschriftet als „Claude-App
 * (nachgestellt)“, keine Kopie der echten App. Die Lehrkraft tippt wirklich ins Feld; Claudes Antworten schreibt das
 * Drehbuch hinein, Wort für Wort wie beim Streamen. Links öffnen die Schoolbox in einem eigenen Tab.
 */

import type { BrowserContext, Page } from '@playwright/test';

import type { Szene } from './buehne';
import { BASIS } from './buehne';

export const CHAT_URL = `${BASIS}/claude-app`;

export interface Nachricht {
	von: 'lehrkraft' | 'claude' | 'schritt' | 'trenner';
	html: string;
}

interface ChatApi {
	verlauf: (liste: Nachricht[]) => void;
	lehrkraft: (text: string) => void;
	claude: (html: string, denkt: number, proWort: number) => Promise<void>;
	schritt: (text: string) => void;
	schrittFertig: () => void;
	trenner: (text: string) => void;
}

declare global {
	interface Window {
		__chat?: ChatApi;
	}
}

const SEITE = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Claude-App (nachgestellt)</title>
<style>
	* { box-sizing: border-box; }
	html { scroll-behavior: smooth; }
	body { margin: 0; background: #f4f4f1; color: #222; font: 22px/1.5 'Liberation Sans', Arial, sans-serif; }
	header { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 18px; height: 76px; padding: 0 40px;
		background: #fff; border-bottom: 1px solid #ddd; }
	header b { font-size: 26px; }
	header .nach { color: #777; font-size: 20px; }
	header .chip { margin-left: auto; padding: 6px 16px; border: 1px solid #ccc; border-radius: 999px; font-size: 18px; color: #555; }
	main { max-width: 980px; margin: 0 auto; padding: 36px 24px 380px; display: flex; flex-direction: column; gap: 26px; }
	.lehrkraft { align-self: flex-end; max-width: 78%; background: #e3e9f1; border-radius: 22px; padding: 14px 22px; white-space: pre-wrap; }
	.claude { align-self: flex-start; max-width: 92%; }
	.claude::before { content: 'Claude'; display: block; font-size: 17px; font-weight: 700; color: #8a6d3b; margin-bottom: 4px; }
	.claude p { margin: 0 0 12px; }
	.claude p:last-child { margin-bottom: 0; }
	.claude ul, .claude ol { margin: 0 0 12px; padding-left: 30px; }
	.claude li { margin: 3px 0; }
	.claude .wahl { display: grid; gap: 6px; margin: 4px 0 12px; }
	.claude .klein { color: #666; font-size: 19px; }
	.claude a { color: #1f5fa8; font-weight: 700; text-decoration: underline; text-underline-offset: 4px; }
	.claude a::after { content: ' ↗'; font-weight: 400; }
	.schritt { align-self: flex-start; display: flex; align-items: center; gap: 12px; color: #666; font-size: 19px;
		border: 1px solid #ddd; background: #fafaf8; border-radius: 12px; padding: 8px 16px; }
	.schritt i { width: 20px; height: 20px; border: 3px solid #bbb; border-top-color: #555; border-radius: 50%; animation: dreh 0.8s linear infinite; }
	.schritt.fertig i { animation: none; border: 0; }
	.schritt.fertig i::before { content: '✓'; color: #2f8a4a; font-style: normal; font-weight: 700; }
	@keyframes dreh { to { transform: rotate(360deg); } }
	.trenner { align-self: center; color: #888; font-style: italic; font-size: 19px; }
	.denkt { align-self: flex-start; display: flex; gap: 8px; padding: 10px 0; }
	.denkt span { width: 11px; height: 11px; border-radius: 50%; background: #b9a27a; animation: hopp 1s infinite; }
	.denkt span:nth-child(2) { animation-delay: .15s; } .denkt span:nth-child(3) { animation-delay: .3s; }
	@keyframes hopp { 0%, 60%, 100% { opacity: .3; transform: none; } 30% { opacity: 1; transform: translateY(-5px); } }
	.w { display: none; } .w.da { display: inline; } .leer { display: none !important; }
	footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 18px 24px 150px; background: linear-gradient(transparent, #f4f4f1 12%); }
	form { max-width: 980px; margin: 0 auto; display: flex; gap: 14px; align-items: flex-end; background: #fff; border: 1px solid #cfcfca;
		border-radius: 20px; padding: 14px 14px 14px 22px; box-shadow: 0 4px 16px rgba(0,0,0,.06); }
	textarea { flex: 1; border: 0; outline: 0; resize: none; font: inherit; min-height: 40px; max-height: 220px; padding: 4px 0; background: transparent; }
	button { flex: none; height: 52px; padding: 0 26px; border: 0; border-radius: 14px; background: #3d3d3a; color: #fff; font: inherit; font-weight: 700; }
	button:disabled { background: #c9c9c4; }
</style></head>
<body>
<header><b>Claude-App</b><span class="nach">(nachgestellt)</span><span class="chip">Umgebung: schoolbox</span></header>
<main></main>
<footer><form><textarea rows="1" placeholder="Schreib Claude …" aria-label="Nachricht"></textarea><button type="submit" disabled>Senden</button></form></footer>
<script>
(() => {
	const main = document.querySelector('main');
	const form = document.querySelector('form');
	const feld = document.querySelector('textarea');
	const knopf = document.querySelector('button');
	const warte = (ms) => new Promise((r) => setTimeout(r, ms));
	const unten = () => window.scrollTo(0, document.body.scrollHeight);
	const neu = (klasse, html) => {
		const el = document.createElement('div');
		el.className = klasse;
		el.innerHTML = html;
		main.append(el);
		unten();
		return el;
	};
	const groesse = () => { feld.style.height = 'auto'; feld.style.height = feld.scrollHeight + 'px'; knopf.disabled = !feld.value.trim(); };
	feld.addEventListener('input', groesse);
	feld.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const text = feld.value.trim();
		if (!text) return;
		neu('lehrkraft', '').textContent = text;
		feld.value = '';
		groesse();
	});
	const streame = async (el, proWort) => {
		const texte = [];
		const gang = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		while (gang.nextNode()) texte.push(gang.currentNode);
		const woerter = [];
		for (const t of texte) {
			const stueck = document.createDocumentFragment();
			for (const teil of t.textContent.split(/(\\s+)/)) {
				if (!teil) continue;
				if (/^\\s+$/.test(teil)) { stueck.append(teil); continue; }
				const w = document.createElement('span');
				w.className = 'w';
				w.textContent = teil;
				stueck.append(w);
				woerter.push(w);
			}
			t.replaceWith(stueck);
		}
		const bloecke = el.querySelectorAll('p, li, ul, ol, div, a');
		bloecke.forEach((b) => b.classList.add('leer'));
		for (const w of woerter) {
			w.classList.add('da');
			for (let b = w.parentElement; b && b !== el; b = b.parentElement) b.classList.remove('leer');
			unten();
			await warte(proWort);
		}
	};
	window.__chat = {
		verlauf: (liste) => {
			for (const n of liste) {
				const el = neu(n.von, n.html);
				if (n.von === 'schritt') { el.classList.add('fertig'); el.insertAdjacentHTML('afterbegin', '<i></i>'); }
			}
		},
		lehrkraft: (text) => { neu('lehrkraft', '').textContent = text; },
		claude: async (html, denkt, proWort) => {
			const punkte = neu('denkt', '<span></span><span></span><span></span>');
			await warte(denkt);
			punkte.remove();
			const el = neu('claude', html);
			await streame(el, proWort);
		},
		schritt: (text) => { neu('schritt', '<i></i>').append(text); },
		schrittFertig: () => { const alle = main.querySelectorAll('.schritt:not(.fertig)'); alle[alle.length - 1]?.classList.add('fertig'); },
		trenner: (text) => { neu('trenner', '').textContent = text; },
	};
})();
</script>
</body></html>`;

export const richteChatEin = async (kontext: BrowserContext) => {
	await kontext.route(CHAT_URL, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: SEITE }));
};

export interface Chat {
	seite: Page;
	/** Tippt in das Feld und schickt ab. */
	schreibe: (text: string) => Promise<void>;
	/** Fügt ein, was in der Zwischenablage steht, tippt den Rest dazu und schickt ab. */
	fuegeEin: (dazu: string) => Promise<void>;
	claude: (html: string, optionen?: { denkt?: number; proWort?: number; pause?: number }) => Promise<void>;
	/** Eine Werkzeug-Zeile, wie die App sie zeigt, während Claude arbeitet. */
	schritt: (text: string) => Promise<void>;
	schrittFertig: (pause?: number) => Promise<void>;
	trenner: (text: string, pause?: number) => Promise<void>;
}

export const oeffneChat = async (szene: Szene, seite: Page, verlauf: Nachricht[] = []): Promise<Chat> => {
	await richteChatEin(seite.context());
	await seite.goto(CHAT_URL);
	await seite.evaluate((liste) => window.__chat?.verlauf(liste), verlauf);
	const feld = seite.getByRole('textbox', { name: 'Nachricht' });
	const senden = seite.getByRole('button', { name: 'Senden' });
	return {
		seite,
		schreibe: async (text) => {
			await szene.klicke(feld, { pause: 200 });
			await szene.tippe(text, { verzoegerung: 30, pause: 300 });
			await szene.klicke(senden, { pause: 600 });
		},
		fuegeEin: async (dazu) => {
			await szene.klicke(feld, { pause: 200 });
			await szene.taste('ControlOrMeta+V', 900);
			await szene.tippe(dazu, { verzoegerung: 30, pause: 400 });
			await szene.klicke(senden, { pause: 600 });
		},
		claude: async (html, optionen = {}) => {
			const { denkt = 800, pause = 1500, proWort = 30 } = optionen;
			await seite.evaluate(([h, d, w]) => window.__chat?.claude(h, d, w), [html, denkt, proWort] as const);
			await szene.pause(pause);
		},
		schritt: async (text) => {
			await seite.evaluate((t) => window.__chat?.schritt(t), text);
		},
		schrittFertig: async (pause = 600) => {
			await seite.evaluate(() => window.__chat?.schrittFertig());
			await szene.pause(pause);
		},
		trenner: async (text, pause = 1500) => {
			await seite.evaluate((t) => window.__chat?.trenner(t), text);
			await szene.pause(pause);
		},
	};
};

/**
 * Die Sperre des Canva-Kontingents im Strom von `stream-json` (235). Canva meldet sie als Ergebnis von `generate-image`
 * oder `get-generate-image-job` mit `"code":"quota_cooldown"` und nennt keine Wartezeit. Nur Ergebnisse von Werkzeugen
 * aus `mcp__canva__` zählen: `Read` von `bilder.md` enthält das Wort auch. Zurück setzt sie nur ein neu angenommener
 * Auftrag; ein fertiges Bild kann von einem Job vor der Sperre stammen.
 */

const CANVA = 'mcp__canva__';
const ERZEUGEN = `${CANVA}generate-image`;

export interface CanvaKontingent {
	/** `tool_use`-ID → Name, nur Werkzeuge von Canva. */
	aufrufe: Map<string, string>;
	/** Die letzte Antwort von Canva, die etwas über das Kontingent sagt, war die Sperre. */
	gesperrt: boolean;
	/** Im Lauf gab es mindestens eine Sperre. */
	imLauf: boolean;
}

export const neuesKontingent = (): CanvaKontingent => ({ aufrufe: new Map(), gesperrt: false, imLauf: false });

const textVon = (inhalt: unknown): string => {
	if (typeof inhalt === 'string') {
		return inhalt;
	}
	if (!Array.isArray(inhalt)) {
		return '';
	}
	return inhalt
		.map((t: unknown) => {
			const teil = t as { type?: unknown; text?: unknown };
			return teil.type === 'text' && typeof teil.text === 'string' ? teil.text : '';
		})
		.join('\n');
};

const teileVon = (e: Record<string, unknown>) => {
	const nachricht = (e.message ?? {}) as { content?: unknown };
	return Array.isArray(nachricht.content) ? (nachricht.content as Record<string, unknown>[]) : [];
};

/** Ein Ereignis aus dem Strom: merkt sich Aufrufe von Canva und wertet ihre Ergebnisse aus. */
export const notiereKontingent = (k: CanvaKontingent, e: Record<string, unknown>) => {
	if (e.type === 'assistant') {
		for (const teil of teileVon(e)) {
			if (
				teil.type === 'tool_use' &&
				typeof teil.id === 'string' &&
				typeof teil.name === 'string' &&
				teil.name.startsWith(CANVA)
			) {
				k.aufrufe.set(teil.id, teil.name);
			}
		}
		return;
	}
	if (e.type !== 'user') {
		return;
	}
	for (const teil of teileVon(e)) {
		const id = teil.type === 'tool_result' ? teil.tool_use_id : null;
		const name = typeof id === 'string' ? k.aufrufe.get(id) : undefined;
		if (!name) {
			continue;
		}
		const text = textVon(teil.content);
		if (text.includes('quota_cooldown')) {
			k.gesperrt = true;
			k.imLauf = true;
		} else if (teil.is_error === true || text.includes('"failure"')) {
			continue;
		} else if (name === ERZEUGEN && /"jobId"\s*:/.test(text)) {
			k.gesperrt = false;
		}
	}
};

import { useEffect, useState } from 'react';

import type { KiAuftrag, Vorschlag } from './ki';

/** Was der Editor zum neuen Blatt zeigt (133): Karte, Entwurfsleiste, Fehlerkarte oder eine Zeile zum Ende. */
export type EntwurfPhase = Laeuft | Plan | Frage | MitEntwurf | OhneEntwurf | Ende;

interface Laeuft {
	art: 'laeuft';
	auftrag: KiAuftrag;
	nachbessern: boolean;
	/** Beim Nachbessern bleibt der bisherige Entwurf auf dem Blatt (190-10). */
	vorschlag: Vorschlag | null;
}

/** Claude hat statt eines Blatts zurückgefragt (190-08): Die Antwort geht ins selbe Gespräch. */
interface Frage {
	art: 'frage';
	text: string;
}

/** Claude hat den Aufgabenplan gezeigt; gebaut wird erst nach der Freigabe, wie in der Claude-App. */
interface Plan {
	art: 'plan';
	text: string;
	fehler: string | null;
}

interface MitEntwurf {
	art: 'vorschlag';
	vorschlag: Vorschlag;
	fehler: string | null;
}

interface OhneEntwurf {
	art: 'fehler';
	text: string;
}

interface Ende {
	art: 'ende';
	wie: 'verworfen' | 'abgebrochen';
}

interface EntwurfStand {
	auftrag: KiAuftrag | null;
	laeuft: boolean;
	vorschlag: Vorschlag | null;
	/** Fehler des letzten Laufs oder des letzten Starts. */
	fehler: string | null;
	/** Der Start aus dem Assistenten wurde gleich abgelehnt. */
	startFehler: string | null;
	/** Der Auftrag, dessen Meldung die Lehrkraft geschlossen hat. */
	zu: string | null;
	verworfen: boolean;
}

export const entwurfPhase = (s: EntwurfStand): EntwurfPhase | null => {
	const { auftrag, vorschlag } = s;
	if (s.laeuft && auftrag) {
		const nachbessern = Boolean(vorschlag && !vorschlag.konflikt);
		return { art: 'laeuft', auftrag, nachbessern, vorschlag: nachbessern ? vorschlag : null };
	}
	const offen = auftrag && auftrag.id !== s.zu;
	const antwort = offen && auftrag.status === 'fertig' && auftrag.ergebnis === 'antwort' ? auftrag.antwort : null;
	if (antwort && auftrag?.plan && !vorschlag) {
		return { art: 'plan', text: antwort, fehler: s.fehler ?? s.startFehler };
	}
	// Claude hat geantwortet statt zu bauen: Neben einem Entwurf ist das wie ein Fehler mit Grund, ohne ihn eine Rückfrage.
	const fehler = s.fehler ?? s.startFehler;
	if (vorschlag) {
		return { art: 'vorschlag', vorschlag, fehler: fehler ?? antwort };
	}
	if (fehler) {
		return { art: 'fehler', text: fehler };
	}
	if (antwort) {
		return { art: 'frage', text: antwort };
	}
	if (offen && auftrag.status === 'abgebrochen') {
		return { art: 'ende', wie: 'abgebrochen' };
	}
	return s.verworfen ? { art: 'ende', wie: 'verworfen' } : null;
};

/**
 * Der Lauf eines neuen Blatts heißt überall gleich, im Editor, an Kachel, Zeile und Pille (190-N03): Bis zur Freigabe
 * plant Claude, danach baut es.
 */
export const laufWort = (plant: boolean) => (plant ? 'Claude plant' : 'Claude baut');

/** Gesperrt ist das Blatt, solange Claude baut und solange der Entwurf offen ist (Festlegung F2 in 130). */
export const sperrtBlatt = (phase: EntwurfPhase | null) =>
	phase?.art === 'laeuft' || phase?.art === 'plan' || (phase?.art === 'vorschlag' && !phase.vorschlag.konflikt);

/** Warum Bausteine und Inspektor nichts ändern; `null`, wenn das Blatt frei ist. */
export const sperrGrund = (phase: EntwurfPhase | null) => {
	if (phase?.art === 'laeuft') {
		if (phase.nachbessern) {
			return 'Claude bessert den Vorschlag nach. Bearbeiten geht wieder, sobald er fertig ist.';
		}
		return phase.auftrag.phase === 'plan'
			? `${laufWort(true)} den Aufgabenplan. Bearbeiten geht wieder, sobald das Blatt fertig ist.`
			: `${laufWort(false)} das Blatt. Bearbeiten geht wieder, sobald der Vorschlag da ist.`;
	}
	if (phase?.art === 'plan') {
		return 'Erst den Aufgabenplan freigeben oder verwerfen, dann geht es hier weiter.';
	}
	return sperrtBlatt(phase) ? 'Erst den Vorschlag übernehmen oder verwerfen, dann geht es hier weiter.' : null;
};

/** Die Quelle des offenen Entwurfs, die das Blatt statt der eigenen zeigt. */
export const quelleDes = (phase: EntwurfPhase | null) => {
	if (phase?.art === 'laeuft') {
		return phase.vorschlag?.quelle ?? null;
	}
	return phase?.art === 'vorschlag' && !phase.vorschlag.konflikt ? (phase.vorschlag.quelle ?? null) : null;
};

/** Die Zeilen „Annahme: …“ aus Claudes Schlusstext (`vorlagen/ki/neu-entwurf.md` verlangt sie so). */
export const annahmenAus = (antwort: string) =>
	antwort
		.split('\n')
		.map((zeile) => /^\s*(?:[-•*]\s*)?Annahme:\s*(.+)$/i.exec(zeile)?.[1]?.trim() ?? '')
		.filter(Boolean);

/** „1:05“ seit dem Beginn; vor dem Beginn (der Auftrag wartet) nichts. */
export const laufzeit = (seit: string | null | undefined, jetzt: number) => {
	if (!seit) {
		return null;
	}
	const sekunden = Math.max(0, Math.round((jetzt - new Date(seit).getTime()) / 1000));
	return `${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, '0')}`;
};

/** Die Uhrzeit, jede Sekunde neu, solange `aktiv`. */
export const useJetzt = (aktiv: boolean) => {
	const [jetzt, setJetzt] = useState(() => Date.now());
	useEffect(() => {
		if (!aktiv) {
			return undefined;
		}
		setJetzt(Date.now());
		const uhr = window.setInterval(() => setJetzt(Date.now()), 1000);
		return () => window.clearInterval(uhr);
	}, [aktiv]);
	return jetzt;
};

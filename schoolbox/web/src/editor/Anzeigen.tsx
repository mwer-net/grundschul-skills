import type { ReactNode } from 'react';
import { useLayoutEffect, useRef } from 'react';

import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
import { Tooltip } from '../bausteine/Tooltip';
import type { SpeicherStand } from './speichern';
import type { VersionEintrag } from './version';
import { versionTitel } from './version';

/** „Gespeichert ✓“ und Verwandte; bei Problemen mit einem Knopf für den nächsten Versuch. */
export const Speicheranzeige = ({ erneut, stand }: { stand: SpeicherStand; erneut: () => void }) => {
	if (stand.art === 'gespeichert') {
		return (
			<span
				className="flex items-center gap-1 text-xs whitespace-nowrap text-dezent"
				data-speicherstand="gespeichert"
			>
				<Symbol name="haken" className="size-3 flex-none" />
				Gespeichert
			</span>
		);
	}
	if (stand.art === 'wartet' || stand.art === 'speichert') {
		return (
			<span className="text-xs whitespace-nowrap text-dezent" data-speicherstand="speichert">
				Speichert …
			</span>
		);
	}
	// 193-03: Im Kopf steht nur, dass nicht gespeichert ist; der Grund steht im Tooltip, damit der Titel bleibt.
	const text = {
		offline: 'Nicht gespeichert – keine Verbindung',
		fehler: 'Nicht gespeichert',
		konflikt: 'Nicht gespeichert – das Material wurde geändert',
	}[stand.art];
	return (
		<span
			className="flex items-center gap-x-1 text-xs font-medium whitespace-nowrap text-fehler"
			data-speicherstand={stand.art}
		>
			{stand.art === 'fehler' ? (
				<Tooltip text={stand.text}>
					<span tabIndex={0} data-speichergrund={stand.text}>
						{text}
					</span>
				</Tooltip>
			) : (
				text
			)}
			{stand.art !== 'konflikt' && (
				<button
					type="button"
					className="h-knopf-status rounded-sm px-1 text-tinte underline"
					aria-label="Erneut versuchen"
					onClick={erneut}
				>
					Erneut
				</button>
			)}
		</span>
	);
};

interface LeistenEigenschaften {
	titel: string;
	/** Kennung für Tests, z. B. `{ 'data-konflikt': '' }`. */
	merkmal: Record<`data-${string}`, string>;
	hinweis: string;
	children: ReactNode;
}

/**
 * 193-20: Erscheint die Leiste, rollt der Blattbereich um ihre Höhe weiter, beim Verschwinden zurück. Das Blatt bleibt
 * so stehen, und die Leiste liegt über seinem oberen Rand.
 */
const useBlattBleibt = () => {
	const leiste = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = leiste.current;
		const bereich = el?.closest('main');
		if (!el || !bereich) {
			return undefined;
		}
		const hoehe = el.offsetHeight + parseFloat(getComputedStyle(el).marginTop);
		bereich.scrollTop += hoehe;
		return () => {
			bereich.scrollTop -= hoehe;
		};
	}, []);
	return leiste;
};

/** Klebt oben im Blattbereich wie die Entwurfsleiste (193-10): Grund und Ausweg bleiben beim Rollen im Blick. */
const Leiste = ({ children, hinweis, merkmal, titel }: LeistenEigenschaften) => {
	const leiste = useBlattBleibt();
	return (
		<div
			ref={leiste}
			className="sticky top-0 z-10 mx-2 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-entwurf bg-warnung-hell px-3 py-2 shadow-sm"
		>
			<div className="min-w-0 flex-1">
				<p className="font-medium" {...merkmal}>
					{titel}
				</p>
				{hinweis && <p className="text-leise">{hinweis}</p>}
			</div>
			<div className="flex flex-wrap gap-2">{children}</div>
		</div>
	);
};

interface KonfliktEigenschaften {
	urheber: 'claude' | 'lehrkraft' | null;
	laeuft: boolean;
	neuLaden: () => void;
}

/** Jemand anderes hat geändert, während hier etwas offen war. Nichts geht verloren: Der eigene Stand wird Version. */
export const Konfliktleiste = ({ laeuft, neuLaden, urheber }: KonfliktEigenschaften) => {
	// 193-11: Beim Konflikt aus dem Speichern ist unbekannt, wer geändert hat; dann nennt die Leiste niemanden.
	const titel = {
		claude: 'Claude hat das Material geändert. Neu laden?',
		lehrkraft: 'Das Material wurde gerade an einem anderen Gerät geändert. Neu laden?',
		unbekannt: 'Das Material wurde inzwischen geändert. Neu laden?',
	}[urheber ?? 'unbekannt'];
	return (
		<Leiste
			titel={titel}
			merkmal={{ 'data-konflikt': '' }}
			hinweis="Deine letzten Änderungen bleiben erhalten: Du findest sie unter „Versionen“."
		>
			<Knopf onClick={neuLaden} disabled={laeuft}>
				{laeuft ? <Symbol name="laden" className="size-4 animate-spin" /> : <Symbol name="zurueckholen" />}
				Neu laden
			</Knopf>
		</Leiste>
	);
};

interface VorschauEigenschaften {
	version: VersionEintrag;
	/** Die Version gleicht dem Blatt (193-18): nichts wiederherzustellen. */
	jetzig: boolean;
	laeuft: boolean;
	wiederherstellen: () => void;
	schliessen: () => void;
}

export const Vorschauleiste = ({ jetzig, laeuft, schliessen, version, wiederherstellen }: VorschauEigenschaften) => (
	<Leiste
		titel={`${jetzig ? 'Jetziger Stand' : 'Vorschau'}: ${versionTitel(version)}`}
		merkmal={{ 'data-vorschau': version.id }}
		hinweis={jetzig ? '' : 'Wiederherstellen legt eine neue Version an. Nichts wird überschrieben.'}
	>
		{!jetzig && (
			<Knopf onClick={wiederherstellen} disabled={laeuft}>
				<Symbol name="zurueckholen" />
				Wiederherstellen
			</Knopf>
		)}
		<Knopf art="zweit" onClick={schliessen}>
			Zurück zum jetzigen Stand
		</Knopf>
	</Leiste>
);

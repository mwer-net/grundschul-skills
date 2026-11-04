import type { ReactNode } from 'react';

import { Knopf } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
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
	const text = {
		offline: 'Nicht gespeichert – keine Verbindung',
		fehler: `Nicht gespeichert: ${stand.art === 'fehler' ? stand.text : ''}`,
		konflikt: 'Nicht gespeichert – das Material wurde geändert',
	}[stand.art];
	return (
		<span
			className="flex items-center gap-x-1 text-xs font-medium whitespace-nowrap text-fehler"
			data-speicherstand={stand.art}
		>
			{text}
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

const Leiste = ({ children, hinweis, merkmal, titel }: LeistenEigenschaften) => (
	<div className="m-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-entwurf bg-warnung-hell px-3 py-2">
		<div className="min-w-0 flex-1">
			<p className="font-medium" {...merkmal}>
				{titel}
			</p>
			<p className="text-leise">{hinweis}</p>
		</div>
		<div className="flex flex-wrap gap-2">{children}</div>
	</div>
);

interface KonfliktEigenschaften {
	urheber: 'claude' | 'lehrkraft' | null;
	laeuft: boolean;
	neuLaden: () => void;
}

/** Jemand anderes hat geändert, während hier etwas offen war. Nichts geht verloren: Der eigene Stand wird Version. */
export const Konfliktleiste = ({ laeuft, neuLaden, urheber }: KonfliktEigenschaften) => {
	const titel =
		urheber === 'lehrkraft'
			? 'Das Material wurde gerade an einem anderen Gerät geändert. Neu laden?'
			: 'Claude hat das Material geändert. Neu laden?';
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
	laeuft: boolean;
	wiederherstellen: () => void;
	schliessen: () => void;
}

export const Vorschauleiste = ({ laeuft, schliessen, version, wiederherstellen }: VorschauEigenschaften) => (
	<Leiste
		titel={`Vorschau: ${versionTitel(version)}`}
		merkmal={{ 'data-vorschau': version.id }}
		hinweis="Wiederherstellen legt eine neue Version an. Nichts wird überschrieben."
	>
		<Knopf onClick={wiederherstellen} disabled={laeuft}>
			<Symbol name="zurueckholen" />
			Wiederherstellen
		</Knopf>
		<Knopf art="zweit" onClick={schliessen}>
			Zurück zum jetzigen Stand
		</Knopf>
	</Leiste>
);

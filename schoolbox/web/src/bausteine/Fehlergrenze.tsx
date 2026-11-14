import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

import { Knopf } from './Knopf';
import { merkeFehler } from './melden';
import { Zustand } from './Zustand';

interface Eigenschaften {
	/** Wechselt der Schlüssel (andere Adresse), versucht es die Seite neu. */
	schluessel: string;
	children: ReactNode;
}

interface Stand {
	fehler: boolean;
	schluessel: string;
}

/**
 * Fängt Ausnahmen beim Zeichnen ab (193-29): statt eines weißen Fensters ein ruhiger Zustand mit „Neu laden“. Der
 * Käfer und die Hinweisleiste stehen außerhalb und bleiben erreichbar; der Fehler landet in der nächsten Meldung.
 */
export class Fehlergrenze extends Component<Eigenschaften, Stand> {
	override state: Stand = { fehler: false, schluessel: this.props.schluessel };

	static getDerivedStateFromError(): Partial<Stand> {
		return { fehler: true };
	}

	static getDerivedStateFromProps(props: Eigenschaften, stand: Stand): Partial<Stand> | null {
		return props.schluessel === stand.schluessel ? null : { fehler: false, schluessel: props.schluessel };
	}

	override componentDidCatch(fehler: Error, info: ErrorInfo) {
		merkeFehler(`Absturz: ${fehler.message}${info.componentStack?.split('\n').slice(0, 4).join(' ') ?? ''}`);
	}

	override render() {
		if (!this.state.fehler) {
			return this.props.children;
		}
		return (
			<main data-fehlergrenze>
				<Zustand symbol="achtung" titel="Da ist etwas schiefgegangen">
					<p className="text-leise">Lade die Seite neu. Was gespeichert ist, bleibt.</p>
					<Knopf onClick={() => window.location.reload()}>Neu laden</Knopf>
				</Zustand>
			</main>
		);
	}
}

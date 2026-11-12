import { Farbwahl } from '../../../bausteine/Farbwahl';
import { Zeile } from '../../../bausteine/Zeile';
import { Regler } from './regler';

export interface Fuellung {
	f1?: string | null;
	f2?: string | null;
	winkel?: number | null;
}

interface Eigenschaften {
	art: 'farbe' | 'verlauf' | 'muster';
	/** Teil des Namens der Farbreihen (`data-farbwahl`), z. B. `flaeche` → `flaeche-f1`. */
	name: string;
	/** Der Teil im Genitiv für den Verlauf, z. B. „der Seitenfläche“ → „Farbe der Seitenfläche“. */
	teil: string;
	doc: Document | null;
	werte: Fuellung;
	/** Winkel, wenn keiner im Material steht. */
	winkel: number;
	setze: (beschreibung: string, werte: Fuellung) => void;
	zeige: (werte: Record<string, string>) => void;
}

const TITEL = {
	farbe: ['Farbe', ''],
	verlauf: ['Farbe 1', 'Farbe 2'],
	muster: ['Grund', 'Musterfarbe'],
} as const;

/** Farbe, beim Verlauf zwei Farben und der Winkel, beim Muster Grund und Musterfarbe: Seitenfläche und Kopfband. */
export const FuellungZeilen = ({ art, doc, name, setze, teil, werte, winkel, zeige }: Eigenschaften) => {
	const [titel1, titel2] = TITEL[art];
	return (
		<>
			<Zeile titel={titel1} darunter>
				<Farbwahl
					name={`${name}-f1`}
					beschriftung={titel1}
					doc={doc}
					wert={werte.f1 ?? null}
					setze={(f1) => setze(`Farbe ${teil}`, { f1 })}
					zeige={(f1) => zeige({ '--f1': f1 })}
				/>
			</Zeile>
			{art !== 'farbe' && (
				<Zeile titel={titel2} darunter>
					<Farbwahl
						name={`${name}-f2`}
						beschriftung={titel2}
						doc={doc}
						wert={werte.f2 ?? null}
						setze={(f2) => setze(`Farbe ${teil}`, { f2 })}
						zeige={(f2) => zeige({ '--f2': f2 })}
					/>
				</Zeile>
			)}
			{art === 'verlauf' && (
				<Regler
					name="winkel"
					titel="Winkel"
					einheit="°"
					min={0}
					max={360}
					schritt={15}
					wert={werte.winkel ?? winkel}
					zeige={(w) => zeige({ '--winkel': `${w}deg` })}
					setze={(w) => setze(`Winkel ${teil}`, { winkel: w })}
				/>
			)}
		</>
	);
};

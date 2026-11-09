import type { Einblendung } from '../../Leinwand';
import type { Struktur } from '../../struktur';
import { SchereAnzeige } from '../schere-anzeige';
import { Testfach } from '../Testfach';
import { imTest } from '../testzugang';
import { SCHERE } from './schere';
import { useWerkzeug } from './useWerkzeug';

/**
 * Über dem Blatt, solange ein anderes Werkzeug als V aktiv ist: fängt den Strich und zeigt den Zeiger des Werkzeugs.
 * Mit einer Zeile in der Einblendung des Editors eingehängt.
 */
export const Werkzeugflaeche = ({
	e,
	folien,
	struktur,
}: {
	e: Einblendung;
	struktur: Pick<Struktur, 'fuehreAus' | 'aktiv'>;
	folien: boolean;
}) => {
	const { griffe, werkzeug } = useWerkzeug({ doc: e.doc, skala: e.skala, struktur, aktiv: struktur.aktiv });
	return (
		<>
			{werkzeug && !e.zieht && (
				<div
					className="absolute top-0 touch-none"
					data-werkzeugflaeche={werkzeug.id}
					style={{ left: e.links, width: e.breite, height: e.hoehe, cursor: werkzeug.zeiger }}
					{...(werkzeug.id === SCHERE ? {} : griffe)}
				>
					{/* 121: Die Formen-Schere wirkt auf die gewählten Formen und nimmt den Zug selbst. */}
					{werkzeug.id === SCHERE && (
						<SchereAnzeige
							doc={e.doc}
							skala={e.skala}
							breite={e.breite}
							hoehe={e.hoehe}
							fuehreAus={struktur.fuehreAus}
						/>
					)}
				</div>
			)}
			{imTest() && <Testfach teile={{ doc: e.doc, struktur, folien }} />}
		</>
	);
};

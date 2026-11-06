import type { Einblendung } from '../../Leinwand';
import type { Struktur } from '../../struktur';
import { Testfach } from '../Testfach';
import { imTest } from '../testzugang';
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
					{...griffe}
				/>
			)}
			{imTest() && <Testfach teile={{ doc: e.doc, struktur, folien }} />}
		</>
	);
};

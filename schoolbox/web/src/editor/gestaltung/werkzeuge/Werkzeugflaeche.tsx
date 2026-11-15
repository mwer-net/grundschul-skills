import { useEffect } from 'react';

import type { Einblendung } from '../../Leinwand';
import type { Struktur } from '../../struktur';
import { Testfach } from '../Testfach';
import { imTest } from '../testzugang';
import { WertAmZeiger } from '../wert-am-zeiger';
import { useWerkzeug } from './useWerkzeug';

/**
 * Über dem Blatt, solange ein anderes Werkzeug als V aktiv ist: fängt den Strich und zeigt den Zeiger des Werkzeugs.
 * Mit einer Zeile in der Einblendung des Editors eingehängt. 198-15: Wird ein Werkzeug aktiv, ist die alte Auswahl
 * aufgehoben (Rahmen und Leiste stünden sonst über dem, was man zeichnet); am Zeiger steht, wie der Pfad endet.
 */
export const Werkzeugflaeche = ({
	e,
	folien,
	struktur,
	waehle,
}: {
	e: Einblendung;
	struktur: Pick<Struktur, 'fuehreAus' | 'aktiv'>;
	folien: boolean;
	waehle?: (nr: number | null) => void;
}) => {
	const { amZeiger, griffe, werkzeug } = useWerkzeug({ doc: e.doc, skala: e.skala, struktur, aktiv: struktur.aktiv });
	const id = werkzeug?.id ?? null;
	useEffect(() => {
		if (id !== null) {
			waehle?.(null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Wechsel des Werkzeugs
	}, [id]);
	return (
		<>
			{amZeiger && <WertAmZeiger links={e.links} skala={e.skala} text={amZeiger.text} zeiger={amZeiger.zeiger} />}
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

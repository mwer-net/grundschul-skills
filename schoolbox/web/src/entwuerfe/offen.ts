import type { DokumentMeta } from '../typen';

/** Es gibt Entwürfe, und Claude hat noch keinen übernommen: Die Lehrkraft soll zuerst wählen. */
export const hatOffeneEntwuerfe = (meta: Pick<DokumentMeta, 'entwuerfe' | 'gewaehlt'>) =>
	meta.entwuerfe.length > 0 && !meta.gewaehlt;

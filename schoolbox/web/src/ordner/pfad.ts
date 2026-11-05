import { pfadVon, WURZEL_NAME } from './objekte';
import type { AblageStand } from './typen';

export const pfadText = (stand: AblageStand, id: string | null) =>
	[WURZEL_NAME, ...pfadVon(stand, id).map((o) => o.name)].join(' › ');

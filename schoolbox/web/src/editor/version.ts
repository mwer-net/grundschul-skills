import { datum, uhrzeit } from '../lib/text';

export interface VersionEintrag {
	id: string;
	/** ISO-Zeit, wie sie der Server schickt. */
	zeit: string;
	urheber: 'claude' | 'lehrkraft';
}

export const URHEBER_NAME = { claude: 'Claude', lehrkraft: 'Du' } as const;

export const versionTitel = (v: VersionEintrag) => `${datum(v.zeit)}, ${uhrzeit(v.zeit)} · ${URHEBER_NAME[v.urheber]}`;

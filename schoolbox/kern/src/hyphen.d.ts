declare module 'hyphen/de-1996' {
	export const hyphenateSync: (text: string, optionen?: { hyphenChar?: string; minWordLength?: number }) => string;
}

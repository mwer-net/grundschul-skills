import { klassen } from './klassen';
import { kuerzelAnzeige } from './kuerzel';

/** Tastenkürzel, klein und leise: `⌘` am Mac, `Strg` sonst. */
export const Kuerzel = ({ className, text }: { text: string; className?: string }) => (
	<kbd className={klassen('font-sans text-xs whitespace-nowrap text-dezent', className)}>{kuerzelAnzeige(text)}</kbd>
);

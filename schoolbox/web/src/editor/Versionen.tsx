import { klassen } from '../bausteine/klassen';
import { Symbol } from '../bausteine/Symbol';
import { datum, uhrzeit } from '../lib/text';
import type { VersionEintrag } from './version';
import { URHEBER_NAME } from './version';

interface Eigenschaften {
	versionen: VersionEintrag[] | null;
	gewaehlt: string | null;
	waehle: (version: VersionEintrag) => void;
}

/** Alle Versionen, neueste zuerst, nach Tagen gruppiert. Antippen zeigt sie im Blatt; wiederherstellen geht dort. */
export const Versionen = ({ gewaehlt, versionen, waehle }: Eigenschaften) => {
	if (!versionen) {
		return <Symbol name="laden" className="mx-auto mt-6 size-8 animate-spin text-leise" />;
	}
	if (versionen.length === 0) {
		return <p className="text-leise">Noch keine Versionen.</p>;
	}
	const tage = new Map<string, VersionEintrag[]>();
	for (const v of [...versionen].reverse()) {
		const tag = datum(v.zeit);
		tage.set(tag, [...(tage.get(tag) ?? []), v]);
	}
	return (
		<div className="flex flex-col gap-4">
			{[...tage].map(([tag, liste]) => (
				<section key={tag}>
					<h3 className="mb-1 text-sm font-bold text-leise">{tag}</h3>
					<ul className="flex flex-col gap-1" data-versionen>
						{liste.map((v) => (
							<li key={v.id}>
								<button
									type="button"
									aria-pressed={v.id === gewaehlt}
									data-version={v.id}
									className={klassen(
										'flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-3 text-left',
										v.id === gewaehlt
											? 'border-brand-500 bg-brand-50'
											: 'border-transparent hover:bg-brand-50',
									)}
									onClick={() => waehle(v)}
								>
									<Symbol
										name={v.urheber === 'claude' ? 'sprechblase' : 'stift'}
										className="size-5 flex-none text-leise"
									/>
									<span className="font-bold">{uhrzeit(v.zeit)}</span>
									<span className="text-leise">{URHEBER_NAME[v.urheber]}</span>
								</button>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
};

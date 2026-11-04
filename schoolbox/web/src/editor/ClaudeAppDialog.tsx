import { useEffect, useRef } from 'react';

import { Dialog } from '../bausteine/Dialog';
import { Knopf } from '../bausteine/Knopf';

export const VonHand = ({ schliessen, text }: { text: string; schliessen: () => void }) => {
	const feld = useRef<HTMLTextAreaElement>(null);
	useEffect(() => feld.current?.select(), []);
	return (
		<Dialog titel="In der Claude-App weiterarbeiten" schliessen={schliessen}>
			<label className="flex flex-col gap-2">
				<span>
					Kopiere diesen Text und füge ihn im Claude-Chat ein. Schreib dahinter, was du ändern möchtest.
				</span>
				<textarea
					ref={feld}
					readOnly
					rows={4}
					className="rounded-xl border border-rand p-3 text-base"
					value={text}
					data-claude-text
				/>
			</label>
			<div>
				<Knopf onClick={schliessen}>Fertig</Knopf>
			</div>
		</Dialog>
	);
};

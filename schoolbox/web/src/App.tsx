import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';

import { ANMELDE_SEITE } from './api';
import { HinweisAnbieter } from './bausteine/Hinweisleiste';
import { Rahmen } from './bausteine/Rahmen';
import { Anmeldung } from './seiten/Anmeldung';
import { Dokumentansicht } from './seiten/Dokumentansicht';
import { Drucken } from './seiten/Drucken';
import { Geteilt } from './seiten/Geteilt';
import { Mappenansicht } from './seiten/Mappenansicht';
import { NichtGefunden } from './seiten/NichtGefunden';
import { Papierkorb } from './seiten/Papierkorb';
import { Uebersicht } from './seiten/Uebersicht';

/** `key`: Ein anderes Dokument ist eine andere Seite, ohne Reste der vorigen (Ansicht, Fassung, Dialoge). */
const DokumentSeite = () => {
	const { dok = '', mappe = '' } = useParams();
	return <Dokumentansicht key={`${mappe}/${dok}`} zugang={{ mappe, token: null }} dok={dok} zurueckZurMappe />;
};

const DruckSeite = () => {
	const { dok = '', mappe = '' } = useParams();
	return <Drucken zugang={{ mappe, token: null }} dok={dok} />;
};

export const App = () => (
	<BrowserRouter>
		<HinweisAnbieter>
			<Routes>
				<Route path={ANMELDE_SEITE} element={<Anmeldung />} />
				<Route path="/f/:token/*" element={<Geteilt />} />
				<Route path="m/:mappe/:dok/drucken" element={<DruckSeite />} />
				<Route element={<Rahmen />}>
					<Route index element={<Uebersicht />} />
					<Route path="m/:mappe" element={<Mappenansicht />} />
					<Route path="m/:mappe/:dok" element={<DokumentSeite />} />
					<Route path="papierkorb" element={<Papierkorb />} />
					<Route path="*" element={<NichtGefunden />} />
				</Route>
			</Routes>
		</HinweisAnbieter>
	</BrowserRouter>
);

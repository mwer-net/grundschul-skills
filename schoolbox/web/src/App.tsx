import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { ANMELDE_SEITE } from './api';
import { HinweisAnbieter } from './bausteine/Hinweisleiste';
import { Rahmen } from './bausteine/Rahmen';
import { Anmeldung } from './seiten/Anmeldung';
import { Geteilt } from './seiten/Geteilt';
import { Mappenansicht } from './seiten/Mappenansicht';
import { NichtGefunden } from './seiten/NichtGefunden';
import { Papierkorb } from './seiten/Papierkorb';
import { Uebersicht } from './seiten/Uebersicht';

export const App = () => (
	<BrowserRouter>
		<HinweisAnbieter>
			<Routes>
				<Route path={ANMELDE_SEITE} element={<Anmeldung />} />
				<Route path="/f/:token/*" element={<Geteilt />} />
				<Route element={<Rahmen />}>
					<Route index element={<Uebersicht />} />
					<Route path="m/:mappe/:dok?" element={<Mappenansicht />} />
					<Route path="papierkorb" element={<Papierkorb />} />
					<Route path="*" element={<NichtGefunden />} />
				</Route>
			</Routes>
		</HinweisAnbieter>
	</BrowserRouter>
);

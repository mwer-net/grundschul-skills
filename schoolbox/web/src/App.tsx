import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';

import { ANMELDE_SEITE } from './api';
import { HinweisAnbieter } from './bausteine/Hinweisleiste';
import { Rahmen } from './bausteine/Rahmen';
import { Anmeldung } from './seiten/Anmeldung';
import { Dokumentansicht } from './seiten/Dokumentansicht';
import { Drucken } from './seiten/Drucken';
import { Editor } from './seiten/Editor';
import { Entwuerfe } from './seiten/Entwuerfe';
import { EntwurfGross } from './seiten/EntwurfGross';
import { Geteilt } from './seiten/Geteilt';
import { Hilfe } from './seiten/Hilfe';
import { Mappenansicht } from './seiten/Mappenansicht';
import { NichtGefunden } from './seiten/NichtGefunden';
import { Papierkorb } from './seiten/Papierkorb';
import { Praesentation } from './seiten/Praesentation';
import { Uebersicht } from './seiten/Uebersicht';

/** `key`: Ein anderes Dokument ist eine andere Seite, ohne Reste der vorigen (Ansicht, Fassung, Dialoge). */
const DokumentSeite = () => {
	const { dok = '', mappe = '' } = useParams();
	return <Dokumentansicht key={`${mappe}/${dok}`} zugang={{ mappe, token: null }} dok={dok} zurueckZurMappe />;
};

const EntwuerfeSeite = () => {
	const { dok = '', mappe = '' } = useParams();
	return <Entwuerfe key={`${mappe}/${dok}`} zugang={{ mappe, token: null }} dok={dok} />;
};

const EntwurfSeite = () => {
	const { dok = '', mappe = '', name = '' } = useParams();
	return <EntwurfGross key={`${mappe}/${dok}`} zugang={{ mappe, token: null }} dok={dok} name={name} />;
};

const DruckSeite = () => {
	const { dok = '', mappe = '' } = useParams();
	return <Drucken zugang={{ mappe, token: null }} dok={dok} />;
};

const EditorSeite = () => {
	const { dok = '', mappe = '' } = useParams();
	return <Editor key={`${mappe}/${dok}`} mappe={mappe} dok={dok} />;
};

const PraesentationSeite = () => {
	const { dok = '', mappe = '' } = useParams();
	return <Praesentation key={`${mappe}/${dok}`} zugang={{ mappe, token: null }} dok={dok} />;
};

export const App = () => (
	<BrowserRouter>
		<HinweisAnbieter>
			<Routes>
				<Route path={ANMELDE_SEITE} element={<Anmeldung />} />
				<Route path="/f/:token/*" element={<Geteilt />} />
				<Route path="m/:mappe/:dok/drucken" element={<DruckSeite />} />
				<Route path="m/:mappe/:dok/praesentation" element={<PraesentationSeite />} />
				<Route path="m/:mappe/:dok/bearbeiten" element={<EditorSeite />} />
				<Route element={<Rahmen />}>
					<Route index element={<Uebersicht />} />
					<Route path="m/:mappe" element={<Mappenansicht />} />
					<Route path="m/:mappe/:dok" element={<DokumentSeite />} />
					<Route path="m/:mappe/:dok/entwuerfe" element={<EntwuerfeSeite />} />
					<Route path="m/:mappe/:dok/entwuerfe/:name" element={<EntwurfSeite />} />
					<Route path="papierkorb" element={<Papierkorb />} />
					<Route path="hilfe" element={<Hilfe />} />
					<Route path="*" element={<NichtGefunden />} />
				</Route>
			</Routes>
		</HinweisAnbieter>
	</BrowserRouter>
);

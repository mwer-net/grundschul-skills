import { Anmeldung } from './Anmeldung';
import { ANMELDE_SEITE } from './api';
import { Geteilt } from './Geteilt';
import { Start } from './Start';

const pfad = window.location.pathname;
const teilenToken = /^\/f\/([^/]+)/.exec(pfad)?.[1];

export const App = () => {
	if (pfad === ANMELDE_SEITE) {
		return <Anmeldung />;
	}
	if (teilenToken) {
		return <Geteilt token={teilenToken} />;
	}
	return <Start />;
};

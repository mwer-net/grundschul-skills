/**
 * Was die Prüfmaschine meldet und was trotzdem stimmt, je mit Grund. Schlüssel: `Regel baustein.feld` oder
 * `Regel baustein.feld=Wert`. Die Liste darf nur schrumpfen; verwaiste Einträge schlagen an.
 */
const AM_ANSCHLAG =
	'Am oberen Anschlag passt es nicht auf eine Seite; die Prüfung sagt das und bietet das Verschieben an.';
const WIE_STANDARD = 'Diese Option ist im Starter (Klasse 2) schon der Standardwert, also ändert sich nichts.';
const NUR_MIT_FORM = 'Wirkt erst bei einer Form, die so etwas hat; dieses Dreieck hat das nicht.';
const NUR_MIT_NOTEN = 'Wirkt nur, wenn der erste Takt unvollständig ist; die Starter-Noten füllen ihn.';

const OHNE_KOPF = 'Auf einem Blatt ohne Kopf steht die Nummer der Klasse 4 oben 3 px im Rand; siehe offene Punkte.';

export const BEKANNT: Readonly<Record<string, string>> = {
	'W6 x-gitter.zeilen=max': AM_ANSCHLAG,
	'W6 x-jahreskreis.groesse=max': AM_ANSCHLAG,
	'W6 x-plan.zeilen=max': AM_ANSCHLAG,
	'W6 x-zahlenstrahl.breite=max': AM_ANSCHLAG,
	'W2 x-gitter.kaestchen=1 cm': WIE_STANDARD,
	'W2 x-suchsel.buchstaben=Großbuchstaben': WIE_STANDARD,
	'W6 x-lineatur.zeilen=max': AM_ANSCHLAG,
	'W6 x-schreibrahmen.linien=max': AM_ANSCHLAG,
	'W2 x-satzglieder.vorn=Akkusativobjekt': WIE_STANDARD,
	'W2 x-schreibrahmen.lineatur=Lineatur 2': WIE_STANDARD,
	'W2 x-skala.einheit=cm': WIE_STANDARD,
	'W2 x-timer.skala=60 Minuten': WIE_STANDARD,
	'W2 x-geld.stuecke=umsortieren': 'Der Starter sortiert nach Wert; die Reihenfolge wirkt erst bei „In einer Reihe“.',
	'G4 x-malkreuz': OHNE_KOPF,
	'G4 x-schriftlich': OHNE_KOPF,
	'W2 x-figur.markierung=Parallele Seiten': NUR_MIT_FORM,
	'W2 x-figur.markierung=Gleich lange Seiten': NUR_MIT_FORM,
	'W2 x-figur.loesung=Parallele Seiten': NUR_MIT_FORM,
	'W2 x-figur.loesung=Gleich lange Seiten': NUR_MIT_FORM,
	'W2 x-noten.auftakt=an': NUR_MIT_NOTEN,
	'W2 x-rhythmus.auftakt=an': NUR_MIT_NOTEN,
	'W2 x-schaltplan.teile=umsortieren': 'Der Stromkreis bleibt derselbe, wenn man nur Batterie und Schalter tauscht.',
	'W2 x-spielplan.inhalt=hinzufügen':
		'Der Plan hat so viele Felder wie „Felder“ sagt; weitere Zeilen warten, bis der Plan wächst.',
};

/** Darf nur sinken. Steigt die Zahl, schlägt die Maschine an. */
export const BEKANNT_HOECHSTENS = 23;

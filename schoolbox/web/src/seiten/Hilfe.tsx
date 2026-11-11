import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { KnopfLink } from '../bausteine/Knopf';
import { Kuerzel } from '../bausteine/Kuerzel';
import { Symbol } from '../bausteine/Symbol';
// >> 166
import { Tastenliste } from '../bausteine/Tastenliste';
import { kuerzelText } from '../editor/befehle';
import { kopf } from '../editor/schubladen/reihe';
import { EditorTasten } from '../editor/TastenUebersicht';
// << 166
import { useLaden } from '../lib/laden';
import { useTitel } from '../lib/titel';
import { dokumentSeite, inhaltAdresse } from '../lib/zugang';
// >> 166
import { AblageTasten } from '../ordner/dialoge';
// << 166
import type { MappenEintrag } from '../typen';
import { GESTALTEN } from './hilfe-gestalten';
import type { Abschnitt, Bild } from './hilfe-teile';
import { Punkt } from './hilfe-teile';
// >> 166
import { WEITERE_TASTEN } from './hilfe-tasten';
// << 166

/** Legt `schoolbox kurzanleitung` an; `scripts/ausrollen.sh` hält sie auf dem Stand der Vorlage. */
const KURZANLEITUNG = { mappe: 'schoolbox-hilfe', token: null };
const KURZANLEITUNG_DOK = 'kurzanleitung';

/** Bildschirmfotos aus `pnpm --filter @schoolbox/web run hilfe:bilder`, nur mit Testdaten. */
const BILDER = '/hilfe-bilder';

/**
 * Maße der Fotos (`playwright.hilfe.config.ts`: Desktop Safari, iPad quer, `scale: 'css'`). Ohne sie hat ein Bild bis
 * zum Laden keine Höhe, und ein Sprung aus dem Inhalt landet daneben, sobald die Bilder darüber nachladen.
 */
const MASSE = { Mac: { width: 1280, height: 720 }, iPad: { width: 1080, height: 810 } } as const;

const Foto = ({ alt, datei, geraet }: Bild) => (
	<figure className="flex flex-col gap-2">
		<a href={`${BILDER}/${datei}`} target="_blank" rel="noopener" className="block">
			<img
				src={`${BILDER}/${datei}`}
				alt={alt}
				{...MASSE[geraet]}
				loading="lazy"
				className="w-full rounded-xl border border-rand bg-flaeche shadow-2"
			/>
		</a>
		<figcaption className="text-sm text-leise">{`Am ${geraet}`}</figcaption>
	</figure>
);

const Beispiel = ({ children }: { children: ReactNode }) => (
	<li className="rounded-2xl bg-flaeche px-5 py-3 shadow-2">{children}</li>
);

// >> 166
/** ⌥1 … aus der Leiste, wie sie im Register steht; im Fließtext so groß wie der Text. */
const SchubladenTaste = ({ id }: { id: Parameters<typeof kopf>[0] }) => (
	<Kuerzel text={kuerzelText({ code: kopf(id).taste, wahl: true })} className="text-[length:inherit]" />
);
// << 166

const ABSCHNITTE: Abschnitt[] = [
	{
		id: 'ordnen',
		titel: 'Ordner und Material ordnen',
		inhalt: (
			<>
				<ul>
					<Punkt titel="Anlegen">Rechtsklick auf die Fläche oder einen Ordner, Namen tippen, fertig.</Punkt>
					<Punkt titel="Wählen">
						Ein Klick wählt, ein Doppelklick öffnet. Mit ⇧ oder ⌘ wählst du mehrere, oder du ziehst einen
						Rahmen auf der freien Fläche. Am iPad: „Auswählen“.
					</Punkt>
					<Punkt titel="Bewegen">
						In einen Ordner, den Baum links oder den Pfad oben ziehen. Auch die Ordner im Baum lassen sich
						so ziehen. Mit ⌥ entsteht eine Kopie. Oder ⌘X und ⌘V, oder im Menü „Bewegen nach …“. Am iPad:
						halten, dann ziehen.
					</Punkt>
					<Punkt titel="Rückgängig">⌘Z nimmt jedes Bewegen, Umbenennen und Löschen zurück.</Punkt>
					<Punkt titel="Löschen">
						Gelöschtes bleibt 30 Tage im Papierkorb und kommt von dort an seinen alten Ort zurück.
					</Punkt>
				</ul>
				<p>
					Links sind die Ordner, „Zuletzt geändert“ und der Papierkorb. Leertaste zeigt eine große Vorschau.
				</p>
			</>
		),
		bilder: [],
	},
	{
		id: 'anlegen',
		titel: 'Material anlegen',
		inhalt: (
			<>
				<p>
					Einen Ordner öffnen oder mit „Neuer Ordner“ anlegen, dann „Material anlegen“. Der Assistent fragt
					Schritt für Schritt, links stehen deine Antworten, ein Klick darauf springt zurück. Vorgewählt ist
					die Empfehlung, ⏎ übernimmt sie und geht weiter.
				</p>
				<ul>
					<Punkt titel="Mit Claude">
						Art, Format, Klasse und Fach, Thema und Ziel, Bausteine wie Niveaus oder Selbsteinschätzung und
						was Claude über deine Klasse wissen sollte. Passt keine Antwort, schreibst du unter „Anders …“
						selbst. Am Ende steht der Auftrag, genau so geht er an Claude; „Als Text bearbeiten“ ändert ihn
						von Hand. „Mit Claude erstellen“ legt das Blatt an, und Claude baut den ersten Entwurf. Das
						dauert einige Minuten und verbraucht deutlich mehr als eine Änderung.
					</Punkt>
					<Punkt titel="Leeres Blatt">
						nur Art, Format und Titel, dann baust du selbst mit Bausteinen, Formen und Figuren. „Doch lieber
						leeres Blatt“ wechselt jederzeit dorthin und behält, was du schon gewählt hast.
					</Punkt>
					<Punkt titel="Wiederverwenden">
						ein fertiges Blatt im Ordner duplizieren (⌘D) und die Kopie ändern. Einzelne Teile legst du im ⋯
						mit „In Sammlung legen“ ab; sie stehen dann unter „Meine Bausteine“ in jedem Blatt.
					</Punkt>
				</ul>
				<p>
					Erst der letzte Schritt legt etwas an. Keine Namen von Kindern eintragen. Ein Mini-Book wählst du
					beim Lesetext als Format.
				</p>
				<h3>Bausteine einfügen</h3>
				<ul>
					<Punkt titel="Plus">
						einen Teil des Blatts antippen, dann das Plus an seinem Rand oder „+ Baustein“ in der Leiste.
					</Punkt>
					{/* >> 166 */}
					<Punkt titel="Bausteine">
						{'links in der Schublade „Bausteine“ ('}
						<SchubladenTaste id="bausteine" />
						). Die Suche findet alles. Oben wählst du „Für dieses Blatt“ oder „Alle“. Karte antippen fügt
						ein, am Griff links ziehst du sie ins Blatt.
					</Punkt>
					{/* << 166 */}
					<Punkt titel="Schrägstrich">in einer leeren Zeile „/“ tippen und weiterschreiben.</Punkt>
				</ul>
			</>
		),
		bilder: [
			{ datei: 'anlegen-start-mac.jpg', alt: 'Die erste Frage: mit Claude oder leeres Blatt', geraet: 'Mac' },
			{ datei: 'anlegen-format-mac.jpg', alt: 'Das Format, die Empfehlung ist vorgewählt', geraet: 'Mac' },
			{ datei: 'anlegen-auftrag-mac.jpg', alt: 'Der Auftrag an Claude vor dem Start', geraet: 'Mac' },
		],
	},
	{
		id: 'material',
		titel: 'Material von Claude',
		inhalt: (
			<>
				<p>
					Ein einzelnes Blatt geht am schnellsten mit „Material anlegen“, siehe „Mit Claude arbeiten“. Für
					alles Größere nimmst du die Claude-App:
				</p>
				<ol>
					<li>Öffne die Claude-App auf dem Mac oder iPad und wähle dort die Umgebung „schoolbox“.</li>
					<li>Schreib in deinen Worten, was du brauchst: Fach, Klasse, Thema. Zum Beispiel:</li>
				</ol>
				<ul className="my-3 flex flex-col gap-2 pl-0">
					<Beispiel>
						„Ich brauche ein Arbeitsblatt zur Uhrzeit für Klasse 2, volle und halbe Stunden.“
					</Beispiel>
					<Beispiel>„Mach mir eine kurze Präsentation als Einstieg ins Thema Igel, Klasse 3.“</Beispiel>
					<Beispiel>„Ein Domino zum Einmaleins mit 6 und 7 für Klasse 2.“</Beispiel>
				</ul>
				<ol start={3}>
					<li>
						Claude fragt kurz nach (Format, Niveaus …), zeigt dir Entwürfe und einen Plan der Aufgaben. Ist
						alles fertig, schickt Claude dir einen Link in die Schoolbox.
					</li>
					<li>
						Alles, was Claude für dich gemacht hat, steht hier unter „Mein Material“. Eine Anfrage ist ein
						Ordner; darin liegen das Arbeitsblatt, Karten, die Präsentation …
					</li>
				</ol>
			</>
		),
		bilder: [{ datei: 'uebersicht-mac.jpg', alt: 'Mein Material mit drei Ordnern', geraet: 'Mac' }],
	},
	{
		id: 'entwuerfe',
		titel: 'Entwürfe auswählen',
		inhalt: (
			<ul>
				<li>
					Vor dem fertigen Material schickt Claude einen Link zu zwei oder drei Entwürfen. Dort siehst du sie
					nebeneinander. Tippe einen an, um ihn groß zu sehen.
				</li>
				<li>
					Ausgewählt wird in der Claude-App: Schreib Claude, welcher es werden soll und was anders sein soll,
					etwa „B, aber mit größerer Schrift“.
				</li>
			</ul>
		),
		bilder: [{ datei: 'entwuerfe-mac.jpg', alt: 'Drei Entwürfe nebeneinander', geraet: 'Mac' }],
	},
	{
		id: 'drucken',
		titel: 'Drucken und PDF',
		inhalt: (
			<ul>
				<li>
					Im Dokument speichert „PDF“ das Blatt, auf Wunsch mit Lösung. „Drucken“ unter ⋯ öffnet den
					Druckdialog.
				</li>
				<li>„Lösung“ oben zeigt das Lösungsblatt.</li>
				<li>
					Der Schalter „Farbe | s/w“ zeigt das Blatt in Farbe oder für den Kopierer. Das Material selbst
					bleibt gleich, du musst dich nicht vorher festlegen.
				</li>
				<li>
					Steht ein gelber Kasten über dem Blatt, sind das Druckhinweise, zum Beispiel „auf festes Papier“.
				</li>
				<li>Ein ganzer Ordner auf einmal: Ordner auswählen, dann „Alles als PDF“.</li>
				<li>
					Warnt die Schoolbox vor dem Herunterladen, passt etwas nicht ganz aufs Blatt. Du kannst trotzdem
					drucken oder Claude bitten, es zu reparieren.
				</li>
			</ul>
		),
		bilder: [{ datei: 'dokument-mac.jpg', alt: 'Ein Arbeitsblatt mit den Knöpfen darüber', geraet: 'Mac' }],
	},
	{
		id: 'praesentieren',
		titel: 'Präsentieren',
		inhalt: (
			<>
				<h3>Mit Internet</h3>
				<ul>
					<li>Öffne die Präsentation und tippe auf „Präsentieren“.</li>
					<li>
						Weiter mit Pfeiltaste, Leertaste oder Klicker, am iPad rechts antippen oder nach links wischen.
						Fragezeichen und Timer tippst du an, wenn du so weit bist.
					</li>
				</ul>
				<h3>Ohne Internet</h3>
				<p>Lade die Präsentation vorher herunter, unter ⋯ „Ohne Internet“:</p>
				<ul>
					<Punkt titel="iPad">
						„PDF zum Präsentieren“, in der Dateien-App öffnen. Jeder Schritt ist eine Seite; einfach
						weiterblättern.
					</Punkt>
					<Punkt titel="Mac">
						„Offline-Präsentation“. Die Datei aus den Downloads in Safari öffnen; sie läuft wie in der
						Schoolbox.
					</Punkt>
					<li>„Folien mit Notizen“ ist zum Ausdrucken, als Spickzettel für dich.</li>
				</ul>
			</>
		),
		bilder: [
			{ datei: 'praesentation-ipad.jpg', alt: 'Eine Folie im Präsentationsmodus', geraet: 'iPad' },
			{ datei: 'ohne-internet-ipad.jpg', alt: 'Das Menü „Ohne Internet“', geraet: 'iPad' },
		],
	},
	{
		id: 'bearbeiten',
		titel: 'Bearbeiten',
		inhalt: (
			<>
				<p>„Bearbeiten“ öffnet das Blatt zum Ändern. Alles speichert von selbst.</p>
				<ul>
					<Punkt titel="Text">
						antippen und lostippen. Fett und unterstrichen stehen in der Leiste über dem Text.
					</Punkt>
					<Punkt titel="Umsortieren">
						Aufgaben und Kärtchen im Blatt ziehen (am iPad kurz halten, dann ziehen) oder in der Leiste am
						Baustein „Nach oben“ und „Nach unten“ tippen. Dort lassen sie sich auch verdoppeln und löschen.
					</Punkt>
					<Punkt titel="Ebenen">
						{/* >> 166 */}
						{'die Schublade links ('}
						<SchubladenTaste id="ebenen" />
						{/* << 166 */}
						, früher „Gliederung“) zeigt alle Seiten als Baum: darin die Aufgaben und
						alles, was du im Blatt anklicken kannst, etwa eine Uhr in einem Eintrag. Was du im Blatt wählst,
						ist dort markiert, Klick auf eine Zeile springt zur Stelle und zeigt rechts ihre Einstellungen.
						Am Griff ziehst du, was sich umstellen lässt: Aufgaben innerhalb der Seite oder auf eine andere,
						Einträge innerhalb ihrer Reihe, Seiten untereinander. Auf eine Seitenzeile abgelegt, landet die
						Aufgabe am Ende dieser Seite. Kopf und Fuß bleiben fest. Der Pfeil klappt eine Zeile ein, „Alle
						einklappen“ macht die Liste kurz. Esc bricht das Ziehen ab, ⌘Z nimmt es zurück.
					</Punkt>
					<Punkt titel="Einstellungen">
						rechts im Inspektor: „Auswahl“ für den gewählten Baustein, „Blatt“ für Klasse, Farben, Format
						und den Abstand zwischen den Aufgaben. Die Marke am Regler zeigt die Vorgabe, „Vorgabe“ stellt
						sie wieder her. „Punkte zeigen“ gibt es, sobald das Blatt Bewertungspunkte hat.
					</Punkt>
					<Punkt titel="Listen">
						jeder Eintrag steht in einer Zeile. Am Griff links ziehst du ihn an eine andere Stelle, ⋯ öffnet
						die Art und das Entfernen. Bei langen Listen wie Bingo oder Kreuzworträtsel schreibt „Als Text
						bearbeiten“ alles auf einmal, eine Zeile je Eintrag. Felder, die gerade nichts bewirken, sind
						ausgeblendet; ihr Wert bleibt erhalten.
					</Punkt>
					<Punkt titel="Nur in der Lösung">
						steht etwas nur in der Lösung, sagt es der Inspektor und bringt dich mit „Zur Lösung“ dorthin.
					</Punkt>
					<Punkt titel="Lesehilfen">
						Text antippen, dann im Inspektor unter „Lesehilfen“: Silben als Bögen, in Farbe oder beides,
						Vokale, einzelne Buchstaben, bei Absätzen auch Zeilennummern. Die Regler zeigen, was gerade
						gilt, und schalten es dort wieder aus; der Text bleibt. Ist Text markiert, steht darunter,
						worauf der Klick wirkt. Trennstriche korrigierst du an den Silben unter „Weitere“, „Text“.
					</Punkt>
					<Punkt titel="Übung daraus machen">
						bei Absätzen, Zellen und Listenpunkten: Lücken, Wörter mischen, Buchstaben mischen. Daraus wird
						ein neuer Baustein, Rückgängig holt den Text zurück.
					</Punkt>
					<Punkt titel="Bilder">
						Bild antippen, dann austauschen, eigenes hochladen oder an den Ecken größer und kleiner ziehen.
						Links in der Schublade „Bilder“ (
						{/* >> 166 */}
						<SchubladenTaste id="bilder" />
						{/* << 166 */}
						) stehen deine Fotos, die Bilder dieses Ordners, deiner anderen Ordner und der Sammlung, mit
						Suche und „Foto hochladen“. Ein Klick tauscht das gewählte Bild aus oder füllt den gewählten
						Platzhalter oder Bildrahmen; ist nichts davon gewählt, kommt das Bild als neuer Baustein hinter
						die Auswahl.
					</Punkt>
					<Punkt titel="Lösung">oben auf „Lösung“ wechseln und die Lösungen eintragen.</Punkt>
					<Punkt titel="Rückgängig">
						der Pfeil oben oder ⌘Z, beides tut dasselbe. Der betroffene Baustein ist danach gewählt. Ein
						noch offener Text gilt als ein Schritt und ist mit ⇧⌘Z sofort wieder da. „Versionen“ zeigt
						ältere Stände; jeden kannst du dir ansehen und zurückholen.
					</Punkt>
				</ul>
			</>
		),
		bilder: [
			{ datei: 'editor-mac.jpg', alt: 'Der Editor mit einer gewählten Aufgabe', geraet: 'Mac' },
			{ datei: 'editor-ipad.jpg', alt: 'Der Editor auf dem iPad', geraet: 'iPad' },
		],
	},
	GESTALTEN,
	{
		id: 'schneller',
		titel: 'Schneller arbeiten',
		inhalt: (
			<>
				<ul>
					<Punkt titel="Rechtsklick">auf einen Baustein zeigt alles, was mit ihm geht.</Punkt>
					<Punkt titel="⋯">
						in der Leiste am Baustein und auf jeder Kachel zeigt dasselbe, auch am iPad.
					</Punkt>
					<Punkt titel="Suchen und Befehle">
						⌘K öffnet ein Feld, in dem du jeden Befehl, jeden Ordner und jedes Dokument findest. Du musst
						nur ungefähr wissen, wie es heißt.
					</Punkt>
				</ul>
			</>
		),
		bilder: [{ datei: 'befehle-mac.jpg', alt: 'Das Feld für Befehle im Editor', geraet: 'Mac' }],
	},
	// >> 166
	{
		id: 'tasten',
		titel: 'Tasten',
		inhalt: (
			<>
				<h3>Im Editor</h3>
				<div data-hilfe-tasten="editor">
					<EditorTasten ebene="h4" />
				</div>
				<h3>In der Ablage</h3>
				<div data-hilfe-tasten="ablage">
					<AblageTasten ebene="h4" />
				</div>
				<h3>Beim Schreiben, Präsentieren und Anlegen</h3>
				<div data-hilfe-tasten="weitere">
					<Tastenliste abschnitte={WEITERE_TASTEN} ebene="h4" />
				</div>
			</>
		),
		bilder: [],
	},
	// << 166
	{
		id: 'claude',
		titel: 'Mit Claude arbeiten',
		inhalt: (
			<>
				<h3>Neues Material mit Claude</h3>
				<p>
					„Material anlegen“ in einem Ordner, dann „Mit Claude“, siehe oben. Schneller geht es über das
					Befehlsfeld (⌘K): Thema tippen und „Material anlegen: …“ wählen. Der Assistent beginnt dann bei der
					Art, das Thema steht schon da.
				</p>
				<p>
					Danach öffnet der Editor das leere Blatt. Solange Claude baut, liegt darauf eine Karte mit den
					Schritten, oben im Kopf läuft die Zeit, und das Blatt ist gesperrt. Du kannst den Editor verlassen,
					die Arbeit läuft weiter; in der Übersicht steht an der Kachel „Claude baut …“.
				</p>
				<ul>
					<Punkt titel="Übernehmen">
						oder ⏎: Der Entwurf wird dein Blatt. Rückgängig nimmt ihn wieder zurück.
					</Punkt>
					<Punkt titel="Nachbessern …">
						schreib, was anders sein soll. Claude arbeitet am Entwurf weiter und kennt den ersten Auftrag.
					</Punkt>
					<Punkt titel="Verwerfen">das leere Blatt bleibt im Ordner, du füllst es selbst.</Punkt>
					<Punkt titel="Annahmen">was Claude selbst entschieden hat, zum Aufklappen.</Punkt>
				</ul>
				<p>
					Klappt es nicht, steht der Grund auf dem Blatt, mit „Nochmal“. Ist das Limit erreicht, steht dort
					auch, ab wann es wieder geht.
				</p>
				<h3>Etwas am Blatt ändern</h3>
				<ol>
					<li>
						Einen Teil des Blatts antippen, dann „Claude“ in seiner Leiste oder ⌘J. Ohne Auswahl nimmt ⌘J
						die Seite. Die Blase hängt direkt unter dem Teil.
					</li>
					<li>
						Oben in der Blase steht, worauf sich dein Auftrag bezieht. Ein Tipp darauf wählt eine Stufe
						darüber: die ganze Aufgabe, die Seite oder, bei mehreren Seiten, das ganze Material.
					</li>
					<li>Schreiben, Enter. Die Blase zeigt, wie lange Claude schon arbeitet.</li>
					<li>
						Am Ende steht der Vorschlag gestrichelt im Blatt, in der Blase „Vorher“ und „Nachher“.
						„Übernehmen“ oder Enter ändert das Blatt, Rückgängig nimmt es zurück. „Groß vergleichen“ zeigt
						beide Fassungen nebeneinander. Schreibst du stattdessen weiter, bessert Claude den Vorschlag
						nach.
					</li>
				</ol>
				<h3>Ein Gespräch</h3>
				<p>
					Claude merkt sich, worüber ihr gesprochen habt, und du kannst einfach antworten, auch mit „Ja, mach
					das“ oder „das zweite“. Ist dein Wunsch offen, fragt Claude kurz zurück, sonst macht es und nennt
					seine Annahme. Weitere Nachrichten bauen auf dem offenen Vorschlag auf: „Noch etwas größer“ meint
					das, was gerade dort steht.
				</p>
				<p>
					„—“ oder Esc klappen die Blase ein, das Gespräch läuft weiter. × beendet es, ohne Nachfrage: Der
					Verlauf ist weg, und Claude fängt beim nächsten Mal von vorn an. Das gilt auch für „Neu beginnen“
					unter ⋯, für ein anderes Dokument, für Neuladen und wenn du den Teil löschst. Ein offener Vorschlag
					bleibt dabei stehen. Ein langes Gespräch verbraucht mit jeder Nachricht mehr; dann schlägt die Blase
					„Neu beginnen“ vor.
				</p>
				<h3>Mehrere Teile gleichzeitig</h3>
				<p>
					Eingeklappt wird die Blase zu einer Pille am Teil: „Claude arbeitet …“ mit der Zeit, „Vorschlag
					bereit“, „Claude fragt“ oder „Claude hat geantwortet“. Ein Tipp darauf öffnet sie wieder. Wählst du
					einen anderen Teil, klappt die offene Blase von selbst ein, und du kannst dort ein weiteres Gespräch
					beginnen. Arbeitet Claude noch am ersten, wartet dein Auftrag und startet direkt danach. Bis zu fünf
					Gespräche gehen gleichzeitig.
				</p>
				<p>
					In den Ebenen steht ✦ an jedem Teil, an dem Claude arbeitet oder ein Vorschlag wartet. Unten in der
					Leiste steht, was eingeklappte Gespräche tun; ein Tipp darauf rollt hin und öffnet die Blase.
				</p>
				<h3>Wenn es keinen passenden Baustein gibt</h3>
				<p>
					Dann baut Claude ein eigenes, freies Element ins Blatt, etwa ein Tangram in Form eines Waschbärs. Es
					läuft wie jeder Vorschlag über „Übernehmen“, und du kannst es verschieben, kopieren und löschen.
					Einstellungen hat es keine. Wähle es aus und tippe auf „Claude“, dann änderst du es in der Blase.
				</p>
				<p>
					Material lässt sich drucken, aber nicht anklicken: Skripte, Klick-Ereignisse und Adressen von außen
					baut Claude nicht ein. Rutscht so etwas doch in einen Lauf, entsteht kein Vorschlag, in der Blase
					steht der Grund, und dein Blatt bleibt, wie es ist.
				</p>
				<h3>Unterrichtseinheit mit Claude</h3>
				<p>
					Unter „Material anlegen“, „Mit Claude“ gibt es als Materialart „Unterrichtseinheit“: einen neuen
					Ordner mit mehreren Materialien zu einem Thema. Du nennst das Thema, alles andere ist vorgewählt und
					mit ⏎ übernommen: Dauer, Bestandteile, Rahmengeschichte, Leitfigur, Aussehen und neue Bilder aus
					Canva.
				</p>
				<p>
					Eine Einheit dauert etwa 10 bis 30 Minuten und verbraucht viel von deinem Limit; vor dem Start
					steht, wie viel schon verbraucht ist. Der neue Ordner öffnet sofort. Oben zeigt ein Band, wie weit
					Claude ist, jedes fertige Material kannst du gleich öffnen. Im Kopf jeder Seite steht „Einheit: 3
					von 12“, ein Tipp darauf führt zum Ordner. Es läuft immer nur eine Einheit.
				</p>
				<p>
					„Abbrechen“ hält an, alles Fertige bleibt. Dann, oder wenn das Limit erreicht ist, steht im Band
					„Weiterbauen“: Claude baut nur, was noch fehlt. „Verwerfen“ legt den ganzen Ordner in den
					Papierkorb, von dort holst du ihn zurück.
				</p>
				<h3>Was weiter die Claude-App braucht</h3>
				<p>
					Neue Bilder für ein einzelnes Blatt und Reihen, die du im Gespräch planen willst. Für einen
					bestimmten Teil in der Blase unter ⋯ „In der Claude-App weiterarbeiten“, in der App einfügen und den
					Wunsch dahinterschreiben. Die zwei eingefügten Zeilen gehören so; die zweite ist für Claude.
				</p>
				<h3>Verbrauch</h3>
				<p>
					Alles zählt für das Limit deines Claude-Kontos, zusammen mit der Claude-App. Eine Änderung braucht
					wenig, neues Material deutlich mehr und einige Minuten. Wird es knapp, steht das in der Blase. Hast
					du Guthaben gekauft, arbeitet Claude am erreichten Limit darüber weiter, das ist echtes Geld. Auch
					das steht dann in der Blase.
				</p>
			</>
		),
		bilder: [
			{ datei: 'blase-mac.jpg', alt: 'Die Blase unter einer Aufgabe', geraet: 'Mac' },
			{
				datei: 'blase-vorschlag-mac.jpg',
				alt: 'Ein Vorschlag gestrichelt im Blatt, in der Blase Vorher und Nachher',
				geraet: 'Mac',
			},
			{ datei: 'entwurf-mac.jpg', alt: 'Der Entwurf von Claude mit der Leiste über dem Blatt', geraet: 'Mac' },
			{
				datei: 'einheit-mac.jpg',
				alt: 'Ein Ordner, in dem Claude eine Einheit baut: oben das Band, darunter ein fertiges Material',
				geraet: 'Mac',
			},
		],
	},
	{
		id: 'teilen',
		titel: 'Teilen mit Kolleginnen',
		inhalt: (
			<ul>
				<li>Ordner oder Dokument auswählen, „Teilen“, dann „Link erstellen“ und „Link kopieren“.</li>
				<li>
					Wer den Link hat, kann ansehen, präsentieren und das PDF herunterladen. Ändern kann sie nichts, und
					deine anderen Ordner sieht sie nicht. Legst du etwas in den geteilten Ordner, sieht sie es auch;
					nimmst du es heraus, ist es für sie weg.
				</li>
				<li>Im selben Fenster schaltest du den Link wieder ab.</li>
			</ul>
		),
		bilder: [{ datei: 'teilen-mac.jpg', alt: 'Das Fenster zum Teilen', geraet: 'Mac' }],
	},
	{
		id: 'probleme',
		titel: 'Wenn etwas nicht klappt',
		inhalt: (
			<ul>
				<li>Sag Claude Bescheid, ganz normal in Worten. Am Material kann Claude fast alles reparieren.</li>
				<li>
					Fehlt dir etwas in der Schoolbox, oder stört dich etwas immer wieder: „Notier das bitte als Wunsch.“
					Claude schreibt es für die Weiterentwicklung auf.
				</li>
				<li>Aus Versehen gelöscht? Im Papierkorb oben bleibt alles 30 Tage.</li>
				<li>Keine Namen von Kindern in Materialien oder an Claude; Claude schlägt dann Fantasienamen vor.</li>
			</ul>
		),
		bilder: [],
	},
];

const Kurzanleitung = () => {
	const { daten } = useLaden<MappenEintrag>(inhaltAdresse(KURZANLEITUNG));
	if (!daten?.dokumente.some((d) => d.id === KURZANLEITUNG_DOK)) {
		return null;
	}
	return (
		<div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl bg-flaeche px-6 py-4 shadow-2">
			<Symbol name="drucker" className="size-8 flex-none text-brand-500" />
			<p className="min-w-0 flex-1">
				<strong>Kurzanleitung zum Ausdrucken</strong>
				<br />
				Alles Wichtige auf einer Seite, für neben den Laptop.
			</p>
			<KnopfLink to={dokumentSeite(KURZANLEITUNG, KURZANLEITUNG_DOK)}>Kurzanleitung öffnen</KnopfLink>
		</div>
	);
};

/** Hilfeseite für die Lehrkraft: kurz, in ihren Worten, mit Bildschirmfotos von Mac und iPad. */
export const Hilfe = () => {
	useTitel('Hilfe');
	const { hash } = useLocation();
	useEffect(() => {
		if (hash) {
			document.getElementById(hash.slice(1))?.scrollIntoView();
		}
	}, [hash]);
	return (
		<div className="mx-auto max-w-5xl">
			<h1 className="text-3xl max-md:text-2xl">Hilfe</h1>
			<p className="mt-1 text-lg text-leise">So kommst du selbst oder mit Claude zum fertigen Material.</p>
			<Kurzanleitung />
			<nav aria-label="Inhalt" className="mt-6 flex flex-wrap gap-2">
				{ABSCHNITTE.map(({ id, titel }) => (
					<a
						key={id}
						href={`#${id}`}
						className="inline-flex h-knopf items-center rounded-lg border border-rand bg-flaeche px-4 font-medium text-tinte no-underline hover:border-brand-200 hover:bg-flaeche-2"
					>
						{titel}
					</a>
				))}
			</nav>
			{ABSCHNITTE.map(({ bilder, id, inhalt, titel }) => (
				<section key={id} id={id} className="mt-12 scroll-mt-28" data-abschnitt={id}>
					<h2 className="text-2xl">{titel}</h2>
					<div className="hilfe-text mt-3 text-lg">{inhalt}</div>
					{bilder.length > 0 && (
						<div className={bilder.length > 1 ? 'mt-5 grid grid-cols-2 gap-6 max-md:grid-cols-1' : 'mt-5'}>
							{bilder.map((bild) => (
								<Foto key={bild.datei} {...bild} />
							))}
						</div>
					)}
				</section>
			))}
		</div>
	);
};

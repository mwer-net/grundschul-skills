import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { Karte } from '../bausteine/Karte';
import { KnopfLink } from '../bausteine/Knopf';
import { Kuerzel } from '../bausteine/Kuerzel';
import { Symbol } from '../bausteine/Symbol';
import { Tastenliste } from '../bausteine/Tastenliste';
import { kuerzelText } from '../editor/befehle';
import { kopf } from '../editor/schubladen/reihe';
import { EditorTasten } from '../editor/TastenUebersicht';
import { useLaden } from '../lib/laden';
import { useTitel } from '../lib/titel';
import { dokumentSeite, inhaltAdresse } from '../lib/zugang';
import { AblageTasten } from '../ordner/dialoge';
import type { MappenEintrag } from '../typen';
import { GESTALTEN } from './hilfe-gestalten';
import { befehlName } from './hilfe-namen';
import { WEITERE_TASTEN } from './hilfe-tasten';
import type { Abschnitt, Bild } from './hilfe-teile';
import { BefehlTaste, Punkt } from './hilfe-teile';

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

/** Karten im Seitenfluss tragen Rand statt Schatten; den Schatten haben nur Menüs und Dialoge (187-20). */
const Beispiel = ({ children }: { children: ReactNode }) => (
	<li>
		<Karte className="px-5 py-3">{children}</Karte>
	</li>
);

/** Tasten in der Hilfe so groß wie der Text daneben (187-19). */
const TASTE_IM_TEXT = 'text-[length:inherit]';

/** ⌥1 … aus der Leiste, wie sie im Register steht; im Fließtext so groß wie der Text. */
const SchubladenTaste = ({ id }: { id: Parameters<typeof kopf>[0] }) => (
	<Kuerzel text={kuerzelText({ code: kopf(id).taste, wahl: true })} className="text-[length:inherit]" />
);

const ABSCHNITTE: Abschnitt[] = [
	{
		id: 'ordnen',
		titel: 'Ordner und Material ordnen',
		inhalt: (
			<>
				<ul>
					<Punkt titel="Anlegen">„Neuer Ordner“ oben oder im Rechtsklick, Namen tippen, fertig.</Punkt>
					<Punkt titel="Wählen">
						Ein Klick wählt, ein Doppelklick öffnet. Mit ⇧ oder ⌘ wählst du mehrere, oder du ziehst einen
						Rahmen auf der freien Fläche. Am iPad: „Auswählen“.
					</Punkt>
					<Punkt titel="Bewegen">
						In einen Ordner, den Baum links oder den Pfad oben ziehen, mit ⌥ entsteht eine Kopie. Oder ⌘X
						und ⌘V, oder im Menü „Bewegen nach …“. Am iPad: halten, dann ziehen.
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
					In einem Ordner „Material anlegen“, oben oder im Rechtsklick. Der Assistent fragt Schritt für
					Schritt, links stehen deine Antworten, ein Klick darauf springt zurück. Vorgewählt ist die
					Empfehlung, ⏎ übernimmt sie. Klasse und Fach kommen aus dem Ordner, seinem Namen oder wie beim
					letzten Mal; daneben steht, woher. Findet sich nichts, wählst du sie selbst.
				</p>
				<ul>
					<Punkt titel="Mit Claude">
						Art, Format, für wen, Thema und Ziel, Bausteine wie Niveaus und was Claude über deine Klasse
						wissen sollte. Passt keine Antwort, schreibst du unter „Anders …“ selbst. „Aufgabenplan holen“
						legt das Blatt an, und Claude zeigt zuerst den Plan der Aufgaben: „So bauen“ startet den Bau,
						„Ändern …“ sagt Claude, was am Plan anders sein soll. „Verwerfen“ legt das Blatt in den
						Papierkorb, „Rückgängig“ holt es mit dem Plan zurück. Das Bauen dauert einige Minuten und
						verbraucht deutlich mehr als eine Änderung.
					</Punkt>
					<Punkt titel="Leeres Blatt">
						nur Art, Format und Titel, dann baust du selbst. „Doch lieber leeres Blatt“ wechselt jederzeit
						dorthin und behält, was du schon gewählt hast.
					</Punkt>
					<Punkt titel="Unterbrechen">
						Esc schließt den Assistenten, deine Antworten bleiben: „Weiter ausfüllen“ macht dort weiter,
						„Von vorn beginnen“ fängt neu an.
					</Punkt>
					<Punkt titel="Wiederverwenden">
						{
							'ein fertiges Blatt duplizieren (⌘D) und die Kopie ändern. Einen einzelnen Baustein legst du mit '
						}
						{befehlName('auswahl.in-sammlung')}
						{
							' im ⋯ ab; er steht dann unter „Meine Bausteine“ in jedem Blatt, mit Vorschau. Dort benennst du ihn um oder löschst ihn, „Rückgängig“ holt ihn zurück.'
						}
					</Punkt>
				</ul>
				<p>Keine Namen von Kindern eintragen. Ein Mini-Book wählst du beim Lesetext als Format.</p>
				<h3>Bausteine einfügen</h3>
				<ul>
					<Punkt titel="Zwischen zwei Bausteinen">
						mit der Maus in die Lücke, dann „+ Baustein“. Es öffnet die Schnellauswahl: tippen, mit ↑ ↓
						wählen, ⏎ fügt ein. Auf einer leeren Seite steht „Ersten Baustein einfügen“. Mit gewähltem
						Baustein geht es über
						{` ${befehlName('auswahl.einfuegen-danach')} im ⋯ oder „/“.`}
					</Punkt>
					<Punkt titel="Schublade">
						„Bausteine“ links (
						<SchubladenTaste id="bausteine" />
						), mit Suche und oben „Für dieses Blatt“ oder „Alle“. Antippen fügt hinter der Auswahl ein,
						gezogen landet der Baustein, wo du loslässt.
					</Punkt>
					<Punkt titel="Schrägstrich">in einer leeren Zeile „/“ tippen und weiterschreiben.</Punkt>
				</ul>
			</>
		),
		bilder: [
			{ datei: 'anlegen-start-mac.jpg', alt: 'Die erste Frage: mit Claude oder leeres Blatt', geraet: 'Mac' },
			{
				datei: 'anlegen-fuer-wen-mac.jpg',
				alt: 'Für wen: Die Klasse legt der Ordner fest, das Fach ist vorgewählt',
				geraet: 'Mac',
			},
			{ datei: 'anlegen-plan-mac.jpg', alt: 'Der Aufgabenplan von Claude vor dem Bauen', geraet: 'Mac' },
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
						Claude fragt kurz nach, zeigt dir Entwürfe und einen Plan der Aufgaben. Ist alles fertig,
						schickt Claude dir einen Link in die Schoolbox.
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
					nebeneinander; einer angetippt zeigt ihn groß.
				</li>
				<li>
					„Diesen Entwurf nehmen“ macht ihn zum Material. Danach steht an den anderen „Stattdessen diesen
					nehmen“.
				</li>
				<li>
					Soll noch etwas anders werden, schreib es Claude in der Claude-App, etwa „B, aber mit größerer
					Schrift“.
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
					Im geöffneten Material lädt das Menü „PDF“ das Arbeitsblatt, die Lösung oder beides. Gedruckt wird
					aus dem PDF, am iPad über „Teilen“ und „Drucken“.
				</li>
				<li>„Lösung“ oben zeigt das Lösungsblatt.</li>
				<li>
					Der Schalter „Farbe | s/w“ zeigt das Blatt in Farbe oder für den Kopierer. Das Material selbst
					bleibt gleich, du musst dich nicht vorher festlegen.
				</li>
				<li>Ein gelber Kasten über dem Blatt sind Druckhinweise, zum Beispiel „auf festes Papier“.</li>
				<li>Ein ganzer Ordner auf einmal: Ordner auswählen, dann „PDF“.</li>
				<li>
					Passt vor dem Herunterladen etwas nicht ganz aufs Blatt, sagt es die Schoolbox. Du lädst trotzdem
					herunter, oder „Claude bitten, es zu reparieren“ öffnet das Blatt im Editor, die Bitte steht schon
					in der Blase.
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
					<li>Öffne die Präsentation und tippe auf „Präsentieren“. Sie startet sofort im Vollbild.</li>
					<li>
						Weiter mit Pfeiltaste, Leertaste oder Klicker, am iPad rechts antippen oder nach links wischen.
						Esc beendet.
					</li>
					<li>
						Abstimmen: Ein Klick auf eine Antwort setzt einen Strich, je fünf werden ein Bündel. Rechtsklick
						oder langes Drücken nimmt einen Strich weg.
					</li>
					<li>
						Timer: antippen startet und hält an, langes Drücken stellt ihn zurück. Kommst du später auf die
						Folie zurück, beginnt ein angehaltener Timer von vorn.
					</li>
				</ul>
				<h3>Ohne Internet</h3>
				<p>
					Lade die Präsentation vorher unter „PDF“ herunter; dort steht, welche Datei für iPad und Mac ist. In
					der Datei für den Mac beendet Esc die Präsentation mit einem Druck. „Folien mit Notizen“ ist zum
					Ausdrucken, als Spickzettel für dich.
				</p>
			</>
		),
		bilder: [
			{
				datei: 'praesentation-ipad.jpg',
				alt: 'Eine Folie im Präsentationsmodus, abgestimmt mit Strichen',
				geraet: 'iPad',
			},
			{ datei: 'ohne-internet-ipad.jpg', alt: 'Das Menü „PDF“ einer Präsentation', geraet: 'iPad' },
		],
	},
	{
		id: 'bearbeiten',
		titel: 'Bearbeiten',
		inhalt: (
			<>
				<p>
					„Bearbeiten“ öffnet das Blatt zum Ändern. Alles speichert von selbst (
					<BefehlTaste id="dokument.speichern" />
					{
						' speichert sofort); beim Verlassen speichert der Editor den Rest, und nur wenn das nicht klappt, fragt er nach.'
					}
				</p>
				<ul>
					<Punkt titel="Wählen">
						Fährst du mit der Maus über das Blatt, zeigen ein Rahmen und ein Name, was ein Klick wählen
						würde. Über dem gewählten Baustein steht eine Leiste mit Claude, „Nach oben“, „Nach unten“,
						Duplizieren, Löschen und ⋯; das ⋯ ist dasselbe Menü wie der Rechtsklick.
					</Punkt>
					<Punkt titel="Text">
						antippen und lostippen. Fett und unterstrichen stehen in der Leiste über dem Text.
					</Punkt>
					<Punkt titel="Umsortieren">
						Aufgaben und Kärtchen im Blatt ziehen (am iPad kurz halten, dann ziehen) oder „Nach oben“ und
						„Nach unten“ in der Leiste.
					</Punkt>
					<Punkt titel="Seiten">
						{
							'Passt eine Aufgabe nicht mehr auf die Seite, rutscht sie von selbst auf die nächste; was passt, bleibt, wo es ist. Soll eine Seite früher enden, nimm '
						}
						{befehlName('seite.ab-hier')}
						{' im ⋯ des Bausteins; '}
						{befehlName('seite.anschliessen')}
						{' nimmt das zurück.'}
					</Punkt>
					<Punkt titel="Ebenen">
						die Schublade links (
						<SchubladenTaste id="ebenen" />
						{') zeigt alle Seiten als Baum mit allem, was du im Blatt anklicken kannst. '}
						Ein Klick auf eine Zeile springt zur Stelle. Zeilen ziehst du an einen anderen Platz, Aufgaben
						auch auf eine andere Seite. Namenszeile, Kopf und Selbsteinschätzung bleiben an ihrem Platz und
						sind grau. Oben klappt „Alle aufklappen“ jede Zeile auf, danach macht „Alle einklappen“ die
						Liste wieder kurz.
					</Punkt>
					<Punkt titel="Einstellungen">
						rechts im Inspektor: „Auswahl“ für das Gewählte, „Blatt“ für Klasse, Farben, Format, den Abstand
						zwischen den Aufgaben und die Gestaltung der Seite. „Vorgabe“ stellt einen Wert zurück.
					</Punkt>
					<Punkt titel="Listen">
						jeder Eintrag steht in einer Zeile, ⋯ öffnet Art und Entfernen. Beim Ankreuzen setzt du den
						Haken an jeder richtigen Antwort, bei Richtig oder falsch je Aussage den Schalter „Richtig“. Bei
						langen Listen wie Bingo schreibt „Als Text bearbeiten“ alles auf einmal, eine Zeile je Eintrag.
					</Punkt>
					<Punkt titel="Nur in der Lösung">
						was nur in der Lösung steht, zeigen die Ebenen im Arbeitsblatt als graue Zeile. Wählst du sie,
						bringt dich „Zur Lösung“ im Inspektor dorthin.
					</Punkt>
					<Punkt titel="Lesehilfen">
						Text antippen, dann im Inspektor unter „Lesehilfen“: Silben als Bögen oder in Farbe, Vokale,
						einzelne Buchstaben, bei Absätzen auch Zeilennummern. Derselbe Regler schaltet es wieder aus.
					</Punkt>
					<Punkt titel="Übung daraus machen">
						bei Absätzen, Zellen und Listenpunkten: Lücken, Wörter mischen, Buchstaben mischen. Rückgängig
						holt den Text zurück.
					</Punkt>
					<Punkt titel="Bilder">
						in der Schublade „Bilder“ (
						<SchubladenTaste id="bilder" />
						), siehe „Gestalten“.
					</Punkt>
					<Punkt titel="Zahlen">
						eine Zahl über dem Zahlenraum der Klasse wird gezeichnet, unten steht dann etwa „1 Ding prüfen“;
						das PDF geht trotzdem. Passt eine Zahl nicht aufs Blatt, setzt der Inspektor die größte, die
						passt, und sagt, warum.
					</Punkt>
					<Punkt titel="Lösung">oben auf „Lösung“ wechseln und die Lösungen eintragen.</Punkt>
					<Punkt titel="Rückgängig">
						der Pfeil oben oder ⌘Z, ⇧⌘Z wiederholt. „Versionen“ zeigt ältere Stände; jeden kannst du dir
						ansehen und zurückholen.
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
			<ul>
				<Punkt titel="Rechtsklick">
					auf einen Baustein, ein Element oder eine Kachel zeigt alles, was damit geht.
				</Punkt>
				<Punkt titel="⋯">in der Leiste und auf jeder Kachel zeigt dasselbe, auch am iPad.</Punkt>
				<Punkt titel="Befehle">
					{'„Befehle“ unten oder '}
					<BefehlTaste id="ansicht.palette" />
					{
						' öffnet ein Feld, in dem du jeden Befehl, jeden Baustein und jedes Material findest; im Editor stehen die anderen Materialien unter „Andere Materialien“. Ungefähr der Name reicht. Ist in der Ablage etwas gewählt, steht oben „Auswahl: …“ mit allem, was der Rechtsklick kann.'
					}
				</Punkt>
			</ul>
		),
		bilder: [{ datei: 'befehle-mac.jpg', alt: 'Das Feld für Befehle im Editor', geraet: 'Mac' }],
	},
	{
		id: 'tasten',
		titel: 'Tasten',
		inhalt: (
			<>
				<h3>Im Editor</h3>
				<div className="max-w-[48rem]" data-hilfe-tasten="editor">
					<EditorTasten ebene="h4" tastenKlasse={TASTE_IM_TEXT} />
				</div>
				<h3>In der Ablage</h3>
				<div className="max-w-[48rem]" data-hilfe-tasten="ablage">
					<AblageTasten ebene="h4" tastenKlasse={TASTE_IM_TEXT} />
				</div>
				<h3>Beim Schreiben, Präsentieren und Anlegen</h3>
				<div className="max-w-[48rem]" data-hilfe-tasten="weitere">
					<Tastenliste abschnitte={WEITERE_TASTEN} ebene="h4" tastenKlasse={TASTE_IM_TEXT} />
				</div>
			</>
		),
		bilder: [],
	},
	{
		id: 'claude',
		titel: 'Mit Claude arbeiten',
		inhalt: (
			<>
				<h3>Neues Material mit Claude</h3>
				<p>
					„Material anlegen“ in einem Ordner, dann „Mit Claude“, siehe oben. Schneller geht es über „Befehle“:
					Thema tippen und „Material anlegen: …“ wählen, der Assistent beginnt dann mit dem Thema.
				</p>
				<p>
					Danach öffnet der Editor das neue Blatt mit dem Aufgabenplan. Solange Claude baut, liegt darauf eine
					Karte mit den Schritten, und das Blatt ist gesperrt. Du kannst den Editor verlassen, die Arbeit
					läuft weiter.
				</p>
				<ul>
					<Punkt titel="Übernehmen">
						oder ⏎: Der Vorschlag wird dein Blatt. Rückgängig nimmt ihn zurück.
					</Punkt>
					<Punkt titel="Nachbessern …">
						schreib, was anders sein soll. Claude bessert den Vorschlag nach und kennt den ersten Auftrag.
					</Punkt>
					<Punkt titel="Verwerfen">das leere Blatt bleibt im Ordner, du füllst es selbst.</Punkt>
					<Punkt titel="Annahmen">was Claude selbst entschieden hat, zum Aufklappen.</Punkt>
				</ul>
				<p>
					Klappt es nicht, steht der Grund auf dem Blatt, mit „Nochmal“, am Limit auch, ab wann es wieder
					geht.
				</p>
				<h3>Etwas am Blatt ändern</h3>
				<ol>
					<li>
						{'Einen Teil des Blatts wählen, dann „Claude“ in seiner Leiste oder '}
						<BefehlTaste id="auswahl.claude" />
						{'. Ohne Auswahl gilt es der Seite. '}
						Claude ändert immer ein Element; für mehrere wählst du die Seite.
					</li>
					<li>
						Oben in der Blase steht, worauf sich dein Auftrag bezieht. Ein Tipp darauf wählt eine Stufe
						darüber: die ganze Aufgabe, die Seite oder das ganze Material.
					</li>
					<li>
						Schreiben, Enter. Die Blase zeigt, wie lange Claude schon arbeitet. Lädst du die Seite neu,
						steht deine Bitte wieder darin.
					</li>
					<li>
						Am Ende steht der Vorschlag gestrichelt im Blatt, in der Blase „Vorher“ und „Nachher“.
						„Übernehmen“ oder Enter ändert das Blatt, Rückgängig nimmt es zurück. Schreibst du stattdessen
						weiter, bessert Claude den Vorschlag nach.
					</li>
				</ol>
				<h3>Ein Gespräch</h3>
				<p>
					Claude merkt sich, worüber ihr gesprochen habt; du kannst einfach antworten, auch mit „Ja, mach
					das“. Ist dein Wunsch offen, fragt Claude kurz zurück, sonst macht es und nennt seine Annahme.
				</p>
				<p>
					× „Schließen“, Esc oder ein Klick daneben schließen die Blase. Arbeitet Claude noch, fragt es oder
					wartet ein Vorschlag, bleibt am Teil eine Pille wie „Vorschlag bereit“; ein Tipp darauf öffnet die
					Blase wieder. Sonst ist das Gespräch vorbei. „Neu beginnen“ unter ⋯ fängt sofort neu an. So laufen
					auch mehrere Gespräche an verschiedenen Teilen.
				</p>
				<h3>Wenn es keinen passenden Baustein gibt</h3>
				<p>
					Dann baut Claude ein eigenes Element ins Blatt, etwa ein Tangram in Form eines Waschbärs. Du
					verschiebst, kopierst und löschst es; ändern geht über „Claude“. Skripte und Adressen von außen baut
					Claude nicht ein.
				</p>
				<h3>Unterrichtseinheit mit Claude</h3>
				<p>
					Unter „Material anlegen“, „Mit Claude“ gibt es als Materialart „Unterrichtseinheit“: einen neuen
					Ordner mit mehreren Materialien zu einem Thema. Du nennst das Thema, alles andere ist vorgewählt.
				</p>
				<p>
					Der neue Ordner öffnet sofort, oben zeigt ein Band zuerst den Plan der Einheit. Gibst du ihn frei,
					baut Claude etwa ein bis drei Stunden; das verbraucht viel von deinem Limit. Jedes fertige Material
					kannst du gleich öffnen, in seinem Kopf steht „Einheit: 3 von 12“. Es läuft immer nur eine Einheit.
					„Abbrechen“ hält an, alles Fertige bleibt, „Weiterbauen“ baut nur, was fehlt. „Verwerfen“ legt den
					Ordner in den Papierkorb.
				</p>
				<h3>Was weiter die Claude-App braucht</h3>
				<p>
					Reihen, die du im Gespräch planen willst. Für einen bestimmten Teil in der Blase unter ⋯ „In der
					Claude-App weiterarbeiten“, in der App einfügen und den Wunsch dahinterschreiben.
				</p>
				<h3>Verbrauch</h3>
				<p>
					Alles zählt für das Limit deines Claude-Kontos, zusammen mit der Claude-App. Eine Änderung braucht
					wenig, ein neues Bild etwas mehr, neues Material deutlich mehr. Wird es knapp oder arbeitet Claude
					mit gekauftem Guthaben weiter, steht das in der Blase.
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
			{ datei: 'entwurf-mac.jpg', alt: 'Der Vorschlag von Claude mit der Leiste über dem Blatt', geraet: 'Mac' },
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
				<li>Ordner oder Material auswählen, „Teilen“, dann „Link erstellen“ und „Link kopieren“.</li>
				<li>
					Wer den Link hat, kann ansehen, präsentieren und das PDF herunterladen. Ändern kann sie nichts, und
					deine anderen Ordner sieht sie nicht. Was du in den geteilten Ordner legst, sieht sie auch.
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
					Fehlt dir etwas oder stört dich etwas immer wieder: „Notier das bitte als Wunsch.“ Claude schreibt
					es für die Weiterentwicklung auf.
				</li>
				<li>Aus Versehen gelöscht? Im Papierkorb links unten bleibt alles 30 Tage.</li>
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
		<Karte className="mt-6 flex flex-wrap items-center gap-4 px-6 py-4">
			<Symbol name="drucker" className="size-8 flex-none text-brand-500" />
			<p className="min-w-0 flex-1">
				<strong>Kurzanleitung zum Ausdrucken</strong>
				<br />
				Alles Wichtige auf einer Seite, für neben den Laptop.
			</p>
			<KnopfLink to={dokumentSeite(KURZANLEITUNG, KURZANLEITUNG_DOK)}>Kurzanleitung öffnen</KnopfLink>
		</Karte>
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
				<section key={id} id={id} className="mt-12 scroll-mt-14" data-abschnitt={id}>
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

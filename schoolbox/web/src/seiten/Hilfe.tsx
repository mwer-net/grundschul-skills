import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { KnopfLink } from '../bausteine/Knopf';
import { Kuerzel } from '../bausteine/Kuerzel';
import { Symbol } from '../bausteine/Symbol';
import { BEFEHLE, kuerzelText } from '../editor/befehle';
import { useLaden } from '../lib/laden';
import { useTitel } from '../lib/titel';
import { dokumentSeite, inhaltAdresse } from '../lib/zugang';
import type { MappenEintrag } from '../typen';

/** Legt `schoolbox kurzanleitung` an; `scripts/ausrollen.sh` hält sie auf dem Stand der Vorlage. */
const KURZANLEITUNG = { mappe: 'schoolbox-hilfe', token: null };
const KURZANLEITUNG_DOK = 'kurzanleitung';

/** Bildschirmfotos aus `pnpm --filter @schoolbox/web run hilfe:bilder`, nur mit Testdaten. */
const BILDER = '/hilfe-bilder';

interface Bild {
	datei: string;
	alt: string;
	geraet: 'Mac' | 'iPad';
}

const Foto = ({ alt, datei, geraet }: Bild) => (
	<figure className="flex flex-col gap-2">
		<a href={`${BILDER}/${datei}`} target="_blank" rel="noopener" className="block">
			<img
				src={`${BILDER}/${datei}`}
				alt={alt}
				loading="lazy"
				className="w-full rounded-xl border border-rand bg-flaeche shadow-2"
			/>
		</a>
		<figcaption className="text-sm text-leise">{`Am ${geraet}`}</figcaption>
	</figure>
);

const Punkt = ({ children, titel }: { titel: string; children: ReactNode }) => (
	<li>
		<strong>{`${titel}: `}</strong>
		{children}
	</li>
);

const Beispiel = ({ children }: { children: ReactNode }) => (
	<li className="rounded-2xl bg-flaeche px-5 py-3 shadow-2">{children}</li>
);

/** Die wichtigsten Tasten. Name und Kürzel kommen aus dem Register, damit die Hilfe nie etwas anderes sagt. */
const WICHTIGE_TASTEN = [
	'ansicht.palette',
	'ansicht.claude',
	'dokument.rueckgaengig',
	'auswahl.duplizieren',
	'auswahl.loeschen',
	'auswahl.einfuegen-danach',
	'ansicht.einpassen',
	'ansicht.tasten',
];

const Tastenliste = () => (
	<ul className="my-3 grid max-w-xl grid-cols-2 gap-x-6 gap-y-1 pl-0 max-md:grid-cols-1" data-hilfe-tasten>
		{WICHTIGE_TASTEN.map((id) => {
			const befehl = BEFEHLE.find((b) => b.id === id);
			const taste = befehl?.kuerzel?.[0];
			return befehl && taste && typeof befehl.titel === 'string' ? (
				<li key={id} className="flex list-none items-center justify-between gap-3" data-hilfe-taste={id}>
					<span>{befehl.titel}</span>
					<Kuerzel text={kuerzelText(taste)} />
				</li>
			) : null;
		})}
	</ul>
);

interface Abschnitt {
	id: string;
	titel: string;
	inhalt: ReactNode;
	bilder: Bild[];
}

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
						In einen Ordner, den Baum links oder den Pfad oben ziehen. Mit ⌥ entsteht eine Kopie. Oder ⌘X
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
		titel: 'Selbst anlegen',
		inhalt: (
			<>
				<ol>
					<li>
						Einen Ordner öffnen oder mit „Neuer Ordner“ anlegen. Fach und Klasse fragt erst das Material.
					</li>
					<li>
						Im Ordner auf „Material anlegen“: Art, Format und Titel wählen, dann leer, mit einer Vorlage
						oder „Mit Claude“ beginnen. Mit Claude schreibst du in einem Satz, worum es geht. Der Chat
						öffnet sich im Editor, und am Ende steht ein Entwurf zum Vergleichen.
					</li>
				</ol>
				<h3>Bausteine einfügen</h3>
				<ul>
					<Punkt titel="Plus">
						einen Teil des Blatts antippen, dann das Plus an seinem Rand oder „+ Baustein“ in der Leiste.
					</Punkt>
					<Punkt titel="Bausteine">links im Reiter „Bausteine“ suchen, ins Blatt ziehen oder antippen.</Punkt>
					<Punkt titel="Schrägstrich">in einer leeren Zeile „/“ tippen und weiterschreiben.</Punkt>
				</ul>
			</>
		),
		bilder: [],
	},
	{
		id: 'material',
		titel: 'Material von Claude',
		inhalt: (
			<>
				<p>
					Ein einzelnes Blatt geht am schnellsten im Chat der Schoolbox, siehe „Mit Claude arbeiten“. Für
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
					Ausgewählt wird im Chat: Schreib Claude, welcher es werden soll und was anders sein soll, etwa „B,
					aber mit größerer Schrift“.
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
						Aufgaben, Kärtchen und Seiten ziehen (am iPad kurz halten, dann ziehen) oder in der Leiste am
						Baustein „Nach oben“ und „Nach unten“ tippen. Dort lassen sie sich auch verdoppeln und löschen.
					</Punkt>
					<Punkt titel="Einstellungen">
						rechts im Inspektor: „Auswahl“ für den gewählten Baustein, „Blatt“ für Klasse, Farben und
						Format.
					</Punkt>
					<Punkt titel="Bilder">
						Bild antippen, dann austauschen, eigenes hochladen oder an den Ecken größer und kleiner ziehen.
					</Punkt>
					<Punkt titel="Lösung">oben auf „Lösung“ wechseln und die Lösungen eintragen.</Punkt>
					<Punkt titel="Rückgängig">
						der Pfeil oben (am Mac auch ⌘Z). „Versionen“ zeigt ältere Stände; jeden kannst du dir ansehen
						und zurückholen.
					</Punkt>
				</ul>
			</>
		),
		bilder: [
			{ datei: 'editor-mac.jpg', alt: 'Der Editor mit einer gewählten Aufgabe', geraet: 'Mac' },
			{ datei: 'editor-ipad.jpg', alt: 'Der Editor auf dem iPad', geraet: 'iPad' },
		],
	},
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
				<h3>Die wichtigsten Tasten</h3>
				<Tastenliste />
				<p>Alle Tasten stehen im Editor unten unter „Tasten“.</p>
			</>
		),
		bilder: [{ datei: 'befehle-mac.jpg', alt: 'Das Feld für Befehle im Editor', geraet: 'Mac' }],
	},
	{
		id: 'claude',
		titel: 'Mit Claude arbeiten',
		inhalt: (
			<>
				<ol>
					<li>„Claude“ oben antippen oder ⌘J drücken. Der Chat liegt unten über dem Blatt.</li>
					<li>
						Der Knopf links im Feld zeigt, worauf sich dein Auftrag bezieht: den gewählten Baustein, das
						ganze Blatt oder neues Material. Wähle einen anderen Teil, und er geht mit.
					</li>
					<li>Schreiben, Enter. Du kannst währenddessen weiterarbeiten, unten steht, wie weit Claude ist.</li>
					<li>
						Am Ende steht ein Vorschlag. „Vergleichen“ zeigt ihn neben dem Blatt, erst „Annehmen“ ändert
						etwas. Schreibst du stattdessen weiter, bessert Claude den Vorschlag nach.
					</li>
				</ol>
				<h3>Neues Material</h3>
				<p>
					In „Mein Material“ oder einem Ordner wird aus deiner Nachricht neues Material, im Editor wählst du
					dafür im Knopf links „Neues Material“. Claude zeigt erst eine Karte mit Titel, Format, Fach, Klasse
					und Ablage. Erst Enter oder „Anlegen“ startet die Arbeit, „Ändern“ öffnet die Wahl von Hand.
				</p>
				<h3>Was weiter die Claude-App braucht</h3>
				<p>
					Neue Bilder, ganze Reihen, mehrere Dokumente auf einmal. Für einen bestimmten Teil im Chat unter ⋯
					„In der Claude-App weiterarbeiten“, in der App einfügen und den Wunsch dahinterschreiben. Die zwei
					eingefügten Zeilen gehören so; die zweite ist für Claude.
				</p>
				<h3>Verbrauch</h3>
				<p>
					Alles zählt für das Limit deines Claude-Kontos, zusammen mit der Claude-App. Eine Änderung braucht
					wenig, neues Material deutlich mehr und einige Minuten. Wird es knapp, steht das im Chat.
				</p>
			</>
		),
		bilder: [{ datei: 'chat-mac.jpg', alt: 'Der Chat mit einem Vorschlag über dem Blatt', geraet: 'Mac' }],
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
				<li>Keine Namen von Kindern in Materialien oder im Chat; Claude schlägt dann Fantasienamen vor.</li>
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

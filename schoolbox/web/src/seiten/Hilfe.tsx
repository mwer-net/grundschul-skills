import type { ReactNode } from 'react';

import { KnopfLink } from '../bausteine/Knopf';
import { Symbol } from '../bausteine/Symbol';
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
				className="w-full rounded-xl border border-rand bg-white shadow-karte"
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
	<li className="rounded-2xl bg-white px-5 py-3 shadow-karte">{children}</li>
);

interface Abschnitt {
	id: string;
	titel: string;
	inhalt: ReactNode;
	bilder: Bild[];
}

const ABSCHNITTE: Abschnitt[] = [
	{
		id: 'material',
		titel: 'So bekommst du Material',
		inhalt: (
			<>
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
						Claude fragt kurz nach (Farbe oder schwarz-weiß, Niveaus …), zeigt dir Entwürfe und einen Plan
						der Aufgaben. Ist alles fertig, schickt Claude dir einen Link in die Schoolbox.
					</li>
					<li>
						Alles, was Claude für dich gemacht hat, steht hier unter „Meine Mappen“. Eine Anfrage ist eine
						Mappe; darin liegen das Arbeitsblatt, Karten, die Präsentation …
					</li>
				</ol>
			</>
		),
		bilder: [{ datei: 'uebersicht-mac.jpg', alt: 'Übersicht mit drei Mappen', geraet: 'Mac' }],
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
					Im Dokument speichert „PDF herunterladen“ das Blatt, auf Wunsch mit Lösung. „Drucken“ öffnet den
					Druckdialog.
				</li>
				<li>„Lösung“ oben zeigt das Lösungsblatt.</li>
				<li>
					Steht ein gelber Kasten über dem Blatt, sind das Druckhinweise, zum Beispiel „auf festes Papier“.
				</li>
				<li>Die ganze Mappe auf einmal: in der Mappe „Alles als PDF“.</li>
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
				<p>Lade die Präsentation vorher herunter, unter „Ohne Internet“:</p>
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
					<Punkt titel="Text">antippen und lostippen. Fett und unterstrichen gibt es rechts daneben.</Punkt>
					<Punkt titel="Umsortieren">
						Aufgaben, Kärtchen und Seiten ziehen (am iPad kurz halten, dann ziehen) oder rechts „Nach oben“
						und „Nach unten“ tippen. Dort lassen sie sich auch verdoppeln und löschen.
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
				<h3>Was im Editor nicht geht</h3>
				<p>
					„Mach die Aufgabe schwerer“ oder „Noch zwei Aufgaben dazu“: Teil antippen, rechts auf „Claude
					fragen“ (ohne Auswahl gilt es für das ganze Blatt). Dann in der Claude-App einfügen und deinen
					Wunsch dahinterschreiben. Die zwei eingefügten Zeilen gehören so; die zweite ist für Claude.
				</p>
			</>
		),
		bilder: [
			{ datei: 'editor-mac.jpg', alt: 'Der Editor mit einer gewählten Aufgabe', geraet: 'Mac' },
			{ datei: 'editor-ipad.jpg', alt: 'Der Editor auf dem iPad', geraet: 'iPad' },
		],
	},
	{
		id: 'teilen',
		titel: 'Teilen mit Kolleginnen',
		inhalt: (
			<ul>
				<li>„Teilen“ in der Mappe oder im Dokument, dann „Link erstellen“ und „Link kopieren“.</li>
				<li>
					Wer den Link hat, kann ansehen, präsentieren und das PDF herunterladen. Ändern kann sie nichts, und
					deine anderen Mappen sieht sie nicht.
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
		<div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl bg-white px-6 py-4 shadow-karte">
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
	return (
		<div className="mx-auto max-w-5xl">
			<h1 className="text-3xl max-md:text-2xl">Hilfe</h1>
			<p className="mt-1 text-lg text-leise">So kommst du vom Wunsch in der Claude-App zum fertigen Material.</p>
			<Kurzanleitung />
			<nav aria-label="Inhalt" className="mt-6 flex flex-wrap gap-2">
				{ABSCHNITTE.map(({ id, titel }) => (
					<a
						key={id}
						href={`#${id}`}
						className="inline-flex min-h-11 items-center rounded-full border-2 border-rand bg-white px-4 font-bold text-brand-600 no-underline hover:border-brand-200 hover:bg-brand-50"
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

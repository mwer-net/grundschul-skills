#!/usr/bin/env bash
# Rollt den Stand von origin/main aus: Fast-Forward, Abhängigkeiten, Typprüfung, Oberfläche bauen, PM2 neu laden,
# /healthz prüfen. Schlägt ein Schritt fehl, kehrt alles zum alten Commit zurück und der alte Stand läuft weiter.
# Danach zieht es die Kurzanleitung (Mappe „Schoolbox-Hilfe“) auf den Stand der Vorlage nach.
#
#   scripts/ausrollen.sh            nur wenn origin/main neuer ist oder der Server den Stand nicht meldet
#   scripts/ausrollen.sh --immer    auch ohne neuen Stand bauen und neu laden
#
# Liest NODE_BIN, HOST und PORT aus .env im Repo-Hauptordner. Sucht pnpm und pm2 im PATH, sonst unter PNPM_HOME.
set -Eeuo pipefail

wurzel=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
schoolbox_dir="$wurzel/schoolbox"
web_dir="$schoolbox_dir/web"
APP=schoolbox
HEALTHZ_VERSUCHE=30

immer=0
for arg in "$@"; do
	case "$arg" in
		--immer) immer=1 ;;
		*)
			echo "Unbekannte Option: $arg (erlaubt: --immer)" >&2
			exit 2
			;;
	esac
done

env_wert() {
	[ -f "$wurzel/.env" ] || return 0
	sed -n "s/^$1=//p" "$wurzel/.env" | tail -n 1 | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
}

schritt() { printf '\n== %s\n' "$*"; }
abbruch() {
	echo "Abbruch: $*" >&2
	exit 1
}

node_bin=$(env_wert NODE_BIN)
[ -n "$node_bin" ] && PATH="$(dirname "$node_bin"):$PATH"
pnpm_home=${PNPM_HOME:-$HOME/.local/share/pnpm}
[ -d "$pnpm_home" ] && PATH="$PATH:$pnpm_home"
export PATH

for befehl in git node pnpm pm2 curl flock; do
	command -v "$befehl" >/dev/null 2>&1 || abbruch "„$befehl“ nicht gefunden (NODE_BIN in .env und PATH prüfen)."
done
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || abbruch "Node 22 nötig, gefunden $(node -v)."

host=$(env_wert HOST)
port=$(env_wert PORT)
healthz="http://${host:-127.0.0.1}:${port:-4009}/healthz"

meldet_head() {
	[ -f "$web_dir/dist/index.html" ] &&
		curl -fsS --max-time 2 "$healthz" 2>/dev/null | grep -qF "+$(git -C "$wurzel" rev-parse --short HEAD)\""
}

warte_auf_head() {
	local i
	for ((i = 1; i <= HEALTHZ_VERSUCHE; i++)); do
		meldet_head && return 0
		sleep 1
	done
	return 1
}

# pm2 läuft mit 9>&-: Ein dabei gestarteter PM2-Daemon erbte sonst die Sperre und hielte sie für immer
exec 9>"$wurzel/.git/schoolbox-ausrollen.lock"
flock -n 9 || abbruch 'Ein anderes Ausrollen läuft gerade.'

cd "$wurzel"
[ "$(git symbolic-ref --short -q HEAD)" = main ] || abbruch 'Ausgerollt wird nur von „main“.'
[ -z "$(git status --porcelain)" ] || abbruch "Der Arbeitsbaum ist nicht sauber:
$(git status --short)"

# Läuft die PM2-App aus einem anderen Klon (Aufruf im Entwicklerklon), lüde „pm2 reload“ dessen Dienst neu
app_ordner=$(pm2 jlist 2>/dev/null 9>&- | node -e '
	let text = "";
	process.stdin.on("data", (teil) => (text += teil)).on("end", () => {
		const zeile = text.split("\n").reverse().find((z) => z.startsWith("[{")) ?? "[]";
		process.stdout.write(JSON.parse(zeile).find((app) => app.name === process.argv[1])?.pm2_env?.pm_cwd ?? "");
	});' "$APP") || abbruch 'Die PM2-Liste ist nicht lesbar („pm2 jlist“ prüfen).'
if [ -n "$app_ordner" ] && [ ! "$app_ordner" -ef "$schoolbox_dir/server" ]; then
	abbruch "Die PM2-App „$APP“ läuft aus $app_ordner, nicht aus diesem Klon. Hier wird nicht ausgerollt."
fi

schritt 'Neuen Stand holen'
git fetch --quiet origin main
alt=$(git rev-parse HEAD)
neu=$(git rev-parse origin/main)
if [ "$alt" = "$neu" ] && [ "$immer" = 0 ] && meldet_head; then
	echo "Schon aktuell ($(git rev-parse --short HEAD)). Mit --immer trotzdem neu bauen."
	exit 0
fi
if [ "$alt" = "$neu" ]; then
	echo "Stand unverändert ($(git rev-parse --short HEAD)), baue neu."
else
	git merge --quiet --ff-only origin/main || abbruch 'origin/main ist kein Fast-Forward des lokalen Stands.'
	echo "$(git rev-parse --short "$alt") → $(git rev-parse --short HEAD)"
fi

neu_geladen=0
zurueck() {
	trap - ERR
	set +e
	echo >&2
	echo "Fehlgeschlagen, zurück auf $(git rev-parse --short "$alt") …" >&2
	git reset --quiet --hard "$alt"
	(cd "$schoolbox_dir" && pnpm install --frozen-lockfile --config.confirmModulesPurge=false --reporter=silent)
	rm -rf "$web_dir/dist.neu"
	if [ -d "$web_dir/dist.alt" ]; then
		rm -rf "$web_dir/dist"
		mv "$web_dir/dist.alt" "$web_dir/dist"
	fi
	if [ "$neu_geladen" = 0 ]; then
		echo 'Der alte Stand läuft weiter. Nichts ausgerollt.' >&2
		exit 1
	fi
	pm2 reload "$APP" >/dev/null 9>&-
	if warte_auf_head; then
		echo 'Der alte Stand läuft wieder. Nichts ausgerollt.' >&2
	else
		echo "ACHTUNG: Auch der alte Stand antwortet nicht auf $healthz. „pm2 logs $APP“ prüfen." >&2
	fi
	exit 1
}
trap zurueck ERR

schritt 'Abhängigkeiten'
cd "$schoolbox_dir"
pnpm install --frozen-lockfile --config.confirmModulesPurge=false

schritt 'Typprüfung'
pnpm run typecheck

schritt 'Oberfläche bauen'
# Daneben bauen, damit der laufende Server bis zum Tausch eine vollständige Oberfläche ausliefert
rm -rf "$web_dir/dist.neu" "$web_dir/dist.alt"
pnpm --filter @schoolbox/web exec vite build --outDir dist.neu --emptyOutDir --logLevel warn
[ -d "$web_dir/dist" ] && mv "$web_dir/dist" "$web_dir/dist.alt"
mv "$web_dir/dist.neu" "$web_dir/dist"

schritt 'Server neu laden'
if pm2 describe "$APP" >/dev/null 2>&1; then
	neu_geladen=1
	pm2 reload "$APP" 9>&-
else
	neu_geladen=1
	pm2 start "$schoolbox_dir/ecosystem.config.cjs" 9>&-
	pm2 save 9>&-
fi

schritt 'Prüfen'
if warte_auf_head; then
	rm -rf "$web_dir/dist.alt"
	trap - ERR
	echo "$healthz: $(curl -fsS --max-time 2 "$healthz")"
	echo 'Ausgerollt.'
	# Läuft erst nach dem Ausrollen: Ein Fehler hier rollt nichts zurück, er wird nur gemeldet
	"$schoolbox_dir/bin/schoolbox" kurzanleitung ||
		echo 'Hinweis: Die Kurzanleitung ließ sich nicht aktualisieren („schoolbox/bin/schoolbox kurzanleitung“).'
	# Eine geänderte Vorlage kommt nicht von selbst in .claude/settings.local.json
	if [ "$(git -C "$wurzel" config --get schoolbox.lehrkraftModus || true)" = true ] &&
		! bash "$wurzel/scripts/einrichten-lehrkraft.sh" --pruefen >/dev/null; then
		echo 'Hinweis: Der Lehrkraft-Modus weicht vom Stand im Repo ab. Bitte scripts/einrichten-lehrkraft.sh ausführen.'
	fi
	exit 0
fi
echo "$healthz meldet nach ${HEALTHZ_VERSUCHE} s nicht den neuen Stand. Fehlerlog: $schoolbox_dir/logs/error.log" >&2
zurueck

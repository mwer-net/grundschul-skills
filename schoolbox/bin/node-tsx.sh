# Gemeinsam für bin/schoolbox und bin/schoolbox-bilder (wird eingebunden, nicht ausgeführt): Node aus NODE_BIN
# (.env im Repo-Hauptordner), weil die Shell einer Claude-Sitzung ein anderes Node im PATH haben kann, und der
# tsx-Loader aus node_modules. Erwartet $schoolbox_dir; `starte_ts <datei.ts> …` ersetzt den Prozess.
wurzel=$(dirname "$schoolbox_dir")

env_wert() {
	[ -f "$wurzel/.env" ] || return 0
	sed -n "s/^$1=//p" "$wurzel/.env" | tail -n 1 | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
}

starte_ts() {
	local einstieg=$1 node_bin version loader
	shift
	node_bin=${NODE_BIN:-$(env_wert NODE_BIN)}
	node_bin=${node_bin:-node}
	if ! command -v "$node_bin" >/dev/null 2>&1; then
		echo "Node nicht gefunden: $node_bin (NODE_BIN in $wurzel/.env prüfen)." >&2
		exit 3
	fi
	version=$("$node_bin" -p 'process.versions.node.split(".")[0]')
	if [ "$version" -lt 22 ]; then
		echo "Die Schoolbox braucht Node 22, gefunden Node $version ($node_bin). NODE_BIN in $wurzel/.env setzen." >&2
		exit 3
	fi
	loader="$schoolbox_dir/node_modules/tsx/dist/loader.mjs"
	if [ ! -f "$loader" ]; then
		echo "Abhängigkeiten fehlen: im Ordner $schoolbox_dir „pnpm install“ ausführen." >&2
		exit 3
	fi
	exec "$node_bin" --import "file://$loader" "$schoolbox_dir/$einstieg" "$@"
}

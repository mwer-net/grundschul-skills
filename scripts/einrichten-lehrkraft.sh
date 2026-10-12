#!/usr/bin/env bash
# Richtet diesen Klon für die Lehrkraft ein. Nur im Klon der Lehrkraft ausführen, nie im Entwicklerklon.
#
#   - kopiert schoolbox/vorlagen/settings.lehrkraft.json nach .claude/settings.local.json: Claude darf hier nicht
#     committen, nicht pushen und außerhalb der Materialien nichts ändern; was es für Material braucht, läuft
#     ohne Rückfrage
#   - macht die Push-Adresse ungültig und schaltet die Commit-Sperre im Pre-Commit-Hook ein. Die Regeln für Claude
#     prüfen nur den Wortlaut eines Befehls („git -C . push“ rutscht durch), diese beiden Sperren greifen immer
#
#   scripts/einrichten-lehrkraft.sh              einrichten; nach einer geänderten Vorlage erneut ausführen
#   scripts/einrichten-lehrkraft.sh --pruefen    nur melden, was fehlt oder abweicht (dann Exit 1)
#   scripts/einrichten-lehrkraft.sh --aufheben   alles zurücknehmen
#
# Neue Stände kommen weiter mit scripts/ausrollen.sh (holt nur, pusht nie). Laufende Claude-Sitzungen danach neu
# starten, damit die Regeln sicher gelten.
set -Eeuo pipefail

wurzel=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)
vorlage="$wurzel/schoolbox/vorlagen/settings.lehrkraft.json"
ziel="$wurzel/.claude/settings.local.json"
sicherung="$wurzel/.git/schoolbox-settings.local.json.vorher"
PUSH_GESPERRT=/dev/null/lehrkraft-modus-pusht-nicht

modus=einrichten
for arg in "$@"; do
	case "$arg" in
		--pruefen) modus=pruefen ;;
		--aufheben) modus=aufheben ;;
		*)
			echo "Unbekannte Option: $arg (erlaubt: --pruefen, --aufheben)" >&2
			exit 2
			;;
	esac
done

abbruch() {
	echo "Abbruch: $*" >&2
	exit 1
}

env_wert() {
	[ -f "$wurzel/.env" ] || return 0
	sed -n "s/^$1=//p" "$wurzel/.env" | tail -n 1 | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
}

git_wert() { git -C "$wurzel" config --get "$1" || true; }

git -C "$wurzel" rev-parse --git-dir >/dev/null 2>&1 || abbruch "$wurzel ist kein Git-Klon."
[ -f "$vorlage" ] || abbruch "Vorlage fehlt: $vorlage"

sichere_ziel() {
	[ -f "$ziel" ] || return 0
	cmp -s "$vorlage" "$ziel" && return 0
	cp "$ziel" "$sicherung"
	echo "Bisherige Datei gesichert: $sicherung"
}

if [ "$modus" = pruefen ]; then
	abweichungen=0
	melde() {
		echo "FEHLT  $*"
		abweichungen=$((abweichungen + 1))
	}
	if [ ! -f "$ziel" ]; then
		melde ".claude/settings.local.json fehlt."
	elif ! cmp -s "$vorlage" "$ziel"; then
		melde ".claude/settings.local.json weicht von der Vorlage ab."
	fi
	[ "$(git_wert remote.origin.pushurl)" = "$PUSH_GESPERRT" ] || melde "Die Push-Adresse ist nicht gesperrt."
	[ "$(git_wert schoolbox.lehrkraftModus)" = true ] || melde "Die Commit-Sperre ist nicht eingeschaltet."
	[ "$(git_wert core.hooksPath)" = .githooks ] || melde "core.hooksPath zeigt nicht auf .githooks."
	if [ "$abweichungen" -gt 0 ]; then
		echo "Beheben mit: scripts/einrichten-lehrkraft.sh"
		exit 1
	fi
	echo "Lehrkraft-Modus ist vollständig eingerichtet."
	exit 0
fi

if [ "$modus" = aufheben ]; then
	sichere_ziel
	rm -f "$ziel"
	git -C "$wurzel" config --unset-all remote.origin.pushurl || true
	git -C "$wurzel" config --unset-all schoolbox.lehrkraftModus || true
	echo "Lehrkraft-Modus aufgehoben: Regeln für Claude entfernt, Push und Commit wieder möglich."
	exit 0
fi

sichere_ziel
mkdir -p "$(dirname "$ziel")"
cp "$vorlage" "$ziel"
git -C "$wurzel" config core.hooksPath .githooks
git -C "$wurzel" config remote.origin.pushurl "$PUSH_GESPERRT"
git -C "$wurzel" config schoolbox.lehrkraftModus true

echo "Lehrkraft-Modus eingerichtet in $wurzel:"
echo "  - Regeln für Claude: .claude/settings.local.json"
echo "  - Push gesperrt, Commit-Sperre im Pre-Commit-Hook eingeschaltet"
echo "Laufende Claude-Sitzungen in diesem Ordner neu starten."

material_dir=$(env_wert MATERIAL_DIR)
material_dir=${material_dir:-materialien}
case "$material_dir" in /*) ;; *) material_dir="$wurzel/${material_dir#./}" ;; esac
if [ "${material_dir%/}" != "$wurzel/materialien" ]; then
	echo
	echo "Hinweis: MATERIAL_DIR ist $material_dir. Die Freigaben in der Vorlage nennen „materialien/“;"
	echo "ohne Anpassung fragt Claude dort bei jeder Änderung nach."
fi

#!/usr/bin/env bash
# Packt jeden Skill-Ordner als ZIP nach dist/ (zum Hochladen in Claude.ai)
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir dist
for dir in skills/*/; do
  name=$(basename "$dir")
  (cd skills && zip -qr "../dist/$name.zip" "$name")
  echo "dist/$name.zip"
done

#!/usr/bin/env bash
set -euo pipefail
verbose=()
input=''
options=true
usage() { echo 'Usage: export.sh [-v] /path/to/xml' >&2; exit 2; }
for arg in "$@"; do
  if [[ "$options" == true && "$arg" == -- ]]; then options=false
  elif [[ "$options" == true && "$arg" == -v ]]; then verbose=(-v)
  elif [[ "$options" == true && "$arg" == -* ]]; then usage
  elif [[ -z "$input" ]]; then input="$arg"
  else usage
  fi
done
[[ -n "$input" ]] || usage
[[ -f "$input" && -r "$input" ]] || { echo "XML file is not readable: $input" >&2; exit 2; }
# Resolve before changing directory, so caller-relative paths work.
input="$(cd -- "$(dirname -- "$input")" && pwd)/$(basename -- "$input")"
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
docker compose up -d --wait redis >&2
docker compose build exporter >&2
docker compose run --rm -T --no-deps --volume "$input:/input/config.xml:ro" exporter "${verbose[@]}" /input/config.xml

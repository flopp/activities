#!/bin/bash

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

TARGET="/var/www/virtual/floppnet/activities.flopp.net/"
LOG="/home/floppnet/project-logs/activities.log"

date >> "${LOG}"
(cd "${DIR}" && git pull) >> "${LOG}"
(cd "${DIR}" && make setup) >> "${LOG}"
mkdir -p "${TARGET}" >> "${LOG}"
(cd "${DIR}" && .env/bin/python run.py \
    --sync \
    --config config.json \
    --authdata account.json \
    --pois freiburg-summits.json \
    --data .data \
    --output "${TARGET}/activities.js") >> "${LOG}"
rsync -qa "${DIR}/web/" "${TARGET}" >> "${LOG}"

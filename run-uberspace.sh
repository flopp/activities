#!/bin/bash

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
TARGET="/var/www/virtual/floppnet/activities.flopp.net/"
LOG="/home/floppnet/project-logs/activities.log"

date >> "${LOG}"
(cd "${DIR}" && git pull) >> "${LOG}"
(cd "${DIR}" && make setup run+sync) >> "${LOG}"
rsync -qa "${DIR}/web/" "${TARGET}" >> "${LOG}"

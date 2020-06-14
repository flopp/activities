#!/bin/bash

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
TARGET="/var/www/virtual/floppnet/activities.flopp.net/"

(cd "${DIR}" && git pull)
(cd "${DIR}" && make setup run+sync)

rsync -qa "${DIR}/web/" "${TARGET}"

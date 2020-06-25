#!/bin/bash

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

TARGET="/var/www/virtual/floppnet/activities.flopp.net/"
LOG="/home/floppnet/project-logs/activities.log"

(
    date
    mkdir -p "${TARGET}"
    (cd "${DIR}" && git pull)
    (cd "${DIR}" && make setup)
    (cd "${DIR}" && .env/bin/python run.py \
        --sync \
        --config config.json \
        --authdata account.json \
        --pois freiburg-summits.json \
        --data data.db \
        --output "${DIR}/web/activities.js")

    HASH_APP_JS="$(sha1sum "${DIR}/web/app.js" | awk '{printf("%.8s", $1);}')"
    HASH_STYLE_CSS="$(sha1sum "${DIR}/web/style.css" | awk '{printf("%.8s", $1);}')"
    HASH_ACTIVITIES_JS="$(sha1sum "${DIR}/web/activities.js" | awk '{printf("%.8s", $1);}')"

    rm -f "${TARGET}"/activities-*.js "${TARGET}"/app-*.js "${TARGET}"/style-*.css
    cp "${DIR}/web/activities.js" "${TARGET}/activities-${HASH_ACTIVITIES_JS}.js"
    cp "${DIR}/web/app.js"        "${TARGET}/app-${HASH_APP_JS}.js"
    cp "${DIR}/web/style.css"     "${TARGET}/style-${HASH_STYLE_CSS}.css"

    sed -e "s/\"style.css\"/\"style-${HASH_STYLE_CSS}.css\"/g" \
        -e "s/\"app.js\"/\"app-${HASH_APP_JS}.js\"/g" \
        -e "s/\"activities.js\"/\"activities-${HASH_ACTIVITIES_JS}.js\"/g" \
        "${DIR}/web/index.html" \
        > "${TARGET}/index.html"
) >> "${LOG}"

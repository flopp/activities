.PHONY: setup
setup:
	python3 -m venv .env
	.env/bin/pip install -U pip
	.env/bin/pip install -r requirements.txt

.PHONY: setup-dev
setup-dev: setup
	.env/bin/pip install -r requirements-dev.txt

.PHONY: format
format:
	.env/bin/black *.py app/*.py auth/*.py

.PHONY: run
run: .web/Polyline.encoded.js
	.env/bin/python run.py

.PHONY: run+sync
run+sync: .web/Polyline.encoded.js
	.env/bin/python run.py --sync

.web/Polyline.encoded.js:
	curl \
	    --silent \
	    --output $@ \
	    https://raw.githubusercontent.com/jieter/Leaflet.encoded/master/Polyline.encoded.js

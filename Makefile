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
	.env/bin/black *.py generator/*.py auth/*.py -l 120

.PHONY: auth
auth:
	.env/bin/python run.py --register

.PHONY: run
run:
	.env/bin/python run.py --pois freiburg-summits.json

.PHONY: run+sync
run+sync:
	.env/bin/python run.py --sync --pois freiburg-summits.json

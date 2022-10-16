.PHONY: setup
setup:
	python3.9 -m venv .env
	.env/bin/pip install --use-pep517 --upgrade pip
	.env/bin/pip install --use-pep517 --upgrade -r requirements.txt

.PHONY: setup-dev
setup-dev: setup
	.env/bin/pip install --use-pep517 --upgrade -r requirements-dev.txt

.PHONY: format
format:
	.env/bin/black activities -l 120

.PHONY: lint
lint: mypy pylint

.PHONY: pylint
pylint:
	.env/bin/pylint activities

.PHONY: mypy
mypy:
	PYTHONPATH=. .env/bin/mypy activities

.PHONY: auth
auth:
	PYTHONPATH=. .env/bin/python activities/run.py --auth

.PHONY: run
run:
	PYTHONPATH=. .env/bin/python activities/run.py

.PHONY: run+sync
run+sync:
	PYTHONPATH=. .env/bin/python activities/run.py --sync

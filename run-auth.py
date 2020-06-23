#!/usr/bin/env python3

import json

import click

import app
import auth


HTTP_PORT = 5000


@click.command()
@click.option('--config', default='config.json',
              metavar='JSON_FILE', type=click.Path(exists=True))
@click.option('--authdata', default='account.json',
              metavar='JSON_FILE', type=click.Path())
def run_auth(config, authdata):
    """
    Run a simple web server to get authentication data to run the sync process

    Read from config.json file and output to account.json
    """
    with open(config) as f:
        config_content = json.load(f)

    auth.configure(config_content, authdata)

    click.launch(f"http://127.0.0.1:{HTTP_PORT}/")

    auth.app.run(port=HTTP_PORT, debug=True)


if __name__ == '__main__':
    run_auth()

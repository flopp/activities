#!/usr/bin/env python3

import datetime
import json
import os

import click

import activities.auth.flask_app as auth_app
from activities.generator import Generator


HTTP_PORT = 5000


def run_auth_app(config: str, data: str) -> None:
    # Run a simple web server to get authentication data to run the sync process
    # Read from config.json file and output to account.json
    with open(config) as f:
        config_content = json.load(f)

    auth_app.configure(config_content, data)
    click.launch(f"http://127.0.0.1:{HTTP_PORT}/")
    auth_app.app.run(port=HTTP_PORT, debug=True)


@click.command()
@click.option("-c", "--config", default="config.json", metavar="JSON_FILE", type=click.Path(exists=True))
@click.option("-r", "--register", is_flag=True, help="Register Strava account.")
@click.option("-s", "--sync", is_flag=True, help="Sync activities.")
@click.option("-p", "--pois", metavar="JSON_FILE", type=click.Path())
@click.option("-d", "--data", default="data.db", metavar="DATA_FILE", type=click.Path())
@click.option("-o", "--output", default="web/activities.js", metavar="JS_FILE", type=click.Path())
@click.option("-b", "--browser", is_flag=True, help="Open the generated website in a web browser.")
@click.option("-f", "--force", is_flag=True, help="Force sync for older activities than the last synced.")
def run(
    config: str, pois: str, data: str, output: str, sync: bool, browser: bool, force: bool, register: bool,
) -> None:

    if register:
        run_auth_app(config, data)
        return

    # Drop DB if sync and force mode enabled
    if sync and force:
        os.remove(data)

    generator = Generator(data, config, pois)

    if sync:
        generator.sync(force)

    athlete, activities_list = generator.load()
    with open(output, "w") as f:
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        f.write(f"const the_last_sync = '{now}';\n")

        f.write("const the_strava_athlete = ")
        json.dump(athlete, f, indent=2)
        f.write(";\n")

        f.write("const the_activities = ")
        json.dump(activities_list, f, indent=2)
        f.write(";\n")

    if browser:
        click.launch("web/index.html")


if __name__ == "__main__":
    run()

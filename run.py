#!/usr/bin/env python3

import datetime
import json

import click

import app


@click.command()
@click.option("-c", "--config", default="config.json",
              metavar="JSON_FILE", type=click.Path(exists=True))
@click.option("-a", "--authdata", default="account.json",
              metavar="JSON_FILE", type=click.Path(exists=True))
@click.option("-p", "--pois",
              metavar="JSON_FILE", type=click.Path())
@click.option("-d", "--data", default=".data",
              metavar="DATA_DIR", type=click.Path())
@click.option("-o", "--output", default="web/activities.js",
              metavar="JS_FILE", type=click.Path())
@click.option("-s", "--sync", is_flag=True,
              help="Sync activities.")
@click.option("-b", "--browser", is_flag=True,
              help="Open the generated website in a web browser..")
def run(config, authdata, pois, data, output, sync, browser):
    main = app.main.Main()

    with open(config) as f:
        main.set_strava_app_config(json.load(f))

    with open(authdata) as f:
        main.set_authdata(json.load(f))

    if pois:
        with open(pois) as f:
            main.set_points_of_interest(json.load(f))

    main.set_data_dir(data)

    if sync:
        main.sync()
        if main.authdata_changed:
            with open(authdata, "w") as f:
                json.dump(main.authdata, f, indent=2)

    athlete, activities = main.load()

    with open(output, "w") as f:
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        f.write(f"const the_last_sync = '{now}';\n")

        f.write("const the_strava_athlete = ")
        json.dump(athlete, f, indent=2)
        f.write(";\n")

        f.write("const the_activities = ")
        json.dump(activities, f, indent=2)
        f.write(";\n")

    if browser:
        click.launch("web/index.html")


if __name__ == "__main__":
    run()

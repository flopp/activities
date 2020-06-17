#!/usr/bin/env python3

import json
import app
import argparse
import datetime

args_parser = argparse.ArgumentParser()
args_parser.add_argument("--config", metavar="JSON_FILE", default="config.json")
args_parser.add_argument("--authdata", metavar="JSON_FILE", default="account.json")
args_parser.add_argument("--pois", metavar="JSON_FILE")
args_parser.add_argument("--data", metavar="DATA_DIR", default=".data")
args_parser.add_argument("--output", metavar="JS_FILE", default="web/activities.js")
args_parser.add_argument(
    "--sync", dest="sync", action="store_true", help="Sync activities.",
)
args = args_parser.parse_args()

main = app.main.Main()

with open(args.config) as f:
    main.set_strava_app_config(json.load(f))

with open(args.authdata) as f:
    main.set_authdata(json.load(f))

if args.pois:
    with open(args.pois) as f:
        main.set_points_of_interest(json.load(f))

main.set_data_dir(args.data)

if args.sync:
    main.sync()
    if main.authdata_changed:
        with open(args.authdata, "w") as f:
            json.dump(main.authdata, f, indent=2)

athlete, activities = main.load()

with open(args.output, "w") as f:
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    f.write(f'const the_last_sync = "{now}";\n')

    f.write("const the_strava_athlete = ")
    json.dump(athlete, f, indent=2)
    f.write(";\n")

    f.write("const the_activities = ")
    json.dump(activities, f, indent=2)
    f.write(";\n")

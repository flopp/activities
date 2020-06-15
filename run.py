#!/usr/bin/env python3

import json
import app
import argparse

args_parser = argparse.ArgumentParser()
args_parser.add_argument("--config", metavar="JSON_FILE", default="config.json")
args_parser.add_argument("--authdata", metavar="JSON_FILE", default="account.json")
args_parser.add_argument("--pois", metavar="JSON_FILE")
args_parser.add_argument("--data", metavar="DATA_DIR", default=".data")
args_parser.add_argument("--output", metavar="JS_FILE", default="activities.json")
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
            json.dump(main.authdata, f)

activities = main.load()
with open(args.output, "w") as f:
    f.write("activities = ")
    json.dump(activities, f)
    f.write(";\n")

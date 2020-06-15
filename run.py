#!/usr/bin/env python3

import json
import app
import argparse

args_parser = argparse.ArgumentParser()
args_parser.add_argument(
    "--sync", dest="sync", action="store_true", help="Sync activities.",
)
args = args_parser.parse_args()

with open("config.json") as json_file:
    config = json.load(json_file)

main = app.main.Main(config)

with open("account.json") as f:
    main.set_account(json.load(f))

if args.sync:
    main.sync()
    if main.account_changed:
        with open("account.json", "w") as json_file:
            json.dump(main.account, json_file)

main.analyze()

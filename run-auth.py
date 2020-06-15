#!/usr/bin/env python3

import json
import app
import auth
import argparse

args_parser = argparse.ArgumentParser()
args_parser.add_argument("--config", metavar="JSON_FILE", default="config.json")
args_parser.add_argument("--authdata", metavar="JSON_FILE", default="account.json")
args = args_parser.parse_args()

with open(args.config) as f:
    config = json.load(f)

auth.configure(config, args.authdata)
auth.app.run(port=5000, debug=True)

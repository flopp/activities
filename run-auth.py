#!/usr/bin/env python3

import json
import app
import auth


with open("config.json") as f:
    config = json.load(f)

auth.configure(config)
auth.app.run(port=5000, debug=True)

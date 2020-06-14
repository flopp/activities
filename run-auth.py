#!/usr/bin/env python3

import json
import auth

#!/usr/bin/env python3

import json
import app

with open("config.json") as json_file:
    config = json.load(json_file)

auth.configure(config)
auth.app.run(port=5000, debug=True)

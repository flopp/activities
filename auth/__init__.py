#!/usr/bin/env python

import flask
import stravalib

app = flask.Flask(__name__)


def configure(config):
    app.config["client_id"] = config["client_id"]
    app.config["client_secret"] = config["client_secret"]


@app.route("/")
def homepage():
    client = stravalib.client.Client()
    auth_url = client.authorization_url(
        client_id=app.config["client_id"],
        scope=None,
        redirect_uri="http://localhost:5000/auth",
    )
    return flask.render_template("main.html", auth_url=auth_url)


@app.route("/auth")
def auth_done():
    code = flask.request.args.get("code", "")
    client = stravalib.client.Client()
    token = client.exchange_code_for_token(
        client_id=app.config["client_id"],
        client_secret=app.config["client_secret"],
        code=code,
    )
    print(token)
    return flask.redirect(flask.url_for("homepage"))

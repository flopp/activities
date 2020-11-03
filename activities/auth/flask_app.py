import datetime
import json
from typing import Union

import flask
from werkzeug.wrappers import Response
import stravalib  # type: ignore

from activities.generator import Generator
from activities.generator.db import init_db, Auth


app = flask.Flask(__name__)


def configure(config: str, data: str, pois: str, thumbnails: str) -> None:
    with open(config) as f:
        config_content = json.load(f)

    app.config["client_id"] = config_content["client_id"]
    app.config["client_secret"] = config_content["client_secret"]
    app.config["data"] = data
    app.config["config"] = config
    app.config["pois"] = pois
    app.config["thumbnails"] = thumbnails


@app.route("/")
def homepage() -> Union[str, Response]:
    session = init_db(app.config["data"])
    auth_info = session.query(Auth).first()
    if auth_info:
        return flask.redirect(flask.url_for("auth_complete"))

    client = stravalib.client.Client()
    auth_url = client.authorization_url(
        client_id=app.config["client_id"],
        scope=None,
        redirect_uri="http://localhost:5000/auth",
    )
    return flask.render_template("main.html", auth_url=auth_url, data_file=app.config["data"])


@app.route("/auth_complete")
def auth_complete() -> str:
    return flask.render_template("auth_complete.html")


@app.route("/auth")
def auth() -> Response:
    code = flask.request.args.get("code", "")
    client = stravalib.client.Client()
    token = client.exchange_code_for_token(
        client_id=app.config["client_id"],
        client_secret=app.config["client_secret"],
        code=code,
    )

    session = init_db(app.config["data"])
    auth_data = Auth(
        access_token=token["access_token"],
        refresh_token=token["refresh_token"],
        expires_at=datetime.datetime.fromtimestamp(token["expires_at"]),
    )

    session.add(auth_data)
    session.commit()

    return flask.redirect(flask.url_for("auth_complete"))


@app.route("/sync")
def sync() -> str:
    generator = Generator(app.config["config"], app.config["data"], app.config["pois"], app.config["thumbnails"])
    generator.sync()

    return flask.render_template("sync_complete.html")

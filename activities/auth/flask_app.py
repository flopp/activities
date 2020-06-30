import datetime
from typing import Dict, Union

import flask
from werkzeug.wrappers import Response
import stravalib  # type: ignore

from activities.generator.db import init_db, Auth


app = flask.Flask(__name__)


def configure(config: Dict, authdata_file: str) -> None:
    app.config["client_id"] = config["client_id"]
    app.config["client_secret"] = config["client_secret"]
    app.config["authdata_file"] = authdata_file


@app.route("/")
def homepage() -> Union[str, Response]:
    session = init_db(app.config["authdata_file"])
    auth_info = session.query(Auth).first()
    if auth_info:
        return flask.redirect(flask.url_for("complete"))

    client = stravalib.client.Client()
    auth_url = client.authorization_url(
        client_id=app.config["client_id"], scope=None, redirect_uri="http://localhost:5000/auth",
    )
    return flask.render_template("main.html", auth_url=auth_url, authdata_file=app.config["authdata_file"])


@app.route("/complete")
def complete() -> str:
    return flask.render_template("complete.html")


@app.route("/auth")
def auth_done() -> Response:
    code = flask.request.args.get("code", "")
    client = stravalib.client.Client()
    token = client.exchange_code_for_token(
        client_id=app.config["client_id"], client_secret=app.config["client_secret"], code=code,
    )

    session = init_db(app.config["authdata_file"])
    auth_data = Auth(
        access_token=token["access_token"],
        refresh_token=token["refresh_token"],
        expires_at=datetime.datetime.fromtimestamp(token["expires_at"]),
    )

    session.add(auth_data)
    session.commit()

    return flask.redirect(flask.url_for("complete"))

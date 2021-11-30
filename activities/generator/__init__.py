import datetime
import json
import time
import sys
from typing import Dict, List, Tuple

import arrow  # type: ignore
import stravalib  # type: ignore
from sqlalchemy import func

from activities.generator.db import init_db, clear_activities, update_or_create_activity, Athlete, Activity, Auth


class Generator:
    def __init__(self, strava_config_path: str, db_path: str, pois_data_path: str):
        self.client = stravalib.Client()
        self.session = init_db(db_path)

        # Load the strava account configuration
        with open(strava_config_path) as f:
            strava_config = json.load(f)
            if not {"client_id", "client_secret"} <= strava_config.keys():
                raise KeyError("Missing keys from strava configuration.")

        self.client_data = {"id": strava_config["client_id"], "secret": strava_config["client_secret"]}

        # Load the POIs
        if pois_data_path:
            with open(pois_data_path) as f:
                self.pois = json.load(f)
        else:
            self.pois = None

        auth = self.session.query(Auth).first()
        if not auth:
            raise Exception("Missing auth data in DB.")

        self.authdata = auth

    def check_access(self) -> None:
        assert self.authdata is not None
        now = datetime.datetime.fromtimestamp(time.time())
        expires_at = self.authdata.expires_at
        print(f"Access token valid until {expires_at} (now is {now})")
        if now + datetime.timedelta(minutes=5) >= expires_at:
            print("Refreshing access token")
            response = self.client.refresh_access_token(
                client_id=self.client_data["id"],
                client_secret=self.client_data["secret"],
                refresh_token=self.authdata.refresh_token,
            )
            # Update the authdata object
            self.authdata.access_token = response["access_token"]
            self.authdata.refresh_token = response["refresh_token"]
            self.authdata.expires_at = datetime.datetime.fromtimestamp(response["expires_at"])
            self.session.commit()

            print(f"New access token will expire at {expires_at}")

        self.client.access_token = self.authdata.access_token
        print("Access ok")

    def sync(self, force: bool = False) -> None:
        self.check_access()
        strava_athlete = self.client.get_athlete()

        athlete = self.session.query(Athlete).filter_by(id=strava_athlete.id).first()
        if not athlete:
            athlete = Athlete(
                id=strava_athlete.id,
                firstname=strava_athlete.firstname,
                lastname=strava_athlete.lastname,
            )
            self.session.add(athlete)
            self.session.commit()

        if force:
            print("Force sync -> clear existing activities")
            clear_activities(self.session)
            filters = {}
        else:
            last_activity = self.session.query(func.max(Activity.start_date)).scalar()
            if last_activity:
                last_activity_date = arrow.get(last_activity)
                last_activity_date = last_activity_date.shift(days=-7)
                filters = {"after": last_activity_date.datetime}
            else:
                filters = {}

        print("Start syncing")
        for strava_activity in self.client.get_activities(**filters):
            created = update_or_create_activity(self.session, athlete, strava_activity)
            if created:
                sys.stdout.write("+")
            else:
                sys.stdout.write(".")
            sys.stdout.flush()

        self.session.commit()

    def load(self) -> Tuple[Dict, List[Dict], List[Dict]]:
        athlete = self.session.query(Athlete).first()
        activities = self.session.query(Activity).filter_by(athlete_id=athlete.id).order_by(Activity.start_date_local)

        athlete_dict = athlete.to_dict()
        activity_list = []

        streak = 0
        last_date = None
        for activity in activities:
            # Determine running streak.
            if activity.type == "Run":
                date = datetime.datetime.strptime(activity.start_date_local, "%Y-%m-%d %H:%M:%S").date()
                if last_date is None:
                    streak = 1
                elif date == last_date:
                    pass
                elif date == last_date + datetime.timedelta(days=1):
                    streak += 1
                else:
                    assert date > last_date
                    streak = 1
                activity.streak = streak
                last_date = date
            # Determine visited POIs.
            activity.set_pois(self.pois)
            # Append to result list.
            activity_list.append(activity.to_dict())

        pois_list = []
        if self.pois:
            pois_list = [
                {"name": name, "lat": point["lat"], "lon": point["lon"]} for (name, point) in self.pois.items()
            ]

        return athlete_dict, activity_list, pois_list

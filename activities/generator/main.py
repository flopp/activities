import datetime
import time
import sys
from typing import Dict, List, Optional, Tuple

import polyline  # type: ignore
import stravalib  # type: ignore
from sqlalchemy import func, desc

from activities.generator.db import init_db, Athlete, Activity


class Main:
    def __init__(self, db_path: str):
        self.config: Optional[Dict] = None
        self.authdata: Optional[Dict] = None
        self.authdata_changed = False
        self.client = stravalib.Client()
        self.session = init_db(db_path)
        self.pois: Optional[Dict[str, Dict]] = None

    def set_strava_app_config(self, strava_app_config: Dict) -> None:
        for key in ["client_id", "client_secret"]:
            if key not in strava_app_config:
                raise KeyError(f'Key "{key}" is missing from app config.')
        self.config = strava_app_config

    def set_authdata(self, authdata: Dict) -> None:
        for key in ["access_token", "refresh_token", "expires_at"]:
            if key not in authdata:
                raise KeyError(f'Key "{key}" is missing from auth data.')
        self.authdata = authdata
        self.authdata_changed = False

    def set_points_of_interest(self, pois: Dict[str, Dict]) -> None:
        self.pois = pois

    def check_access(self) -> None:
        assert self.authdata is not None
        assert self.config is not None
        now = datetime.datetime.fromtimestamp(time.time())
        expires_at = datetime.datetime.fromtimestamp(self.authdata["expires_at"])
        print(f"Access token valid until {expires_at} (now is {now})")
        if now + datetime.timedelta(minutes=5) >= expires_at:
            print("Refreshing access token")
            response = self.client.refresh_access_token(
                client_id=self.config["client_id"],
                client_secret=self.config["client_secret"],
                refresh_token=self.authdata["refresh_token"],
            )
            self.authdata["access_token"] = response["access_token"]
            self.authdata["refresh_token"] = response["refresh_token"]
            self.authdata["expires_at"] = response["expires_at"]
            expires_at = datetime.datetime.fromtimestamp(self.authdata["expires_at"])
            print(f"New access token will expire at {expires_at}")
            self.authdata_changed = True

        self.client.access_token = self.authdata["access_token"]
        print("Access ok")

    def sync(self, force: bool = False) -> None:
        self.check_access()
        strava_athlete = self.client.get_athlete()

        athlete = self.session.query(Athlete).filter_by(id=strava_athlete.id).first()
        if not athlete:
            athlete = Athlete(
                id=strava_athlete.id, firstname=strava_athlete.firstname, lastname=strava_athlete.lastname,
            )
            self.session.add(athlete)
            self.session.commit()

        print("Start syncing")
        if force:
            filters = {"before": datetime.datetime.utcnow()}
        else:
            last_activity_date = self.session.query(func.max(Activity.start_date)).scalar()

            filters = {"after": last_activity_date}

        for strava_activity in self.client.get_activities(**filters):
            sys.stdout.write(".")
            sys.stdout.flush()

            activity = self.session.query(Activity).filter_by(strava_id=strava_activity.id).first()
            if not activity:
                activity = Activity(
                    strava_id=strava_activity.id,
                    athlete=athlete,
                    name=strava_activity.name,
                    distance=strava_activity.distance,
                    moving_time=strava_activity.moving_time,
                    elapsed_time=strava_activity.elapsed_time,
                    total_elevation_gain=strava_activity.total_elevation_gain,
                    type=strava_activity.type,
                    start_date=strava_activity.start_date,
                    start_date_local=strava_activity.start_date_local,
                    location_country=strava_activity.location_country,
                )

                try:
                    decoded = polyline.decode(strava_activity.map.summary_polyline)
                    activity.summary_polyline = strava_activity.map.summary_polyline
                    if decoded:
                        activity.track = decoded
                except (AttributeError, TypeError):
                    continue
                self.session.add(activity)

        self.session.commit()

    def load(self) -> Tuple[Dict, List[Dict]]:
        athlete = self.session.query(Athlete).first()
        activities = (
            self.session.query(Activity).filter_by(athlete_id=athlete.id).order_by(desc(Activity.start_date_local))
        )

        athlete_dict = athlete.to_dict()
        activity_list = []

        for activity in activities:
            activity.set_pois(self.pois)
            activity_list.append(activity.to_dict())

        return (athlete_dict, activity_list)

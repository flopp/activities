import datetime
import json
import os
import time
import sys

from geopy import distance as geopy_distance
import polyline
import stravalib

from app.valuerange import ValueRange


class Main:
    def __init__(self):
        self.config = None
        self.authdata = None
        self.authdata_changed = False
        self.client = stravalib.Client()
        self.dir = None
        self.pois = None

    def set_strava_app_config(self, strava_app_config):
        for key in ["client_id", "client_secret"]:
            if key not in strava_app_config:
                raise KeyError(f'Key "{key}" is missing from app config.')
        self.config = strava_app_config

    def set_authdata(self, authdata):
        for key in ["access_token", "refresh_token", "expires_at"]:
            if key not in authdata:
                raise KeyError(f'Key "{key}" is missing from auth data.')
        self.authdata = authdata
        self.authdata_changed = False

    def set_data_dir(self, dir):
        self.dir = dir

    def set_points_of_interest(self, pois):
        self.pois = pois

    def check_access(self):
        if time.time() > self.authdata["expires_at"]:
            print("Refreshing access token")
            response = self.client.refresh_access_token(
                client_id=self.config["client_id"],
                client_secret=self.config["client_secret"],
                refresh_token=self.authdata["refresh_token"],
            )
            self.authdata["access_token"] = response["access_token"]
            self.authdata["refresh_token"] = response["refresh_token"]
            self.authdata["expires_at"] = response["expires_at"]
            self.authdata_changed = True

        self.client.access_token = self.authdata["access_token"]
        print("Access ok")

    def sync(self):
        self.check_access()
        athlete = self.client.get_athlete()
        os.makedirs(f"{self.dir}/{athlete.id}", exist_ok=True)
        with open(f"{self.dir}/{athlete.id}/data.json", "w") as f:
            athlete_dict = athlete.to_dict()
            athlete_dict["id"] = athlete.id
            json.dump(athlete_dict, f)
        print("Start syncing")
        for activity in self.client.get_activities(before=datetime.datetime.utcnow()):
            sys.stdout.write(".")
            sys.stdout.flush()
            os.makedirs(f"{self.dir}/{athlete.id}/{activity.id}", exist_ok=True)
            activity_file_name = f"{self.dir}/{athlete.id}/{activity.id}/data.json"
            with open(activity_file_name, "w") as f:
                json.dump(activity.to_dict(), f)

    @staticmethod
    def is_point_on_track(point, track, max_distance_meters=100):
        point_lat, point_lon = point
        for coordinates in track:
            lat, lon = coordinates
            if (
                abs(point_lat - lat) < 0.01
                and abs(point_lon - lon) < 0.01
                and geopy_distance.geodesic(point, coordinates).meters
                < max_distance_meters
            ):
                return True
        return False

    def load(self):
        athlete = {}
        activities = []
        for athlete_folder in [f.path for f in os.scandir(self.dir) if f.is_dir()]:
            athlete_file = os.path.join(athlete_folder, "data.json")
            if not os.path.exists(athlete_file):
                print(f"Not an athlete folder: {athlete_folder}")
                continue
            with open(athlete_file) as f:
                athlete_data = json.load(f)
                keys = ["id", "firstname", "lastname"]
                athlete = dict(
                    (key, athlete_data[key]) for key in keys if key in athlete_data
                )
            for activity_folder in [
                f.path for f in os.scandir(athlete_folder) if f.is_dir()
            ]:
                activity_file = os.path.join(activity_folder, "data.json")
                if not os.path.exists(activity_file):
                    print(f"Not an activity folder: {activity_folder}")
                    continue
                activity = self.load_activity(activity_file)
                activity["strava_id"] = os.path.split(activity_folder)[1]
                activities.append(activity)
            break
        return (
            athlete,
            sorted(activities, key=lambda k: k["start_date_local"], reverse=True),
        )

    def load_activity(self, activity_file):
        with open(activity_file) as f:
            data = json.load(f)
        keys = [
            "name",
            "distance",
            "moving_time",
            "elapsed_time",
            "total_elevation_gain",
            "type",
            "start_date",
            "start_date_local",
            "location_country",
        ]
        activity = dict((key, data[key]) for key in keys if key in data)
        summary_polyline, track = Main.get_polyline(data)
        if summary_polyline:
            activity["summary_polyline"] = summary_polyline
        if track and self.pois:
            lat_range, lon_range = Main.compute_bbox(track)
            track_pois = []
            for (name, point) in self.pois.items():
                lat, lon = point["lat"], point["lon"]
                if not lat_range.contains(lat, 0.01) or not lon_range.contains(
                    lon, 0.01
                ):
                    continue
                if Main.is_point_on_track((lat, lon), track):
                    track_pois.append(name)
            if len(track_pois) > 0:
                activity["pois"] = track_pois
        return activity

    @staticmethod
    def get_polyline(activity):
        if "map" not in activity:
            return None, None
        if "summary_polyline" not in activity["map"]:
            return None, None
        summary_polyline = activity["map"]["summary_polyline"]
        if summary_polyline is None:
            return None, None
        decoded = polyline.decode(summary_polyline)
        return summary_polyline, decoded if len(decoded) > 0 else None

    @staticmethod
    def compute_bbox(track):
        assert len(track) > 0
        lat_range = ValueRange()
        lon_range = ValueRange()
        for (lat, lon) in track:
            lat_range.add(lat)
            lon_range.add(lon)
        return lat_range, lon_range

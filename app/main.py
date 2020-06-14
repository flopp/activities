import datetime
from geopy import distance as geopy_distance
import json
import os
import polyline
import stravalib
import time
from app.valuerange import ValueRange


class Main:
    def __init__(self, config):
        self.config = config
        self.account = None
        self.account_changed = False
        self.client = stravalib.Client()
        self.dir = ".data"
        self.pois = [
            ("Belchen", (47.822496, 7.833198)),
            ("Feldberg", (47.873986, 8.004683)),
            ("Hinterwaldkopf", (47.918979, 8.016681)),
            ("Kandel", (48.062517, 8.011391)),
            ("Kybfelsen", (47.960851, 7.885071)),
            ("Rosskopf", (48.010010, 7.901702)),
            ("Schauinsland", (47.911940, 7.898506)),
            ("Schönberg", (47.954722, 7.805504)), 
        ]

    def set_account(self, account):
        self.account = account
        self.account_changed = False

    def check_access(self):
        assert self.account
        if time.time() > self.account["expires_at"]:
            print("refreshing access token")
            response = self.client.refresh_access_token(
                client_id=self.config["client_id"],
                client_secret=self.config["client_secret"],
                refresh_token=self.account["refresh_token"],
            )
            print(f"response: {response}")
            self.account["access_token"] = response["access_token"]
            self.account["refresh_token"] = response["refresh_token"]
            self.account["expires_at"] = response["expires_at"]
            self.account_changed = True

    def sync(self):
        self.check_access()
        self.client.access_token = self.account["access_token"]
        athlete = self.client.get_athlete()
        os.makedirs(f"{self.dir}/{athlete.id}", exist_ok=True)
        with open(f"{self.dir}/{athlete.id}/data.json", "w") as f:
            json.dump(athlete.to_dict(), f)
        for activity in self.client.get_activities(before=datetime.datetime.utcnow()):
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

    def analyze(self):
        all = []
        for athlete_folder in [f.path for f in os.scandir(self.dir) if f.is_dir()]:
            if not os.path.exists(os.path.join(athlete_folder, "data.json")):
                print(f"Not an athlete folder: {athlete_folder}")
                continue
            for activity_folder in [
                f.path for f in os.scandir(athlete_folder) if f.is_dir()
            ]:
                activity_file = os.path.join(activity_folder, "data.json")
                if not os.path.exists(activity_file):
                    print(f"Not an activity folder: {activity_folder}")
                    continue
                activity = self.load_activity(activity_file)
                activity["strava_id"] = os.path.split(activity_folder)[1]
                all.append(activity)
        with open(".web/activities.js", "w") as all_file:
            all_file.write("activities = ")
            json.dump(sorted(all, key=lambda k: k["start_date_local"], reverse=True), all_file)
            all_file.write(";\n")
        

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
        if track:
            lat_range, lon_range = Main.compute_bbox(track)
            track_pois = []
            for (name, point) in self.pois:
                lat, lon = point
                if not lat_range.contains(lat, 0.01) or not lon_range.contains(
                    lon, 0.01
                ):
                    continue
                if Main.is_point_on_track(point, track):
                    print(f'{name} {data["start_date"]} {data["name"]}')
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

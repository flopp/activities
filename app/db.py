import datetime

from geopy import distance as geopy_distance

from sqlalchemy import (
    create_engine,
    ForeignKey,
    Column,
    Float,
    Integer,
    Interval,
    PickleType,
    String,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

from app.valuerange import ValueRange


Base = declarative_base()


class Athlete(Base):
    __tablename__ = "athletes"

    id = Column(Integer, primary_key=True)
    firstname = Column(String)
    lastname = Column(String)

    def to_dict(self):
        return {"id": self.id, "firstname": self.firstname, "lastname": self.lastname}


def is_point_on_track(point, track, max_distance_meters=100):
    point_lat, point_lon = point
    for coordinates in track:
        lat, lon = coordinates
        if (
            abs(point_lat - lat) < 0.01
            and abs(point_lon - lon) < 0.01
            and geopy_distance.geodesic(point, coordinates).meters < max_distance_meters
        ):
            return True
    return False


ACTIVITY_KEYS = [
    "strava_id",
    "athlete_id",
    "name",
    "distance",
    "moving_time",
    "elapsed_time",
    "total_elevation_gain",
    "type",
    "start_date",
    "start_date_local",
    "location_country",
    "summary_polyline",
]


class Activity(Base):
    __tablename__ = "activities"

    strava_id = Column(Integer, primary_key=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id"))
    athlete = relationship("Athlete")
    name = Column(String)
    distance = Column(Float)
    moving_time = Column(Interval)
    elapsed_time = Column(Interval)
    total_elevation_gain = Column(Float)
    type = Column(String)
    start_date = Column(String)
    start_date_local = Column(String)
    location_country = Column(String)
    summary_polyline = Column(String)
    track = Column(PickleType)

    def bbox(self):
        if self.track:
            lat_range = ValueRange()
            lon_range = ValueRange()
            for (lat, lon) in self.track:
                lat_range.add(lat)
                lon_range.add(lon)
            return lat_range, lon_range
        return None, None

    def set_pois(self, pois):
        if self.track and pois:
            lat_range, lon_range = self.bbox()
            track_pois = []
            for (name, point) in pois.items():
                lat, lon = point["lat"], point["lon"]
                if not lat_range.contains(lat, 0.01) or not lon_range.contains(
                    lon, 0.01
                ):
                    continue
                if is_point_on_track((lat, lon), self.track):
                    track_pois.append(name)

            if track_pois:
                self.pois = track_pois
                return

    def to_dict(self):
        out = {}
        for key in ACTIVITY_KEYS:
            attr = getattr(self, key)
            if isinstance(attr, (datetime.timedelta, datetime.datetime)):
                out[key] = str(attr)
            else:
                out[key] = attr

        if hasattr(self, "pois"):
            out["pois"] = self.pois
        return out


def init_db(db_path):
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()

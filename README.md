# Activities

Your self-hosted activities overview (running, cycling, ...). Synced with [Strava](https://www.strava.com).

https://activities.flopp.net

![Screenshot](https://raw.githubusercontent.com/flopp/activities/master/screenshot.png "Screenshot")

## Usage

### Installation

```
git clone https://github.com/flopp/activities.git
cd activities
python3 -m venv .env
.env/bin/pip install --upgrade pip
.env/bin/pip install .
```

### Fetch API Config from Strava (once!)

1. Create an "Application" on https://www.strava.com/settings/api; for "Authorization Callback Domain" use `localhost`, for all other properties you can basically use whatever you want ;)
2. Copy `config-example.json` to `config.json` and fill in the "Client ID" and the "Client Secret" from the "My API Application" section on https://www.strava.com/settings/api.

### Authenticate with Strava (once!)

```
.env/bin/activities \
    --config config.json \
    --authdata auth.json \
    --register
```

Now a web browser window should open with an "Authenticate with Strava" button. If not, manually open `localhost:5000` in a web browser of your choice. Click "Authenticate with Strava". Allow access for the app.
The authentication data is now saved in `auth.json` for later use.

### Sync

```
.env/bin/activities \
    --config config.json \
    --authdata auth.json \
    --sync \
    ---browser
```

This fetches your Strava data, creates a static website, and opens a browser to view the website.
You can also manually point a web browser of your choice to `file:///INSTALLATION_PATH/web/index.html`...


## Made with

- [Bulma](https://bulma.io/)
- [Click](https://click.palletsprojects.com/)
- [Flask](https://flask.palletsprojects.com/)
- [geopy](https://github.com/geopy/geopy)
- [jQuery](https://jquery.com/)
- [Leaflet.encoded](https://github.com/jieter/Leaflet.encoded)
- [Leaflet](https://leafletjs.com/)
- [polyline](https://github.com/hicsail/polyline)
- [noUiSlider](https://refreshless.com/nouislider/)
- [SQLAlchemy](https://www.sqlalchemy.org)
- [Stravalib](https://github.com/hozn/stravalib)

## License

```
MIT License

Copyright (c) 2020 Florian Pigorsch
```

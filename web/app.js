/* global L, HeatmapOverlay, noUiSlider, the_activities, the_strava_athlete, the_pois, the_last_sync */

$(function() {
    App.init(
        (typeof the_activities !== 'undefined') ? the_activities : [],
        (typeof the_strava_athlete !== 'undefined') ? the_strava_athlete : null,
        (typeof the_pois !== 'undefined') ? the_pois : [],
        (typeof the_last_sync !== 'undefined') ? the_last_sync : "n/a"
    );
});

var App = {
    init: function (activities, athlete, pois, last_sync) {
        this.activities = activities.reverse();
        this.added_activities = 0;
        this.athlete = athlete;
        this.pois = pois;
        this.filter_name = null;
        this.filter_type = null;
        this.filter_category = null;
        this.filter_year = null;
        this.filter_min_distance = 0;
        this.filter_max_distance = null;
        this.max_distance = null;
        this.selected_activity = null;
        this.heatmapActive = false;
        this.heatmapDataInitialized = false;
        this.map = this.initMap();
        this.track = null;
        this.start_point = null;
        this.end_point = null;
        this.initEventHandlers();

        this.start_icon = L.BeautifyIcon.icon({
            icon: 'play-circle',
            iconShape: 'circle',
            borderColor: 'green',
            textColor: 'green'
        });
        this.end_icon = L.BeautifyIcon.icon({
            icon: 'stop-circle',
            iconShape: 'circle',
            borderColor: 'red',
            textColor: 'red'
        });
        this.poi_icon = L.BeautifyIcon.icon({
            icon: 'star',
            iconShape: 'circle',
            borderColor: 'blue',
            textColor: 'blue'
        });

        var activity_id = null;
        const regex = /^#(\d+)$/;
        const match = window.location.hash.match(regex);
        if (match && this.hasActivity(match[1])) {
            activity_id = match[1];
        } else if (this.activities.length > 0) {
            activity_id = this.activities[0]['strava_id'];
        }
        this.populatePois();
        this.populateFilters();
        this.filter_max_distance = this.max_distance;
        this.populateActivities(activity_id);
        this.toggleSidebar("sidebar-activities");
        this.loadActivity(activity_id);
        this.filterActivities('', 'All', 'All', 'All', 0, this.max_distance);
        document.querySelector("#no-activities-message").style.display = "none";
        $('#last-sync').text(`Last Sync: ${last_sync}`);
        if (this.athlete) {
            document.querySelector("#strava-button").href = `https://www.strava.com/athletes/${this.athlete["id"]}`;
        }

    },

    initMap: function() {
        const self = this;

        const openstreetmap = L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: 'map data: © <a href="https://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors'});
        const opentopomap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'map data: © <a href="https://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors, SRTM | map style: © <a href="http://opentopomap.org/" target="_blank">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC-BY-SA</a>)'});
        const cartodark = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png', {
            attribution: 'map data: © <a href="https://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors, SRTM | map style: © <a href="http://opentopomap.org/" target="_blank">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC-BY-SA</a>)'});
        const arcgis_worldimagery = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Source: Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'});
            
        const heatmap_config = {
            // radius should be small ONLY if scaleRadius is true (or small radius is intended)
            // if scaleRadius is false it will be the constant radius used in pixels
            "radius": 0.0007,
            "maxOpacity": .5,
            // scales the radius based on map zoom
            "scaleRadius": true,
            "useLocalExtrema": false,
            latField: 'lat',
            lngField: 'lng',
            valueField: 'count'
        };
        this.heatmap = new HeatmapOverlay(heatmap_config);
    
        const map = L.map('map', {
            center: [48, 8],
            zoom: 13,
            layers: [openstreetmap],
            zoomSnap: 0.33
        });

        L.control.layers({
            "OpenStreetMap": openstreetmap,
            "OpenTopoMap": opentopomap,
            "CARTO dark": cartodark,
            "ArcGIS World Imagery": arcgis_worldimagery,
        }, {
            "Heatmap": this.heatmap,
        }).addTo(map);
        map.zoomControl.setPosition('bottomright');

        map.on('overlayadd', event => {
            if (event.name === "Heatmap") {
                self.onHeatmapToggle(true);
            }
        });
        map.on('overlayremove', event => {
            if (event.name === "Heatmap") {
                self.onHeatmapToggle(false);
            }
        });

        return map;
    },

    initEventHandlers: function() {
        var self = this;
        /*
         * Add click event handlers for objects of class 'activity', 'type', or
         * 'category' that are created in the future.
         */ 
        document.addEventListener('click', event => {
            var obj = event.target;
            while (obj.parentElement !== null &&
                   !obj.classList.contains('activity') &&
                   !obj.classList.contains('type') &&
                   !obj.classList.contains('category') &&
                   !obj.classList.contains('year')
            ) {
                obj = obj.parentElement;
            }

            if (obj.classList.contains('activity')) {
                self.clickActivity(obj.dataset.id);
                event.stopPropagation();
            } else if (obj.classList.contains('type')) {
                self.setTypeFilter(obj.dataset.type);
                event.stopPropagation();
            } else if (obj.classList.contains('category')) {
                self.setCategoryFilter(obj.dataset.category);
                event.stopPropagation();
            } else if (obj.classList.contains('year')) {
                self.setCategoryFilter(obj.dataset.year);
                event.stopPropagation();
            }
        }, false);
        $("#filter-name").change(function () {
            self.setNameFilter($(this).val());
        });
        $("#filter-type")
            .change(function () {
                var type = null;
                $("#filter-type option:selected").each(function() {
                    type = $(this).val();
                });
                self.setTypeFilter(type);
            });
        $("#filter-category")
            .change(function () {
                var category = null;
                $("#filter-category option:selected").each(function() {
                    category = $(this).val();
                });
                self.setCategoryFilter(category);
            });
        $("#filter-year")
            .change(function () {
                var year = null;
                $("#filter-year option:selected").each(function() {
                    year = $(this).val();
                });
                self.setYearFilter(year);
            });

        $("#prev-button").click(function() {
            self.loadPrevActivity();
        });
        $("#next-button").click(function() {
            self.loadNextActivity();
        });

        document.querySelectorAll(".statistics-button").forEach(button => {
            button.onclick = () => {
                self.loadActivity(button.dataset.id);
            }
        });

        document.querySelectorAll(".sidebar-control").forEach(control => {
            const container_id = control.dataset.container;
            const container = document.getElementById(container_id);

            container.querySelector(".header > .close").onclick = () => {
                self.toggleSidebar(null);
            };

            control.querySelector("a").onclick = () => {
                self.toggleSidebar(container_id);
            };
        });
    },

    populatePois: function() {
        const self = this;
        if (!this.pois) {
            return;
        }

        this.pois.forEach(poi => {
            L.marker(L.latLng(poi["lat"], poi["lon"]), {icon: self.poi_icon, title: poi["name"]}).addTo(self.map);
        });
    },

    populateFilters: function() {
        const self = this;
        var types = new Set();
        var categories = new Set();
        var years = new Set();
        this.max_distance = 0;

        this.activities.forEach(activity => {
            self.max_distance = Math.max(activity['distance'], self.max_distance);
            types.add(activity['type']);
            years.add(activity['start_date_local'].slice(0, 4));
            if ('pois' in activity) {
                activity['pois'].forEach(category => {
                    categories.add(category);
                });
            }
        });
        this.max_distance = Math.ceil(this.max_distance / 1000.0);

        $('#filter-type').append(
            $('<option value="All">All</option>')
        );
        Array.from(types).sort().forEach(type => {
            $('#filter-type').append(
                $(`<option value="${type}">${type}</option>`)
            );
        });
        $('#filter-category').append(
            $('<option value="All">All</option>')
        );
        Array.from(categories).sort().forEach(category => {
            $('#filter-category').append(
                $(`<option value="${category}">${category}</option>`)
            );
        });
        $('#filter-year').append(
            $('<option value="All">All</option>')
        );
        Array.from(years).sort().forEach(year => {
            $('#filter-year').append(
                $(`<option value="${year}">${year}</option>`)
            );
        });

        const distance_slider = document.getElementById('filter-distance');
        noUiSlider.create(distance_slider, {
            start: [0, self.max_distance],
            connect: true,
            range: {
                'min': 0,
                'max': self.max_distance
            },
            format: {
                to: function (value) {
                    return value.toFixed(0);
                },
                from: function (value) {
                    return Number(value);
                }
            },
            step: 1,
            tooltips: true
        });
        distance_slider.noUiSlider.on('set', function () {
            const range = this.get();
            self.setDistanceFilter(Number(range[0]), Number(range[1]));
        });
    },

    displayPolyline: function(polyline) {
        if (this.track) {
            this.track.remove();
            this.track = null;
        }
        if (this.start_point) {
            this.start_point.remove();
            this.start_point = null;
        }
        if (this.end_point) {
            this.end_point.remove();
            this.end_point = null;
        }
        if (polyline !== null && polyline !== '') {
            const decoded = L.PolylineUtil.decode(polyline);
            this.track = L.polyline(decoded, {
                color: 'red',
                distanceMarkers: {iconSize: [20, 14] },
           }).addTo(this.map);
            if (decoded.length > 0) {
                this.start_point = L.marker(decoded[0], {icon: this.start_icon}).addTo(this.map);
                this.end_point = L.marker(decoded.slice(-1)[0], {icon: this.end_icon}).addTo(this.map);
            }
            this.map.fitBounds(this.track.getBounds(), {padding: [64, 64]});
        }
    },

    hasActivity: function(id) {
        return this.getActivity(id) !== undefined;
    },

    getActivity: function(id) {
        return this.activities.find(activity => {
            return activity['strava_id'] == id;
        });
    },

    clickActivity: function(id) {
        if (this.selected_activity === id) {
            this.loadActivity(null);
        } else {
            this.loadActivity(id);
        }
    },
 
    loadActivity: function(id) {
        this.selected_activity = id;
        document.querySelectorAll('.activity').forEach(div => {
            div.classList.remove('is-info');
        });
        if (id === null) {
            window.location.hash = "#";
            this.displayPolyline(null);
            $("#preview-image").attr("content", "");
        } else {
            window.location.hash = `#${id}`;
            const activity_div = document.querySelector(`.activity[data-id="${id}"]`);
            activity_div.classList.add('is-info');
            activity_div.scrollIntoView({behavior: "smooth", block: "nearest", inline: "nearest"});
            var polyline = null;
            const activity = this.getActivity(id);
            if (activity !== undefined) {
                if ('summary_polyline' in activity) {
                    polyline = activity['summary_polyline'];
                }
                $("#activity-name").text(activity['name']);
                $("#activity-date").text(activity['start_date_local'].replace('T', ' '));
                $("#activity-distance").text(this.format_distance(activity['distance']));
                $("#activity-time").text(activity['moving_time']);
                $("#preview-image").attr('content', `img/${id}.png`);
            }
            this.displayPolyline(polyline);
        }
    },

    loadPrevActivity: function() {
        const self = this;
        var load = null;
        var found = false;

        this.activities.forEach(activity => {
            if (!self.matchesFilter(activity)) {
                return;
            }
            const id = activity['strava_id'];
            if (!found) {
                if (id == self.selected_activity) {
                    found = true;
                }
            } else if (load === null) {
                load = id;
            }
        });

        if (load !== null && found) {
            this.loadActivity(load);
        }
    },

    loadNextActivity: function() {
        const self = this;
        var load = null;
        var found = false;

        this.activities.forEach(activity => {
            if (!self.matchesFilter(activity)) {
                return;
            }
            const id = activity['strava_id'];
            if (!found) {
                if (id == self.selected_activity) {
                    found = true;
                } else {
                    load = id;
                }
            }
        });

        if (load !== null && found) {
            this.loadActivity(load);
        }
    },

    matchesFilter: function(activity) {
        if (this.filter_name !== null && this.filter_name !== '') {
            if (!activity['name'].toLowerCase().includes(this.filter_name.toLowerCase())) {
                return false;
            }
        }
        if (this.filter_type !== null && this.filter_type !== 'All') {
            if (activity['type'] !== this.filter_type) {
                return false;
            }
        }
        if (this.filter_year !== null && this.filter_year !== 'All') {
            if (activity['start_date_local'].slice(0, 4) !== this.filter_year) {
                return false;
            }
        }
        if (this.filter_category !== null && this.filter_category !== 'All') {
            if (!('pois' in activity) || !(activity['pois'].includes(this.filter_category))) {
                return false;
            }
        }
        const distance = activity['distance'] / 1000.0;
        if (distance < this.filter_min_distance || distance > this.filter_max_distance) {
            return false;
        }

        return true;
    },

    setNameFilter: function(name) {
        this.filterActivities(
            name,
            this.filter_type,
            this.filter_category,
            this.filter_year,
            this.filter_min_distance,
            this.filter_max_distance);
    },

    setTypeFilter: function(type) {
        this.filterActivities(
            this.filter_name,
            type,
            this.filter_category,
            this.filter_year,
            this.filter_min_distance,
            this.filter_max_distance);
    },

    setYearFilter: function(year) {
        this.filterActivities(
            this.filter_name,
            this.filter_type,
            this.filter_category,
            year,
            this.filter_min_distance,
            this.filter_max_distance);
    },

    setCategoryFilter: function(category) {
        this.filterActivities(
            this.filter_name,
            this.filter_type,
            category,
            this.filter_year,
            this.filter_min_distance,
            this.filter_max_distance);
    },

    setDistanceFilter: function(min_distance, max_distance) {
        this.filterActivities(
            this.filter_name,
            this.filter_type,
            this.filter_category,
            this.filter_year,
            min_distance,
            max_distance);
    },

    filterActivities: function(name, type, category, year, min_distance, max_distance) {
        if (name === this.filter_name &&
            type === this.filter_type &&
            category === this.filter_category &&
            year === this.filter_year &&
            min_distance === this.filter_min_distance &&
            max_distance === this.filter_max_distance
        ) {
            return;
        }
        this.filter_name = name;
        this.filter_type = type;
        this.filter_category = category;
        this.filter_year = year;
        this.filter_min_distance = min_distance;
        this.filter_max_distance = max_distance;
        document.querySelector('#filter-name').value = name;
        document.querySelector(`#filter-type [value="${type}"]`).selected = true;
        document.querySelector(`#filter-category [value="${category}"]`).selected = true;
        document.querySelector(`#filter-year [value="${year}"]`).selected = true;
        document.getElementById('filter-distance').noUiSlider.set([min_distance, max_distance]);
        var self = this;
        var first_activity = null;
        var selected_found = false;

        var count = 0;
        var distance_sum = 0;
        var distance_max = 0;
        var distance_max_id = null;
        var elevation_sum = 0;
        var elevation_max = 0;
        var elevation_max_id = null;
        var time_sum = 0;
        var time_max = 0;
        var time_max_id = null;
        const types = new Map();
        this.activities.forEach(item => {
            const activity_id = item['strava_id']
            const div = document.querySelector(`.activity[data-id="${activity_id}"]`);
            const match = self.matchesFilter(item);

            if (div) {
                div.style.display = match ? "block" : "none";
            }
            if (match) {
                if (!first_activity) {
                    first_activity = activity_id;
                }
                if (self.selected_activity == activity_id) {
                    selected_found = true;
                }
                count += 1;

                if (types.has(item['type'])) {
                    types.set(item['type'], types.get(item['type']) + 1);
                } else {
                    types.set(item['type'], 1);
                }

                distance_sum += item['distance'];
                if (distance_max_id === null || item['distance'] > distance_max) {
                    distance_max_id = activity_id;
                    distance_max = item['distance'];
                }

                elevation_sum += item['total_elevation_gain'];
                if (elevation_max_id === null || item['total_elevation_gain'] > elevation_max) {
                    elevation_max_id = activity_id;
                    elevation_max = item['total_elevation_gain'];
                }

                const time = this.parse_duration(item['moving_time'])
                time_sum += time;
                if (time_max_id === null || time > time_max) {
                    time_max_id = activity_id;
                    time_max = time;
                }
            }
        });

        this.statistics_distance_max_id = distance_max_id;
        this.statistics_elevation_max_id = elevation_max_id;
        this.statistics_time_max_id = time_max_id;

        document.querySelector('#filter-matches').textContent = `${count} / ${this.activities.length}`;
        document.querySelector('#no-activities-message').style.display = (count === 0) ? "block" : "none";

        document.querySelector('#statistics-count').textContent = `${count}`;
        if (count > 0) {
            document.querySelectorAll('.statistics-table-type-row').forEach(row => {
                row.remove();
            });
            var before = document.querySelector('#statistics-table-types').nextElementSibling;
            types.forEach((value, key) => {
                const tr = document.createElement("tr");
                tr.classList.add("statistics-table-type-row");
                const td1 = document.createElement("td");
                td1.appendChild(document.createTextNode(key));
                tr.appendChild(td1);
                const td2 = document.createElement("td");
                td2.colSpan = 2;
                td2.appendChild(document.createTextNode(value));
                tr.appendChild(td2);
                before.parentNode.insertBefore(tr, before);
            });
            document.querySelector('#statistics-distance-max-button').dataset.id = distance_max_id;
            document.querySelector('#statistics-elevation-max-button').dataset.id = elevation_max_id;
            document.querySelector('#statistics-time-max-button').dataset.id = time_max_id;

            document.querySelector('#statistics-distance-sum').textContent = this.format_distance(distance_sum);
            document.querySelector('#statistics-distance-avg').textContent = this.format_distance(distance_sum / count);
            document.querySelector('#statistics-distance-max').textContent = this.format_distance(distance_max);
            
            document.querySelector('#statistics-elevation-sum').textContent = this.format_elevation(elevation_sum);
            document.querySelector('#statistics-elevation-avg').textContent = this.format_elevation(elevation_sum / count);
            document.querySelector('#statistics-elevation-max').textContent = this.format_elevation(elevation_max);
            
            document.querySelector('#statistics-time-sum').textContent = this.format_duration(time_sum);
            document.querySelector('#statistics-time-avg').textContent = this.format_duration(time_sum / count);
            document.querySelector('#statistics-time-max').textContent = this.format_duration(time_max);

            document.querySelector('#statistics-table').style.display = "table";
        } else {
            document.querySelector('#statistics-table').style.display = "none";
        }

        if (selected_found) {
            this.loadActivity(this.selected_activity);
        } else {
            this.loadActivity(first_activity);
        }

        this.fillHeatmap();
    },

    format_distance: function (d) {
        return `${(d / 1000.0).toFixed(2)} km`;
    },

    format_elevation: function (d) {
        return `${d.toFixed(0)} m`;
    },

    parse_duration: function (s) {
        var a = /^(\d+):(\d\d):(\d\d)$/.exec(s);
        if (a === null) {
            console.log("Failed to parse duration:", s);
            return 0;
        }
        return 3600 * parseInt(a[1]) + 60 * parseInt(a[2]) + parseInt(a[3]);
    },

    format_duration: function (d) {
        const secondsPerDay = 24 * 60 * 60;
        if (d < secondsPerDay) {
            return new Date(d * 1000).toISOString().substr(11, 8);
        } else {
            const days = Math.floor(d / secondsPerDay);
            return `${days}d ${new Date((d - days * secondsPerDay) * 1000).toISOString().substr(11, 8)}`;
        }
    },

    format_pace: function (d) {
        const pace = (1000.0 / 60.0) * (1.0 / d);
        const minutes = Math.floor(pace);
        const seconds = Math.floor((pace - minutes) * 60.0); 
        return `${minutes}:${seconds.toFixed(0).toString().padStart(2, "0")} min/km`;
    },

    format_heartrate: function (d) {
        return `${d.toFixed(0)} bpm`;
    },

    populateActivities: function(search_id) {
        var self = this;

        // initially load 20 activities or enough activities until 'search_id' is found.
        var init = (self.added_activities === 0);
        var count = 0;
        var idFound = false;
        this.activities.forEach(activity => {
            const activity_id = activity['strava_id'];
            const div = document.querySelector(`.activity[data-id="${activity_id}"]`);
            if (div) {
                return;
            }
            if (activity_id == search_id) {
                idFound = true;
                self.createActivityDiv(activity);
            } else {
                if (init) {
                    count += 1;
                    if ((count > 20) && (search_id === null || idFound)) {
                        return;
                    }
                }
                self.createActivityDiv(activity);
            }
        });

        // schedule loading the remaining activities
        if (this.added_activities < this.activities.length) {
            setTimeout(function() {
                self.populateActivities(null);
            }, 1000);
        }
    },

    createActivityDiv: function(activity) {
        this.added_activities += 1;
        const strava_id = activity['strava_id'];
        var activity_div = $('<div class="notification activity">')
                .attr('data-id', strava_id);
        var title = `<strong>${activity['name']}</strong>`;
        var table_items = [];
        table_items.push({icon: "far fa-calendar-alt", value: activity['start_date_local'].replace('T', ' ')});
        table_items.push({icon: "far fa-question-circle", value: `<a class="type" data-type="${activity['type']}">${activity['type']}</a>`});
        table_items.push({icon: "fas fa-arrows-alt-h", value: this.format_distance(activity['distance'])});
        table_items.push({icon: "fas fa-arrows-alt-v", value: this.format_elevation(activity['total_elevation_gain'])});
        table_items.push({icon: "fas fa-stopwatch", value: activity['moving_time']});
        if (activity['average_speed'] !== null) {
            table_items.push({icon: "fas fa-tachometer-alt", value: this.format_pace(activity['average_speed'])});
        }
        if (activity['average_heartrate'] !== null) {
            table_items.push({icon: "fas fa-heartbeat", value: this.format_heartrate(activity['average_heartrate'])});
        }
        if ('streak' in activity) {
            table_items.push({icon: "fas fa-hashtag", value: `${activity['streak']}`});
        }
        if ('pois' in activity) {
            var links = [];
            activity['pois'].forEach(category => {
                links.push(`<a class="category" data-category="${category}">${category}</a>`);
            });
            if (links.length > 0) {
                table_items.push({icon: "fas fa-map-marker-alt", value: links.join(' · ')});
            }
        }
        var strava = `<small><a href="https://www.strava.com/activities/${strava_id}" target="_blank">View on Strava</a></small>`;
        var content = $(`${title}<br />${this.createTable(table_items)}<br />${strava}`);
        activity_div.append(content);
        $('#activities').append(activity_div);
    },

    createTable: function(table_items) {
        var contents = [];
        table_items.forEach(item => {
            const icon = item['icon'];
            const value = item['value'];
            contents.push(`<span class="icon is-small"><i class="${icon}"></i></span><span class="value">${value}</span>`);
        });
        return contents.join('<br />');
    },

    toggleSidebar: function(id) {
        if (!id || document.getElementById(id).classList.contains("active")) {
            document.querySelector("#sidebar").classList.remove("sidebar-open");
            document.querySelector("#sidebar-controls").classList.remove("sidebar-open");
            document.querySelector("#bottombar").classList.remove("sidebar-open");
            document.querySelector("#map").classList.remove("sidebar-open");
            document.querySelectorAll(".sidebar-control").forEach(control => {
                const container_id = control.dataset.container;
                const container = document.getElementById(container_id);
                control.classList.remove("active");
                container.classList.remove("active");
            });
        } else {
            document.querySelector("#sidebar").classList.add("sidebar-open");
            document.querySelector("#sidebar-controls").classList.add("sidebar-open");
            document.querySelector("#bottombar").classList.add("sidebar-open");
            document.querySelector("#map").classList.add("sidebar-open");
            document.querySelectorAll(".sidebar-control").forEach(control => {
                const container_id = control.dataset.container;
                const container = document.getElementById(container_id);
                if (container_id === id) {
                    control.classList.add("active");
                    container.classList.add("active");
                } else {
                    control.classList.remove("active");
                    container.classList.remove("active");
                }
            });

            if (id == "sidebar-activities") {
                const activity_div = document.querySelector(`.activity[data-id="${this.selected_activity}"]`);
                if (activity_div) {
                    activity_div.classList.add('is-info');
                    activity_div.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "nearest"
                    });
                }
            }
        }

        this.map.invalidateSize(false);
    },

    onHeatmapToggle: function (on) {
        const self = this;

        if (this.heatmapActive === on) {
            return;
        }
        this.heatmapActive = on;

        if (on) {
            if (this.heatmapDataInitialized) {
                self.fillHeatmap();
            } else {
                $("#heatmap-modal").addClass("is-active");
                setTimeout(() => {
                    self.fillHeatmap();
                    self.heatmapDataInitialized = true;
                    $("#heatmap-modal").removeClass("is-active");
                }, 0);
            }
        }
    },

    getHeatmapPointsForActivity: function (activity) {
        const self = this;

        if ('heatmap_points' in activity) {
            return activity['heatmap_points'];
        }

        const points = new Map();
        if (!('summary_polyline' in activity)) {
            activity['heatmap_points'] = points;
            return points;
        }
        
        const polyline = activity['summary_polyline'];
        if (polyline === null || polyline === "") {
            activity['heatmap_points'] = points;
            return points;
        }

        const latlngs = L.PolylineUtil.decode(polyline).map(a => {
            return L.latLng(a[0], a[1]);
        });
        const accumulated = L.GeometryUtil.accumulatedLengths(latlngs);
        const length = accumulated.length > 0 ? accumulated[accumulated.length - 1] : 0;
        const offset = 25;
        const count = Math.floor(length / offset);

        var j = 0;
        for (var i = 1; i <= count; ++i) {
            const distance = offset * i;
            while ((j < (accumulated.length - 1)) && (accumulated[j] < distance)) {
                ++j;
            }
            const p1 = latlngs[j - 1];
            const p2 = latlngs[j];
            const ratio = (distance - accumulated[j - 1]) / (accumulated[j] - accumulated[j - 1]);
            const position = L.GeometryUtil.interpolateOnLine(self.map, [p1, p2], ratio);
            const key = `${position.latLng.lat.toFixed(4)}/${position.latLng.lng.toFixed(4)}`;
            if (points.has(key)) {
                points.get(key).count += 1;
            } else {
                points.set(key, {
                    lat: Number(Math.round(position.latLng.lat + 'e4') + 'e-4'),
                    lng: Number(Math.round(position.latLng.lng + 'e4') + 'e-4'),
                    count: 1
                });
            }
        }

        activity['heatmap_points'] = points;
        return points;
    },

    fillHeatmap: function() {
        if (!this.heatmapActive) {
            return;
        }

        const self = this;
        const points = new Map();
        this.activities.forEach(activity => {
            const match = self.matchesFilter(activity);
            if (!match) {
                return;
            }

            self.getHeatmapPointsForActivity(activity).forEach((value, key) => {
                if (points.has(key)) {
                    points.get(key).count += value.count;
                } else {
                    points.set(key, {
                        lat: value.lat,
                        lng: value.lng,
                        count: value.count
                    });
                }
            });
        });

        var max = 0;
        points.forEach(d => {
            if (d['count'] > max) {
                max = d['count'];
            }
        });

        const data = [];
        points.forEach(d => {
            data.push({lat: d.lat, lng: d.lng, count: Math.log(1 + d.count)});
        });

        this.heatmap.setData({max: Math.log(1 + max), data: data});
    }
};

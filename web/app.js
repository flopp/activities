/* global L, noUiSlider, the_activities, the_strava_athlete, the_last_sync */

$(function() {
    App.init(
        (typeof the_activities !== 'undefined') ? the_activities : [],
        (typeof the_strava_athlete !== 'undefined') ? the_strava_athlete : null,
        (typeof the_last_sync !== 'undefined') ? the_last_sync : "n/a"
    );
});

var App = {
    init: function(activities, athlete, last_sync) {
        this.activities = activities.reverse();
        this.added_activities = 0;
        this.athlete = athlete;
        this.filter_name = null;
        this.filter_type = null;
        this.filter_category = null;
        this.filter_min_distance = 0;
        this.filter_max_distance = null;
        this.max_distance = null;
        this.selected_activity = null;
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

        var activity_id = null;
        const regex = /^#(\d+)$/;
        const match = window.location.hash.match(regex);
        if (match && this.hasActivity(match[1])) {
            activity_id = match[1];
        } else if (this.activities.length > 0) {
            activity_id = this.activities[0]['strava_id'];
        }
        this.populateFilters();
        this.filter_max_distance = this.max_distance;
        this.populateActivities(activity_id);
        this.toggleSidebar("sidebar-activities");
        this.loadActivity(activity_id);
        this.filterActivities('', 'All', 'All', 0, this.max_distance);
        document.querySelector("#no-activities-message").style.display = "none";
        $('#last-sync').text(`Last Sync: ${last_sync}`);
        if (this.athlete) {
            document.querySelector("#strava-button").href = `https://www.strava.com/athletes/${this.athlete["id"]}`;
        }

    },

    initMap: function() {
        const openstreetmap = L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: 'map data: © <a href="https://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors'});
        const opentopomap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'map data: © <a href="https://osm.org/copyright" target="_blank">OpenStreetMap</a> contributors, SRTM | map style: © <a href="http://opentopomap.org/" target="_blank">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC-BY-SA</a>)'});

        const map = L.map('map', {
            center: [48, 8],
            zoom: 13,
            layers: [openstreetmap],
            zoomSnap: 0.33
        });

        L.control.layers({"OpenStreetMap": openstreetmap, "OpenTopoMap": opentopomap}, {}).addTo(map);
        map.zoomControl.setPosition('bottomright');

        return map;
    },

    initEventHandlers: function() {
        var self = this;
        /*
         * Add click event handlers for objects of class 'activity', 'type', or
         * 'category' that are created in the future.
         */ 
        document.addEventListener('click', event => {
            if (event.target.classList.contains('activity')) {
                self.loadActivity(event.target.dataset.id);
            } else if (event.target.classList.contains('type')) {
                self.setTypeFilter(event.target.dataset.type);
            } else if (event.target.classList.contains('category')) {
                self.setCategoryFilter(event.target.dataset.category);
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

        $("#prev-button").click(function() {
            self.loadPrevActivity();
        });
        $("#next-button").click(function() {
            self.loadNextActivity();
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

    populateFilters: function() {
        const self = this;
        var types = new Set();
        var categories = new Set();
        this.max_distance = 0;

        this.activities.forEach(activity => {
            self.max_distance = Math.max(activity['distance'], self.max_distance);
            types.add(activity['type']);
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
            this.map.fitBounds(this.track.getBounds());
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

    loadActivity: function(id) {
        this.selected_activity = id;
        document.querySelectorAll('.activity').forEach(div => {
            div.classList.remove('is-info');
        });
        if (id === null) {
            window.location.hash = "#";
            this.displayPolyline(null);
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
                $("#activity-distance").text(`${(activity['distance'] / 1000).toFixed(2)} km`);
                $("#activity-time").text(activity['moving_time']);
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
            this.filter_min_distance,
            this.filter_max_distance);
    },

    setTypeFilter: function(type) {
        this.filterActivities(
            this.filter_name,
            type,
            this.filter_category,
            this.filter_min_distance,
            this.filter_max_distance);
    },

    setCategoryFilter: function(category) {
        this.filterActivities(
            this.filter_name,
            this.filter_type,
            category,
            this.filter_min_distance,
            this.filter_max_distance);
    },

    setDistanceFilter: function(min_distance, max_distance) {
        this.filterActivities(
            this.filter_name,
            this.filter_type,
            this.filter_category,
            min_distance,
            max_distance);
    },

    filterActivities: function(name, type, category, min_distance, max_distance) {
        if (name === this.filter_name &&
            type === this.filter_type &&
            category === this.filter_category &&
            min_distance === this.filter_min_distance &&
            max_distance === this.filter_max_distance
        ) {
            return;
        }
        this.filter_name = name;
        this.filter_type = type;
        this.filter_category = category;
        this.filter_min_distance = min_distance;
        this.filter_max_distance = max_distance;
        document.querySelector('#filter-name').value = name;
        document.querySelector(`#filter-type [value="${type}"]`).selected = true;
        document.querySelector(`#filter-category [value="${category}"]`).selected = true;
        document.getElementById('filter-distance').noUiSlider.set([min_distance, max_distance]);
        var self = this;
        var first_activity = null;
        var selected_found = false;

        var count = 0;
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
            }
        });

        document.querySelector('#filter-matches').textContent = `${count} / ${this.activities.length}`;
        document.querySelector('#no-activities-message').style.display = (count === 0) ? "block" : "none";

        if (selected_found) {
            this.loadActivity(this.selected_activity);
        } else {
            this.loadActivity(first_activity);
        }
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
        table_items.push({icon: "fas fa-arrows-alt-h", value: `${(activity['distance'] / 1000).toFixed(2)} km`});
        table_items.push({icon: "fas fa-arrows-alt-v", value: `${activity['total_elevation_gain']} m`});
        table_items.push({icon: "fas fa-stopwatch", value: activity['moving_time']});
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
    }
};

$(function() {
    App.init(
        (typeof the_activities !== 'undefined') ? the_activities : [],
        (typeof the_strava_athlete !== 'undefined') ? the_strava_athlete : null,
        (typeof the_last_sync !== 'undefined') ? the_last_sync : "n/a"
    );
});

var App = {
    init: function(activities, athlete, last_sync) {
        this.activities = activities;
        this.added_activities = 0;
        this.athlete = athlete;
        this.filter_name = null;
        this.filter_type = null;
        this.filter_category = null;
        this.selected_activity = null;
        this.map = this.initMap();
        this.track = null;
        this.initEventHandlers();

        var activity_id = null;
        const regex = /^#(\d+)$/;
        const match = window.location.hash.match(regex);
        if (match && this.hasActivity(match[1])) {
            activity_id = match[1];
        } else if (this.activities.length > 0) {
            activity_id = this.activities[0]['strava_id'];
        }
        this.populateFilters();
        this.populateActivities(activity_id);
        this.toggleSidebar("sidebar-activities");
        this.loadActivity(activity_id);
        this.filterActivities('', 'All', 'All');
        $('#no-activities-message').hide();
        $('#last-sync').text(`Last Sync: ${last_sync}`);
        if (this.athlete) {
            $('#strava-button').attr('href', `https://www.strava.com/athletes/${this.athlete["id"]}`);
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
            layers: [openstreetmap]
        });

        L.control.layers({"OpenStreetMap": openstreetmap, "OpenTopoMap": opentopomap}, {}).addTo(map);
        map.zoomControl.setPosition('bottomright');

        return map;
    },

    initEventHandlers: function() {
        var self = this;
        $(document).on('click', '.activity', function () {
            self.loadActivity($(this).data('id'));
        });
        $("#prev-button").click(function() {
            self.loadPrevActivity();
        });
        $("#next-button").click(function() {
            self.loadNextActivity();
        });
        $(document).on('click', '.type', function () {
            const type = $(this).data('type');
            self.filterActivities(self.filter_name, type, self.filter_category);
        });
        $(document).on('click', '.category', function () {
            const category = $(this).data('category');
            self.filterActivities(self.filter_name, self.filter_type, category);
        });
        $("#filter-name").change(function () {
            self.filterActivities($(this).val(), self.filter_type, self.filter_category);
        });
        $("#filter-type")
            .change(function () {
                var type = null;
                $("#filter-type option:selected").each(function() {
                    type = $(this).val();
                });
                self.filterActivities(self.filter_name, type, self.filter_category);
            });
        $("#filter-category")
            .change(function () {
                var category = null;
                $("#filter-category option:selected").each(function() {
                    category = $(this).val();
                });
                self.filterActivities(self.filter_name, self.filter_type, category);
            });
        
        document.querySelectorAll(".sidebar-control").forEach(control => {
            const container_id = control.dataset.container;
            const container = document.getElementById(container_id);
        
            container.querySelector(".header > .close").onclick = event => {
                self.toggleSidebar(null);
            };
    
            const a = control.getElementsByTagName("a")[0];
            a.onclick = event => {
                self.toggleSidebar(container_id);
            };
        });
    },

    populateFilters: function() {
        var types = new Set();
        var categories = new Set();
        this.activities.forEach(item => {
            types.add(item['type']);
            if ('pois' in item) {
                item['pois'].forEach(category => {
                    categories.add(category);
                });
            }
        });

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
    },

    displayPolyline: function(polyline) {
        if (this.track) {
            this.track.remove();
            this.track = null;
        }
        if (polyline !== null && polyline !== '') {
            const decoded = L.PolylineUtil.decode(polyline);
            this.track = L.polyline(decoded).addTo(this.map);
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
        $('.activity').removeClass('is-info');
        if (id === null) {
            window.location.hash = "#";
            this.displayPolyline(null);
        } else {
            window.location.hash = `#${id}`;
            const activity_div = $(`.activity[data-id="${id}"]`);
            activity_div.addClass('is-info');
            activity_div[0].scrollIntoView({behavior: "smooth", block: "nearest", inline: "nearest"});
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

        return true;
    },

    filterActivities: function(name, type, category) {
        if (name === this.filter_name &&
            type === this.filter_type &&
            category === this.filter_category
        ) {
            return;
        }
        this.filter_name = name;
        this.filter_type = type;
        this.filter_category = category;
        $('#filter-name').val(name);
        $('#filter-type').val(type);
        $('#filter-category').val(category);

        var self = this;
        var first_activity = null;
        var selected_found = false;

        var count = 0;
        this.activities.forEach(item => {
            const activity_id = item['strava_id'];
            const div = $(`.activity[data-id="${activity_id}"]`);
            if (!self.matchesFilter(item)) {
                div.hide();
            } else {
                div.show();
                if (!first_activity) {
                    first_activity = activity_id;
                }
                if (self.selected_activity == activity_id) {
                    selected_found = true;
                }
                count += 1;
            }
        });

        $('#filter-matches').text(`${count} / ${this.activities.length}`);
        if (count === 0) {
            $('#no-activities-message').show();
        } else {
            $('#no-activities-message').hide();
        }

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
            if ($(`.activity[data-id="${activity_id}"]`).length > 0) {
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
        table_items.push({icon: "fas fa-stopwatch",    value: activity['moving_time']});
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
            document.getElementById("sidebar").classList.remove("sidebar-open");
            document.getElementById("sidebar-controls").classList.remove("sidebar-open");
            document.getElementById("bottombar").classList.remove("sidebar-open");
            document.getElementById("map").classList.remove("sidebar-open");
            document.querySelectorAll(".sidebar-control").forEach(control => {
                const container_id = control.dataset.container;
                const container = document.getElementById(container_id);
                control.classList.remove("active");
                container.classList.remove("active");
            });
        } else {
            document.getElementById("sidebar").classList.add("sidebar-open");
            document.getElementById("sidebar-controls").classList.add("sidebar-open");
            document.getElementById("bottombar").classList.add("sidebar-open");
            document.getElementById("map").classList.add("sidebar-open");
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
                const activity_div = $(`.activity[data-id="${this.selected_activity}"]`);
                activity_div.addClass('is-info');
                if (activity_div.length > 0) {
                    activity_div[0].scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "nearest"
                    });
                }
            };
        }

        this.map.invalidateSize(false);
    }
};

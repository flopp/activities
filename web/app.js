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
        this.athlete = athlete;
        this.filter_name = null;
        this.filter_type = null;
        this.filter_category = null;
        this.selected_activity = null;
        this.map = this.initMap();
        this.track = null;
        this.initEventHandlers();
        this.populateFilters();
        this.populateActivities();
        this.filterActivities('', 'All', 'All');
        $('#last-sync').text(`Last Sync: ${last_sync}`);
        if (this.athlete) {
            $('#strava-button').attr('href', `https://www.strava.com/athletes/${this.athlete["id"]}`);
        }

        this.toggleSidebar("sidebar-activities");
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

    loadActivity: function(id) {
        this.selected_activity = id;
        $('.activity').removeClass('is-info');
        if (id === null) {
            this.displayPolyline(null);
        } else {
            const activity = $(`.activity[data-id="${id}"]`);
            activity.addClass('is-info');
            activity[0].scrollIntoView({behavior: "smooth", block: "nearest", inline: "nearest"});
            var polyline = null;
            this.activities.forEach(item => {
                if (item['strava_id'] == id) {
                    if ('summary_polyline' in item) {
                        polyline = item['summary_polyline'];
                    }
                    return;
                }
            });
            this.displayPolyline(polyline);
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
        if (name === this.filter_name && type === this.filter_type && category === this.filter_category) {
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

    populateActivities: function() {
        var self = this;
        var first_activity = null;
        
        if (this.activities.length > 0) {
            $('#no-activities-message').hide();
        } else {
            $('#no-activities-message').show();
        }

        this.activities.forEach(item => {
            var activity_div = $('<div class="notification activity">')
                .attr('data-id', item['strava_id']);
            var title = `<strong>${item['name']}</strong>`;
            var table_items = [];
            table_items.push({icon: "far fa-calendar-alt", value: item['start_date_local'].replace('T', ' ')});
            table_items.push({icon: "far fa-question-circle", value: `<a class="type" data-type="${item['type']}">${item['type']}</a>`});
            table_items.push({icon: "fas fa-arrows-alt-h", value: `${(item['distance'] / 1000).toFixed(2)} km`});
            table_items.push({icon: "fas fa-arrows-alt-v", value: `${item['total_elevation_gain']} m`});
            table_items.push({icon: "fas fa-stopwatch",    value: item['moving_time']});
            if ('pois' in item) {
                var links = [];
                item['pois'].forEach(category => {
                    links.push(`<a class="category" data-category="${category}">${category}</a>`);
                });
                if (links.length > 0) {
                    table_items.push({icon: "fas fa-map-marker-alt", value: links.join(' · ')});
                }
            }
            var strava = `<small><a href="https://www.strava.com/activities/${item['strava_id']}" target="_blank">View on Strava</a></small>`;
            var content = $(`${title}<br />${self.createTable(table_items)}<br />${strava}`);
            activity_div.append(content);
            if (!first_activity) {
                first_activity = item['strava_id'];
            }
            if (self.selected_activity == item['strava_id']) {
                selected_found = true;
            }
            $('#activities').append(activity_div);
        });

        this.loadActivity(first_activity);
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
        }

        this.map.invalidateSize(false);
    }
};

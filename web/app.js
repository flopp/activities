$(function() {
    App.init(activities);
});

var App = {
    init: function(activities) {
        this.selected_category = null;
        this.selected_activity = null;
        this.activities = activities;
        this.map = this.initMap();
        this.track = null;
        this.initEventHandlers();
        this.populateCategories();
        this.loadActivities('All');
    },
    
    initMap: function() {
        var map = L.map('map').setView([48, 8], 13);

        L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        return map;
    },
    
    initEventHandlers: function() {
        var self = this;
        $(document).on('click', '.activity', function () {
            self.loadActivity($(this).data('id'));
        });
        $(document).on('click', '.category', function () {
            const category = $(this).data('category');
            self.loadActivities(category);
        });
        $("#categories")
            .change(function () {
                var category = null;
                $("#categories option:selected").each(function() {
                    category = $(this).val();
                });
                self.loadActivities(category);
            });
        $("#sidebar").overlayScrollbars({className: "os-theme-light"});
    },

    populateCategories: function() {
        var category_counts = new Map();
        category_counts.set('All', 0);
        $.each(this.activities, function(key, item) {
            category_counts.set('All', category_counts.get('All') + 1)
            if ('pois' in item) {
                $.each(item['pois'], function(category_index, category_name) {
                    if (category_counts.has(category_name)) {
                        category_counts.set(category_name, category_counts.get(category_name) + 1)
                    } else {
                        category_counts.set(category_name, 1)
                    }
                });
            }
        });

        // Hide 'categories' select box if there only is the 'All' category.
        if (category_counts.size == 1) {
            $('#categories').parent().parent().parent().hide();
            return;
        }

        var sorted = [];
        category_counts.forEach((count, category) =>
            sorted.push({name: category, count: count})
        );
        sorted.sort(function(a, b) {
            return b.count - a.count;
        });
        $.each(sorted, function(index, name_count) {
            $('#categories').append(
                $(`<option value="${name_count.name}">${name_count.name} (${name_count.count})</option>`)
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
        activity = $(`.activity[data-id="${id}"]`);
        activity.addClass('is-info');

        const sidebar_rect = $('#sidebar')[0].getBoundingClientRect();
        const rect = activity[0].getBoundingClientRect();
        if (rect.bottom > sidebar_rect.bottom) {
            activity[0].scrollIntoView(false);
        }
        if (rect.top < sidebar_rect.top) {
            activity[0].scrollIntoView();
        }

        var polyline = null;
        $.each(this.activities, function(key, item) {
            if (item['strava_id'] == id) {
                polyline = item['summary_polyline'];
            }
        });
        this.displayPolyline(polyline);
    },

    loadActivities: function(category) {
        if (category === this.selected_category) {
            return;
        }
        this.selected_category = category;
        $('#categories').val(category);

        var self = this;
        var first_activity = null;
        var selected_found = false;
        var count = 0;
        $('#activities').empty();

        $.each(self.activities, function(key, item) {
            if (category !== "All") {
                var show = false;
                if ('pois' in item) {
                    $.each(item['pois'], function(category_index, category_name) {
                        if (category_name === category) {
                            show = true;
                        }
                    });
                }
                if (!show) {
                    return;
                }
            }
            count += 1;

            var activity_div = $('<div class="notification activity">')
                .attr('data-id', item['strava_id']);
            var title = `<strong>${item['name']}</strong>`;
            var table_items = [];
            table_items.push({icon: "far fa-calendar-alt", value: item['start_date_local'].replace('T', ' ')});
            table_items.push({icon: "fas fa-arrows-alt-h", value: `${(item['distance'] / 1000).toFixed(2)} km`});
            table_items.push({icon: "fas fa-arrows-alt-v", value: `${item['total_elevation_gain']} m`});
            table_items.push({icon: "fas fa-stopwatch",    value: item['moving_time']});
            if ('pois' in item) {
                var links = [];
                $.each(item['pois'], function(category_index, category_name) {
                    links.push(`<a class="category" data-category="${category_name}">${category_name}</a>`);
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

        if (selected_found) {
            this.loadActivity(this.selected_activity);
        } else {
            this.loadActivity(first_activity);
        }
    },

    createTable: function(table_items) {
        var contents = [];
        $.each(table_items, function(index, item) {
            const icon = item['icon'];
            const value = item['value'];
            contents.push(`<span class="icon is-small"><i class="${icon}"></i></span><span class="value">${value}</span>`);
        });
        return contents.join('<br />');
    }
};

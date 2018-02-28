L.HexLayer = L.Class.extend({
    includes: L.Mixin.Events,

    options: {
        minZoom: 0,
        maxZoom: 18,
        padding: 100,
        radius: 25
    },
    hour: 6,
    day:1,

    onmouseover : function(tooltip) { return function(d){
        tooltip.transition()
                .duration(200)
                .style("opacity", 1);

        tooltip.html(d.length)
                .style("top", (d3.event.pageY - 40) + "px")
                .style("left", (d3.event.pageX + 15) + "px");
    }},
mouseout : function(tooltip) { return function(d){
        tooltip.transition()
                .duration(500)
                .style("opacity", 0);
    }}
    ,
    interval_action: function(layer){
        layer.hour = (1 + layer.hour) % 24
        layer._update(true)
    },

    initialize: function (data, options) {
        var options = L.setOptions(this, options);
        this._tooltip = options.tooltip;
        var _hexbin = d3.hexbin().radius(this.options.radius)
        _hexbin.size([5,5])
        this._layout = _hexbin;
        this._data = data;

        this._levels = {};
        this.animations = null
        
    },

    onAdd: function (map) {
        this._map = map;
        this._initContainer();

        map.on({
            'moveend': this._update
        }, this);

        this._update();
    },

    onRemove: function (map) {
        this._container.parentNode.removeChild(this._container);

        map.off({
            'moveend': this._update
        }, this);

        this._container = null;
        this._map = null;
    },

    addTo: function (map) {
        map.addLayer(this);
        return this;
    },

    _initContainer: function () {
        var overlayPane = this._map.getPanes().overlayPane;
        if (!this._container || overlayPane.empty) {
            this._container = d3.select(overlayPane)
                .append('svg').attr('class', 'leaflet-layer leaflet-zoom-hide');
        }
    },
    _turn_to_feature_collection: function(data) {
        feat_coll = {'type': 'FeatureCollection',  
                 'features':[]}

        feat_coll['features'] = data.data.stops.map(function(stop) { return {
            'type': 'Feature',  
             'geometry': {  
                'type': 'Point',  
                'coordinates': stop.geom.coordinates
            }}})  
              
        return feat_coll
    },
    _update: function (should_update) {
        if (!this._map && !should_update) { return; }

        var zoom = this._map.getZoom();

        if ((!should_update) && (zoom > this.options.maxZoom || zoom < this.options.minZoom)) {
            return;
        }

        var padding = this.options.padding,
            bounds = this._translateBounds(d3.geo.bounds(this._turn_to_feature_collection(this._data)));
            width = bounds.getSize().x + (2 * padding),
            height = bounds.getSize().y + (2 * padding),
            margin_top = bounds.min.y - padding,
            margin_left = bounds.min.x - padding;
            
        this._layout.size([width, height]);
        this._container.attr("width", width).attr("height", height)
            .style("margin-left", margin_left + "px").style("margin-top", margin_top + "px");

        if (!(zoom in this._levels) || should_update) {
            this._levels[zoom] = this._container.append("g").attr("class", "zoom-" + zoom);
            this._createHexagons(this._levels[zoom]);
            this._levels[zoom].attr("transform", "translate(" + -margin_left + "," + -margin_top + ")");
        }
        this._setLevel(zoom);
    },

    _setLevel: function (zoom) {
        if (this._currentLevel) {
            this._currentLevel.style("display", "none");
        }
        this._currentLevel = this._levels[zoom];
        this._currentLevel.style("display", "inline");
    },

    _createHexagons: function (container) {
        var layout = this._layout
        var data = []

        this._data.data.stops.map(function (d) {
                 var points = this._project(d.geom.coordinates);
                 for (i = 0 ; i < d.rides[this.day][this.hour]; i++)
                    data.push(points)
            }, this)

        var bins = layout(data)
        var hexagons = container.selectAll(".hexagon").data(bins);

        var path = hexagons.enter().append("path").attr("class", "hexagon")
  
        this._applyStyle(path);

        hexagons.attr("d", function (d) {
            return "M" + d.x + "," + d.y + layout.hexagon();
        });

        hexagons.on("mouseover", this.onmouseover(this._tooltip))
        .on("mouseout", this.mouseout(this._tooltip))
    },

    _applyStyle: function (hexagons) {
        if ('applyStyle' in this.options) {
            this.options.applyStyle.call(this, hexagons);
        }
    },

    _project: function (x) {
        var point = this._map.latLngToLayerPoint([x[1], x[0]]);
        return [point.x, point.y];
    },

    _translateBounds: function (d3_bounds) {
        var nw = this._project([d3_bounds[0][0], d3_bounds[1][1]]),
            se = this._project([d3_bounds[1][0], d3_bounds[0][1]]);
        return L.bounds(nw, se);
    },

    activateNewConfig: function(new_config) {

        if(new_config.animate){
            if(this.animations)clearInterval(this.animations);
            this.animations = setInterval(() => this.interval_action(this), 1000);
        }else if(this.animations){
            clearInterval(this.animations);
            this.animations = null;
        }
        this.hour = new_config.hour % 24
        this.day = new_config.day % 7
        this._update(true)
    }

});

L.hexLayer = function (data, options) {
    return new L.HexLayer(data, options)
};
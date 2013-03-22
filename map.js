(function () {

	Map.prototype.map = null;

	function Map (id) 
	{
		var self = this; 

        self.map = L.map(id, {
            center: new L.LatLng(30.26, -97.74),
            zoom: 15,
            keyboard: false
        });

        /*var basemap = L.tileLayer(
        	'http://{s}.tiles.mapbox.com/v3/examples.map-vyofok3q/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);*/

        var basemap = L.tileLayer(
            'http://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Basemap by <a href="http://www.esri.com">ESRI</a> and licensors'
        }).addTo(self.map);
	}

	window.Map = Map;

}(window));
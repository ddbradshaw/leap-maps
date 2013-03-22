(function () {

    LeapController.prototype.ws = null;

    var maxPan = 120;
    var sensitivity = 18;
    var startX = startY = endX = endY = 0;
    var sketchX = sketchY = 0;
    var paused = false;
    var sketch = [];
    var isDrawing = false;
    var currentCoord = [];
    var lastZoomTime = timeDelta = lastPauseTime = 0;
    var lastHand = null;
    var self;

    function LeapController (map, canvasElement, debugElement) 
    {
        self = this;

        self.debugId = debugElement;
        self.canvas = $("#" + canvasElement)[0]
        self.map = map;

        //Initialize keyboard listeners
        $("#body").keydown(function(e) {
            if(e.keyCode == 37) {
                paused = !paused
                isDrawing = false;
                if(!paused) {
                    self.canvas.width = 0;
                    self.canvas.height = 0;
                    sketch = [];
                } else {
                    lastPauseTime = new Date().getTime();
                }
            }
            if(e.keyCode == 38) {
                self.map.zoomIn(2);
            }
            if(e.keyCode == 39) {
                isDrawing = !isDrawing
                if(isDrawing) sketch.push("break");
            }
            if(e.keyCode == 40) {
                self.map.zoomOut(2);
            }
         });
	}

    LeapController.prototype.init = function ()
    {
        self._decelerating = false;
        self._positions = [];
        self._times = [];

        self.map.on('zoomstart', function(e) {
            self._isZooming = true;
        });

        self.map.on('zoomend', function(e) {
            self._isZooming = false;
        });

        //Initialize leap loop
        var controllerOptions = {enableGestures: true};
        Leap.loop(controllerOptions, function(frame) 
        {
            if (self._isZooming) {
                return; // Skip this update
            }

            //Check for a hand
            if (frame.hands != null && frame.hands.length > 0) {

                timeDelta = (frame.timestamp - lastZoomTime) / 1000;
                
                //Check for gestures - zoom in / out
                if(frame.gestures != null && frame.gestures.length > 0) {
                    for(var x = 0; x < frame.gestures.length; x++) {
                        var gesture = frame.gestures[x];
                        if(gesture.type == "circle" && !paused) {
                            if(gesture.progress > 1 && timeDelta > 750) {
                                 lastZoomTime = frame.timestamp;
                                if(gesture.normal[2] > 0) {
                                    self.map.zoomOut(2);
                                }
                                else {
                                    self.map.zoomIn(2);
                                }
                                return;
                            }
                        }
                    }
                }

                var hand = _parseHand(frame);
                lastHand = hand;
                _moveMap(hand);

            } else  {
                //If no hands are available, check to see
                // if we need a deceleration pan
                if(!self._decelerating && self._panning) {
                    _dragEnd(lastHand.vx, lastHand.vy);
                }
            }
        });
    }

    function _parseHand(frame) 
    {
        var x = y = z = vx = vy = vz = t = p = 0;
        var hand = frame.hands[0];
        x = hand.palmPosition[0];
        y = hand.palmPosition[1];
        z = hand.palmPosition[2];
        vx = hand.palmVelocity[0];
        vy = hand.palmVelocity[1];
        vz = hand.palmVelocity[2];
        t = frame.timestamp;
        p = frame.pointables;     
        return { 'x': x, 'y': y, 'z': z, 'vx': vx, 'vy': vy, 'vz': vz, 't': t, 'p': p}; 
    }

    function _moveMap(hand)
    {
        //Draw instead of zooming
        if(paused) {
            if(hand.p.length == 0) {
                //sketchX = sketchY = 0
                return;
            }
            var point = hand.p[0];
            if(sketchX == 0 && point != null) {
                sketchX = point.tipPosition[0];
                sketchY = point.tipPosition[1];
            }
            _draw(point, hand.z)
            return;
        }

        //If the hand is further than X units from front
        //of device, stop panning
        if( hand.z > maxPan ) {
            startX = hand.x;
            startY = hand.y;
            if(!self._decelerating && self._panning) {
                _dragEnd(hand.vx, hand.vy);
            }
            return;
        }

        //Stop panning the map if the user assumes control during a decel
        if (self.map._panAnim && self._decelerating) {
            self.map._panAnim.stop();
        }

        self._panning = true;
        self._decelerating = false;

        // proximity adjustment - more sensitive as you get closer to the center
        var proximity = Math.max((maxPan - hand.z) / maxPan, .3);

        //Send end coordinates
        endX = hand.x;
        endY = hand.y;

        //Calculate move delta
        self._dx = (startX - endX) * sensitivity * proximity;
        self._dy = (endY - startY) * sensitivity * proximity;

        //Prevent crazy big moves
        if(self._dx > 200 || self._dx < -200) self._dx = self._dx / 10;
        if(self._dy > 200 || self._dy < -200) self._dy = self._dy / 10;

        //Reset new start coordinate
        startX = endX;
        startY = endY;
        
        //Track time and position for last 200 milliseconds
        //This is useful for decelaration
        var time = self._lastTime = hand.t / 1000,
            pos = self._lastPos = new L.Point(hand.x, hand.y);

        self._positions.push(pos);
        self._times.push(time);

        if (time - self._times[0] > 200) {
            self._positions.shift();
            self._times.shift();
        }

        //Pan the map
        L.Util.requestAnimFrame(function () {
            self.map.panBy([self._dx, self._dy])
        });
    }

    function _dragEnd(vx, vy) 
    {
        var direction = self._lastPos.subtract(self._positions[0]);

        self.map._panAnim.stop();
        L.Util.requestAnimFrame(function () {
            self.map.panBy([(0 - direction.x) * 11, (direction.y) * 11 ], 1.2, .25)
        });

        self._decelerating = true;
        self._panning = false;
    }
    
    function _draw(point, z) 
    {
        if(point == null) return;

        var canvas = self.canvas;
        var context = canvas.getContext('2d');

        //Clear the cavas
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;

        var radius = 8;
        var xRatio = 200 / canvas.width;
        var yRatio = 200 / canvas.height;
        (xRatio > yRatio) ? xRatio = yRatio : yRatio = xRatio;
        
        context.strokeStyle = "#df4b26";
        context.lineJoin = "round";
        context.lineWidth = 5;

        var x = point.tipPosition[0];
        var y = point.tipPosition[1];
        currentCoord = _calScreenCoord([x,y], xRatio, yRatio, canvas.width, canvas.height)

        if(isDrawing) sketch.push([x, y])

        //Show the tail
        for(var i = 0; i < sketch.length; i++)
        {
            if(sketch[i] == "break") {
                context.closePath();
                context.stroke();
                context.beginPath();
                continue;
            }

            var fromCoord = _calScreenCoord(sketch[i-1], xRatio, yRatio, canvas.width, canvas.height)
            var toCoord = _calScreenCoord(sketch[i], xRatio, yRatio, canvas.width, canvas.height)

            if(fromCoord == null) continue;

            context.beginPath();
            context.moveTo(fromCoord[0], fromCoord[1])
            context.lineTo(toCoord[0], toCoord[1]);
            context.closePath();
            context.stroke();
        }

        //Show tip location
        context.beginPath();
        context.arc(currentCoord[0], currentCoord[1], radius, 0, 2 * Math.PI, true);
        context.fillStyle = 'green';
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = '#003300';
        context.stroke();
    }

    function _calScreenCoord(coord, xRatio, yRatio, width, height) 
    {
        if(coord == null) return null;
        var pdx = (coord[0] - sketchX) / xRatio;
        var pdy = (coord[1] - sketchY) / yRatio;
        var centerX = (width / 2) + pdx;
        var centerY = (height / 2) - pdy;
        return [centerX, centerY];
    }

    LeapController.prototype.debug = function (message) 
    {
        var el = $("#" + this.debugId)[0];
        $(el).html(message);
    }

	window.LeapController = LeapController;

}(window));
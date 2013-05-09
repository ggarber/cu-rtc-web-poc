'use strict'; /*global rtapi, Event, EventTarget */
/*jshint node:true,browser:true*/

/**
 * getUserMedia, MediaStream, MediaStreamTrack, MediaStreamTrackList
 * <http://dev.w3.org/2011/webrtc/editor/getusermedia.html>
 */
(function(global, rtapi) {

    function MediaStreamTrack(deviceId) {
        var open = true;
        var plugin = rtapi.getPlugin();

        EventTarget.call(this);

        if (!plugin.deviceIsAvailable(deviceId)) {
            throw new Error('invalid device ID');
        }
        console.log('Creating MediaStreamTrack', plugin.deviceGetName(deviceId));
        Object.defineReadOnlyProperty(this, 'kind', plugin.deviceGetType(deviceId).toLowerCase());
        Object.defineReadOnlyProperty(this, 'label', deviceId);
        Object.defineProperty(this, 'enabled', {
            get: function() {
                return open && plugin.deviceIsAvailable();
            },
            set: function(value) {
                throw new Error('not implemented');
            }, 
            enumerable: true
        });
        Object.defineReadOnlyProperty(this, 'remote', plugin.deviceGetDirection(deviceId) === 'RECEIVE');
        Object.defineReadOnlyProperty(this, 'readyState', MediaStreamTrack.LIVE);

        ['mute', 'unmute', 'ended'].forEach(this.defineEventProperty.bind(this));
    }
    Object.inherits(MediaStreamTrack, EventTarget);
    MediaStreamTrack.LIVE = 0;
    MediaStreamTrack.MUTED = 1;
    MediaStreamTrack.ENDED = 2;

    rtapi.MediaStreamTrack = MediaStreamTrack;

    function MediaStreamTrackList() {
        var self = this;
        var list = [];

        EventTarget.call(this);

        Object.defineProperty(this, 'length', {
            get: function() {
                return list.length;
            },
            set: function() {
                throw new Error('can\'t set length');
            }
        });

        this.item = function(index) {
            index = parseInt(index, 10);
            return list[index];
        };
        this.add = function(track) {
            list.push(track);
            self.dispatchEvent(new Event('addtrack'));
        };
        this.remove = function(track) {
            var i = list.indexOf(track);
            if (i >= 0) {
                list.splice(i, 1);
                self.dispatchEvent(new Event('removetrack'));
            }
        };

        ['addtrack', 'removetrack'].forEach(this.defineEventProperty.bind(this));
    }
    Object.inherits(MediaStreamTrackList, EventTarget);

    function generateLabel() {
        // TODO might want to do something with UUIDs or some such nonsense
        return 'it\'s a MediaStream, get over it';
    }

    function MediaStream() {
        EventTarget.call(this);

        Object.defineReadOnlyProperty(this, 'label', generateLabel());
        Object.defineReadOnlyProperty(this, 'audioTracks', new MediaStreamTrackList());
        Object.defineReadOnlyProperty(this, 'videoTracks', new MediaStreamTrackList());

        this.ended = false;
        this.defineEventProperty('ended');
    }
    Object.inherits(MediaStream, EventTarget);
    rtapi.MediaStream = MediaStream;

}((typeof window === 'object' ? window : global), ('undefined' !== typeof rtapi) ? rtapi : window));
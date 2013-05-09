'use strict'; /*global rtapi, Event, EventTarget */
/*jshint node:true,browser:true*/

/**
 * getUserMedia, MediaStream, MediaStreamTrack, MediaStreamTrackList
 * <http://dev.w3.org/2011/webrtc/editor/getusermedia.html>
 */
(function(global, rtapi) {

    function filterDirection(dir) {
        return function(deviceId) {
            var plugin = rtapi.getPlugin();
            return plugin.deviceIsAvailable(deviceId) && (plugin.deviceGetDirection(deviceId) === dir);
        };
    }

    function getDevice(microphone) {
        var plugin = rtapi.getPlugin();
        var devices = JSON.parse(plugin.getDeviceIds());
        return devices.filter(filterDirection(microphone ? 'SEND' : 'RECEIVE'))[0];
    }
    rtapi.util.getDevice = getDevice;

    function getUserMedia(constraints, callback, errCallback) {
        var deviceId, stream, track;
        errCallback = (typeof errCallback === 'function') ? errCallback : function() {};
        if (typeof callback !== 'function') {
            errCallback('no callback');
            return;
        }
        if (constraints.video) {
            errCallback('video not supported');
            return;
        }
        if (!constraints.audio) {
            errCallback('no audio specified');
            return;
        }

        deviceId = getDevice(true);
        if (!deviceId) {
            errCallback('no microphone');
            return;
        }
        stream = new rtapi.MediaStream();
        track = new rtapi.MediaStreamTrack(deviceId);
        stream.audioTracks.add(track);
        callback(stream);
    }
    rtapi.getUserMedia = getUserMedia;

    function createObjectURL(stream) {
        var plugin = rtapi.getPlugin();
        var tracks = stream.audioTracks;
        var audio;
        if (tracks.length <= 0) {
            return; // undefined
        }

        return 'about:media';
    }
    rtapi.createObjectURL = createObjectURL;

}((typeof window === 'object' ? window : global), ('undefined' !== typeof rtapi) ? rtapi : window));
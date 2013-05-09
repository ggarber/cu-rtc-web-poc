'use strict'; /*global rtapi    */
/*jshint node:true,browser:true*/

/*
[Constructor(RealtimeMediaDescription description, RealtimeTransport transport, optional RealtimeTransport rtcpTransport)]
interface RemoteRealtimeMediaStream : RealtimeMediaStream {
             attribute UnknownPacketTypeEventHandler? onunknownpackettype;
};

*/

(function() {
    var g = ('undefined' !== typeof rtapi) ? rtapi : window; /*global EventTarget*/

    // [Constructor(RealtimeMediaDescription description, RealtimeTransport transport, optional RealtimeTransport rtcpTransport)]

    function RemoteRealtimeMediaStream(description, transport, rtcpTransport) {
        var deviceId = g.util.getDevice(false);
        var track = new g.MediaStreamTrack(deviceId);
        g.RealtimeMediaStream.call(this, track, description, transport, rtcpTransport);

        // only on RemoteRealtimeMediaStream - not implemented
        this.defineEventProperty('unknownpackettype');
    }
    Object.inherits(RemoteRealtimeMediaStream, g.RealtimeMediaStream);

    g.RemoteRealtimeMediaStream = RemoteRealtimeMediaStream;
}());
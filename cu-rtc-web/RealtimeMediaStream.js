'use strict'; /*global rtapi    */
/*jshint node:true,browser:true*/

/*
[NoInterfaceObject]
interface RealtimeMediaStream : EventTarget {
    readonly attribute MediaStreamTrack         track;
    readonly attribute RealtimeTransport        transport;
    readonly attribute RealtimeTransport        rtcpTransport;
    readonly attribute RealtimeMediaDescription description;
    void updateDescription (RealtimeMediaDescription description);
    void updateTransport (RealtimeTransport transport, optional RealtimeTransport rtcpTransport);
};

*/

(function() {
    var g = ('undefined' !== typeof rtapi) ? rtapi : window; /*global EventTarget*/

    function start(stream) {
        console.log('creating stream', JSON.stringify(stream.description.toDictionary()));
        var plugin = g.getPlugin();
        var codecId = g.util.getCodecId(stream.description.codecs[0]);
        var streamId = plugin.deviceNewStream(stream.track.label, codecId, stream.description.streams[0].ssrc);
        if (stream.id) {
            plugin.streamClose(stream.id);
        }

        Object.defineReadOnlyProperty(stream, 'id', streamId);

        plugin.streamSetTransport(stream.id, stream.transport.id);
        plugin.streamPlay(stream.id);
    }

    // [Constructor(MediaStreamTrack track, RealtimeMediaDescription description, RealtimeTransport transport,
    //              optional RealtimeTransport rtcpTransport)]
    function RealtimeMediaStream(track, description, transport, rtcpTransport) {
        EventTarget.call(this);

        Object.defineReadOnlyProperty(this, 'track', track);
        this.updateDescription(description);
        this.updateTransport(transport, rtcpTransport);
    }
    Object.inherits(RealtimeMediaStream, EventTarget);

    RealtimeMediaStream.prototype.updateDescription = function(description) {
        Object.defineReadOnlyProperty(this, 'description', description);
        if (this.transport) {
            start(this);
        }
    };

    RealtimeMediaStream.prototype.updateTransport = function(transport, rtcpTransport) {
        var self = this;
        transport.addEventListener('close', function()
        {
            self.close();
        });
        Object.defineReadOnlyProperty(this, 'transport', transport);
        Object.defineReadOnlyProperty(this, 'rtcpTransport', rtcpTransport || transport);
        if (this.description) {
            start(this);
        }
    };


    RealtimeMediaStream.prototype.getLevel = function() {
        var plugin = g.getPlugin();
        var result = plugin.streamGetLevel(this.id);
        return result;
    };

    RealtimeMediaStream.prototype.close = function() {
        var plugin = g.getPlugin();
        plugin.streamClose(this.id);
    };

    g.RealtimeMediaStream = RealtimeMediaStream;
}());
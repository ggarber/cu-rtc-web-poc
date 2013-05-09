'use strict'; /*global rtapi*/
/*jshint node:true,browser:true*/

/*
 WEBIDL

 [Constructor(MediaStreamTrack track, RealtimeMediaDescription description, RealtimeTransport transport, optional RealtimeTransport rtcpTransport)]
interface LocalRealtimeMediaStream : RealtimeMediaStream {
    void play ();
    void pause ();
    readonly attribute boolean playing;
};

*/

(function() {

    var g = ('undefined' !== typeof rtapi) ? rtapi : window;

    /**
     * [Constructor(MediaStreamTrack track,
     *     RealtimeMediaDescription description,
     *     RealtimeTransport transport,
     *     optional RealtimeTransport rtcpTransport)]
     */

    function LocalRealtimeMediaStream(track, description, transport, rtcpTransport) {
        g.RealtimeMediaStream.call(this, track, description, transport, rtcpTransport);

        // only on LocalRealtimeMediaStream
        Object.defineReadOnlyProperty(this, 'playing', true);
    }
    Object.inherits(LocalRealtimeMediaStream, g.RealtimeMediaStream);


    LocalRealtimeMediaStream.prototype.updateDescription = function(description) {
        g.RealtimeMediaStream.prototype.updateDescription.call(this, description);
        if (!this.description.streams[0].ssrc) {
            this.description.streams[0].ssrc = Math.random() * Math.pow(2, 32) | 0;
        }
    };

    LocalRealtimeMediaStream.prototype.play = function() {
        if (!this.playing) {
            Object.defineReadOnlyProperty(this, 'playing', true);
            var plugin = g.getPlugin();
            plugin.streamPlay(this.id);
        }
    };

    LocalRealtimeMediaStream.prototype.pause = function() {
        if (this.playing) {
           Object.defineReadOnlyProperty(this, 'playing', false);
            var plugin = g.getPlugin();
            plugin.streamPause(this.id);
        }
    };

    g.LocalRealtimeMediaStream = LocalRealtimeMediaStream;

}());
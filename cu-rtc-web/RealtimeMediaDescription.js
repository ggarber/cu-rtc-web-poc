'use strict'; /*global rtapi*/
/*jshint node:true,browser:true*/

/*
WebIDL[Constructor (optional (MediaStreamTrack or RealtimeMediaDescriptionDictionary or RealtimeMediaDescriptionConstraints) constraints)]
interface RealtimeMediaDescription {
    readonly attribute sequence<RtpStreamDescription> streams;
    readonly attribute DOMString                      cname;
    readonly attribute sequence<RtpExtension>?        rtpExceptions;
    readonly attribute sequence<RtcpFeature>          rtcpFeatures;
    readonly attribute sequence<CodecDescription>     codecs;
    readonly attribute byte?                          priority;
    RealtimeMediaDesctiption           update (RealtimeMediaDescriptionDictionary constraints);
    RealtimeMediaDescription           update (RealtimeMediaDescriptionConstraints constraints);
    RealtimeMediaDescriptionDictionary toDictionary ();
};
*/



(function() {

    var g = ('undefined' !== typeof rtapi) ? rtapi : window;

    var codecs;
    var codecIds = {};
    var codecDetails = {
        "SILK_V3": {
            type: "audio/x.skype.net-SILKv3",
            clockRate: 48000
        },
        "SILK_WB_V3": {
            type: "audio/x.skype.net-SILKv3-WB",
            clockRate: 48000
        },
        "SILK": {
            type: "audio/x.skype.net-SILK",
            clockRate: 48000
        },
        "SILK_WB": {
            type: "audio/x.skype.net-SILK-WB",
            clockRate: 48000
        },
        "SVOPC": {
            type: "audio/x.skype.net-SVOPC",
            clockRate: 48000
        },
        "SVOPC_SB": {
            type: "audio/x.skype.net-SVOPC-SB",
            clockRate: 48000
        },
        "SILK_MB_V3": {
            type: "audio/x.skype.net-SILKv3-MB",
            clockRate: 48000
        },
        "SILK_NB_V3": {
            type: "audio/x.skype.net-SILKv3-NB",
            clockRate: 48000
        },
        "NWC": {
            type: "audio/x.skype.net-NWC",
            clockRate: 48000
        },
        "G722": {
            type: "audio/G722",
            clockRate: 8000
        },
        "UNCODEDWB": {
            type: "audio/x.skype.net-UNCODEDWB",
            clockRate: 32000
        },
        "UNCODEDSWB": {
            type: "audio/x.skype.net-UNCODEDSWB",
            clockRate: 48000
        },
        "G729": {
            type: "audio/G729",
            clockRate: 48000
        },
        "PCMU": {
            type: "audio/PCMU",
            clockRate: 8000
        },
        "PCMA": {
            type: "audio/PCMA",
            clockRate: 8000
        },
        "OPUS_V1": {
            type: "audio/opus",
            clockRate: 48000
        }
    };

    function getCodecId(codecDescription) {
        return codecIds[codecDescription.type];
    }
    g.util.getCodecId = getCodecId;

    function getStreams(input) {
        var streams = [];
        if (input && input.streams && input.streams.length > 0 && input.streams[0].ssrc) {
            streams = input.streams;
        } else {
            streams.push({
                ssrc: Math.random() * Math.pow(2, 32) | 0
            });
        }
        return streams;
    }

    function processCapability(cap) {
        var result = codecDetails[cap.encodingName];
        result.packetType = cap.payloadType;
        result.ptime = cap.packetSize;
        result.silenceSuppression = true;
        result.fmtp = '';
        codecIds[result.type] = cap.mediaId;
        return result;
    }

    function isRtp(cap) {
        return cap.protocol === "RTP";
    }

    function getCodecFilter(track) {
        var plugin = rtapi.getPlugin();
        var formats = JSON.parse(plugin.deviceGetFormats(track.label)).map(function(format) {
            return codecDetails[format].type;
        });
        return function(codec) {
            return formats.indexOf(codec.type) >= 0;
        };
    }

    function getCodecs() {
        var plugin, capabilities;
        if (!codecs) {
            plugin = rtapi.getPlugin();
            capabilities = JSON.parse(plugin.getCapabilities()).capabilities;
            codecs = capabilities.filter(isRtp).map(processCapability);
        }
        return codecs;
    }

    function filterCodecs(result, input) {
        var i;
        if (!input) {
            return result;
        }

        if (input.audioTracks) { // if input is a stream
            for (i = 0; i < input.audioTracks.length; ++i) {
                result = result.filter(getCodecFilter(input.audioTracks.item(i)));
            }
        } else if (input.codecs) { // if input is another description
            result = result.filter(function(available) {
                return input.codecs.some(function(desired) {
                    return available.type === desired.type && available.packetType === desired.packetType && available.clockRate === desired.clockRate;
                });
            });
        }

        if (result.length === 0) {
            throw new Error('No compatible codecs');
        }
        return result;
    }

    function RealtimeMediaDescription(input) {
        var codecSet = getCodecs();
        codecSet = filterCodecs(codecSet, input);
        Object.defineReadOnlyProperty(this, 'streams', getStreams(input));
        Object.defineReadOnlyProperty(this, 'cname', 'user@example.com');
        Object.defineReadOnlyProperty(this, 'rtpExtensions', []);
        Object.defineReadOnlyProperty(this, 'rtcpFeatures', []);
        Object.defineReadOnlyProperty(this, 'codecs', codecSet);
        Object.defineReadOnlyProperty(this, 'priority', 3);
    }

    RealtimeMediaDescription.prototype.update = function update(constraints) {
        throw new Error('not implemented');
    };

    RealtimeMediaDescription.prototype.toDictionary = function update() {
        return JSON.parse(JSON.stringify(this));
    };

    g.RealtimeMediaDescription = RealtimeMediaDescription;


}());
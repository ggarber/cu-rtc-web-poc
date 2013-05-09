'use strict'; /*global rtapi*/
/*jshint node:true,browser:true*/

/*

 This file attaches Enum classes to the namespace.
 WEBIDL

enum RtcpFeature {
    "avpf", "nack", "pli", "sli", "rpsi", "reduced", "rtx", "fir", "tmmbr", "tstr"
};

enum RtpExtension {
    "rapid-sync", "c2m-alevel", "m2c-alevel"
};

enum TurnRelayTransport {
    "udp", "tcp", "tls"
};

enum RealtimeTransportMode {
    "srtp", "dtls-srtp" //, "rtp"
};

enum DtlsRole {
    "client", "server"
};

*/

(function() {

    var g = ('undefined' !== typeof rtapi) ? rtapi : window;

    /**
     There's no formal definition of a JavaScript enum. This helper adds some
     methods and values to an object (usually the "static class" handle) that
     are inspired by Java's enum type.

     An attribute .values gives the array of enum values,
     An attribute .keys gives the array of keys,
     and enumeration.key is the value.
     and enumeration.keyOf(value) goes back to the key.

     Return a class that implements this, for you to put
     into the namespace as you see fit.

     @param values {Array} an ordered array of enum values. Symbols are created by casting to upper case.
     @returns {Object} an enumerated type
     */
    function createEnum(values) {
        var enumeration = {};
        var nameOfD = {};
        var names = [];
        values.forEach(function(value) {
            var name = value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

            Object.defineReadOnlyProperty(enumeration, name, value);

            nameOfD[value] = name;
            names.push(name);
        });

        Object.defineProperty(enumeration, 'nameOf', {
            value: function nameOf(e) {
                return nameOfD[e];
            }
        });
        Object.defineProperty(enumeration, 'values', {
            get: function() {
                return values.slice();
            }
        });
        Object.defineProperty(enumeration, 'names', {
            get: function() {
                return names.slice();
            }
        });
        return enumeration;
    }

    g.RtcpFeature = createEnum(["avpf", "nack", "pli", "sli", "rpsi", "reduced", "rtx", "fir", "tmmbr", "tstr"]);
    g.RtpExtension = createEnum(['rapid-sync', 'c2m-alevel', 'm2c-alevel']);
    g.TurnRelayTransport = createEnum(["udp", "tcp", "tls"]);
    g.RealtimeTransportMode = createEnum(["srtp", "dtls-srtp", "rtp"]); // secret RTP mode
    g.DtlsRole = createEnum(["client", "server"]);
}());
/*
[Constructor(RealtimePort base, DOMString ip, short port)]
interface ReflexiveRealtimePort {
    readonly attribute RealtimePort base;
};
ReflexiveRealtimePort implements RealtimePort;
 */

(function(g) {
    'use strict'; /*jshint browser:true,node:true*/

    function ReflexiveRealtimePort(base, ip, port) {
        var self = this;

        g.EventTarget.call(this);

        Object.defineProperty(this, 'base', {
            get: function() {
                return base;
            },
            enumerable: true
        });
        Object.defineProperty(this, 'ip', {
            get: function() {
                return ip;
            },
            enumerable: true
        });
        Object.defineProperty(this, 'port', {
            get: function() {
                return port;
            },
            enumerable: true
        });
        ['ufrag', 'pwd', 'open'].forEach(function(property){
            Object.defineProperty(self, property, {
                get: function() {
                    return base[property];
                },
                enumerable: true
            });
        });

        function relayEvent(e) {
            self.dispatchEvent(e);
        }

        ['close', 'networkchange'].forEach(function(etype) {
            self.defineEventProperty(etype);
            base.addEventListener(etype, relayEvent);
        });
        // check-related events should not be triggered on this port - the base can handle those
        // define the property, but never trigger the event
        ['checksent', 'checksuccess', 'remotecheck'].forEach(function(etype) {
            self.defineEventProperty(etype);
        });

        ['close', 'check', 'cancelCheck', 'status', 'setServerAttributes'].forEach(function(mname) {
            self[mname] = base[mname].bind(base);
        });

        self.allocateRelay = function() {
            throw new Error('can\'t allocate a relay from a server reflexive address');
        };
    }
    Object.inherits(ReflexiveRealtimePort, g.EventTarget);

    g.icejs.ReflexiveRealtimePort = ReflexiveRealtimePort;
}((typeof window === 'object') ? window : global));
/*
[Constructor(RealtimeTransportBuilderOptions options)]
interface RealtimePortGatherer : EventTarget {
    void gather();
    EventHandler? onport;
    EventHandler? ondone;
};
// ondone is fired when all the local and server reflexive ports are collected
// onport is fired before ondone for local and server reflexive
// on

dictionary IceRealtimePortGathererOptions {
    StunServer stun;
};

dictionary StunServer : RemoteRealtimePort {
    unsigned short port = 3478;  
};
 */

(function(g) {
    'use strict'; /*jshint browser:true,node:true*/

    var RealtimePort = g.rtapi.RealtimePort;

    var RealtimePortEvent = g.icejs.RealtimePortEvent;
    var ReflexiveRealtimePort = g.icejs.ReflexiveRealtimePort;

    function groomOptions(options) {
        var opts = options || {};
        if(opts.stun) {
            opts.stun.port = opts.stun.port || 3478;
        }
        opts.timeout = opts.timeout || 3000;
        return opts;
    }

    function closeAnything(resource) {
        resource.close();
    }

    function RealtimePortGatherer(options, timerManager) {
        var self = this;
        var ports = [];
        var outstanding = 0;
        var timeout = null;

        g.EventTarget.call(this);
        options = groomOptions(options);
        timerManager = timerManager || g;

        function stepDone() {
            --outstanding;
            if(outstanding <= 0) {
                self.dispatchEvent(new g.Event('done'));
                timerManager.clearTimeout(timeout);
                timeout = null;
            }
        }

        function giveUp() {
            outstanding = 0;
            stepDone();
        }

        function stepTriggered() {
            if(timeout === null) {
                timeout = timerManager.setTimeout(giveUp, options.timeout);
            }
            ++outstanding;
        }


        function portClosed(event) {
            var i = ports.indexOf(event.target);
            if(i >= 0) {
                ports.splice(i, 1);
            }
        }

        function newRealtimePort(type, port) {
            port.type = type; // we may use this to prioritize, eventually
            port.addEventListener('close', portClosed);
            ports.push(port);
            self.dispatchEvent(new RealtimePortEvent(port));
        }

        function duplicateAddress(address, base) {
            return ports.some(function(port) {
                var cbase = port.base || port;
                return(base.ip === cbase.ip && base.port === cbase.port) && //
                (port.ip === address.ip && port.port === address.port);
            });
        }

        function newReflexiveRealtimePort(ev) {
            var rflx;
            // the event contains a StunBinding response, which should contain an IP and port
            var address = ev.response.getMappedAddress();
            var base = ev.target;
            if(address && !duplicateAddress(address, base)) {
                rflx = new ReflexiveRealtimePort(base, address.ip, address.port);
                newRealtimePort('reflexive', rflx); // yes we don't distinguish between server and peer reflexive!
            }
            stepDone();
        }

        function newHostRealtimePort(port) {
            newRealtimePort('host', port);
            if(options.stun) {
                port.addEventListener('checksuccess', newReflexiveRealtimePort);
                stepTriggered();
                port.check(options.stun);
            }
            // if (options.turn) {
            // allocate at least one relay
            // }
        }

        function hostPortsOpen(err, opened) {
            if(!err) {
                opened.forEach(newHostRealtimePort);
            }
            stepDone();
        }

        this.gather = function() {
            stepTriggered();
            RealtimePort.openLocalPorts(hostPortsOpen);
        };

        this.closeAll = function() {
            ports.forEach(closeAnything);
        };

        Object.defineProperty(self, 'ports', {
            get: function() {
                return ports.concat();
            },
            enumerable: true
        });

        this.defineEventProperty('port');
        this.defineEventProperty('done');
    }
    Object.inherits(RealtimePortGatherer, g.EventTarget);

    g.icejs.RealtimePortGatherer = RealtimePortGatherer;
}((typeof window === 'object') ? window : global));
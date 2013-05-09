'use strict'; /*global rtapi,EventTarget,Event,b64*/
/*jshint node:true,browser:true*/

/*
 WEBIDL

interface RealtimeTransport : EventTarget {
    static void createTransport (RealtimePort local, RemoteRealtimePort remote, TransportOptions options, TransportCallback callback);
    readonly attribute RealtimePort                  localPort;
    readonly attribute SimpleRealtimePort            remotePort;
    readonly attribute boolean                       dtls;
    readonly attribute RemoteCertificateInformation? remoteCertificate;
    readonly attribute SrtpSecurityDescription?      outboundSdes;
    readonly attribute SrtpSecurityDescription?      inboundSdes;
    readonly attribute boolean                       open;
    readonly attribute unsigned long                 bandwidth;
    void close ();
             attribute EventHandler?                 onclose;
    readonly attribute boolean                       consent;
             attribute EventHandler?                 onconsent;
             attribute EventHandler?                 onconsentexpired;
             attribute EventHandler?                 onbandwidthchange;
};

*/



(function() {

    var g = ('undefined' !== typeof rtapi) ? rtapi : window;
    var RealtimeTransportMode = rtapi.RealtimeTransportMode;

    /**
     * Copy a remote port, just the important fields.
     */

    function copyRemotePort(remotePort) {
        var fields = ['ip', 'port', 'ufrag', 'pwd'];
        var copy = {};

        fields.forEach(function(field) {
            if(remotePort && remotePort.hasOwnProperty(field)) {
                copy[field] = remotePort[field];
            }
        });
        return copy;
    }

    function ipToInt32(ip) {
        var intVal = 0;
        var i;
        var piece = 0;
        for(i = 0; i < ip.length; ++i) {
            if(ip.charAt(i) === '.') {
                intVal += piece;
                piece = 0;
                intVal = (intVal * 256);
            } else {
                piece = (piece * 10) + parseInt(ip.charAt(i), 10);
            }
        }
        intVal += piece;
        return intVal;
    }

    /*
     * Return a string based on the local and remote
     * ports of a transport.
     */

    function transportSig(lp, rp) {
        var sig = ipToInt32(lp.ip) + ':' + lp.port;
        sig += '/';
        sig += ipToInt32(rp.ip) + ':' + rp.port;
        return sig;
    }

    /*
     * transportSigs keeps track of transports requested
     * by endpoints. It's an object, whose keys come and go,
     * but whose values are only 1.
     */
    var transportSigs = {};

    function startChecking(transport) {
        var timerId;

        function check() {
            try {
                transport.localPort.check(transport.remotePort);
            } catch(e) {
                clearInterval(timerId);
            }
        }
        timerId = setInterval(check, 9999);
        transport.addEventListener('close', function() {
            clearInterval(timerId);
        });
        if(!transport.consent) {
            check();
        }
    }

    /**
     * Constructor that you need the magic id to really use, so use the static create.
     */

    function RealtimeTransport(id, localPort, remotePort) {
        var remotePortCopy = copyRemotePort(remotePort);
        var self = this;
        var plugin = g.getPlugin();

        RealtimeTransport.super_.call(this);
        Object.defineProperty(this, 'id', {
            value: id
        });
        Object.defineReadOnlyProperty(this, 'localPort', localPort);
        Object.defineReadOnlyProperty(this, 'remotePort', remotePortCopy);
        Object.defineReadOnlyProperty(this, 'dtls');
        Object.defineReadOnlyProperty(this, 'remoteCertificate');
        Object.defineReadOnlyProperty(this, 'outboundSdes');
        Object.defineReadOnlyProperty(this, 'inboundSdes');
        Object.defineReadOnlyProperty(this, 'open', true);
        Object.defineReadOnlyProperty(this, 'bandwidth');
        Object.defineReadOnlyProperty(this, 'consent', localPort.status(remotePortCopy));

        ['consent', 'consentexpired', 'bandwidthchange', 'unknownssrc'].forEach(function(eventType) {
            self.defineEventProperty(eventType);
            plugin.transportRegisterEvent(self.id, eventType, function(data) {
                var i;
                var ev = new Event(eventType);
                console.log(self.id, eventType, data);
                try {
                    data = JSON.parse(data);
                } catch(e) {
                    // ignore
                }
                for(i in data) {
                    if(data.hasOwnProperty(i)) {
                        ev[i] = data[i];
                    }
                }
                self.dispatchEvent(ev);
            });
        });

        localPort.addEventListener('close', this.close.bind(this));
        self.defineEventProperty('close');
        plugin.transportRegisterEvent(self.id, 'close', this.close.bind(this));
    }

    Object.inherits(RealtimeTransport, EventTarget);

    var SDES_DEFAULTS = {
        'encrypt': 'AES-CM',
        'encryptRtp': true,
        'encryptRtcp': true,
        'keystreamPrefix': 0,
        'authenticate': 'HMAC-SHA1',
        'n_a': 160,
        'n_tag': 80,
        'keyDerivation': 'AES-CM',
        'keyDerivationInterval': 0
    };

    function copyArrayBuffer(buf) {
        var copy = new ArrayBuffer(buf.byteLength);
        var copyView = new Uint8Array(copy);
        var bufView = new Uint8Array(buf);
        var i;
        for(i = 0; i < copyView.length; ++i) {
            copyView[i] = bufView[i];
        }
        return copy;
    }

    function checkSdes(sdes) {
        var copy = {};
        var i;
        for(i in SDES_DEFAULTS) {
            if(SDES_DEFAULTS.hasOwnProperty(i)) {
                if(sdes[i] && sdes[i] !== SDES_DEFAULTS[i]) {
                    throw new Error('unsupported mode for ' + i + ', only ' + SDES_DEFAULTS[i] + ' supported');
                }
                copy[i] = SDES_DEFAULTS[i];
            }
        }
        if(!sdes.key || sdes.key.byteLength !== 16) {
            throw new Error('invalid SDES key');
        }
        copy.key = copyArrayBuffer(sdes.key);
        if(!sdes.salt || sdes.salt.byteLength !== 14) {
            throw new Error('invalid SDES salt');
        }
        copy.salt = copyArrayBuffer(sdes.salt);
        return copy;
    }

    /** need to b64 encode those array buffers for passing to the plugin. */

    function prepareSdesForStringify(sdes) {
        if(!sdes) {
            return; // undefined
        }
        return {
            key: b64.Encode(sdes.key),
            salt: b64.Encode(sdes.salt)
        };
    }

    //     static void createTransport (RealtimePort local, RemoteRealtimePort remote, TransportOptions options, TransportCallback callback);
    RealtimeTransport.createTransport = function createTransport(localPort, remotePort, options, callback) {
        var inboundSdes, outboundSdes;

        var sig = transportSig(localPort, remotePort);
        if(transportSigs[sig]) {
            throw new Error('duplicate transport ' + sig);
        }

        if(!options) {
            throw new Error('missing options');
        }
        if(!options.mode) {
            throw new Error('missing options.mode (rtp or srtp)');
        }
        if(typeof callback !== 'function') {
            throw new Error('invalid callback');
        }

        if(options.mode === RealtimeTransportMode.SRTP) {
            inboundSdes = checkSdes(options.inboundSdes);
            outboundSdes = checkSdes(options.outboundSdes);
        } else if(options.mode !== RealtimeTransportMode.RTP) {
            throw new Error('unsupported transport mode');
        }

        transportSigs[sig] = 1;

        var plugin = g.getPlugin();

        var localId = localPort.id;
        var remoteId = g.util.getRemotePortId(remotePort, true);

        function transportCreated(err, transportId) {
            var transport;
            if(err === '') {
                transport = new RealtimeTransport(transportId, localPort, remotePort);
                Object.defineReadOnlyProperty(transport, 'inboundSdes', inboundSdes);
                Object.defineReadOnlyProperty(transport, 'outboundSdes', outboundSdes);
                startChecking(transport);
                err = null;
            }
            callback(err, transport); // rely on '' being falsy
            delete transportSigs[sig];
        }
        var stringOptions = JSON.stringify({
            mode: options.mode,
            inboundSdes: prepareSdesForStringify(inboundSdes),
            outboundSdes: prepareSdesForStringify(outboundSdes)
        });
        plugin.candidateCreateTransport(localId, remoteId, transportCreated, stringOptions);
    };

    RealtimeTransport.prototype.close = function close() {
        var plugin;

        if(this.open) {
            var sig = transportSig(this.localPort, this.remotePort);
            delete transportSigs[sig];

            Object.defineReadOnlyProperty(this, 'open', false);

            plugin = g.getPlugin();
            plugin.transportClose(this.id);

            this.dispatchEvent(new Event('close'));
        }
    };

    RealtimeTransport.prototype.getCounter = function(counter) {
        return g.util.getCounter('transport', this, counter);
    };

    RealtimeTransport.prototype.getCounters = function() {
        return g.util.getCounters('transport', this);
    };

    g.RealtimeTransport = RealtimeTransport;

}());
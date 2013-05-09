'use strict'; /*global rtapi, Event, EventTarget */
/*jshint node:true,browser:true*/

/**
 * RealtimePort.js
 *
 * Includes RealtimePort as well as objects tightly coupled to/associated with the
 * RealtimePort object.  Including:
 *
 *  StunBinding
 *  StunAttribute
 *  Address
 *
 */

/**
 * Definition of the RealtimePort object.  This object refers to a Local RealtimePort.
 * RemoteRealtimePort, while of similar name, is just a dictionary with a set of members
 * defined below.
 *
 * WebIDL definition for RealtimePort:
 *
 *  interface RealtimePort : EventTarget {
 *      readonly attribute DOMString                      ip;
 *      readonly attribute unsigned short                 port;
 *      readonly attribute DOMString                      ufrag;
 *      readonly attribute DOMString                      pwd;
 *      static void openLocalPorts (RealtimePortCallback callback);
 *      static void allocateRelay (TurnServer turnServer, RealtimePortCallback callback);
 *      void        allocateRelay (TurnServer turnServer, RelayCallback callback);
 *      [TreatNonCallableAsNull]
 *               attribute EventHandler?                  onnetworkchange;
 *      [TreatNonCallableAsNull]
 *               attribute ConnectivityCheckEventHandler? onchecksent;
 *      [TreatNonCallableAsNull]
 *               attribute ConnectivityCheckEventHandler? onchecksuccess;
 *      [TreatNonCallableAsNull]
 *               attribute ConnectivityCheckEventHandler? onremotecheck;
 *      [TreatNonCallableAsNull]
 *               attribute EventHandler?                  onclose;
 *      readonly attribute boolean                        open;
 *      long        check (RemoteRealtimePort remote, optional StunAttribute... attributes);
 *      void        cancelCheck (long checkHandle);
 *      boolean     status (RemoteRealtimePort remoteRealtimePort);
 *      void        close ();
 *  };
 *
 *
 * WebIDL definition for RemoteRealtimePort:
 *
 *  dictionary RemoteRealtimePort {
 *      DOMString      ip;
 *      [EnforceRange]
 *      unsigned short port;
 *      DOMString      ufrag;
 *      DOMString      username;
 *      DOMString      pwd;
 *  };
 */
(function(global, rtapi) {

    function initialize(port) {
        // setup the plugin
        var plugin = rtapi.getPlugin();

        // setup a wrapper event handler from the plugin -> javascript
        // this wrapper determines the proper event parameters and 
        // triggers the event.

        function eventHandler(eventType, rem, handle, request, response) {
            var event;
            var obj;
            if(!port.open && eventType !== 'close') {
                return;
            }

            // was the check cancelled?
            if(eventType in {
                'checksent': '',
                'checksuccess': ''
            }) {
                if(port.cancelledChecks[handle] === true) {
                    return;
                }
            }

            // initialize an event object
            event = new Event(eventType);

            if(rem !== "") {
                event.remote = JSON.parse(rem);
            }

            // get the request/response 
            if(eventType === 'checksuccess' || eventType === 'remotecheck') {
                event.request = new rtapi.StunBinding(request);
                event.response = new rtapi.StunBinding(response);
            }

            port.dispatchEvent(event);
        }

        // setup the plugin wrapper handlers
        ['checksent', 'checksuccess', 'close', 'networkchange', 'remotecheck'].forEach(function(evt) {
            port.defineEventProperty(evt);
            plugin.candidateRegisterEvent(port.id, 'on' + evt, function(rem, handle, request, response) {
                console.log(port.id, evt, rem, handle, request, response);
                eventHandler(evt, rem, handle, request, response);
            });
        });
    }

    /**
     * RealtimePort object
     */

    function RealtimePort(id, ip, port, ufrag, pwd) {
        RealtimePort.super_.call(this);
        // connectivity information
        Object.defineProperty(this, 'id', {
            value: id
        });
        Object.defineProperty(this, 'cancelledChecks', {
            value: {}
        });

        Object.defineReadOnlyProperty(this, 'ip', ip);
        Object.defineReadOnlyProperty(this, 'port', port);
        Object.defineReadOnlyProperty(this, 'pwd', pwd);
        Object.defineReadOnlyProperty(this, 'ufrag', ufrag);
        Object.defineReadOnlyProperty(this, 'open', true);
        Object.defineReadOnlyProperty(this, 'serverAttributes', []);

        initialize(this);
    }
    rtapi.RealtimePort = RealtimePort;

    Object.inherits(RealtimePort, EventTarget);

    /**
     * Allocate a relay port on a TURN server over UDP using the local real-time port
     * as a base.
     *
     * @api public
     *
     * @param {TurnServer}      turnServer
     * @param {RelayCallback}   relayCallback
     */
    RealtimePort.prototype.allocateRelay = function(turnServer, relayCallback) {
        throw new Error("unsupported: allocateRelay");
    };

    /**
     * Cancel an outstanding or enqueued connectivity check.  This guarantees that a
     * oncheckstatus event is never triggered for the specified check.
     *
     * @api public
     *
     * @param {long}            checkHandle
     */
    RealtimePort.prototype.cancelCheck = function(checkHandle) {
        if(this.open === false) {
            return; // automatic success!
        }

        this.cancelledChecks[checkHandle] = true;

        var plugin = rtapi.getPlugin();
        return plugin.candidateCancelCheck(this.id, checkHandle);
    };

    /**
     * Perform a connectivity check on the remote port.  Returns a handle to the check
     * that can be used to cancel it.
     *
     * @param {RemoteRealtimePort}  remotePort
     * @param optional {StunAttribute}... attributes
     *
     * @api public
     *
     * @return {long} check handle
     */
    RealtimePort.prototype.check = function(remotePort, attributes) {
        if(this.open === false) {
            throw new Error("port is not open");
        }

        if((typeof remotePort !== 'object') || (typeof remotePort.ip !== 'string') || (typeof remotePort.port !== 'number')) {
            throw new Error("check: invalid parameter");
        }

        // XXX - check for existing check on the same port
        var plugin = rtapi.getPlugin();

        // if we don't know about it, add the remote port to the plugin
        var remoteId = rtapi.util.getRemotePortId(remotePort, true);

        attributes = attributes || [];
        var strAttr = JSON.stringify(attributes.map(encodeAttribute));
        var checkId = plugin.candidateCheck(this.id, remoteId, function() {}, strAttr);

        if(checkId <= 0) {
            // we have an invalid handle
            throw new Error("check: too many checks queued");
        }

        return checkId;
    };

    /**
     * Close the port and any associated open transports that use the port
     *
     * @api public
     */
    RealtimePort.prototype.close = function() {
        var plugin;
        if(this.open) {
            Object.defineReadOnlyProperty(this, 'open', false);
            plugin = rtapi.getPlugin();
            plugin.candidateClose(this.id);
            this.dispatchEvent(new Event('close'));
        }
    };

    /**
     * Query the status of a particular remote port with respect to this port.
     * Returns true if the remote port was successfully checked recently.  The
     * specific time is based on the browser's configured consent expiration timer.
     *
     * @api public
     *
     * @param {RemoteRealtimePort}  remotePort
     *
     * @return {bool} true iff a recent check toward the given port was recently successful
     */
    RealtimePort.prototype.status = function(remotePort) {
        if(this.open === false) {
            throw new Error("port is not open");
        }
        var remotePortId = rtapi.util.getRemotePortId(remotePort, false);
        if(typeof remotePortId !== 'string') {
            return false;
        }
        var plugin = rtapi.getPlugin();
        var result = plugin.checkCandidatePairStatus(this.id, remotePortId);
        return result;
    };

    function encodeAttribute(attr) {
        if(attr.value) {
            return {
                type: attr.type,
                value: global.b64.Encode(attr.value)
            };
        }
        return attr;
    }

    RealtimePort.prototype.setServerAttributes = function(attributes) {
        var strValue = JSON.stringify(attributes.map(encodeAttribute));
        var result = rtapi.getPlugin().candidateSetServerAttributes(this.id, strValue);
        if(result) {
            Object.defineReadOnlyProperty(this, 'serverAttributes', attributes);
        }
        return result;
    };

    /**
     * Get value of specified counter.
     *
     * @api public
     * @param {String}                  counter
     *
     * @return {int} counter value or -1 if invalid
     */
    RealtimePort.prototype.getCounter = function(counter) {
        return rtapi.util.getCounter('candidate',this,counter);
    };

    /**
     * Get a dictionary of all counters for the port.
     *
     * @api public
     *
     * @return {dictionary} counters associated with the port
     */
    RealtimePort.prototype.getCounters = function() {
        return rtapi.util.getCounters('candidate',this);
    };

    /**
     * Open ports on the localhost.  One port is opened for each network interface
     * on the host.  Calls the provided callback when complete.
     *
     * @api public
     *
     * @param {RealtimePortCallback} realtimePortCallback
     */
    RealtimePort.openLocalPorts = function(realtimePortCallback) {
        if(realtimePortCallback === null || typeof realtimePortCallback === 'undefined') {
            throw new Error("openLocalPorts: invalid parameters");
        }

        var plugin = rtapi.getPlugin();

        // call the plugin to gather the hosts
        plugin.gatherHostCandidates(

        function(candidatesJson) {
            var r = [];
            var cands = JSON.parse(candidatesJson);
            for(var i = 0; i < cands.length; i++) {
                var cand = cands[i];
                var ip = cand.ip;
                var port = parseInt(cand.port, 10);
                var ipPort = ip + ':' + port;
                var rto = new RealtimePort(cand.candidateId, ip, port, cand.ufrag, cand.pwd);
                r[r.length] = rto;
            }
            realtimePortCallback(null, r);
        }, function() {});
    };

    /**
     * Allocate a relay port on a TURN server using a newly created local base.
     *
     * @api public
     *
     * @param {TurnServer}              turnServer
     * @param {RealtimePortCallback}    realtimePortCallback
     */
    RealtimePort.allocateRelay = function(turnServer, realtimePortCallback) {
        throw new Error("unsupported: allocateRelay");
    };

}((typeof window === 'object' ? window : global), ('undefined' !== typeof rtapi) ? rtapi : window));
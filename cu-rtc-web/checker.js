(function(g) {
    'use strict'; /*jshint browser:true,node:true*/

    /**
     * Create a new checker.
     * @param localPort {RealtimePort} the local port to use in checking
     * @param remotePort {RemoteRealtimePort} the remote port to check against
     * @param controlRandom {ArrayBuffer} the value to use to break controlling/controlled ties (must be ArrayBuffer(8))
     * @param options {Object} options that include:
     *        * controlling {boolean} whether we are controlling or controlled
     *        * roundTrip {Number} the initial size of the round trip timer, default 500 (ms)
     *          set this high to start because it only goes down from here
     *        * timerManager {Object} the window, or something with setTimeout, mostly only here for testing purposes
     *        * maxChecks {Number} the number of checks to run
     *        * attributes {Array} an array of attributes that should be added to check requests
     */

    function RealtimePortPairChecker(localPort, remotePort, controlRandom, options) {
        var view;

        g.EventTarget.call(this);
        options = options || {};

        this.local = localPort;
        this.remote = remotePort;
        this.rto = options.roundTrip || 500;
        this.maxChecks = options.maxChecks || 5;

        this.setControlRandom(controlRandom);
        this.setControllerState(options.controlling);

        this.timer = options.timerManager || g;
        this.extraAttributes = options.attributes || [];

        this.local.addEventListener('checksent', this.checkSent.bind(this));
        this.local.addEventListener('checksuccess', this.checkSuccess.bind(this));
        this.local.addEventListener('close', this.portClosed.bind(this));

        this.defineEventProperty('close');
    }
    Object.inherits(RealtimePortPairChecker, g.EventTarget);

    RealtimePortPairChecker.prototype.setControllerState = function(controller) {
        this.controllerState = !!controller;
    };

    RealtimePortPairChecker.prototype.setControlRandom = function(controlRandom) {
        this.controlRandom = controlRandom;
    };

    RealtimePortPairChecker.prototype.addCheckAttribute = function(attr) {
        this.extraAttributes.push(attr);
    };

    RealtimePortPairChecker.prototype.report = function(success) {
        var cb = this.callback;
        this.callback = null;
        if (typeof cb === 'function') {
            cb(success, this.controllerState);
        }
    };

    RealtimePortPairChecker.prototype.stop = function(success) {
        if (this.timeout) {
            this.timer.clearTimeout(this.timeout);
            this.timeout = null;
        }
        if (this.lastCheck) {
            this.local.cancelCheck(this.lastCheck);
            this.lastCheck = null;
        }
        this.report(success);
    };

    RealtimePortPairChecker.prototype.sendCheck = function() {
        if (!this.local.open) {
            this.stop(false);
            return;
        }

        var attributes = [];
        var attrType = this.controllerState ? 0x802A : 0x8029;
        attributes.push({
            type: attrType,
            value: this.controlRandom
        });
            attributes.push({
                type: 0x0025,
                value: new ArrayBuffer(0)
            });
            var priority = new ArrayBuffer(4);
            var array = new Int32Array(priority);
            array[0] = 234838333;
            attributes.push({ 
                type: 0x0024, // Priority
                value: priority
            });
        attributes = attributes.concat(this.extraAttributes);
        try {
           this.lastCheck = this.local.check(this.remote, attributes);
        } catch (e) {
            // can't send - probably because too many checks are queued
            this.lastCheck = null;
        }
    };

    RealtimePortPairChecker.prototype.nextDelay = function() {
        // count starts at 1, but delay starts at 1, which is (1 << 0)
        var v = this.rto * (1 << this.checkCount);
        this.checkCount++;
        return (Math.random() * 0.4 + 0.8) * v;
    };

    RealtimePortPairChecker.prototype.giveUp = function() {
        this.stop(false);
    };

    RealtimePortPairChecker.prototype.portClosed = function() {
        this.giveUp();
        this.dispatchEvent(new g.Event('close'));
    };

    RealtimePortPairChecker.prototype.isRelevant = function(peer) {
        if (this.lastCheck) {
            return peer.ip === this.remote.ip && peer.port === this.remote.port;
        }
        return false;
    };

    RealtimePortPairChecker.prototype.checkSent = function(e) {
        var self = this;
        var delay;
        var func;

        function nextCheck() {
            self.timeout = null;
            self.sendCheck();
        }

        function giveUp() {
            self.timeout = null;
            self.giveUp();
        }

        if (!this.isRelevant(e.remote)) {
            return;
        }

        delay = this.nextDelay();
        if (this.checkCount < this.maxChecks) {
            func = nextCheck;
        } else {
            func = giveUp;
        }
        this.timeout = this.timer.setTimeout(func, delay);
    };

    RealtimePortPairChecker.prototype.updateRto = function(e) {
        var rtt = e.response.timestamp.getTime() - e.request.timestamp.getTime();
        if (rtt) {
            // want to keep rto if it is low, but update if the rtt is lower (though we don't want less than 100ms)
            this.rto = Math.min(this.rto, Math.max(100, rtt));
        }
    };

    function compareBuffers(a, b) {
        var i;
        var viewA = new Uint8Array(a);
        var viewB = new Uint8Array(b);
        if (a.byteLength !== 8 || b.byteLength !== 8) {
            return 1;  // bad, we control
        }
        for (i = 0; i < 8; ++i) {
            if (viewA[i] !== viewB[i]) {
                return viewA[i] - viewB[i];
            }
        }
        return 0;
    }

    RealtimePortPairChecker.prototype.updateControllerState = function(response) {
        var attr; 
        var localAttrType;
        var remoteAttrType;
        var comparison;

        localAttrType = this.controllerState ? 0x802A : 0x8029;
        remoteAttrType = localAttrType ^ 3; // the opposite
        attr = response.getStunAttribute(remoteAttrType);
        if (!attr) {
            remoteAttrType ^= 0x3;
            attr = response.getStunAttribute(remoteAttrType); // look for the other
        }
        if (attr) {
            comparison = localAttrType - remoteAttrType;  // controlling > controlled
            if (comparison === 0) {
                // we should really send an error if CONTROLLING is set by both peers
                // but that's silly - they should work it out based on their own checks
                comparison = compareBuffers(this.controlRandom, attr.value);
            }
            if (comparison !== 0) {
                this.setControllerState(comparison > 0);
            } else {
                delete this.controllerState; // set this to undefined to trigger a change in random value
            }
        } else {
            // no controlling/controlled attribute is suspect, but probably harmless
            // we shall assume the role of controlling peer, for now
            this.controllerState = true;
        }
    };

    RealtimePortPairChecker.prototype.checkSuccess = function(e) {
        if (!this.isRelevant(e.remote)) {
            return;
        }
        this.updateRto(e);
        this.updateControllerState(e.response);

        this.lastCheck = null;
        this.stop(true);
    };

    /**
     * Run a check.
     * Only one check can run at a time.
     * @param cb {Function} a callback for when the checking is done. 
     *           This callback is called with two arguments, both boolean:
     *               - true iff the check succeeded
     *               - true iff we are the ICE controller (only ever true if the check succeeds)
     */

    RealtimePortPairChecker.prototype.check = function(cb) {
        if (this.callback) {
            throw new Error('checking in progress');
        }
        this.stop(false);
        this.checkCount = 0;
        this.callback = cb;
        this.sendCheck();
    };

    g.icejs.RealtimePortPairChecker = RealtimePortPairChecker;
}((typeof window === 'object') ? window : global));
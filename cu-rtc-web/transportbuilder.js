/*
[Constructor()]
interface IceAgent : EventTarget {
    readonly sequence<RealtimePort> local;
    readonly sequence<RemoteRealtimePort> remote;
    readonly RealtimeTransport? transport;
    void addRemote(RemoteRealtimePort rem);
    void start();
    void stop();
    void closeAll();
    EventHandler? onconnect;
    EventHandler? oncandidate;
    EventHandler? onerror;
};
 */

(function(g) {
    'use strict'; /*jshint browser:true,node:true*/

    var RealtimePort = g.rtapi.RealtimePort;
    var RealtimeTransport = g.rtapi.RealtimeTransport;

    var RealtimePortGatherer = g.icejs.RealtimePortGatherer;
    var RealtimePortPairChecker = g.icejs.RealtimePortPairChecker;
    var RealtimePortEvent = g.icejs.RealtimePortEvent;
    var ReflexiveRealtimePort = g.icejs.ReflexiveRealtimePort;


    function createControlRandom() {
        var buffer = new ArrayBuffer(8);
        var view = new Uint16Array(buffer);
        var i;
        for(i = 0; i < view.length; ++i) {
            view[i] = Math.random() * 0x10000;
        }
        return buffer;
    }

    function isDuplicateCandidate(rem, existing) {
        var rembase = rem.base || rem;
        var exbase = existing.base || existing;
        if(rembase.ip !== exbase.ip || rembase.port !== exbase.port) {
            return false;
        }
        return existing.ip === rem.ip && existing.port === rem.port && existing.ufrag === rem.ufrag && existing.pwd === rem.pwd;
    }

    /**
     * Unlike a full-blown ICE Agent, this only deals with a single component.
     */

    function RealtimeTransportBuilder(options) {
        var self = this;
        var gatherer = new RealtimePortGatherer(options);
        var gatherDone = false;
        var remote = []; // the set of remote ports
        var enabled = false; // whether we are running
        var checkers = []; // checkers for each of the port pairs
        var active;
        var good = []; // a list of spare good pairs
        var bad = []; // a list of all the bad pairs
        var controlRandom;
        var controlling = false;
        var stunServerAttributes = [];
        var nominating = false;
        var earlyNominee;

        g.EventTarget.call(this);

        if(!options || !options.transport) {
            throw new Error('options must include transport options');
        }

        controlRandom = createControlRandom();

        function transportCreated(err, transport) {
            if(err) {
                self.dispatchEvent(new g.Event('error'));
                return;
            }

            var evt = new g.Event('connect');
            evt.local = active.local;
            evt.remote = active.remote;
            evt.transport = transport;
            self.dispatchEvent(evt);

            Object.defineReadOnlyProperty(self, 'transport', transport);
        }

        function createTransport(newActive) {
            var evt;
            if(active === newActive) {
                // it was a simultaneous nomination, no need to repeat.
                return;
            }

            active = newActive; // dispose the previous?
            console.log('create transport', active.local.id, active.remote.id);

            var createTransport = options.createTransport || RealtimeTransport.createTransport;

            try {
                createTransport(active.local, active.remote, options.transport, transportCreated);
            } catch(ex) {
                evt = new g.Event('error');
                evt.exception = ex;
                self.dispatchEvent(evt);
            }
        }

        function nominationCompleted(success) {
            console.log('nominated', success);
            nominating = false;
            if(success) {
                createTransport(good[0]);
            } else {
                bad.push(good.shift());
                activateNextGoodPair();
            }
        }

        function nominate() {
            var nextActive = good[0];
            if(!nextActive) {
                return;
            }
            console.log('nominating', nextActive.local.id, nextActive.remote.ip, nextActive.remote.port);
            nominating = true;
            nextActive.addCheckAttribute({
                type: 0x0025,
                value: new ArrayBuffer(0)
            });
            nextActive.addCheckAttribute({ 
                type: 0x0024, // Priority
                value: new ArrayBuffer(4)
            });
            nextActive.check(nominationCompleted);
        }

        function activateNextGoodPair() {
            if(controlling && !nominating && good.length > 0) {
                nominate();
            }
        }

        function buildCheckerMatcher(loc, rem) {
            return function(checker) {
                if(checker.local !== loc) {
                    return false;
                }
                return checker.remote.ip === rem.ip && checker.remote.port === rem.port && checker.remote.ufrag === rem.ufrag;
            };
        }

        function findPair(matcher) {
            // note that we are looking at all checkers, including those we might have thought bad
            // we accept the wisdom of the controlling peer
            return checkers.filter(matcher)[0];
        }

        function nominationListener(e) {
            var matcher, pair;
            var useCandidate = e.request.getStunAttribute(0x0025);
            if(useCandidate && !controlling) {
                console.log('remote nomination', e.target.id, e.remote.id);
                matcher = buildCheckerMatcher(e.target, e.remote);
                pair = findPair(matcher);
                if(pair) {
                    if(pair !== active) {
                        createTransport(pair);
                    }
                } else {
                    // we save the nomination for when we receive signaling for the pair
                    // this happens when we send our ports out but the remote peer jumps in and nominates faster
                    // than their signaling can arrive
                    console.log('early nominee');
                    earlyNominee = matcher;
                }
            } // if we are controlling, ignore nominations
        }

        /** 
         * Every port that we control is expected to return a coherent set of attributes.
         * This builds that set.
         */

        function buildStunServerAttributes() {
            var controlAttrType = 0x8029;
            stunServerAttributes.splice(0);
            // TODO set PRIORITY attribute
            if(controlling) {
                controlAttrType = 0x802a;
            } else {
                stunServerAttributes.push({
                    type: 0x0025
                }); // echo USE-CANDIDATE
            }
            stunServerAttributes.push({
                type: controlAttrType,
                value: controlRandom
            });
        }
        buildStunServerAttributes();

        function setStunServerAttributes(localPort) {
            localPort.setServerAttributes(stunServerAttributes);
        }

        function setCheckerControlling(checker) {
            checker.setControllerState(controlling);
        }

        function setCheckerControlRandom(checker) {
            checker.setControlRandom(controlRandom);
        }

        function updateControlling(checker, isController) {
            if(typeof isController === 'undefined') {
                controlRandom = createControlRandom();
                checkers.forEach(setCheckerControlRandom);
                // reset the tie breaker number
                // this might happen a number of times, but that's OK, it only affects new checks
                checker.check(); // force a re-check on the affected checker
            } else if(isController !== controlling) {
                // step up into the controlling role (or down from it, which should never happen)
                controlling = isController;
                buildStunServerAttributes();
                gatherer.ports.forEach(setStunServerAttributes);
                checkers.forEach(setCheckerControlling);
            }
        }

        function pairChecked(checker, success, isController) {
            if(!success) {
                bad.push(checker);
                return;
            }

            updateControlling(checker, isController);

            good.push(checker);
            activateNextGoodPair();
        }

        function check(checker) {
            checker.check(function(success, isController) {
                console.log('checked', success, checker.local, checker.remote);
                pairChecked(checker, success, isController);
            });
        }

        function removeFromList(list, value) {
            var idx = list.indexOf(value);
            if(idx >= 0) {
                list.splice(idx, 1);
            }
            return idx;
        }

        function pairClosed(e) {
            // the only reason that we remove checkers is when they break
            var idx = removeFromList(good, e.target);
            if(idx === 0) { // active or active-in-waiting
                activateNextGoodPair(); // fail over to next good one
            }
            removeFromList(bad, e.target);
            removeFromList(checkers, e.target);

            if(gatherer.ports.length === 0) {
                self.dispatchEvent(new g.Event('error'));
            }
        }

        function addPair(loc, rem) {
            var checker = new RealtimePortPairChecker(loc, rem, controlRandom, options);
            console.log('matched port pair', loc, rem);
            checker.addEventListener('close', pairClosed);
            checkers.push(checker);
            if(enabled) {
                check(checker);
                if(earlyNominee && earlyNominee(checker)) {
                    console.log('acting on early nomination');
                    createTransport(checker);
                }
            }
        }

        function newLocalPort(e) {
            var port = e.port;
            console.log('new local port', e.port);

            // reflexive addresses are informational only, 
            // checks use their base, which we should already have
            if(!(port instanceof ReflexiveRealtimePort)) {
                setStunServerAttributes(port);
                port.addEventListener('remotecheck', nominationListener);
                remote.forEach(function(rem) {
                    addPair(port, rem);
                });
            }

            self.dispatchEvent(new RealtimePortEvent(port));
        }
        gatherer.addEventListener('port', newLocalPort);

        function gathererDone(e) {
            gatherDone = true;
            if(gatherer.ports.length === 0) {
                self.dispatchEvent('fail');
            }
        }
        gatherer.addEventListener('done', gathererDone);

        self.start = function() {
            enabled = true;
            gatherer.gather();
            checkers.forEach(check); // start checking on each existing checker
        };

        self.stop = function() {
            enabled = false;
            checkers.forEach(function(checker) {
                checker.stop();
            });
        };

        self.closeAll = function() {
            self.stop();
            gatherer.closeAll();
        };

        function isDuplicateRemote(rem) {
            return remote.some(function(existing) {
                return isDuplicateCandidate(rem, existing);
            });
        }

        self.addRemote = function(rem) {
            console.log('new remote port', rem);
            if(!isDuplicateRemote(rem)) {
                remote.push(rem);
                gatherer.ports.forEach(function(loc) {
                    // todo insert pairs in priority order, 
                    // and delay checking to allow for higher priority pairs to be added, etc...
                    addPair(loc, rem);
                });
            }
        };

        Object.defineProperty(self, 'local', {
            get: function() {
                return gatherer.ports;
            },
            enumerable: true
        });
        Object.defineProperty(self, 'remote', {
            get: function() {
                return remote;
            },
            enumerable: true
        });
        Object.defineReadOnlyProperty(self, 'transport', null);

        self.defineEventProperty('connect');
        self.defineEventProperty('error'); // happens with zero ports, or with bad transport options
        self.defineEventProperty('port');
    }
    Object.inherits(RealtimeTransportBuilder, g.EventTarget);

    g.icejs.RealtimeTransportBuilder = RealtimeTransportBuilder;
}((typeof window === 'object') ? window : global));
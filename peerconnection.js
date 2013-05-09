sip = {}

sip.filter = function(lambda, list) {
    var result = [];
    for (var i=0; i<list.length; ++i) {
        if (lambda(list[i]))
            result.push(list[i]);
    }
    return result;
};

sip.map = function(lambda, list) {
    var result = [];
    for (var i=0; i<list.length; ++i) {
        result.push(lambda(list[i]));
    }
    return result;
};

sip.str_partition = function(value, sep) {
    var index = value.indexOf(sep);
    return index >= 0 ? [value.substr(0, index), sep, value.substr(index+sep.length)] : [value, '', '']
};

sip.str_strip = function(value) {
    return value.replace(/^\s+/g, '').replace(/\s+$/g, '');
};

sip.str_slice = function(str, first, second) {
    if (typeof first == "undefined" || first < 0)
        first = 0;
    if (typeof second == "undefined" || second > str.length)
        second = str.length;
    var result = [];
    for (var i=first; i<second; ++i) {
        result.push(str.charAt(i));
    }
    return result.join('');
};
sip.list_slice = function(list, first, second) {
    if (typeof first == "undefined" || first < 0)
        first = 0;
    if (typeof second == "undefined" || second > list.length)
        second = list.length;
    var result = [];
    for (var i=first; i<second; ++i) {
        result.push(list[i]);
    }
    return result;
};

sip.dict_items = function(dict) {
    var result = [];
    for (var s in dict) {
        result.push([s, dict[s]]);
    }
    return result;
};

sip.is_array = function(obj) {
    return Object.prototype.toString.apply(obj) === '[object Array]';
};


function SDP(value) {
    if (value)
        this._parse(value);
}

SDP._multiple = 'tramb';

function originator(value) {
    if (value && typeof value == "string") {
        var parts = value.split(' ');
        this.username = parts[0];
        this.sessionid = parseInt(parts[1]);
        this.version = parseInt(parts[2]);
        this.nettype = parts[3];
        this.addrtype = parts[4];
        this.address = parts[5];
    }
    else {
        this.username = "-";
        this.sessionid = Math.ceil((new Date()).getTime() / 1000);
        this.version = Math.ceil((new Date()).getTime() / 1000);
        this.nettype = "IN";
        this.addrtype = "IP4";
        this.address = (value && value["address"] !== undefined ? value["address"] : "127.0.0.1");
    }
}

originator.prototype.toString = function() {
    return [this.username, this.sessionid.toString(), this.version.toString(), this.nettype, this.addrtype, this.address].join(' ');
};

SDP.originator = originator;


function connection(value) {
    if (value && typeof value == "string") {
        parts = value.split(' ');
        this.nettype = parts[0];
        this.addrtype = parts[1];
        var rest = parts[2].split('/');
        this.address = (rest.length > 0 ? rest[0] : null);
        this.ttl = (rest.length > 1 ? parseInt(rest[1]) : null);
        this.count = (rest.length > 2 ? parseInt(rest[2]) : null);
    }
    else {
        var attrs = ["address", null, "nettype", "IN", "addrtype", "IP4", "ttl", null, "count", null];
        for (var i=0; i<attrs.length; i += 2) {
            var attr = attrs[i];
            var def = attrs[i+1];
            this[attr] = (value && value[attr] !== undefined ? value[attr] : def);
        }
    }
}
connection.prototype.toString = function() {
    return this.nettype + ' ' + this.addrtype + ' ' + this.address + (this.ttl === null ? '' : '/' + this.ttl) + (this.count === null ? '' : '/' + this.count);
};

SDP.connection = connection;

function media(value) {
    if (value && typeof value == "string") {
        var parts = value.split(' ');
        this.media = parts.shift();
        this.port = parseInt(parts.shift());
        this.proto = parts.shift();
        this.fmt = [];
        this.crypto = [];//ggb
        this.candidates = [];//ggb
        for (var i=0; i<parts.length; ++i) {
            var f = parts[i];
            var a = {};
            if (f.match(/^\d+$/)) {
                a.pt = parseInt(f);
            }
            else {
                a.pt = f;
            }
            this.fmt.push(a);
        }
    }
    else {
        this.media = (value && value["media"] !== undefined ? value["media"] : null);
        this.port = (value && value["port"] !== undefined ? value["port"] : 0);
        this.proto = (value && value["proto"] !== undefined ? value["proto"] : "RTP/AVP");
        this.fmt = (value && value["fmt"] !== undefined ? value["fmt"] : []);
    }
}

media.prototype.toString = function() {
    var result = this.media + ' ' + this.port + ' ' + this.proto + ' ' + sip.map(function(item) { return item.pt.toString();}, this.fmt).join(' ');
    var attrs = ['i', 'c', 'b', 'k', 'a'];
    for (var i=0; i<attrs.length; ++i) {
        var k = attrs[i];
        if (this[k] !== undefined) {
            var all = this[k];
            if (SDP._multiple.indexOf(k) < 0) {
                result += "\r\n" + k + "=" + all.toString();
            }
            else {
                for (var j=0; j<all.length; ++j) {
                    var v = all[j];
                    result += "\r\n" + k + "=" + v.toString();
                }
            }
        }
    }
    for (var l=0; l<this.fmt.length; ++l) {
        var f = this.fmt[l];
        if (f["name"] !== undefined) {
            result += "\r\n" + "a=rtpmap:" + f.pt + " " + f.name + "/" + f.rate + (f.params ? '/' + f.params : '');
        }
    }
    return result;
};

media.prototype.dup = function() {
    var result = new SDP.media({media: this.media, port: this.port, proto: this.proto, fmt: sip.map(function(f) {return {pt: f.pt, name: f.name, rate: f.rate, params: f.params}}, this.fmt)});
    var attrs = ['i', 'c', 'b', 'k', 'a'];
    for (var i=0; i<attrs.length; ++i) {
        var k = attrs[i];
        if (this[k] !== undefined) {
            var all = this[k];
            if (sip.is_array(all)) {
                result[k] = all.slice();
            }
            else {
                result[k] = all;
            }
        }
    }
    return result;
};

SDP.media = media;


SDP.prototype._parse = function(text) {
    var g = true;
    var lines = text.replace(/\r\n/g, "\n").split("\n");
    var obj = null;
    for (var i=0; i<lines.length; ++i) {
        var line = lines[i];
        var parts = sip.str_partition(line, "=");
        var k = parts[0];
        var v = parts[2];
        
        if (k == "o")
            v = new SDP.originator(v);
        else if (k == "c")
            v = new SDP.connection(v);
        else if (k == "m")
            v = new SDP.media(v);
        
        if (k == "m") {
            if (this["m"] === undefined) {
                this["m"] = [];
            }
            this["m"].push(v);
            obj = this["m"][this["m"].length-1];
        }
        else if (this["m"] !== undefined) {
            obj = this["m"][this["m"].length-1];
            if (k == "a" && v.substr(0, 7) == "rtpmap:") {
                var mparts = v.substr(7).split(' ');
                var pt = mparts.shift();
                var rest = mparts.join(' ');
                mparts = sip.str_partition(rest, '/');
                var name = mparts[0];
                rest = mparts[2];
                mparts = sip.str_partition(rest, '/');
                var rate = mparts[0];
                var params = mparts[2];
                var fall = sip.filter(function(x) {return x.pt.toString() == pt.toString(); }, obj.fmt);
                for (var j=0; j<fall.length; ++j) {
                    var f = fall[j];
                    f.name = name;
                    f.rate = parseInt(rate);
                    f.params = params || null;
                }
            }
            else if (k == "a" && v.substr(0, 7) == "crypto:") {
                var mparts = v.substr(7).split(' ');
                obj.crypto.push({
                    index: mparts.shift(),
                    suite: mparts.shift(),
                    key: mparts.shift()
                });
            }
            else if (k == "a" && v.substr(0, 10) == "candidate:") {
                var mparts = v.substr(10).split(' ');
                obj.candidates.push({
                    ip: mparts[4],
                    port: parseInt(mparts[5])
                });
            }
            else if (k == "a" && v.substr(0, 10) == "ice-ufrag:") {
                obj['ice-ufrag'] = v.substr(10);
            }
            else if (k == "a" && v.substr(0, 8) == "ice-pwd:") {
                obj['ice-pwd'] = v.substr(8);
            }
            else {
                if (SDP._multiple.indexOf(k) >= 0) {
                    if (obj[k] !== undefined)
                        obj[k].push(v);
                    else
                        obj[k] = [v];
                }
                else {
                    obj[k] = v;
                }
            }
        }
        else {
            obj = this;
            if (SDP._multiple.indexOf(k) >= 0) {
                if (obj[k] !== undefined)
                    obj[k].push(v);
                else
                    obj[k] = [v];
            }
            else {
                obj[k] = v;
            }
        }
    }
};

SDP.prototype.toString = function() {
    var result = '';
    var attrs = ['v', 'o', 's', 'i', 'u', 'e', 'p', 'c', 'b', 't', 'a', 'm'];
    for (var i=0; i<attrs.length; ++i) {
        var k = attrs[i];
        if (this[k] !== undefined) {
            var all = this[k];
            if (SDP._multiple.indexOf(k) < 0) {
                result += k + "=" + all.toString() + "\r\n";
            }
            else {
                for (var j=0; j<all.length; ++j) {
                    var v = all[j];
                    result += k + "=" + v.toString() + "\r\n";
                }
            }
        }
    }
    return result;
};

function SessionDescription(sdp) {
    this.sdp = sdp;
}

SDP.fromRealtimeMediaDescription = function(description, port, sdes) {
    console.log(description.toDictionary());

    var s = "v=0\r\n"
        +   "o=jdoe 2890844526 2890842807 IN IP4 " + port.ip + "\r\n"
        +   "s=SDP\r\n"
        +   "c=IN IP4 " + port.ip + "\r\n"
        +   "t=2873397496 2873404696\r\n"
        +   "a=msid-semantic: WMS 3wHNrw5LNfQljjixIteML0kBbHRqEsybguEs\r\n"
        +   "a=group:BUNDLE audio\r\n"
        +   "m=audio " + port.port + " RTP/SAVPF 0\r\n"
        +   "a=sendrecv\r\n"
        +   "a=ice-ufrag:" + port.ufrag + "\r\n"
        +   "a=ice-pwd:" + port.pwd + "\r\n"
        +   "a=rtpmap:0 PCMU/8000\r\n"
        +   "a=crypto:0 AES_CM_128_HMAC_SHA1_80 inline:" + b64.Encode(sdes.key).replace(/=/g, '') + b64.Encode(sdes.salt).replace(/=/g, '') + "\r\n"
        +   "a=candidate:3793899172 1 udp 1509957375 " + port.ip + " " + port.port + " typ host generation 0\r\n"
        +   "a=candidate:3793899172 2 udp 1509957375 " + port.ip + " " + port.port + " typ host generation 0\r\n"
        +   "a=ssrc:2573139346 cname:hznZDZum7xVR53t/\r\n"
        +   "a=ssrc:2573139346 msid:3wHNrw5LNfQljjixIteML0kBbHRqEsybguEs 3wHNrw5LNfQljjixIteML0kBbHRqEsybguEs\r\n"
        +   "a=ssrc:2573139346 mslabel:3wHNrw5LNfQljjixIteML0kBbHRqEsybguEs\r\n"
        +   "a=ssrc:2573139346 label:3wHNrw5LNfQljjixIteML0kBbHRqEsybguEs\r\n"

    return new SessionDescription(s);
}

function RTCPeerConnection(config) {
    console.log('RTCPeerConnection.RTCPeerConnection');

    this.outboundSdes = { key: new ArrayBuffer(16), salt: new ArrayBuffer(14) };
    this.inboundSdes = undefined;
}

RTCPeerConnection.prototype.addStream = function(stream, constrains) {
    console.log('RTCPeerConnection.addStream ' + stream);

    this.stream = stream;
}

RTCPeerConnection.prototype.createSessionDescription = function(isOffer, callback, xxxx, constrains) {
    console.log('RTCPeerConnection.createSessionDescription');

    var track = this.stream.audioTracks[0];
    var description = new RealtimeMediaDescription(track);

    var options = { 
        controlling: isOffer,
        transport: { 
        }//, 
        //stun: { ip: "50.18.141.102", port: 3478 }
    };

    var pc = this;

    options.createTransport = function(local, remote, options, transportCreated) {
        console.log('RtcPeerConnection.createTransport');
        options = {
            mode: 'srtp', 
            inboundSdes: pc.inboundSdes,
            outboundSdes: pc.outboundSdes
        }
        RealtimeTransport.createTransport(local, remote, options, transportCreated);
    }

    this.builder = new icejs.RealtimeTransportBuilder(options);

    this.builder.onport = function(e) {
        console.log('New local port' + e.port);

        var sdp = SDP.fromRealtimeMediaDescription(description, e.port, pc.outboundSdes);
        callback(sdp);
    };

    this.builder.onconnect = function(e) {
        console.log('onconnect')
        e.target.stop();

        pc.gotTransport(e.transport); // at which point streams can be added, etc...
    };

    this.builder.start();
}

RTCPeerConnection.prototype.createOffer = function(callback, xxxx, constrains) {
    console.log('RTCPeerConnection.createOffer');

    this.createSessionDescription(true, callback, xxxx, constrains);
}

RTCPeerConnection.prototype.createAnswer = function(callback, xxxx, constrains) { 
    console.log('RTCPeerConnection.createAnswer');

    this.createSessionDescription(false, callback, xxxx, constrains);
}

RTCPeerConnection.prototype.setLocalDescription = function(sessionDescription, callback) {
    console.log('RTCPeerConnection.setLocalDescription');

    this.localDescription = sessionDescription;

    if (this.remoteDescription) {
        var sdp = new SDP(this.remoteDescription.sdp);
        var crypto = sdp['m'][0].crypto[0];
        var candidates = sdp['m'][0].candidates;

        var cryptoBuffer = b64.Decode(crypto.key.substr('inline:'.length));
        var key = new Uint8Array(cryptoBuffer, 0, 16);
        var salt = new Uint8Array(cryptoBuffer, 16, 14);

        this.inboundSdes = { key: key, salt: salt };

        for (var i=0; i<candidates.length; i++) {
            //http://lists.w3.org/Archives/Public/public-webrtc/2012Oct/att-0076/realtime-media.html#idl-def-RemoteRealtimePort
            remotePort = {
                ip: candidates[i].ip,
                port: candidates[i].port,
                ufrag: sdp['m'][0]['ice-ufrag'],
                pwd: sdp['m'][0]['ice-pwd']
            }
            this.builder.addRemote(remotePort);
        }
    }
}

RTCPeerConnection.prototype.setRemoteDescription = function(sessionDescription, callback) {
    console.log('RTCPeerConnection.setRemoteDescription');

    this.remoteDescription = sessionDescription;

    if (this.localDescription) {
        var sdp = new SDP(this.remoteDescription.sdp);
        var crypto = sdp['m'][0].crypto[0];
        var candidates = sdp['m'][0].candidates;

        var cryptoBuffer = b64.Decode(crypto.key.substr('inline:'.length));
        var key = new Uint8Array(cryptoBuffer, 0, 16);
        var salt = new Uint8Array(cryptoBuffer, 16, 14);

        this.inboundSdes = { key: key, salt: salt };

        for (var i=0; i<candidates.length; i++) {
            //http://lists.w3.org/Archives/Public/public-webrtc/2012Oct/att-0076/realtime-media.html#idl-def-RemoteRealtimePort
            remotePort = {
                ip: candidates[i].ip,
                port: candidates[i].port,
                ufrag: sdp['m'][0]['ice-ufrag'],
                pwd: sdp['m'][0]['ice-pwd']
            }
            this.builder.addRemote(remotePort);
        }
    }
    callback();

}

RTCPeerConnection.prototype.discoveredSsrc = function(e) {
    var remoteDescription = this.buildDescription(e.ssrc);
    var rtStream = new RemoteRealtimeMediaStream(remoteDescription, this.transport);
    var incomingStream = new MediaStream();
    incomingStream.audioTracks.add(rtStream.track);

    if (this.onaddstream) {
        this.onaddstream({stream: incomingStream});
    }
}

RTCPeerConnection.prototype.buildDescription = function(ssrc) {
    var g711Codec = {
        type: 'audio/PCMU',
        clockRate: 8000,
        packetType: 0
    };
    var stream = {
        ssrc: ssrc
    };
    return new RealtimeMediaDescription({
        streams: [stream],
        codecs: [g711Codec]
    });
}

RTCPeerConnection.prototype.startOutgoingStream = function() {
    if(this.transport && this.stream) {
        var localDescription = this.buildDescription();
        var outgoingStream =
                new LocalRealtimeMediaStream(this.stream.audioTracks.item(0),
                                             localDescription, this.transport);
        outgoingStream.play();
    }
}

RTCPeerConnection.prototype.gotTransport = function(transport) {
    console.log('gotTransport');

    this.transport = transport;

    var pc = this;
    transport.addEventListener('unknownssrc', function(e) { pc.discoveredSsrc(e); });

    this.startOutgoingStream();
}
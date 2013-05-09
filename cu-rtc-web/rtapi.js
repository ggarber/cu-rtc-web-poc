/* ! rtapi.js Copyright(c) 2012 Microsoft */

/**
 * rtapi
 * The realtime API for using the MSG Plugin
 *
 * Defines what really should be private helper and utility methods used
 * by other components of the API.
 */

/*jshint node:true,browser:true,smarttabs:true*/
/*global rtapi*/


(function(exports, global) {
    'use strict';

    /**
     * rtapi namespace
     *
     * @namespace
     */

    var rtapi = exports;

    /**
     * Plugin loaded?
     *
     * @api private
     */
    var plugin;
    var init;

    function isMsIE() {
        if (typeof navigator === 'undefined') {
            return false;
        }
        return !!navigator.userAgent.match(/MSIE\s\d+/);
    }

    function createPlugin() {
        if (plugin) {
            return;
        }
        plugin = document.createElement('object');
        plugin.setAttribute('id', 'rtapiPlugin');
        if (isMsIE()) {
            // IE requires that the object be added to the DOM before
            // loading the plugin
            document.body.appendChild(plugin);
            plugin.setAttribute('type', 'application/x-webrtcdemo');
        } else {
            plugin.setAttribute('type', 'application/x-webrtcdemo');
            document.body.appendChild(plugin);
        }
        init = false;
    }

    function initPlugin() {
        if (init) {
            return;
        }
        try {
            plugin.initialize();
            init = true;
        } catch (err) {
            throw err;
        }
    }

    /**
     * Get plugin.
     *
     * @api public
     */
    rtapi.getPlugin = function(cb) {
        createPlugin();
        initPlugin();
        return plugin;
    };

}('object' === typeof module ? module.exports : (this.rtapi = {}), this));

(function(exports, global) {
    'use strict';

    var util = exports.util = {};

    /** not null */

    function nn(x) {
        if ('undefined' === typeof x || 'null' === typeof x) {
            x = '';
        }
        return x;
    }

    /**
     * Build a unique key based on a CURTC remote port dictionary
     */

    function canonicalizeRemotePort(remotePort) {
        if ((typeof remotePort !== 'object') || (remotePort === null)) {
            return '';
        }

        var keys = ['ip', 'port', 'pwd'];
        keys.push(remotePort.username ? 'username' : 'ufrag');
        return keys.map(function(key) {
            return key + ':' + nn(remotePort[key]);
        }).join(';');
    }


    /**
     * Global map of plugin id's for remote ports
     */
    var remotePortIdMap = {};

    /**
     * Given a CURTC remotePort dictionary, find or build
     * the appropriate plugin-known ID for it.
     *
     * TODO: this is leaky, we have an ever-growing list
     * of ports we ever thought of.
     *
     * remotePort -- a CURTC remote port dictionary with port, ip, ufrag, username, pwd
     * createIfMissing -- if true, we'll make one on the fly (via the plugin) as needed. Else, if it doesnt already exist, return ''.
     */
    util.getRemotePortId = function(remotePort, createIfMissing) {
        var plugin = rtapi.getPlugin();

        var portKey = canonicalizeRemotePort(remotePort);
        var remoteId = null;
        if (typeof remotePortIdMap[portKey] === 'string') {
            remoteId = remotePortIdMap[portKey];
        } else if (createIfMissing) {
            remoteId = plugin.addRemoteCandidate(remotePort.ip, remotePort.port, nn(remotePort.ufrag), nn(remotePort.pwd));
            if (remoteId.length === 0) {
                // invalid return value, unable to create remote candidate?
                throw new Error("addRemoteCandidate: error adding remote candidate");
            }
            remotePortIdMap[portKey] = remoteId;
        }

        return remoteId;
    };

    util.secureRandom = function(size) {
        var plugin = rtapi.getPlugin();
        return rtapi.b64.Decode(plugin.secureRandom(size));
    };

    util.getCounter = function (objectBaseName,object,counterName)
    {
        var pluginMethodName = objectBaseName + 'GetCounter';
        var result;
        try {
            var plugin = rtapi.getPlugin();
            result = plugin[pluginMethodName](object.id, counterName);
        }
        catch(err)
        {
            result = undefined;
        }
        if(result < 0)
        {
            result = undefined;
        }
        return result;
    };

    util.getCounters = function(objectBaseName,object)
    {
        var pluginMethodName = objectBaseName + 'GetCounters';
        var result;
        try {
            var plugin = rtapi.getPlugin();
            var s = plugin[pluginMethodName](object.id);
            result = JSON.parse(s);
        } catch(err) {
            result = {};
        }
        return result;
    };

}('undefined' !== typeof rtapi ? rtapi : module.exports, this));

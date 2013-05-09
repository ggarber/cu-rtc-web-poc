(function() {
    'use strict'; /*jshint browser:true,node:false*/
    /*global URL*/
    for (var a in window.rtapi) {
        if (window.rtapi.hasOwnProperty(a) && (typeof window.rtapi[a] === 'function')) {
            window[a] = window.rtapi[a];
        }
    }
    navigator._getUserMedia = navigator.getUserMedia;
    navigator.getUserMedia = window.rtapi.getUserMedia;
    window.URL = {};
    window.URL.createObjectURL = window.rtapi.createObjectURL;
}());
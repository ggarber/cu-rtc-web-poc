(function(g) {
    'use strict'; /*jshint browser:true,node:true*/

    function RealtimePortEvent(c) {
        g.Event.call(this, 'port');
        this.port = c;
    }
    Object.inherits(RealtimePortEvent, g.Event);

    g.icejs.RealtimePortEvent = RealtimePortEvent;
}((typeof window === 'object') ? window : global));
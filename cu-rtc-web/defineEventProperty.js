(function(g) {
  'use strict'; /*jshint browser:true,node:true*/

  var EventTarget = g.EventTarget;

  /**
   * A helper function for defining event listener properties (the onfoo property for the 'foo' event)
   * @param obj {EventTarget} the event target to attach the property to
   * @param name {string} the name of the event (without the 'on')
   */
  EventTarget.prototype.defineEventProperty = function(name) {
    var currentListener;
    Object.defineProperty(this, 'on' + name, {
      get: function() {
        return currentListener;
      },
      set: function(v) {
        if (currentListener) {
          this.removeEventListener(name, currentListener);
        }
        if (typeof v === 'function') {
          currentListener = v;
          this.addEventListener(name, v);
        } else {
          currentListener = null;
        }
      }
    });
  };
}(typeof window === 'object' ? window : global));
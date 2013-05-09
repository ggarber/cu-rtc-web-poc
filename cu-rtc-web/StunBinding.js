'use strict'; /*global rtapi, Event, EventTarget, b64 */
/*jshint node:true,browser:true*/

/**
 * Definition of Stun objects -- StunAttribute and StunBinding.
 *
 * WebIDL definition of StunAttribute:
 *
 *  dictionary StunAttribute {
 *      unsigned short  type;
 *      ArrayBuffer     value;
 *  };
 *
 * WebIDL definition of StunBinding:
 *
 *  interface StunBinding {
 *      readonly attribute ArrayBuffer             transactionId;
 *      readonly attribute sequence<StunAttribute> attributes;
 *      StunAttribute getStunAttribute (byte type);
 *      Address       getMappedAddress ();
 *  };
 */
(function() {
  var g = ('undefined' !== typeof rtapi) ? rtapi : window;

  function StunBinding(jsonString) {
    var obj = JSON.parse(jsonString); // yes, this will throw! let it
    var attributes = [];
    if (!obj.transactionId || !obj.attributes || !obj.timestamp) {
      throw new Error('missing parameters');
    }

    Object.defineReadOnlyProperty(this, 'transactionId', b64.Decode(obj.transactionId));
    attributes = obj.attributes.map(function(attr) {
      var attribute = {};
      Object.defineReadOnlyProperty(attribute, 'type', attr.type);
      if (attr.value) {
        Object.defineReadOnlyProperty(attribute, 'value', b64.Decode(attr.value));
      }
      return attribute;
    });
    Object.defineReadOnlyProperty(this, 'attributes', attributes);

    Object.defineReadOnlyProperty(this, 'timestamp', new Date(obj.timestamp));
  }
  g.StunBinding = StunBinding;

  // some constants
  StunBinding.ATTR_TYPE_MAPPED_ADDRESS = 0x0001;
  StunBinding.ATTR_TYPE_USERNAME = 0x0006;
  StunBinding.ATTR_TYPE_MESSAGE_INTEGRITY = 0x0008;
  StunBinding.ATTR_TYPE_ERROR_CODE = 0x0009;
  StunBinding.ATTR_TYPE_UNKNOWN_ATTRIBUTE = 0x000A;
  StunBinding.ATTR_TYPE_XOR_MAPPED_ADDRESS = 0x0020;
  StunBinding.ATTR_TYPE_FINGERPRINT = 0x8028;
  StunBinding.ATTR_TYPE_ICE_CONTROLLED = 0x8029;
  StunBinding.ATTR_TYPE_ICE_CONTROLLING = 0x802A;

  StunBinding.MAGIC_COOKIE = 0x2112A442;

  /**
   * Retrieve the first instance of the specified attribute.  If not present, return null.
   *
   * @api public
   *
   * @param {unsigned short}  type
   *
   * @return {StunBinding}
   */
  StunBinding.prototype.getStunAttribute = function(type) {
    return this.attributes.filter(function(attr) {
      return attr.type === type;
    })[0];
  };

  /**
   * Convenience method to get the mapped address attribute.  If not
   * present, null is returned.
   *
   * @api public
   *
   * @return {Address}
   */
  StunBinding.prototype.getMappedAddress = function() {
    var addrAttr = this.getStunAttribute(StunBinding.ATTR_TYPE_XOR_MAPPED_ADDRESS);
    var address = {};
    var addrView;
    var xor = StunBinding.MAGIC_COOKIE;
    if (!addrAttr) {
      addrAttr = this.getStunAttribute(StunBinding.ATTR_TYPE_MAPPED_ADDRESS);
      xor = 0;
      if (!addrAttr) {
        return null;
      }
    }
    addrView = new Uint8Array(addrAttr.value);

    var xor0 = (xor >> 24) & 0xff;
    var xor1 = (xor >> 16) & 0xff;
    var xor2 = (xor >> 8) & 0xff;
    var xor3 = (xor >> 0) & 0xff;

    address.port = ((addrView[2] ^ xor0) << 8) | (addrView[3] ^ xor1);
    address.ip = "" + (addrView[4] ^ xor0); 
    address.ip += "." + (addrView[5] ^ xor1);
    address.ip += "." + (addrView[6] ^ xor2);
    address.ip += "." + (addrView[7] ^ xor3);
    return address;
  };
}());
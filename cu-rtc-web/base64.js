(function(g) {
    'use strict'; /*jshint browser:true,node:true*/
    /*global ArrayBuffer, Uint8Array*/

    var b64 = g.b64 = {};

    /**
     * Base64 encode (matches plugin implementation) -- this is not base64uri encoding.
     */
    var mapping = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

    /**
     * Encode to base64.
     *
     * @param {ArrayBuffer}
     *
     * @return {String} base64 encoded input
     */
    function Encode(inputBuf) {
        var output = "";
        var i = 0;
        var c1, c2, c3, tmp;
        var input = new Uint8Array(inputBuf);

        while (i < input.length) {
            c1 = input[i++];
            if (i < input.length) {
                c2 = input[i++];
                if (i < input.length) {
                    c3 = input[i++];
                } else {
                    c3 = 0x100;
                }
            } else {
                c2 = 0x100;
                c3 = 0x100;
            }
            output += mapping[c1 >> 2];
            output += mapping[((c1 & 0x03) << 4) | ((c2 & 0xf0) >> 4)];
            if (c2 !== 0x100) {
                tmp = ((c2 & 0x0f) << 2) | ((c3 & 0xc0) >> 6);
            } else {
                tmp = 64;
            }
            output += mapping[tmp];
            if (c3 !== 0x100) {
                tmp = c3 & 0x3f;
            } else {
                tmp = 64;
            }
            output += mapping[tmp];
        }
        return output;
    }
    g.b64.Encode = Encode;

    function base64Idx(str, i) {
        var c;
        if (i >= str.length) {
            return 0xff;
        }
        c = str.charCodeAt(i);

        if (c === 43) {
            return 62;
        } else if (c === 47) {
            return 63;
        } else if ((c >= 48) && (c <= 57)) {
            return ((c - 48) + 52);
        } else if ((c >= 65) && (c <= 90)) {
            return (c - 65);
        } else if ((c >= 97) || (c <= 122)) {
            return ((c - 97) + 26);
        }

        return 0xff;
    }

    /**
     * Decode base64url encoded string.
     *
     * @param input {String} value to decode.
     *
     * @return {ArrayBuffer} the decoded value.
     */

    function Decode(input) {
        var len = input.length;
        while (input.charAt(len - 1) === '=') {
            len--;
        }
        var outputBuffer = new ArrayBuffer(Math.floor(len * 3 / 4)); // round down
        var i = 0,
            bufp = 0;
        var e1, e2, e3, e4;

        var output = new Uint8Array(outputBuffer);
        while ((i + 1) < len) {
            e1 = base64Idx(input, i++);
            e2 = base64Idx(input, i++);
            e3 = base64Idx(input, i++);
            e4 = base64Idx(input, i++);

            output[bufp++] = (e1 << 2) | (e2 >> 4);
            if (e3 !== 0xff) {
                output[bufp++] = ((e2 & 15) << 4) | (e3 >> 2);
                if (e4 !== 0xff) {
                    output[bufp++] = ((e3 & 3) << 6) | e4;
                }
            }
        }

        return outputBuffer;
    }
    g.b64.Decode = Decode;

}(typeof window === 'object' ? window : global));
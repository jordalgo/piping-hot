var assert = require('assert');
var estream = require('../lib');
var takeUntil = require('../modules/takeUntil');

describe('takeUntil', function() {
  it('takes events until the passed function is truthy', function(done) {
    var count = 0;
    var dataOver10 = function(event) {
      return event.isData && event.value > 10;
    };

    var s = estream({
      start: function(push, error) {
        push(1);
        error('boom');
        push(11);
        push(20);
      }
    });

    takeUntil(dataOver10)(s).on(function(event) {
      if (count === 0) {
        assert.equal(event.value, 1);
      } else if (count === 1) {
        assert.equal(event.value, 'boom');
      } else if (count === 2) {
        assert.equal(event.value, 11);
      } else if (count === 3) {
        assert.ok(event.isEnd);
      } else {
        assert.fail();
      }
      count++;
    });

    setTimeout(done, 50);
  });
});

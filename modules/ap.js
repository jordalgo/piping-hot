var curryN = require('ramda/src/curryN');

module.exports = function(createPipe) {
  if (!createPipe) {
    throw new Error('Piping Hot module functions need the createPipe' +
                    'function passed in to work. See docs!');
  }
  /**
   * Returns a Pipe that applies a value to a next function
   *
   * __Signature__: `a -> Pipe (a -> b) -> Pipe b`
   *
   * @name ap
   * @param {*} value - the value applied to the pipe function
   * @param {pipe} parentPipe - the parent pipe
   * @return {pipe} the pipe with the new value
   *
   * @example
   * var pipe1 = PH.pipe();
   * var mPipe = pipe1.ap(1);
   * // or
   * var mPipe = PH.map(add1, pipe1);
   * pipe1.next(function(x) { return x + 1; });
   */
  function ap(value, parentPipe) {
    var p = createPipe(parentPipe);
    p.next = function(fnValue) {
      var apValue;
      try {
        apValue = fnValue(value);
        this._next(apValue);
      } catch (e) {
        this._error(e);
      }
    };
    return p;
  }
  return curryN(2, ap);
};

var defaultOptions = {
  buffer: true
};

/**
 * Pushes a data event down the estream.
 * The estream param is bound automatically when creating a new estream.
 *
 * @name push
 * @param {Estream} estream
 * @param {*} value - the value
 */
function push(estream, value) {
  if (value && value.type === '@@EsEvent') {
    _processEvent(estream, value);
  } else {
    _processEvent(estream, new EsData(value));
  }
}

/**
 * Pushes an error event down the estream.
 * The estream param is bound automatically when creating a new estream.
 *
 * @name error
 * @param {Estream} estream
 * @param {*} value - the value
 */
function error(estream, value) {
  if (value && value.type === '@@EsEvent') {
    _processEvent(estream, value);
  } else {
    _processEvent(estream, new EsError(value));
  }
}

/**
 * Pushes an end event down the estream.
 * The estream param is bound automatically when creating a new estream.
 *
 * @name end
 * @param {Estream} estream
 * @param {*} value - the value
 */
function end(estream, value) {
  if (arguments.length === 2) {
    if (value.type === '@@EsEvent') {
      _processEvent(estream, value);
    } else {
      _processEvent(estream, new EsEnd(value));
    }
  } else {
    _processEvent(estream, new EsEnd());
  }
}

/**
 * @name off
 * @private
 * @param {Estream} estream
 * @param {Function} consumer
 * @return {Boolean}
 */
function off(estream, consumer) {
  var foundIndex = -1;
  estream.consumers.some(function(obj, index) {
    if (obj.fn === consumer) {
      foundIndex = index;
      return true;
    }
    return false;
  });
  if (foundIndex !== -1) {
    estream.consumers.splice(foundIndex, 1);
    return true;
  }
  return false;
}

/**
 * @private
 * @param {Estream} estream
 * @param {EsEvent} event - EsData | EsError | EsEnd
 * @param {Estream} sourceEstream - the parent stream emitting event
 */
function _processEvent(estream, esEvent, sourceEstream) {
  if (estream._ended) return;

  Object.freeze(esEvent);
  _emitEvent(estream, esEvent, sourceEstream);

  if (!estream.consumers.length && estream._isBuffering) {
    estream.buffer.push(esEvent);
  }
  if (esEvent.isEnd) {
    estream.consumers = [];
    estream._ended = true;
  }
}

/**
 * Notify consumers of an event.
 *
 * @private
 * @param {Estream} estream
 * @param {EsEvent} event - EsData | EsError | EsEnd
 * @param {Estream} sourceEstream
 */
function _emitEvent(estream, event, sourceEstream) {
  estream.consumers.forEach(function(obj) {
    obj.fn(event, sourceEstream || estream, obj.off);
  });
}

/**
 * @private
 * @param {Estream} estream
 * @param {EsEnd} esEnd
 * @param {Estream} endingStream
 */
function _parentEnd(estream, esEnd, endingStream) {
  var foundIndex = estream.sources.indexOf(endingStream);
  if (foundIndex !== -1) {
    estream.sources.splice(foundIndex, 1);
    estream._concatEnd.concat(esEnd);
  }
  if (estream.sources.length === 0) {
    _processEvent(estream, estream._concatEnd);
  }
}

/**
 * Add a source/parent estream to list of sources.
 *
 * @private
 * @param {Estream} estream
 * @param {Estream} sourceEstream
 */
function _addSource(estream, sourceEstream) {
  if (estream.sources.indexOf(sourceEstream) === -1) {
    estream.sources.push(sourceEstream);
  }
}

/**
 * Connects a child Estream to an Estream
 *
 * @private
 * @name connect
 * @param {Estream} parent
 * @param {Estream} child
 */
function _connect(parent, child) {
  parent.on(function(event, source) {
    if (event.isData || event.isError) {
      _processEvent(child, event, source || parent);
    } else {
      _parentEnd(child, event, parent);
    }
  });
  _addSource(child, parent);
}

/**
 * @private
 * @param {Estream} estream
 */
function _emptyBuffer(estream) {
  estream.buffer
  .forEach(function(event) {
    _emitEvent(estream, event);
  });
  estream.buffer = [];
}

/**
 * Base Estream event object.
 * This is not exposed directly. Please use:
 * EsData, EsEvent, or EsEnd - which inherit from this base object.
 *
 * @constructor
 * @param {*} value
 */
function EsEvent(value) {
  this.value = value;
}

EsEvent.prototype.isData = false;
EsEvent.prototype.isError = false;
EsEvent.prototype.isEnd = false;
EsEvent.prototype.type = '@@EsEvent';

/**
 * Estream Data Event object.
 *
 * @example
 * var ES = require('estream');
 * var estream1 = ES();
 * estream1.push(new Es.Data(5));
 * // or
 * estream1.push(5); // which wraps this value in an EsData object
 *
 * @constructor
 */
function EsData() {
  EsEvent.apply(this, arguments);
}

EsData.prototype = Object.create(EsEvent.prototype);
EsData.prototype.constructor = EsData;
EsData.prototype.isData = true;

/**
 * Estream Error Event object.
 *
 * @example
 * var ES = require('estream');
 * var estream1 = ES();
 * estream1.push(new Es.Error('bad thing'));
 * // or
 * estream1.error('bad thing'); // which wraps this value in an EsError object
 *
 * @constructor
 */
function EsError() {
  EsEvent.apply(this, arguments);
}

EsError.prototype = Object.create(EsEvent.prototype);
EsError.prototype.constructor = EsError;
EsError.prototype.isError = true;

/**
 * Estream End Event object.
 * The value kept inside this object will always be an array
 * since a stream can have multiple source/parent streams
 * and we want to keep a list of all the end event values.
 *
 * If you don't push a value, the array is just empty.
 *
 * @example
 * var ES = require('estream');
 * var estream1 = ES();
 * estream1.push(new Es.End('my end val'));
 * // or
 * estream1.end('my end val'); // which wraps this value in an EsEnd object
 *
 * @constructor
 */
function EsEnd() {
  EsEvent.apply(this, arguments);
  this.value = (arguments.length === 0) ? [] : [arguments[0]];
}

EsEnd.prototype = Object.create(EsEvent.prototype);
EsEnd.prototype.constructor = EsEnd;
EsEnd.prototype.isEnd = true;

/**
 * Use when an Estream has multiple source/parent streams
 * to concat the end values together in an array.
 *
 * @private
 * @param {EsEnd} esEnd
 */
EsEnd.prototype.concat = function(esEnd) {
  this.value = this.value.concat(esEnd.value);
};

/**
 * The Estream Object. To create use the exposed factory function.
 *
 * @example
 * var ES = require('estream');
 * var estream1 = ES();
 *
 * @constructor
 * @param {Object} opts - stream options
 */
function Estream(opts) {
  this._isBuffering = (opts && opts.hasOwnProperty('buffer')) ? opts.buffer : defaultOptions.buffer;
  this._concatEnd = new EsEnd();
  this._lastSentIndex = 0;
  this.buffer = [];
  this.sources = [];
  this.consumers = [];
}

/**
 * Creates a new estream with X amount of parent estreams.
 *
 * @name addSources
 * @param {Array} estreams - an Array of estreams
 * @return {Estream}
 *
 * @example
 * var estream1 = ES();
 * var estream2 = ES();
 * var estream3 = ES();
 * var estream4 = estream1.addSources([estream2, estream3]);
 */
Estream.prototype.addSources = function(estreams) {
  return createEstream([this].concat(estreams));
};

/**
 * Adds a consumer to an estream.
 * When an event gets pushed down this estream,
 * the consumer will get as params:
 * - the event (EsData | EsError | EsEnd)
 * - a reference to the estream
 * - the off/unsubscribe function
 *
 * __Signature__: `(a -> *) -> Estream a`
 *
 * @name on
 * @param {Function} consumer - the consuming function
 * @return {Function} off - the unsubscribe function
 *
 * @example
 * var estream1 = es();
 * var estream1.on(function(event, estream1, unsubscribe) {
 *   console.log('got an event', event.value);
 * });
 */
Estream.prototype.on = function(consumer) {
  if (typeof consumer !== 'function') {
    throw new Error('Consumer needs to be a function.');
  }
  if (!this.buffer.length && this._ended) {
    console.warn('The estream has ended and the buffer is empty.');
  }
  var found = this.consumers.some(function(obj) {
    return obj.fn === consumer;
  });
  var offFn;
  if (!found) {
    offFn = off.bind(null, this, consumer);
    this.consumers.push({ fn: consumer, off: offFn });
    if (this._isBuffering && this.buffer.length) {
      setTimeout(_emptyBuffer.bind(null, this), 0);
    }
  }
  return offFn;
};

/**
 * A helper function for getting only data event values from Estreams.
 *
 * @name onData
 * @param {Function} consumer - the consuming function
 * @return {Estream}
 */
Estream.prototype.onData = function(consumer) {
  return this.on(function(event, estream, offFn) {
    if (event.isData) consumer(event.value, estream, offFn);
  });
};

/**
 * A helper function for getting only error event values from Estreams.
 *
 * @name onError
 * @param {Function} consumer - the consuming function
 * @return {Estream}
 */
Estream.prototype.onError = function(consumer) {
  return this.on(function(event, estream, offFn) {
    if (event.isError) consumer(event.value, estream, offFn);
  });
};

/**
 * A helper function for getting only end event values from Estreams.
 *
 * @name onError
 * @param {Function} consumer - the consuming function
 * @return {Estream}
 */
Estream.prototype.onEnd = function(consumer) {
  return this.on(function(event, estream, offFn) {
    if (event.isEnd) consumer(event.value, estream, offFn);
  });
};

/**
 * Get events out of the buffer. Useful if the stream has ended.
 *
 * @name getBuffer
 * @param {Number} end - when to end when reading from the buffer
 * @return {Array} - an array of buffered events
 */
Estream.prototype.getBuffer = function(endPoint) {
  var bufferLen = this.buffer.length;
  var ender = endPoint || bufferLen;
  var bufferSlice = this.buffer.slice(0, ender);
  this.buffer = this.buffer.slice(ender, bufferLen);
  return bufferSlice;
};

/**
 * Remove all stored events from the buffer.
 *
 * @name clearBuffer
 */
Estream.prototype.clearBuffer = function() {
  this.buffer = [];
};

/**
 * Returns an Estream that maps the values from data events.
 * Catches errors that occur in the mapping fn
 * and sends the error event down the Estream.
 *
 * __Signature__: `(a -> b) -> Estream EsEvent b`
 *
 * @name map
 * @param {Function} fn - the mapping function
 * @return {Estream}
 *
 * @example
 * var estream = ES();
 * var mEstream = estream.map(add1);
 */
Estream.prototype.map = function(fn) {
  return createEstream(function(p, e) {
    this.on(function(event) {
      if (event.isData) {
        var mappedValue;
        try {
          mappedValue = fn(event.value);
          p(mappedValue);
        } catch (err) {
          e(err);
        }
      } else {
        p(event);
      }
    });
  }.bind(this));
};

/**
 * Returns a Estream that scans the values from data events.
 * Catches errors that occur in the reducing function
 * and sends the error event down the Estream.
 *
 * __Signature__: `(b -> a -> c) -> b -> Estream b`
 *
 * @name scan
 * @param {Function} fn - the reducing function
 * @param {Object} acc - intial value
 * @return {Estream}
 *
 * @example
 * var estream1 = ES();
 * var sEstream = estream1.scan(sum, 0);
 */
Estream.prototype.scan = function(fn, acc) {
  return createEstream(function(p, e) {
    this.on(function(event) {
      if (event.isData) {
        var nextAcc;
        try {
          nextAcc = fn(acc, event.value);
          p(acc = nextAcc);
        } catch (err) {
          e(err);
        }
      } else {
        p(event);
      }
    });
  }.bind(this));
};

/**
 * Returns a estream that filters the values of data events.
 * Catches errors that occur in the filtering function
 * and sends the error event down the Estream.
 *
 * __Signature__: `(a -> Boolean) -> estream a`
 *
 * @name filter
 * @param {Function} fn - the filtering function
 * @return {estream}
 *
 * @example
 * var estream1 = ES();
 * var mEstream = estream1.filter(isEven);
 */
Estream.prototype.filter = function(fn) {
  return createEstream(function(p, e) {
    this.on(function(event) {
      if (event.isData) {
        try {
          if (fn(event.value)) {
            p(event);
          }
        } catch (err) {
          e(err);
        }
      } else {
        p(event);
      }
    });
  }.bind(this));
};

/**
 * Creates a new Estream that filters EsEvents themselves,
 * as opposed to the data within an EsData event.
 *
 * @example
 * var estream1 = ES();
 * estream1.filterEvent(function(e) {
 *  return e.isData;
 * });
 *
 * @name filterEvent
 * @param {Function} fn - the filtering function
 * @return {Estream}
 */
Estream.prototype.filterEvent = function(fn) {
  return createEstream(function(p) {
    this.on(function(event) {
      if (fn(event)) p(event);
    });
  }.bind(this));
};

/**
 * Returns a Estream that reduces all data and end values,
 * emitting the final value on Estream end in an EsEnd object.
 *
 * __Signature__: `(b -> a -> c) -> b -> Estream b`
 *
 * @name reduce
 * @param {Function} fn - the reducing function
 * @param {Object} acc - intial value
 * @return {Estream}
 *
 * @example
 * var estream1 = ES();
 * estream1.reduce(sum, 0).on(function(event) {
 *  if (event.isEnd) console.log(event.value);
 * });
 */
Estream.prototype.reduce = function(fn, acc) {
  return createEstream(function(p, er, en) {
    this.on(function(event) {
      if (event.isData) {
        try {
          acc = fn(acc, event.value);
        } catch (err) {
          er(err);
        }
      } else if (event.isError) {
        p(event);
      } else {
        try {
          en(event.value.reduce(fn, acc));
        } catch (err) {
          er(err);
          en();
        }
      }
    });
  }.bind(this));
};

/**
 * Add methods to the base estream object.
 *
 * __Signature__: `[Objects] -> undefined`
 *
 * @name addMethods
 * @param {Array} addedMethods - an array of objects
 *
 * @example
 * ES.addEstreamMethods({
 *  name: 'collect',
 *  fn: function collect() {}
 * });
 */
function addMethods(addedMethods) {
  // Add methods to the estream object for chainability.
  addedMethods.forEach(function(method) {
    Estream.prototype[method.name] = function() {
      var args = Array.prototype.slice.call(arguments).concat([this]);
      return method.fn.apply(null, args);
    };
  });
}

/**
 * Combine estreams into a new estream.
 *
 * @name combine
 * @param {Array} sources - an array of Estreams
 * @param {Object} options - set of estream options
 * @return {Estream}
 *
 * @example
 * var estream3 = ES.combine([estream1, estream2]);
 */
function combine(sources, options) {
  var estream = new Estream(options);
  if (!sources || !Array.isArray(sources)) {
    throw new Error('Combine requires an array of sources.');
  }
  sources.forEach(function(source) {
    _connect(source, estream);
  });
  return estream;
}

/**
 * Estream factory function.
 * The only way to create a new blank Estream.
 *
 * @name createEstream
 * @param {Object} fn - the source function
 * @param {Object} options - set of estream options
 * @return {Estream}
 *
 * @example
 * var estream1 = ES(function(push, error, end) {}, { buffer: false });
 */
function createEstream(fn, options) {
  var estream = new Estream(options);
  fn(push.bind(null, estream), error.bind(null, estream), end.bind(null, estream));
  return estream;
}

createEstream.addMethods = addMethods;
createEstream.combine = combine;

module.exports = createEstream;


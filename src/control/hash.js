/* global L */

'use strict';

var util = require('../util/util');

var HashControl = L.Class.extend({
  initialize: function() {
    this._supported = true;
    this._supportsHashChange = (function() {
      var docMode = window.documentMode;

      return ('onhashchange' in window) && (docMode === undefined || docMode > 7);
    })();
    this._window = window;

    if ((window.self !== window.top) && document.referrer !== '') {
      if (util.parseDomainFromUrl(document.referrer) === util.parseDomainFromUrl(window.location.href)) {
        try {
          this._window = top;
        } catch (exception) {
          this._supported = false;
        }
      } else {
        this._supported = false;
      }
    }

    return this;
  },
  addTo: function(map) {
    if (this._supported) {
      this._map = map;
      this._onHashChange(this);
      this._startListening();
    } else {
      window.alert('Sorry, but the hash control does not work for maps that are loaded in an iframe hosted from another domain.');
    }
  },
  removeFrom: function() {
    if (this._changeTimeout) {
      clearTimeout(this._changeTimeout);
    }

    if (this.isListening) {
      this._stopListening();
    }

    this._map = null;
    delete this._map.hashControl;
  },
  _changeDefer: 100,
  _changeTimeout: null,
  _hashChangeInterval: null,
  _isListening: false,
  _lastHash: null,
  _formatHash: function(map) {
    var center = map.getCenter(),
      zoom = map.getZoom(),
      precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2));

    return '#' + [zoom, center.lat.toFixed(precision), center.lng.toFixed(precision)].join('/');
  },
  _getParentDocumentWindow: function(el) {
    while (el.parentNode) {
      el = el.parentNode;

      if (el.tagName.toLowerCase() === 'window') {
        return el;
      }
    }

    return null;
  },
  _onHashChange: function(context) {
    if (!context._changeTimeout) {
      context._changeTimeout = setTimeout(function() {
        context._update();
        context._changeTimeout = null;
      }, context._changeDefer);
    }
  },
  _onMapMove: function() {
    if (this._movingMap || !this._map._loaded) {
      return false;
    }

    var hash = this._formatHash(this._map);

    if (this._lastHash !== hash) {
      this._window.location.hash = hash;
      this._lastHash = hash;
    }
  },
  _parseHash: function(hash) {
    var args;

    if (hash.indexOf('#') === 0) {
      hash = hash.substr(1);
    }

    args = hash.split('/');

    if (args.length === 3) {
      var lat = parseFloat(args[1]),
        lng = parseFloat(args[2]),
        zoom = parseInt(args[0], 10);

      if (isNaN(zoom) || isNaN(lat) || isNaN(lng)) {
        return false;
      } else {
        return {
          center: new L.LatLng(lat, lng),
          zoom: zoom
        };
      }
    } else {
      return false;
    }
  },
  _startListening: function() {
    var me = this;

    this._map.on('moveend', this._onMapMove, this);

    if (this._supportsHashChange) {
      L.DomEvent.addListener(this._window, 'hashchange', function() {
        me._onHashChange(me);
      });
    } else {
      clearInterval(this.hashChangeInterval);
      this._hashChangeInterval = setInterval(function() {
        me._onHashChange(me);
      }, 50);
    }

    this._isListening = true;
  },
  _stopListening: function() {
    this._map.off('moveend', this._onMapMove, this);

    if (this._supportsHashChange) {
      L.DomEvent.removeListener(this._window, 'hashchange', this._onHashChange, this);
    } else {
      clearInterval(this._hashChangeInterval);
    }

    this._isListening = false;
  },
  _update: function() {
    var hash = this._window.location.hash,
      parsed;

    if (hash === this._lastHash) {
      return;
    }

    parsed = this._parseHash(hash);

    if (parsed) {
      this._movingMap = true;
      this._map.setView(parsed.center, parsed.zoom);
      this._movingMap = false;
    } else {
      this._onMapMove();
    }
  }
});

L.Map.addInitHook(function() {
  if (this.options.hashControl) {
    this.hashControl = L.npmap.control.hash().addTo(this);
  }
});

module.exports = function() {
  return new HashControl();
};
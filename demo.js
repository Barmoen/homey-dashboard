/* Demo backend: fake Homey data so the dashboard can be tried without a Homey. */
(function () {
  'use strict';

  function cap(value, extra) { return Object.assign({ value: value }, extra || {}); }

  function makeDevices() {
    var list = [
      ['d1', 'Ceiling light', 'living', 'light', { onoff: cap(true), dim: cap(0.7) }],
      ['d2', 'Floor lamp', 'living', 'light', { onoff: cap(false), dim: cap(0.4) }],
      ['d3', 'TV socket', 'living', 'socket', { onoff: cap(true), measure_power: cap(86, { units: 'W' }) }],
      ['d4', 'Thermostat', 'living', 'thermostat', { measure_temperature: cap(21.4, { units: '°C' }), target_temperature: cap(21.5, { units: '°C', min: 5, max: 30, step: 0.5 }) }],
      ['d5', 'Island pendants', 'kitchen', 'light', { onoff: cap(true), dim: cap(1) }],
      ['d6', 'Coffee machine', 'kitchen', 'socket', { onoff: cap(false), measure_power: cap(0, { units: 'W' }) }],
      ['d7', 'Leak sensor', 'kitchen', 'sensor', { alarm_water: cap(false), measure_temperature: cap(19.8, { units: '°C' }) }],
      ['d8', 'Front door', 'hall', 'lock', { locked: cap(true) }],
      ['d9', 'Door sensor', 'hall', 'sensor', { alarm_contact: cap(false) }],
      ['d10', 'Motion', 'hall', 'sensor', { alarm_motion: cap(false), measure_luminance: cap(42, { units: 'lx' }) }],
      ['d11', 'Bedside left', 'bedroom', 'light', { onoff: cap(false), dim: cap(0.3) }],
      ['d12', 'Blinds', 'bedroom', 'windowcoverings', { windowcoverings_set: cap(0.6), windowcoverings_state: cap('idle') }],
      ['d13', 'Climate', 'bedroom', 'sensor', { measure_temperature: cap(18.9, { units: '°C' }), measure_humidity: cap(46, { units: '%' }) }],
      ['d14', 'Desk lamp', 'office', 'light', { onoff: cap(true), dim: cap(0.85) }],
      ['d15', 'Window', 'office', 'sensor', { alarm_contact: cap(true) }],
      ['d16', 'Floor heating', 'bath', 'thermostat', { measure_temperature: cap(23.1, { units: '°C' }), target_temperature: cap(24, { units: '°C', min: 5, max: 35, step: 0.5 }), onoff: cap(true) }]
    ];
    var out = {};
    list.forEach(function (r) {
      out[r[0]] = { id: r[0], name: r[1], zone: r[2], class: r[3], available: true, capabilities: Object.keys(r[4]), capabilitiesObj: r[4] };
    });
    return out;
  }

  function DemoBackend() {
    this.isDemo = true;
    this._devices = makeDevices();
    this._watchers = {};
    this._status = function () {};
  }

  DemoBackend.prototype.init = function () {
    var self = this;
    setTimeout(function () { self._status('ok'); }, 50);
    // Simulate some life: temperatures drift, motion triggers, power changes.
    setInterval(function () {
      ['d4', 'd13', 'd16', 'd7'].forEach(function (id) {
        var c = self._devices[id].capabilitiesObj.measure_temperature;
        self._emit(id, 'measure_temperature', Math.round((c.value + (Math.random() - 0.5) * 0.2) * 10) / 10);
      });
      if (Math.random() < 0.35) {
        self._emit('d10', 'alarm_motion', true);
        setTimeout(function () { self._emit('d10', 'alarm_motion', false); }, 6000);
      }
      var tv = self._devices.d3.capabilitiesObj;
      self._emit('d3', 'measure_power', tv.onoff.value ? Math.round(80 + Math.random() * 15) : 0);
    }, 8000);
    return Promise.resolve();
  };

  DemoBackend.prototype.onStatus = function (cb) { this._status = cb; };

  DemoBackend.prototype._emit = function (id, capId, value) {
    var d = this._devices[id];
    if (!d || !d.capabilitiesObj[capId]) return;
    d.capabilitiesObj[capId].value = value;
    (this._watchers[id + ':' + capId] || []).forEach(function (cb) { cb(value); });
  };

  DemoBackend.prototype.zones = function () {
    return Promise.resolve({
      home: { id: 'home', name: 'Home', parent: null },
      living: { id: 'living', name: 'Living room', parent: 'home' },
      kitchen: { id: 'kitchen', name: 'Kitchen', parent: 'home' },
      hall: { id: 'hall', name: 'Hallway', parent: 'home' },
      bedroom: { id: 'bedroom', name: 'Bedroom', parent: 'home' },
      office: { id: 'office', name: 'Office', parent: 'home' },
      bath: { id: 'bath', name: 'Bathroom', parent: 'home' }
    });
  };

  DemoBackend.prototype.devices = function () { return Promise.resolve(this._devices); };

  DemoBackend.prototype.flows = function () {
    return Promise.resolve([
      { id: 'f1', name: 'Good morning', type: 'basic' },
      { id: 'f2', name: 'Leaving home', type: 'advanced' },
      { id: 'f3', name: 'Dinner', type: 'basic' },
      { id: 'f4', name: 'Movie time', type: 'advanced' },
      { id: 'f5', name: 'Good night', type: 'basic' }
    ]);
  };

  DemoBackend.prototype.users = function () {
    return Promise.resolve([
      { id: 'u1', name: 'Sam', present: true, asleep: false },
      { id: 'u2', name: 'Robin', present: false, asleep: false },
      { id: 'u3', name: 'Kit', present: true, asleep: true }
    ]);
  };

  DemoBackend.prototype.weather = function () {
    return Promise.resolve({ temperature: 7.2, state: 'Clouds' });
  };

  DemoBackend.prototype.setCapability = function (id, capId, value) {
    var self = this;
    return new Promise(function (resolve) {
      setTimeout(function () {
        self._emit(id, capId, value);
        if (capId === 'onoff' && id === 'd6') self._emit('d6', 'measure_power', value ? 1250 : 0);
        if (capId === 'windowcoverings_state' && value !== 'idle') {
          self._emit(id, 'windowcoverings_set', value === 'up' ? 1 : 0);
          setTimeout(function () { self._emit(id, 'windowcoverings_state', 'idle'); }, 1500);
        }
        resolve();
      }, 150);
    });
  };

  DemoBackend.prototype.trigger = function () {
    return new Promise(function (resolve) { setTimeout(resolve, 300); });
  };

  DemoBackend.prototype.watch = function (id, capId, cb) {
    var k = id + ':' + capId;
    (this._watchers[k] = this._watchers[k] || []).push(cb);
  };

  DemoBackend.prototype.refresh = function () { return Promise.resolve(this._devices); };

  window.DemoBackend = DemoBackend;
})();

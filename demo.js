/* Demo backend: fake Homey data so the dashboard can be tried without a Homey. */
(function () {
  'use strict';

  function cap(value, extra) { return Object.assign({ value: value }, extra || {}); }
  // Same format as the Renovasjon app: "man. 16. nov."
  function inDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }); }

  function makeDevices() {
    var list = [
      ['d1', 'Taklampe', 'living', 'light', { onoff: cap(true), dim: cap(0.7) }],
      ['d2', 'Gulvlampe', 'living', 'light', { onoff: cap(false), dim: cap(0.4) }],
      ['d3', 'TV-stikk', 'living', 'socket', { onoff: cap(true), measure_power: cap(86, { units: 'W' }) }],
      ['d4', 'Termostat', 'living', 'thermostat', { measure_temperature: cap(21.4, { units: '°C' }), target_temperature: cap(21.5, { units: '°C', min: 5, max: 30, step: 0.5 }) }],
      ['d5', 'Kjøkkenøy', 'kitchen', 'light', { onoff: cap(true), dim: cap(1) }],
      ['d6', 'Kaffemaskin', 'kitchen', 'socket', { onoff: cap(false), measure_power: cap(0, { units: 'W' }) }],
      ['d7', 'Lekkasjesensor', 'kitchen', 'sensor', { alarm_water: cap(false), measure_temperature: cap(19.8, { units: '°C' }) }],
      ['d8', 'Ytterdør', 'hall', 'lock', { locked: cap(true) }],
      ['d9', 'Dørsensor', 'hall', 'sensor', { alarm_contact: cap(false) }],
      ['d10', 'Bevegelse', 'hall', 'sensor', { alarm_motion: cap(false), measure_luminance: cap(42, { units: 'lx' }) }],
      ['d11', 'Nattbordlampe', 'bedroom', 'light', { onoff: cap(false), dim: cap(0.3) }],
      ['d12', 'Rullegardin', 'bedroom', 'windowcoverings', { windowcoverings_set: cap(0.6), windowcoverings_state: cap('idle') }],
      ['d13', 'Klima', 'bedroom', 'sensor', { measure_temperature: cap(18.9, { units: '°C' }), measure_humidity: cap(46, { units: '%' }) }],
      ['d14', 'Skrivebordslampe', 'office', 'light', { onoff: cap(true), dim: cap(0.85) }],
      ['d15', 'Vindu', 'office', 'sensor', { alarm_contact: cap(true) }],
      ['d16', 'Varmekabler', 'bath', 'thermostat', { measure_temperature: cap(23.1, { units: '°C' }), target_temperature: cap(24, { units: '°C', min: 5, max: 35, step: 0.5 }), onoff: cap(true) }],
      ['d17', 'Pulse', 'home', 'other', { measure_power: cap(1840, { units: 'W' }), 'meter_power.imported': cap(275296, { units: 'kWh' }) }],
      ['d18', 'Saros 10', 'living', 'vacuumcleaner', { is_cleaning: cap(true), measure_battery: cap(78, { units: '%' }), battery_charging_state: cap('discharging'),
        alarm_stuck: cap(false), alarm_bin_full: cap(false), alarm_water_box_empty: cap(false), dock: cap(false), clean_time: cap(1.21),
        clean_full: cap(false, { setable: true }), pause_clean: cap(false, { setable: true }), cancel_and_dock: cap(null, { setable: true }) }],
      ['d19', 'Renovasjon', 'home', 'sensor', {
        pickup_glass: cap(inDays(9)), pickup_food: cap(inDays(1)), pickup_paper: cap(inDays(23)), pickup_plastic: cap(inDays(9)),
        pickup_general: cap(inDays(1)), pickup_next_fractions: cap('Restavfall, Matavfall'), pickup_next_date: cap(inDays(1)),
        pickup_next_days: cap(1), pickup_next: cap(inDays(1))
      }],
      ['d20', 'Værvarsel', 'home', 'sensor', { weather_description: cap('Lettskyet'), measure_temperature: cap(-3.4, { units: '°C' }), measure_wind_strength1: cap(2.2) }],
      ['d21', 'Billader', 'garage', 'evcharger', { evcharger_charging_state: cap('plugged_in_charging'), evcharger_charging: cap(true, { setable: true }), measure_power: cap(7200, { units: 'W' }) }]
    ];
    var out = {};
    list.forEach(function (r) {
      out[r[0]] = { id: r[0], name: r[1], zone: r[2], class: r[3], available: true, capabilities: Object.keys(r[4]), capabilitiesObj: r[4] };
    });
    out.d17.energyObj = { cumulative: true };   // behaves like a P1 / HAN whole-home meter
    out.d18.driverId = 'homey:app:com.roborock.roborock:vacuum';
    out.d19.driverId = 'homey:app:no.renovasjon:renovasjon';
    out.d17.driverId = 'homey:app:com.tibber:pulse';
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
      self._emit('d17', 'measure_power', Math.round(1500 + Math.random() * 700));
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
      home: { id: 'home', name: 'Hjemme', parent: null },
      living: { id: 'living', name: 'Stue', parent: 'home' },
      kitchen: { id: 'kitchen', name: 'Kjøkken', parent: 'home' },
      hall: { id: 'hall', name: 'Gang', parent: 'home' },
      bedroom: { id: 'bedroom', name: 'Soverom', parent: 'home' },
      office: { id: 'office', name: 'Kontor', parent: 'home' },
      bath: { id: 'bath', name: 'Bad', parent: 'home' },
      garage: { id: 'garage', name: 'Garasje', parent: 'home' }
    });
  };

  DemoBackend.prototype.devices = function () { return Promise.resolve(this._devices); };

  DemoBackend.prototype.flows = function () {
    return Promise.resolve([
      { id: 'f1', name: 'God morgen', type: 'basic' },
      { id: 'f2', name: 'Går ut', type: 'advanced' },
      { id: 'f3', name: 'Middag', type: 'basic' },
      { id: 'f4', name: 'Filmkveld', type: 'advanced' },
      { id: 'f5', name: 'God natt', type: 'basic' },
      { id: 'f6', name: 'Støvsug huset', type: 'basic' }
    ]);
  };

  DemoBackend.prototype.users = function () {
    return Promise.resolve([
      { id: 'u1', name: 'Sam', present: true, asleep: false },
      { id: 'u2', name: 'Robin', present: false, asleep: false },
      { id: 'u3', name: 'Kim', present: true, asleep: true }
    ]);
  };

  DemoBackend.prototype.weather = function () { return Promise.resolve({ temperature: 7.2, state: 'Clouds' }); };
  DemoBackend.prototype.location = function () { return Promise.resolve({ lat: 59.913, lon: 10.739, name: 'Oslo' }); };

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
        if (capId === 'vacuumcleaner_state' && value === 'docked') {
          setTimeout(function () { self._emit(id, 'vacuumcleaner_state', 'charging'); }, 2000);
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

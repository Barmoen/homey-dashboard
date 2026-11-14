/* Hjemmepanel — a wall dashboard for Homey Pro, talking directly to Homey's local API. UI text is Norwegian (bokmål). */
(function () {
  'use strict';

  // ---------------------------------------------------------------- config
  var STORE_KEY = 'homepanel.config.v1';
  var DEFAULTS = {
    address: '',          // IP or full URL of the Homey
    token: '',            // API key from Homey settings
    demo: false,
    shown: null,          // array of device ids, null = automatic selection
    scenes: [],           // [{id, type, name}]
    idleMin: 5,           // screensaver after N minutes idle (0 = never)
    nightFrom: '22:30',
    nightTo: '06:30',
    showWeather: true,
    showPresence: true,
    lockConfirm: true,
    use24h: true,
    sortBy: 'type',       // tile order: 'type' (lights first) or 'room'
    topInset: null,       // px of space for the iPad status bar, null = automatic
    weatherLoc: null,     // {name, lat, lon}; null = use Homey's location
    todoistToken: '',     // personal API token from Todoist, stored only on this device
    todoLists: [],        // Todoist project ids to show, in order
    todoToday: true       // also show today's and overdue tasks
  };
  var LOCALE = 'nb-NO';

  // A Home Screen web app can't hide the iPad status bar, so leave room for it.
  var STANDALONE = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  function applyTopInset() {
    var px = typeof cfg.topInset === 'number' ? cfg.topInset : (STANDALONE ? 30 : 0);
    document.documentElement.style.setProperty('--top-inset', px + 'px');
  }

  function loadConfig() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return Object.assign({}, DEFAULTS, raw ? JSON.parse(raw) : {});
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function saveConfig() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); }
    catch (e) { toast('Kunne ikke lagre innstillingene på denne enheten', true); }
  }
  var cfg = loadConfig();

  function resolveAddress(input) {
    var a = String(input || '').trim().replace(/\/+$/, '');
    if (!a) return '';
    if (/^https?:\/\//i.test(a)) return a;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(a)) {
      // Pages served over HTTPS (GitHub Pages etc.) must reach Homey over HTTPS too.
      if (location.protocol === 'https:') return 'https://' + a.replace(/\./g, '-') + '.homey.homeylocal.com';
      return 'http://' + a;
    }
    return (location.protocol === 'https:' ? 'https://' : 'http://') + a;
  }

  // ---------------------------------------------------------------- helpers
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtNum(v, digits) {
    if (typeof v !== 'number' || isNaN(v)) return '–';
    return v.toLocaleString(LOCALE, { maximumFractionDigits: digits == null ? 1 : digits, minimumFractionDigits: 0 });
  }
  function cap1(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function initials(name) {
    return String(name || '?').split(/\s+/).map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
  }
  var toastTimer;
  function toast(msg, isErr) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast' + (isErr ? ' err' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, isErr ? 5000 : 2500);
  }
  function confirmBox(text, okLabel) {
    return new Promise(function (resolve) {
      $('confirmText').textContent = text;
      $('confirmYes').textContent = okLabel || 'OK';
      $('confirmBackdrop').hidden = false;
      function done(v) {
        $('confirmBackdrop').hidden = true;
        $('confirmYes').onclick = $('confirmNo').onclick = null;
        resolve(v);
      }
      $('confirmYes').onclick = function () { done(true); };
      $('confirmNo').onclick = function () { done(false); };
    });
  }
  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function daysFromToday(date) { return Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000); }
  function dayWord(days, date) {
    if (days === 0) return 'i dag';
    if (days === 1) return 'i morgen';
    if (days > 1 && days < 7 && date) return date.toLocaleDateString(LOCALE, { weekday: 'long' });
    if (date) return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }).replace('.', '');
    return 'om ' + days + ' dager';
  }

  // ---------------------------------------------------------------- icons
  var CLOUD = 'M8.5 19h9a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.6A3.3 3.3 0 0 0 8.5 19z';
  var I = {
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.8 10.6c.7.6 1.3 1.5 1.3 2.4h5c0-.9.6-1.8 1.3-2.4A6 6 0 0 0 12 3z"/>',
    plug: '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>',
    thermo: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0zM12 9v7"/>',
    door: '<path d="M4 21h16M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M14.5 12h.01"/>',
    doorOpen: '<path d="M4 21h16M6 21V4a1 1 0 0 1 1-1h3M18 21V4a1 1 0 0 0-1-1h-3M10 3l5 2v16l-5-1z"/>',
    motion: '<circle cx="13" cy="4.5" r="1.8"/><path d="M7 21l3.5-6.5L13 16v5M10.5 14.5l1.3-6 3.7 3h3M8 11l3.8-2.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.7-1.5"/>',
    blinds: '<path d="M3 3h18M5 3v13M19 3v13M5 7h14M5 11h14M5 15h14M12 16v5"/>',
    fan: '<circle cx="12" cy="12" r="1.6"/><path d="M12 10.4C11 6 12.5 3 15 3.5c2.5.6 1.4 4.6-3 6.9M13.6 12c4.4-1 7.4.5 6.9 3-.6 2.5-4.6 1.4-6.9-3M12 13.6c1 4.4-.5 7.4-3 6.9-2.5-.6-1.4-4.6 3-6.9M10.4 12C6 13 3 11.5 3.5 9c.6-2.5 4.6-1.4 6.9 3"/>',
    drop: '<path d="M12 3s6.5 7 6.5 11.3a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z"/>',
    sensor: '<circle cx="12" cy="14" r="2"/><path d="M7.8 9.8a6 6 0 0 1 8.4 0M5 7a10 10 0 0 1 14 0"/>',
    bolt: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>',
    speaker: '<rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="14" r="3"/><path d="M12 7h.01"/>',
    smoke: '<path d="M3 8h18M5 8l1 9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-9M9 4h6"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    cloud: '<path d="M7 18h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 10.6 3.8 3.8 0 0 0 7 18z"/>',
    partly: '<path d="M8 3v1.5M3 8h1.5M4.5 4.5l1 1M11.5 4.5l-1 1M5.6 10.6a3.5 3.5 0 0 1 5.6-4.1"/><path d="' + CLOUD + '"/>',
    partlyNight: '<path d="M10.5 4a4.5 4.5 0 0 0-4.8 6.6A4.6 4.6 0 0 1 10.5 4z"/><path d="' + CLOUD + '"/>',
    rain: '<path d="M7 15h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 7.6 3.8 3.8 0 0 0 7 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    snow: '<path d="M7 15h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 7.6 3.8 3.8 0 0 0 7 15zM8 19h.01M12 20h.01M16 19h.01"/>',
    sleet: '<path d="M7 15h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 7.6 3.8 3.8 0 0 0 7 15zM8 18l-1 3M16 18l-1 3M12 19.5h.01"/>',
    thunder: '<path d="M7 15h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 7.6 3.8 3.8 0 0 0 7 15zM13 15l-2.5 4h3l-2 3.5"/>',
    fog: '<path d="M4 8h16M3 12h18M5 16h14M8 20h8"/>',
    wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8"/>',
    umbrella: '<path d="M3 12a9 9 0 0 1 18 0zM12 12v6a2 2 0 0 0 4 0"/>',
    trash: '<path d="M4 7h16M10 3h4M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/>',
    vacuum: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M8.5 6h7"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/>',
    home: '<path d="M3.5 11 12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-5h4v5"/>',
    exit: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9.5 8l-4 4 4 4M5.5 12H16"/>',
    cutlery: '<path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17.5 21V3c-2.2 1.8-3 4.6-3 8.5h3"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    sofa: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 13a2 2 0 1 1 4 0v2h10v-2a2 2 0 1 1 4 0v5H3zM5 18v2M19 18v2"/>',
    pot: '<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM2 10h2M20 10h2M9 3.5v3M12 3v3.5M15 3.5v3"/>',
    bed: '<path d="M3 19V6M3 15h18M21 19v-6a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="12" r="1.7"/>',
    bath: '<path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM6 12V6a2 2 0 0 1 3.6-1.2M7 19l-1 2M17 19l1 2"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
    car: '<path d="M3 17v-4l2.4-5h13.2l2.4 5v4zM3 13h18M7 17v2M17 17v2"/>',
    tree: '<path d="M12 21v-5M6 16h12L12 3z"/>',
    cart: '<path d="M3 4h2.2l2.3 11h10.3l2.2-8.2H6.3"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="16.5" cy="19.5" r="1.4"/>',
    tools: '<path d="M14.5 6.5l3 3M4 20l8.5-8.5M11 5.5 14 2.5l7.5 7.5-3 3z"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    today: '<circle cx="12" cy="12" r="9"/><path d="M8 12.2l2.8 2.8L16.5 9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (I[name] || I.sensor) + '</svg>'; }

  // ---------------------------------------------------------------- real Homey backend
  function HomeyBackend(address, token) {
    this.address = address;
    this.token = token;
    this.api = null;
    this._apiDevices = {};
    this._status = function () {};
  }
  HomeyBackend.prototype.onStatus = function (cb) { this._status = cb; };
  HomeyBackend.prototype.init = function () {
    var self = this;
    if (!window.HomeyAPI) return Promise.reject(new Error('Homey-biblioteket ble ikke lastet (vendor/homey-api.min.js mangler).'));
    return window.HomeyAPI.createLocalAPI({ address: this.address, token: this.token }).then(function (api) {
      self.api = api;
      api.on('connect', function () { self._status('ok'); });
      api.on('reconnect', function () { self._status('ok'); if (self.onReconnect) self.onReconnect(); });
      api.on('disconnect', function () { self._status('bad'); });
      api.on('connect_error', function () { self._status('bad'); });
      self._status('ok');
    });
  };
  HomeyBackend.prototype.zones = function () { return this.api.zones.getZones(); };
  HomeyBackend.prototype.devices = function () {
    var self = this;
    return this.api.devices.getDevices().then(function (devs) { self._apiDevices = devs; return devs; });
  };
  HomeyBackend.prototype.refresh = function () { return this.api.devices.getDevices({ $cache: false }); };
  HomeyBackend.prototype.flows = function () {
    var api = this.api;
    function pick(obj, type) {
      return Object.keys(obj || {}).map(function (k) { return obj[k]; })
        .filter(function (f) { return f.triggerable && f.enabled !== false; })
        .map(function (f) { return { id: f.id, name: f.name, type: type }; });
    }
    return Promise.all([
      api.flow.getFlows().catch(function () { return {}; }),
      api.flow.getAdvancedFlows().catch(function () { return {}; })
    ]).then(function (r) {
      return pick(r[0], 'basic').concat(pick(r[1], 'advanced')).sort(function (a, b) { return a.name.localeCompare(b.name, LOCALE); });
    });
  };
  HomeyBackend.prototype.users = function () {
    return this.api.users.getUsers().then(function (u) {
      return Object.keys(u).map(function (k) { return u[k]; })
        .filter(function (x) { return x.enabled !== false && x.role !== 'guest'; })
        .map(function (x) { return { id: x.id, name: x.name, present: !!x.present, asleep: !!x.asleep }; });
    });
  };
  HomeyBackend.prototype.weather = function () { return this.api.weather.getWeather(); };
  // Homey's own location (needs the Geolocation permission on the API key).
  HomeyBackend.prototype.location = function () {
    return this.api.geolocation.getOptionLocation().then(function (r) {
      var v = (r && r.value) || r || {};
      var lat = v.latitude != null ? v.latitude : v.lat, lon = v.longitude != null ? v.longitude : v.lon;
      return typeof lat === 'number' && typeof lon === 'number' ? { lat: lat, lon: lon, name: 'Homeys posisjon' } : null;
    });
  };
  HomeyBackend.prototype.setCapability = function (id, capId, value) {
    return this.api.devices.setCapabilityValue({ deviceId: id, capabilityId: capId, value: value });
  };
  HomeyBackend.prototype.trigger = function (flow) {
    return flow.type === 'advanced'
      ? this.api.flow.triggerAdvancedFlow({ id: flow.id })
      : this.api.flow.triggerFlow({ id: flow.id });
  };
  HomeyBackend.prototype.watch = function (id, capId, cb) {
    var d = this._apiDevices[id];
    if (d && d.makeCapabilityInstance) d.makeCapabilityInstance(capId, cb);
  };

  // ---------------------------------------------------------------- state
  var backend = null;
  var state = { zones: {}, devices: {}, flows: [], users: [], weather: null, forecast: null, connected: false };

  function snapshot(d) {
    var co = {};
    Object.keys(d.capabilitiesObj || {}).forEach(function (k) {
      var c = d.capabilitiesObj[k] || {};
      co[k] = { value: c.value, units: c.units, min: c.min, max: c.max, step: c.step, title: c.title, decimals: c.decimals, setable: c.setable,
        values: c.values };   // enum options, e.g. for vacuumcleaner_state
    });
    return { id: d.id, name: d.name, zone: d.zone, class: d.virtualClass || d.class, driverId: d.driverId || d.driverUri || '',
      capabilities: d.capabilities || Object.keys(co), capabilitiesObj: co, available: d.available !== false,
      cumulative: !!(d.energyObj && d.energyObj.cumulative) };  // true for whole-home meters (P1 / HAN readers)
  }
  function has(d, c) { return d.capabilitiesObj && d.capabilitiesObj[c] !== undefined; }
  function val(d, c) { return has(d, c) ? d.capabilitiesObj[c].value : undefined; }

  // Waste collection apps (Min Renovasjon, Renovasjon, Norske Tjenester …) show up as devices.
  function isWaste(d) { return /renovasjon|avfall|tømme|tomme|søppel|soppel|waste|garbage|trash|norske.?tjenester/i.test(d.driverId + ' ' + d.name); }
  function isVacuum(d) { return d.class === 'vacuumcleaner' || has(d, 'vacuumcleaner_state') || /roborock|vacuum|støvsug/i.test(d.driverId); }

  // Which devices show up automatically before the user picks.
  function autoShown(d) {
    if (isWaste(d)) return false;
    if (isVacuum(d)) return true;
    if (['light', 'thermostat', 'lock', 'windowcoverings', 'blinds', 'curtain', 'heater', 'socket', 'fan'].indexOf(d.class) >= 0) return true;
    return has(d, 'measure_temperature') || has(d, 'alarm_contact') || has(d, 'alarm_motion') || has(d, 'alarm_water');
  }
  function isShown(d) { return cfg.shown ? cfg.shown.indexOf(d.id) >= 0 : autoShown(d); }

  // ---------------------------------------------------------------- tile model
  function kind(d) {
    if (isVacuum(d)) return 'vacuum';
    if (has(d, 'target_temperature')) return 'thermostat';
    if (has(d, 'locked')) return 'lock';
    if (has(d, 'windowcoverings_set') || has(d, 'windowcoverings_state')) return 'cover';
    if (has(d, 'onoff')) return 'switch';
    if (has(d, 'dim')) return 'dimmer';
    return 'sensor';
  }
  function deviceIcon(d) {
    var c = d.class;
    if (isVacuum(d)) return 'vacuum';
    if (isWaste(d)) return 'trash';
    if (c === 'light') return 'bulb';
    if (c === 'socket') return 'plug';
    if (c === 'thermostat' || c === 'heater') return 'thermo';
    if (c === 'lock') return val(d, 'locked') === false ? 'unlock' : 'lock';
    if (c === 'windowcoverings' || c === 'blinds' || c === 'curtain' || c === 'sunshade') return 'blinds';
    if (c === 'fan') return 'fan';
    if (c === 'tv') return 'tv';
    if (c === 'speaker' || c === 'amplifier') return 'speaker';
    if (has(d, 'alarm_contact')) return val(d, 'alarm_contact') ? 'doorOpen' : 'door';
    if (has(d, 'alarm_motion')) return 'motion';
    if (has(d, 'alarm_water')) return 'drop';
    if (has(d, 'alarm_smoke') || has(d, 'alarm_co')) return 'smoke';
    if (has(d, 'measure_temperature')) return 'thermo';
    if (has(d, 'measure_power')) return 'bolt';
    if (has(d, 'locked')) return 'lock';
    if (has(d, 'onoff')) return 'plug';
    return 'sensor';
  }
  function unit(d, c, fallback) { var u = d.capabilitiesObj[c] && d.capabilitiesObj[c].units; return u || fallback || ''; }

  var VAC_STATES = { cleaning: 'Støvsuger', spot_cleaning: 'Punktrengjøring', docked: 'I dokken', charging: 'Lader', stopped: 'Stoppet',
    returning: 'På vei hjem', paused: 'Pause', error: 'Feil', idle: 'Klar' };
  function vacuumState(d) {
    var s = val(d, 'vacuumcleaner_state');
    if (s != null) return VAC_STATES[s] || cap1(String(s).replace(/_/g, ' '));
    if (has(d, 'onoff')) return val(d, 'onoff') ? 'Støvsuger' : 'Av';
    return genericState(d) || '';
  }
  function vacuumBusy(d) {
    var s = val(d, 'vacuumcleaner_state');
    return s === 'cleaning' || s === 'spot_cleaning' || (s == null && val(d, 'onoff') === true);
  }

  // Capabilities the dashboard understands; anything else is shown as "title: value".
  var KNOWN = /^(onoff|dim|light_.*|measure_temperature|target_temperature|measure_humidity|alarm_.*|locked|measure_power|meter_power.*|windowcoverings_.*|measure_luminance|measure_co2|measure_battery|vacuumcleaner_state|volume_.*|speaker_.*|button.*|thermostat_mode)$/;
  function fmtValue(d, c) {
    var v = val(d, c);
    if (v == null || v === '') return '';
    if (typeof v === 'boolean') return v ? 'Ja' : 'Nei';
    if (typeof v === 'number') return fmtNum(v, 1) + (unit(d, c) ? ' ' + unit(d, c) : '');
    return String(v);
  }
  function genericState(d) {
    var ids = Object.keys(d.capabilitiesObj).filter(function (c) { return !KNOWN.test(c) && fmtValue(d, c); });
    if (!ids.length) return '';
    var c = ids[0], t = d.capabilitiesObj[c].title;
    return (t ? t + ': ' : '') + fmtValue(d, c);
  }

  // Returns { cls, big, state, corner, bar }
  function describe(d) {
    var k = kind(d), out = { cls: '', big: '', state: '', corner: '', bar: null };
    var alarm = ['alarm_water', 'alarm_smoke', 'alarm_co', 'alarm_tamper'].filter(function (a) { return val(d, a) === true; });
    if (k === 'vacuum') {
      out.state = vacuumState(d);
      if (vacuumBusy(d)) out.cls = 'on';
      if (typeof val(d, 'measure_battery') === 'number') out.corner = fmtNum(val(d, 'measure_battery'), 0) + ' %';
    } else if (k === 'switch' || k === 'dimmer') {
      var on = k === 'switch' ? !!val(d, 'onoff') : val(d, 'dim') > 0;
      out.cls = on ? 'on' : '';
      out.state = on ? (has(d, 'dim') ? Math.round(val(d, 'dim') * 100) + ' %' : 'På') : 'Av';
      if (on && has(d, 'dim')) out.bar = val(d, 'dim');
      if (has(d, 'measure_power')) out.corner = fmtNum(val(d, 'measure_power'), 0) + ' ' + unit(d, 'measure_power', 'W');
      else if (has(d, 'measure_temperature')) out.corner = fmtNum(val(d, 'measure_temperature')) + '°';
    } else if (k === 'thermostat') {
      var t = val(d, 'measure_temperature'), target = val(d, 'target_temperature');
      out.big = t != null ? fmtNum(t) + '<small>°</small>' : fmtNum(target) + '<small>°</small>';
      out.state = 'Satt til ' + fmtNum(target) + '°' + (val(d, 'onoff') === false ? ' · av' : '');
      if (typeof t === 'number' && typeof target === 'number' && target > t + 0.2 && val(d, 'onoff') !== false) { out.cls = 'heat'; out.state = 'Varmer til ' + fmtNum(target) + '°'; }
    } else if (k === 'lock') {
      var locked = val(d, 'locked');
      out.state = locked ? 'Låst' : 'Ulåst';
      out.cls = locked ? '' : 'alert';
    } else if (k === 'cover') {
      var pos = val(d, 'windowcoverings_set'), mv = val(d, 'windowcoverings_state');
      out.state = mv === 'up' ? 'Åpner …' : mv === 'down' ? 'Lukker …' : (typeof pos === 'number' ? (pos >= 0.99 ? 'Åpen' : pos <= 0.01 ? 'Lukket' : Math.round(pos * 100) + ' % åpen') : 'Står stille');
      if (typeof pos === 'number') out.bar = pos;
    } else {
      if (has(d, 'measure_temperature')) {
        out.big = fmtNum(val(d, 'measure_temperature')) + '<small>°</small>';
        if (has(d, 'measure_humidity')) out.state = fmtNum(val(d, 'measure_humidity'), 0) + ' % fuktighet';
      } else if (has(d, 'measure_power')) {
        out.big = fmtNum(val(d, 'measure_power'), 0) + '<small>' + esc(unit(d, 'measure_power', 'W')) + '</small>';
      } else if (has(d, 'measure_co2')) {
        out.big = fmtNum(val(d, 'measure_co2'), 0) + '<small>ppm</small>';
      }
      if (has(d, 'alarm_contact')) { var open = !!val(d, 'alarm_contact'); out.state = open ? 'Åpen' : 'Lukket'; if (open) out.cls = 'alert'; }
      if (has(d, 'alarm_motion')) { var m = !!val(d, 'alarm_motion'); if (!has(d, 'alarm_contact')) out.state = m ? 'Bevegelse' : 'Rolig'; if (m) out.cls = 'cool'; }
      if (has(d, 'measure_luminance') && !out.big) out.corner = fmtNum(val(d, 'measure_luminance'), 0) + ' lx';
      if (!out.state && !out.big && has(d, 'alarm_water')) out.state = 'Tørt';
      if (!out.state && !out.big) {
        var p = isWaste(d) ? pickupsOf(d)[0] : null;
        out.state = p ? cap1(p.label) + ' ' + p.when : genericState(d);
      }
    }
    if (alarm.length) { out.cls = 'alert'; out.state = alarm.map(function (a) { return { alarm_water: 'Vann!', alarm_smoke: 'Røyk!', alarm_co: 'CO!', alarm_tamper: 'Sabotasje' }[a]; }).join(' '); }
    if (val(d, 'alarm_battery') === true && !out.corner) out.corner = 'Lavt batteri';
    return out;
  }

  function tileHTML(d) {
    var x = describe(d);
    return '<button class="tile ' + x.cls + (d.available ? '' : ' offline') + '" data-id="' + esc(d.id) + '">' +
      '<div class="t-top"><span class="t-icon">' + icon(deviceIcon(d)) + '</span><span class="t-value">' + esc(x.corner) + '</span></div>' +
      '<div>' + (x.big ? '<div class="t-big">' + x.big + '</div>' : '') +
      '<div class="t-name">' + esc(d.name) + '</div>' +
      '<div class="t-state">' + esc(d.available ? x.state : 'Utilgjengelig') + '</div>' +
      (showRoomLabel ? '<div class="t-room">' + esc(zoneName(d.zone)) + '</div>' : '') + '</div>' +
      (x.bar != null ? '<span class="t-bar" style="width:' + Math.round(x.bar * 100) + '%"></span>' : '') +
      '</button>';
  }

  // ---------------------------------------------------------------- waste pickups
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
  // Turns a capability value into a date, a number of days, or nothing.
  function parsePickup(v, units, hint) {
    if (v == null || v === '' || typeof v === 'boolean') return null;
    if (typeof v === 'number') {
      if (v > 1e12) return { date: new Date(v) };
      if (v > 1e9) return { date: new Date(v * 1000) };
      if (/dag|day|^d$/i.test((units || '') + ' ' + hint) && v >= 0 && v < 400) return { days: Math.round(v) };
      return null;
    }
    var s = String(v).trim(), m;
    if (/^i ?dag/i.test(s) || /^today/i.test(s)) return { days: 0 };
    if (/^i ?morgen/i.test(s) || /^tomorrow/i.test(s)) return { days: 1 };
    if ((m = s.match(/(\d{4})-(\d{2})-(\d{2})/))) return { date: new Date(+m[1], +m[2] - 1, +m[3]) };
    if ((m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/))) return { date: new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]) };
    if ((m = s.match(/(\d{1,2})\.\s*([a-zæøå]{3})/i))) {
      var mi = MONTHS.indexOf(m[2].toLowerCase());
      if (mi >= 0) { var d = new Date(new Date().getFullYear(), mi, +m[1]); if (daysFromToday(d) < -30) d.setFullYear(d.getFullYear() + 1); return { date: d }; }
    }
    if ((m = s.match(/(?:om\s*)?(\d+)\s*dag/i))) return { days: +m[1] };
    return { raw: s };
  }
  function pickupsOf(d) {
    var out = [];
    Object.keys(d.capabilitiesObj).forEach(function (c) {
      if (/^(measure_battery|alarm_|onoff$|button)/.test(c)) return;
      var co = d.capabilitiesObj[c], r = parsePickup(co.value, co.units, c + ' ' + (co.title || ''));
      if (!r) return;
      var label = String(co.title || d.name).replace(/^(neste|next)\s+/i, '').replace(/\s*\((dager|days)\)\s*$/i, '');
      if (r.date) r.days = daysFromToday(r.date);
      if (r.days != null && r.days < 0) return;
      out.push({ d: d, label: label, days: r.days, raw: r.raw, when: r.days != null ? dayWord(r.days, r.date) : r.raw });
    });
    return out.sort(function (a, b) { return (a.days == null ? 999 : a.days) - (b.days == null ? 999 : b.days); });
  }
  function allPickups() {
    var list = [];
    allDevices().filter(isWaste).forEach(function (d) { list = list.concat(pickupsOf(d)); });
    return list.filter(function (p) { return p.days == null || p.days <= 14; })
      .sort(function (a, b) { return (a.days == null ? 999 : a.days) - (b.days == null ? 999 : b.days); });
  }

  // ---------------------------------------------------------------- weather (MET Nordic via Open-Meteo)
  var WMO = {
    0: ['Klart', 'sun'], 1: ['Lettskyet', 'partly'], 2: ['Delvis skyet', 'partly'], 3: ['Overskyet', 'cloud'],
    45: ['Tåke', 'fog'], 48: ['Rimtåke', 'fog'], 51: ['Lett yr', 'rain'], 53: ['Yr', 'rain'], 55: ['Kraftig yr', 'rain'],
    56: ['Underkjølt yr', 'sleet'], 57: ['Underkjølt yr', 'sleet'], 61: ['Lett regn', 'rain'], 63: ['Regn', 'rain'], 65: ['Kraftig regn', 'rain'],
    66: ['Underkjølt regn', 'sleet'], 67: ['Underkjølt regn', 'sleet'], 71: ['Lett snø', 'snow'], 73: ['Snø', 'snow'], 75: ['Kraftig snø', 'snow'],
    77: ['Snøkorn', 'snow'], 80: ['Regnbyger', 'rain'], 81: ['Regnbyger', 'rain'], 82: ['Kraftige regnbyger', 'rain'],
    85: ['Snøbyger', 'snow'], 86: ['Kraftige snøbyger', 'snow'], 95: ['Tordenvær', 'thunder'], 96: ['Tordenvær med hagl', 'thunder'], 99: ['Tordenvær med hagl', 'thunder']
  };
  function wxText(code) { return (WMO[code] || ['', 'cloud'])[0]; }
  function wxIcon(code, isDay) {
    var i = (WMO[code] || ['', 'cloud'])[1];
    if (!isDay && i === 'sun') return 'moon';
    if (!isDay && i === 'partly') return 'partlyNight';
    return i;
  }
  function weatherLocation() {
    if (cfg.weatherLoc) return Promise.resolve(cfg.weatherLoc);
    if (backend && backend.location) return backend.location().catch(function () { return null; });
    return Promise.resolve(null);
  }
  function loadForecast() {
    if (!backend || !cfg.showWeather) return;
    weatherLocation().then(function (loc) {
      if (!loc) { state.forecast = null; renderWeather(); return; }
      var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat.toFixed(3) + '&longitude=' + loc.lon.toFixed(3) +
        '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,is_day' +
        '&hourly=temperature_2m,weather_code,precipitation,is_day&daily=temperature_2m_max,temperature_2m_min' +
        '&timezone=auto&forecast_days=2&wind_speed_unit=ms';
      return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
        var now = Date.now(), hours = [];
        (j.hourly.time || []).forEach(function (t, i) {
          var ts = new Date(t).getTime();
          if (ts > now - 3600000 && hours.length < 13) {
            hours.push({ time: new Date(t), t: j.hourly.temperature_2m[i], code: j.hourly.weather_code[i], precip: j.hourly.precipitation[i], isDay: !!j.hourly.is_day[i] });
          }
        });
        var c = j.current || {};
        state.forecast = {
          place: loc.name, t: c.temperature_2m, feels: c.apparent_temperature, code: c.weather_code, wind: c.wind_speed_10m,
          precip: c.precipitation, isDay: !!c.is_day, hours: hours,
          max: j.daily && j.daily.temperature_2m_max ? j.daily.temperature_2m_max[0] : null,
          min: j.daily && j.daily.temperature_2m_min ? j.daily.temperature_2m_min[0] : null
        };
        renderWeather();
      });
    }).catch(function () { renderWeather(); });
  }
  // "Regn fra kl. 15" / "Opphold de neste timene"
  function precipOutlook(f) {
    var hrs = f.hours.slice(0, 12), wet = function (h) { return h.precip >= 0.2; };
    var kindOf = function (h) { var i = wxIcon(h.code, true); return i === 'snow' ? 'Snø' : i === 'sleet' ? 'Sludd' : 'Regn'; };
    var nowWet = (f.precip || 0) >= 0.2 || (hrs[0] && wet(hrs[0]));
    if (nowWet) {
      var dry = hrs.filter(function (h) { return !wet(h) && h.time > new Date(); })[0];
      var k = kindOf(hrs.filter(wet)[0] || hrs[0]);
      return dry ? k + ' nå, opphold fra kl. ' + dry.time.getHours() : k + ' de neste timene';
    }
    var first = hrs.filter(wet)[0];
    return first ? kindOf(first) + ' fra kl. ' + first.time.getHours() : 'Opphold de neste 12 timene';
  }

  // ---------------------------------------------------------------- Todoist (shopping list, home projects, today)
  var TD = 'https://api.todoist.com/api/v1';
  var todo = { projects: [], lists: {}, today: [], error: '', loaded: false };
  var demoTodo = null;
  function todoActive() { return !!cfg.todoistToken || (cfg.demo && !!backend); }
  // Demo mode without a token shows two sample lists without touching the saved choice.
  function todoListIds() { return !cfg.todoistToken && cfg.demo ? (cfg.todoLists.length ? cfg.todoLists : ['p1', 'p2']) : cfg.todoLists; }
  function tdFetch(path, opts) {
    opts = opts || {};
    var headers = { Authorization: 'Bearer ' + cfg.todoistToken };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(TD + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) throw new Error('Todoist avviste tokenet');
        if (!r.ok) throw new Error('Todoist svarte ' + r.status);
        return r.status === 204 ? null : r.json().catch(function () { return null; });
      });
  }
  // Follows Todoist's cursor pagination and returns every result.
  function tdAll(path) {
    var out = [];
    function page(cursor) {
      var sep = path.indexOf('?') < 0 ? '?' : '&';
      return tdFetch(path + sep + 'limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')).then(function (j) {
        out = out.concat((j && j.results) || []);
        return j && j.next_cursor && out.length < 2000 ? page(j.next_cursor) : out;
      });
    }
    return page(null);
  }
  function makeDemoTodo() {
    var t = function (id, content, extra) { return Object.assign({ id: id, content: content, section_id: null, parent_id: null, due: null, child_order: +id.slice(1) }, extra || {}); };
    var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      projects: [{ id: 'p1', name: 'Handleliste', is_shared: true }, { id: 'p2', name: 'Hjemmeprosjekter', is_shared: true }, { id: 'p3', name: 'Jobb', is_shared: false }],
      lists: {
        p1: { sections: [{ id: 's1', name: 'Frukt og grønt' }, { id: 's2', name: 'Meieri' }], tasks: [
          t('t1', 'Bananer', { section_id: 's1' }), t('t2', 'Agurk', { section_id: 's1' }), t('t3', 'Melk', { section_id: 's2' }),
          t('t4', 'Smør', { section_id: 's2' }), t('t5', 'Kaffe'), t('t6', 'Dopapir')] },
        p2: { sections: [], tasks: [
          t('t7', 'Male gangen', { due: { date: tomorrow.toISOString().slice(0, 10) } }), t('t8', 'Bytte pakning på kjøkkenkranen'),
          t('t9', 'Rydde bod'), t('t10', 'Kjøpe maling', { parent_id: 't7' })] }
      },
      today: [t('t11', 'Betale strømregningen', { due: { date: new Date().toISOString().slice(0, 10) } }), t('t12', 'Ringe rørlegger', { due: { date: new Date().toISOString().slice(0, 10) } })]
    };
  }
  function loadTodo() {
    if (!todoActive()) { todo = { projects: [], lists: {}, today: [], error: '', loaded: false }; renderStrip(); return Promise.resolve(); }
    if (!cfg.todoistToken) {   // demo mode without a token
      demoTodo = demoTodo || makeDemoTodo();
      todo = { projects: demoTodo.projects, lists: demoTodo.lists, today: demoTodo.today, error: '', loaded: true };
      renderStrip(); if (listOpen()) renderRooms();
      return Promise.resolve();
    }
    var ids = todoListIds();
    return Promise.all([
      tdAll('/projects'),
      Promise.all(ids.map(function (id) {
        return Promise.all([tdAll('/tasks?project_id=' + encodeURIComponent(id)), tdAll('/sections?project_id=' + encodeURIComponent(id)).catch(function () { return []; })])
          .then(function (r) { return { id: id, tasks: r[0], sections: r[1] }; })
          .catch(function () { return null; });   // a deleted or unshared project shouldn't hide the others
      })),
      cfg.todoToday ? tdAll('/tasks/filter?query=' + encodeURIComponent('today | overdue')) : Promise.resolve([])
    ]).then(function (r) {
      var lists = {};
      r[1].forEach(function (l) { if (l) lists[l.id] = { tasks: l.tasks, sections: l.sections }; });
      todo = { projects: r[0], lists: lists, today: r[2], error: '', loaded: true };
    }).catch(function (err) {
      todo.error = err && err.message || String(err);
    }).then(function () { renderStrip(); if (listOpen()) { renderRoomHead(); renderRooms(); } });
  }
  function projectName(id) { var p = todo.projects.filter(function (x) { return x.id === id; })[0]; return p ? p.name : 'Liste'; }
  function listIcon(name) { return /handle|shopping|innkjøp|dagligvare|matbutikk|grocer/i.test(name) ? 'cart' : /prosjekt|project|oppussing|hus|hjem|fiks|repar|vedlikehold/i.test(name) ? 'tools' : 'list'; }
  function topLevel(tasks) { return tasks.filter(function (t) { return !t.parent_id && !t.checked; }); }
  function closeTask(task) {
    if (!cfg.todoistToken) return Promise.resolve();   // demo
    return tdFetch('/tasks/' + encodeURIComponent(task.id) + '/close', { method: 'POST' });
  }
  function addTask(projectId, content) {
    if (!cfg.todoistToken) {
      var t = { id: 'n' + Date.now(), content: content, section_id: null, parent_id: null, due: null, child_order: 0 };
      demoTodo.lists[projectId].tasks.unshift(t);
      return Promise.resolve(t);
    }
    return tdFetch('/tasks', { method: 'POST', body: { content: content, project_id: projectId } });
  }
  function dueText(t) {
    if (!t.due || !t.due.date) return '';
    var d = new Date(t.due.datetime || (t.due.date.length === 10 ? t.due.date + 'T12:00:00' : t.due.date));
    if (isNaN(d)) return '';
    var days = daysFromToday(d);
    if (days < 0) return 'forfalt';
    return dayWord(days, d) + (t.due.datetime ? ' kl. ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : '');
  }

  // ---------------------------------------------------------------- render
  function zoneOrder() {
    // Depth-first order so rooms appear as they're arranged in Homey.
    var zones = state.zones, children = {}, out = [];
    Object.keys(zones).forEach(function (id) {
      var p = zones[id].parent || '_root';
      (children[p] = children[p] || []).push(zones[id]);
    });
    function walk(p) {
      (children[p] || []).sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', LOCALE); })
        .forEach(function (z) { out.push(z.id); walk(z.id); });
    }
    walk('_root');
    Object.keys(zones).forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
    return out;
  }

  function allDevices() { return Object.keys(state.devices).map(function (k) { return state.devices[k]; }); }
  function shownDevices() { return allDevices().filter(isShown); }
  function kindRank(d) { return { switch: 0, dimmer: 0, thermostat: 1, vacuum: 2, cover: 2, lock: 3, sensor: 4 }[kind(d)]; }
  function zoneName(zid) { return state.zones[zid] ? state.zones[zid].name : 'Annet'; }
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'); }
  function joinNames(a) {
    if (a.length <= 1) return a.join('');
    return a.slice(0, -1).join(', ') + ' og ' + a[a.length - 1];
  }
  function avg(list) { return list.reduce(function (s, v) { return s + v; }, 0) / list.length; }

  // ---- what needs attention
  function lightsOn(zid) {
    return allDevices().filter(function (d) { return d.class === 'light' && val(d, 'onoff') === true && (!zid || d.zone === zid); });
  }
  function alerts() {
    var out = [];
    allDevices().forEach(function (d) {
      ['alarm_water', 'alarm_smoke', 'alarm_co'].forEach(function (a) {
        if (val(d, a) === true) out.push({ d: d, level: 3, text: d.name + ' (' + zoneName(d.zone) + ') melder ' + { alarm_water: 'vannlekkasje', alarm_smoke: 'røyk', alarm_co: 'kullos' }[a] });
      });
    });
    shownDevices().forEach(function (d) {
      if (val(d, 'alarm_contact') === true) out.push({ d: d, level: 2, text: d.name + ' i ' + zoneName(d.zone) + ' står ' + (/vindu|vindauge|window/i.test(d.name) ? 'åpent' : 'åpen') });
      if (val(d, 'locked') === false) out.push({ d: d, level: 2, text: d.name + ' er ulåst' });
    });
    return out.sort(function (a, b) { return b.level - a.level; });
  }
  function powerInfo() {
    var all = allDevices().filter(function (d) { return typeof val(d, 'measure_power') === 'number'; });
    if (!all.length) return null;
    var meters = all.filter(function (d) { return d.cumulative; });   // a main meter measures the whole home
    var w = (meters.length ? meters : all).reduce(function (s, d) { return s + val(d, 'measure_power'); }, 0);
    return Math.abs(w) >= 1000 ? fmtNum(w / 1000, 1) + ' kW' : fmtNum(w, 0) + ' W';
  }
  function roomTemp(zid) {
    var pick = function (list) { return list.filter(function (d) { return d.zone === zid && typeof val(d, 'measure_temperature') === 'number'; }); };
    var l = pick(shownDevices());
    if (!l.length) l = pick(allDevices());
    return l.length ? avg(l.map(function (d) { return val(d, 'measure_temperature'); })) : null;
  }
  function insideTemp() {
    var l = shownDevices().filter(function (d) { return typeof val(d, 'measure_temperature') === 'number'; });
    return l.length ? avg(l.map(function (d) { return val(d, 'measure_temperature'); })) : null;
  }

  // ---- header corner (inside temperature, power)
  function renderMeta() {
    var el = $('meta');
    if (!backend) { el.innerHTML = ''; return; }
    var parts = [], t = insideTemp(), p = powerInfo();
    if (t != null) parts.push(icon('home') + '<span>' + fmtNum(t) + '°</span>');
    if (p) parts.push(icon('bolt') + '<span>' + esc(p) + '</span>');
    el.innerHTML = parts.map(function (x) { return '<span class="m-item">' + x + '</span>'; }).join('');
  }

  // ---- weather card
  function renderWeather() {
    var el = $('wx'), f = state.forecast, w = state.weather;
    if (!backend || !cfg.showWeather) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    if (!f) {
      if (w && typeof w.temperature === 'number') {
        el.innerHTML = '<div class="wx-now">' + icon('cloud') + '<div><div class="wx-temp">' + fmtNum(w.temperature) + '°</div>' +
          '<div class="wx-desc">' + esc(w.state ? cap1(String(w.state).replace(/_/g, ' ')) : 'Ute nå') + '</div></div></div>' +
          '<div class="wx-hint">Velg sted i innstillingene for å få værmelding time for time.</div>';
      } else {
        el.innerHTML = '<div class="wx-hint">' + icon('cloud') + 'Hold inne tannhjulet og velg sted under «Vær» for å vise værmeldingen her.</div>';
      }
      renderSaverSub();
      return;
    }
    var h = '<div class="wx-now">' + icon(wxIcon(f.code, f.isDay)) + '<div class="wx-main"><div class="wx-temp">' + fmtNum(f.t, 0) + '°</div>' +
      '<div class="wx-desc">' + esc(wxText(f.code)) + '</div></div>' +
      '<div class="wx-facts"><div>Føles som ' + fmtNum(f.feels, 0) + '°</div><div>' + icon('wind') + fmtNum(f.wind, 0) + ' m/s</div>' +
      (f.max != null ? '<div>' + fmtNum(f.min, 0) + '° / ' + fmtNum(f.max, 0) + '°</div>' : '') + '</div></div>';
    h += '<div class="wx-outlook">' + icon('umbrella') + esc(precipOutlook(f)) + '</div>';
    h += '<div class="wx-hours">' + f.hours.slice(1, 9).map(function (x) {
      return '<div class="wx-h"><span class="wx-hh">' + x.time.getHours() + '</span>' + icon(wxIcon(x.code, x.isDay)) +
        '<span class="wx-ht">' + fmtNum(x.t, 0) + '°</span><span class="wx-hp">' + (x.precip >= 0.1 ? fmtNum(x.precip, 1) : '') + '</span></div>';
    }).join('') + '</div>';
    el.innerHTML = h;
    renderSaverSub();
  }

  // ---- the status sentence
  function greeting() {
    var h = new Date().getHours();
    return h >= 5 && h < 10 ? 'God morgen' : h >= 10 && h < 12 ? 'God formiddag' : h >= 12 && h < 17 ? 'God ettermiddag' : h >= 17 && h < 22 ? 'God kveld' : 'God natt';
  }
  function renderStatus() {
    var el = $('status');
    if (!backend) {
      el.innerHTML = '<div class="s-greet">Velkommen</div><div class="s-line">Hold inne tannhjulet i hjørnet et sekund for å koble til Homey.</div>';
      return;
    }
    var on = lightsOn(), h = '<div class="s-greet">' + greeting() + '</div>';
    if (!on.length) {
      h += '<div class="s-line">Alle lys er av.</div>';
    } else {
      var rooms = [];
      on.forEach(function (d) { var n = zoneName(d.zone); if (rooms.indexOf(n) < 0) rooms.push(n); });
      var named = rooms.length > 3 ? rooms.slice(0, 2).concat([(rooms.length - 2) + ' andre rom']) : rooms;
      h += '<div class="s-line">' + on.length + ' lys er på i ' + esc(joinNames(named)) + '.' +
        ' <button class="s-action" data-act="alloff">Slå av</button></div>';
    }
    var al = alerts();
    al.slice(0, 3).forEach(function (a) {
      h += '<button class="s-alert" data-dev="' + esc(a.d.id) + '">' + icon(a.level > 2 ? 'smoke' : 'doorOpen') + '<span>' + esc(a.text) + '.</span>' + icon('chev') + '</button>';
    });
    if (al.length > 3) h += '<div class="s-more">og ' + (al.length - 3) + ' til</div>';

    // Calm extra: vacuums at work.
    var extras = '';
    allDevices().filter(function (d) { return isVacuum(d) && vacuumBusy(d); }).forEach(function (d) {
      extras += '<button class="s-info" data-dev="' + esc(d.id) + '">' + icon('vacuum') + '<span>' + esc(d.name) + ' støvsuger nå</span></button>';
    });
    if (!al.length && !extras && shownDevices().some(function (d) { return has(d, 'alarm_contact') || has(d, 'locked'); })) {
      h += '<div class="s-calm">Dører og vinduer er lukket.</div>';
    }
    el.innerHTML = h + extras;
  }

  // ---- card row under the centre: waste pickups and Todoist lists
  function stripCard(attrs, cls, ic, title, sub, count) {
    return '<button class="i-card ' + cls + '" ' + attrs + '><span class="ic-icon">' + icon(ic) + '</span><span class="ic-text"><span class="ic-title">' + esc(title) +
      '</span><span class="ic-sub">' + esc(sub) + '</span></span>' + (count != null ? '<span class="ic-count">' + count + '</span>' : '') + '</button>';
  }
  function preview(tasks) {
    var names = tasks.map(function (t) { return t.content; });
    return names.length ? names.slice(0, 3).join(', ') + (names.length > 3 ? ' …' : '') : 'Tom';
  }
  function renderStrip() {
    var el = $('strip');
    if (!backend) { el.innerHTML = ''; return; }
    var h = '';
    var pk = allPickups();
    if (pk.length) {
      var soon = pk.filter(function (p) { return p.days != null && p.days <= 1; });
      var rest = pk.filter(function (p) { return soon.indexOf(p) < 0; });
      var title = soon.length ? cap1(joinNames(soon.map(function (p) { return p.label.toLowerCase(); }))) + ' ' + soon[0].when : cap1(pk[0].label) + ' ' + pk[0].when;
      var sub = soon.length ? (soon[0].days === 1 ? 'Sett ut dunken i kveld' : 'Hentes i dag') : rest.slice(1, 3).map(function (p) { return cap1(p.label) + ' ' + p.when; }).join(' · ') || 'Neste tømming';
      h += stripCard('data-dev="' + esc(pk[0].d.id) + '"', soon.length ? 'warm' : '', 'trash', title, sub);
    }
    if (todoActive()) {
      if (todo.error) h += stripCard('data-list="_settings"', 'err', 'list', 'Todoist', todo.error);
      todoListIds().forEach(function (id) {
        var l = todo.lists[id];
        if (!l) return;
        var open = topLevel(l.tasks);
        h += stripCard('data-list="' + esc(id) + '"', '', listIcon(projectName(id)), projectName(id), preview(open), open.length);
      });
      if (cfg.todoToday && todo.loaded) {
        var td = topLevel(todo.today);
        h += stripCard('data-list="_today"', td.length ? '' : 'quiet', 'today', 'I dag', td.length ? preview(td) : 'Ingen oppgaver', td.length || null);
      }
    }
    el.innerHTML = h;
  }

  // ---- scene buttons, with the one that fits the time of day highlighted
  var SCENE_RULES = [
    { re: /night|natt|sleep|sove|bed|legg/i, icon: 'moon', period: 'night' },
    { re: /morning|morgen|wake|våkn|frokost|breakfast/i, icon: 'sun', period: 'morning' },
    { re: /leav|away|borte|går ut|reis|work|jobb/i, icon: 'exit', period: 'day' },
    { re: /home|hjem|arriv|kommer/i, icon: 'home', period: 'evening' },
    { re: /movie|film|kino|tv|cinema/i, icon: 'tv', period: 'evening' },
    { re: /dinner|middag|lunch|lunsj|mat|eat/i, icon: 'cutlery', period: 'evening' },
    { re: /støvsug|vacuum|rengjør|robot/i, icon: 'vacuum', period: 'day' }
  ];
  function sceneRule(name) { for (var i = 0; i < SCENE_RULES.length; i++) if (SCENE_RULES[i].re.test(name)) return SCENE_RULES[i]; return null; }
  function period() {
    var h = new Date().getHours();
    return h >= 5 && h < 10 ? 'morning' : h < 17 && h >= 10 ? 'day' : h >= 17 && h < 22 ? 'evening' : 'night';
  }
  function renderScenes() {
    var p = period(), suggested = -1;
    (cfg.scenes || []).forEach(function (f, i) { var r = sceneRule(f.name); if (suggested < 0 && r && r.period === p) suggested = i; });
    $('scenes').innerHTML = (cfg.scenes || []).map(function (f, i) {
      var r = sceneRule(f.name);
      return '<button class="scene' + (i === suggested ? ' suggested' : '') + '" data-scene="' + i + '"><span class="sc-icon">' +
        icon(r ? r.icon : 'sparkle') + '</span><span class="sc-name">' + esc(f.name) + '</span></button>';
    }).join('');
  }

  // ---- room bar
  var ROOM_RULES = [
    [/living|stue|lounge|family/i, 'sofa'], [/kitchen|kjøkken|kjokken/i, 'pot'], [/bed|sov|master|guest|gjeste|kid|barn|nursery/i, 'bed'],
    [/bath|bad|wc|toilet|toalett|laundry|vask/i, 'bath'], [/office|kontor|study|arbeid|work/i, 'monitor'],
    [/hall|gang|entr|corridor|stair|trapp|vindfang/i, 'door'], [/garage|garasje|carport/i, 'car'],
    [/garden|hage|outside|ute|terrass|balcon|balkong|patio|yard/i, 'tree']
  ];
  function roomIcon(name) { for (var i = 0; i < ROOM_RULES.length; i++) if (ROOM_RULES[i][0].test(name)) return ROOM_RULES[i][1]; return 'home'; }
  function roomZones() {
    var used = {};
    shownDevices().forEach(function (d) { used[d.zone] = true; });
    return zoneOrder().filter(function (z) { return used[z]; });
  }
  function renderRoomBar() {
    var el = $('roombar');
    if (!backend) { el.innerHTML = ''; return; }
    var alertZones = {};
    alerts().forEach(function (a) { alertZones[a.d.zone] = true; });
    var h = roomZones().map(function (zid) {
      var n = zoneName(zid), t = roomTemp(zid), lit = lightsOn(zid).length > 0;
      return '<button class="room-pill' + (lit ? ' lit' : '') + (alertZones[zid] ? ' alert' : '') + '" data-room="' + esc(zid) + '">' +
        icon(roomIcon(n)) + '<span class="rp-name">' + esc(n) + '</span>' + (t != null ? '<span class="rp-temp">' + fmtNum(t) + '°</span>' : '') + '</button>';
    }).join('');
    el.innerHTML = h + '<button class="room-pill all" data-room="_all" aria-label="Alle enheter">' + icon('grid') + '<span class="rp-name">Alle</span></button>';
    // Fade the right edge only when the pills overflow and can be scrolled.
    el.classList.toggle('fits', el.scrollWidth <= el.clientWidth + 1);
  }

  function renderChips() { renderStatus(); renderRoomBar(); renderMeta(); renderStrip(); if (openRoomId && !listOpen()) renderRoomHead(); }

  // ---- room panel (slides up with the room's device tiles)
  var openRoomId = null, showRoomLabel = false;
  function openRoom(zid) {
    openRoomId = zid;
    renderRoomHead(); renderRooms();
    $('roomBackdrop').hidden = false;
    $('rooms').scrollTop = 0;
  }
  function closeRoom() { openRoomId = null; $('roomBackdrop').hidden = true; $('rooms').innerHTML = ''; }
  function roomDevices() {
    return (openRoomId === '_all' ? allDevices().filter(function (d) { return isShown(d) || isWaste(d) || isVacuum(d); }) : shownDevices())
      .filter(function (d) { return openRoomId === '_all' || d.zone === openRoomId; });
  }
  // ---- Todoist lists use the same slide-up panel ("list:<projectId>" or "list:_today")
  function listOpen() { return !!openRoomId && openRoomId.indexOf('list:') === 0; }
  function openList(id) { openRoom('list:' + id); loadTodo(); }
  var pendingDone = {};   // task id -> timer; a second tap within 2 s undoes the tick
  function listTasks(id) {
    if (id === '_today') return todo.today.slice();
    var l = todo.lists[id];
    return l ? l.tasks.slice() : [];
  }
  function renderListHead(id) {
    var name = id === '_today' ? 'I dag' : projectName(id), open = topLevel(listTasks(id));
    $('roomHead').innerHTML = '<span class="rh-icon">' + icon(id === '_today' ? 'today' : listIcon(name)) + '</span><div class="rh-text"><div class="rh-name">' + esc(name) +
      '</div><div class="rh-meta">' + (open.length ? open.length + ' igjen' : 'Alt er gjort') + '  ·  Todoist</div></div>' +
      '<button class="icon-btn rh-close" data-act="closeroom" aria-label="Lukk">' + icon('x') + '</button>';
  }
  function taskRow(t, sub) {
    var due = dueText(t), done = !!pendingDone[t.id];
    return '<button class="task' + (sub ? ' sub' : '') + (done ? ' done' : '') + '" data-task="' + esc(t.id) + '"><span class="tk-box">' + (done ? icon('today') : '') + '</span>' +
      '<span class="tk-text">' + esc(t.content) + '</span>' + (due ? '<span class="tk-due' + (due === 'forfalt' ? ' late' : '') + '">' + esc(due) + '</span>' : '') + '</button>';
  }
  function renderList(id) {
    var tasks = listTasks(id).filter(function (t) { return !t.checked; }).sort(function (a, b) { return (a.child_order || 0) - (b.child_order || 0); });
    var h = id === '_today' ? '' : '<form class="add-task" data-addto="' + esc(id) + '"><input type="text" id="addTask" placeholder="Legg til …" autocomplete="off" enterkeyhint="done">' +
      '<button class="btn" type="submit">' + icon('plus') + 'Legg til</button></form>';
    var kids = {};
    tasks.forEach(function (t) { if (t.parent_id) (kids[t.parent_id] = kids[t.parent_id] || []).push(t); });
    var rows = function (list) {
      return list.map(function (t) { return taskRow(t, false) + (kids[t.id] || []).map(function (k) { return taskRow(k, true); }).join(''); }).join('');
    };
    var top = tasks.filter(function (t) { return !t.parent_id || !tasks.some(function (p) { return p.id === t.parent_id; }); });
    var sections = id === '_today' || !todo.lists[id] ? [] : todo.lists[id].sections || [];
    var loose = top.filter(function (t) { return !t.section_id || !sections.some(function (s) { return s.id === t.section_id; }); });
    h += '<div class="tasks">' + rows(loose);
    sections.forEach(function (s) {
      var inS = top.filter(function (t) { return t.section_id === s.id; });
      if (inS.length) h += '<div class="tk-section">' + esc(s.name) + '</div>' + rows(inS);
    });
    if (!tasks.length) h += '<div class="empty">' + (todo.loaded ? 'Ingenting her akkurat nå.' : 'Henter fra Todoist …') + '</div>';
    $('rooms').innerHTML = h + '</div>';
  }
  function toggleTask(id) {
    var listId = openRoomId.slice(5), t = listTasks(listId).filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    if (pendingDone[id]) { clearTimeout(pendingDone[id]); delete pendingDone[id]; renderList(listId); return; }
    pendingDone[id] = setTimeout(function () {
      delete pendingDone[id];
      closeTask(t).then(function () {
        [todo.today].concat(Object.keys(todo.lists).map(function (k) { return todo.lists[k].tasks; })).forEach(function (arr) {
          for (var i = arr.length - 1; i >= 0; i--) if (arr[i].id === id || arr[i].parent_id === id) arr.splice(i, 1);
        });
        renderStrip(); if (listOpen()) { renderListHead(openRoomId.slice(5)); renderList(openRoomId.slice(5)); }
      }).catch(function (err) { toast('Kunne ikke fullføre «' + t.content + '»: ' + (err && err.message || err), true); if (listOpen()) renderList(listId); });
    }, 2000);
    renderList(listId);
  }

  function renderRoomHead() {
    if (listOpen()) return renderListHead(openRoomId.slice(5));
    var zid = openRoomId, isAll = zid === '_all', name = isAll ? 'Alle enheter' : zoneName(zid);
    var on = isAll ? lightsOn() : lightsOn(zid), t = isAll ? null : roomTemp(zid);
    var meta = [];
    if (t != null) meta.push(fmtNum(t) + '°');
    meta.push(on.length ? on.length + ' lys på' : 'Lysene er av');
    $('roomHead').innerHTML = '<span class="rh-icon">' + icon(isAll ? 'grid' : roomIcon(name)) + '</span><div class="rh-text"><div class="rh-name">' + esc(name) +
      '</div><div class="rh-meta">' + esc(meta.join('  ·  ')) + '</div></div>' +
      (on.length ? '<button class="btn" data-act="roomoff">' + icon('bulb') + 'Slå av</button>' : '') +
      '<button class="icon-btn rh-close" data-act="closeroom" aria-label="Lukk">' + icon('x') + '</button>';
  }
  function renderRooms() {
    var rooms = $('rooms');
    if (!openRoomId) { rooms.innerHTML = ''; return; }
    if (listOpen()) {
      // Keep what's being typed in the add field when the list refreshes underneath.
      var inp = $('addTask'), typed = inp ? inp.value : '', focused = inp && document.activeElement === inp;
      renderList(openRoomId.slice(5));
      if (typed || focused) { $('addTask').value = typed; if (focused) $('addTask').focus(); }
      return;
    }
    showRoomLabel = openRoomId === '_all';
    var zIndex = {};
    zoneOrder().forEach(function (z, i) { zIndex[z] = i; });
    var list = roomDevices().sort(function (a, b) {
      var byRoom = (zIndex[a.zone] || 0) - (zIndex[b.zone] || 0), byKind = kindRank(a) - kindRank(b);
      return (cfg.sortBy === 'room' ? (byRoom || byKind) : (byKind || byRoom)) || a.name.localeCompare(b.name, LOCALE);
    });
    rooms.innerHTML = list.length ? '<div class="grid">' + list.map(tileHTML).join('') + '</div>'
      : '<div class="empty">Ingen enheter her. Hold inne tannhjulet for å velge enheter.</div>';
  }

  function updateTile(id) {
    var d = state.devices[id];
    var el = document.querySelector('.tile[data-id="' + cssEsc(id) + '"]');
    if (el && d) {
      var tmp = document.createElement('div');
      tmp.innerHTML = tileHTML(d);
      el.replaceWith(tmp.firstChild);
    }
    if (sheetId === id && !dragging && !sheetTouch) renderSheet();
  }

  function renderPresence() {
    var el = $('presence');
    if (!cfg.showPresence || !state.users.length) { el.innerHTML = ''; return; }
    el.innerHTML = state.users.map(function (u) {
      return '<span class="avatar' + (u.present ? ' home' : '') + (u.asleep ? ' asleep' : '') + '" title="' + esc(u.name) + (u.present ? ', hjemme' : ', borte') + '">' + esc(initials(u.name)) + '</span>';
    }).join('');
  }

  function renderAll() { renderPresence(); renderScenes(); renderChips(); renderWeather(); renderStrip(); renderRooms(); }

  // ---------------------------------------------------------------- clock
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function timeStr(d) {
    if (cfg.use24h) return pad(d.getHours()) + ':' + pad(d.getMinutes());
    var h = d.getHours() % 12 || 12;
    return h + ':' + pad(d.getMinutes());
  }
  function dateStr(d) { return cap1(d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })); }
  function renderSaverSub() {
    var f = state.forecast, w = state.weather, t = f ? f.t : (w && typeof w.temperature === 'number' ? w.temperature : null);
    $('saverSub').textContent = dateStr(new Date()) + (cfg.showWeather && t != null ? '  ·  ' + fmtNum(t, 0) + '°' : '');
  }
  function tick() {
    var now = new Date();
    $('time').textContent = timeStr(now);
    $('date').textContent = dateStr(now);
    $('saverTime').textContent = timeStr(now);
    if (now.getSeconds() === 0) {
      renderSaverSub();
      // Greeting, suggested scene and pickup days follow the time of day.
      if (backend) { renderStatus(); renderScenes(); }
    }
    $('saver').classList.toggle('night', isNight());
    // Kiosk hygiene: reload once a day at 04:00 to keep memory and sockets fresh.
    if (now.getHours() === 4 && now.getMinutes() === 0 && now.getSeconds() < 2 && performance.now() > 120000) location.reload();
  }
  function minutes(hhmm) { var p = String(hhmm || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function isNight() {
    var n = new Date(), m = n.getHours() * 60 + n.getMinutes(), a = minutes(cfg.nightFrom), b = minutes(cfg.nightTo);
    return a <= b ? (m >= a && m < b) : (m >= a || m < b);
  }

  // ---------------------------------------------------------------- screensaver / wake lock
  var lastActivity = Date.now();
  function activity() {
    lastActivity = Date.now();
    if (!$('saver').hidden) $('saver').hidden = true;
    requestWakeLock();
  }
  setInterval(function () {
    var idle = Date.now() - lastActivity;
    // Drift back to the calm home screen when nobody is touching the panel.
    if (idle > 60000 && openRoomId && $('sheetBackdrop').hidden && $('confirmBackdrop').hidden) closeRoom();
    if (idle > 60000 && !$('sheetBackdrop').hidden && $('confirmBackdrop').hidden) closeSheet();
    var idleLimit = isNight() ? Math.min(cfg.idleMin || 1, 1) : cfg.idleMin;
    if (!idleLimit || !$('settings').hidden || !$('sheetBackdrop').hidden) return;
    if (idle > idleLimit * 60000) $('saver').hidden = false;
  }, 5000);
  $('saver').addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); activity(); });

  var wakeLock = null;
  function requestWakeLock() {
    if (wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(function (l) {
      wakeLock = l;
      l.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () {});
  }

  // ---------------------------------------------------------------- actions
  function setCap(id, capId, value) {
    var d = state.devices[id];
    if (!d || !has(d, capId)) return Promise.resolve();
    var prev = val(d, capId);
    d.capabilitiesObj[capId].value = value;   // optimistic update
    updateTile(id); renderChips();
    var el = document.querySelector('.tile[data-id="' + cssEsc(id) + '"]');
    if (el) el.classList.add('busy');
    return backend.setCapability(id, capId, value).catch(function (err) {
      d.capabilitiesObj[capId].value = prev;
      toast('Kunne ikke endre ' + d.name + ': ' + (err && err.message || err), true);
    }).then(function () { updateTile(id); renderChips(); });
  }

  function primaryAction(d) {
    var k = kind(d);
    if (!d.available) return toast(d.name + ' er utilgjengelig', true);
    if (k === 'switch') return setCap(d.id, 'onoff', !val(d, 'onoff'));
    if (k === 'lock') {
      var locked = val(d, 'locked');
      if (locked && cfg.lockConfirm) {
        return confirmBox('Låse opp ' + d.name + '?', 'Lås opp').then(function (ok) { if (ok) setCap(d.id, 'locked', false); });
      }
      return setCap(d.id, 'locked', !locked);
    }
    return openSheet(d.id);
  }

  // Tiles: tap = primary action, long-press = details.
  (function () {
    var rooms = $('rooms'), timer = null, startX = 0, startY = 0, target = null, longFired = false;
    rooms.addEventListener('pointerdown', function (e) {
      var t = e.target.closest('.tile');
      if (!t) return;
      target = t; longFired = false; startX = e.clientX; startY = e.clientY;
      t.classList.add('pressing');
      timer = setTimeout(function () {
        longFired = true;
        t.classList.remove('pressing');
        openSheet(t.getAttribute('data-id'));
      }, 450);
    });
    rooms.addEventListener('pointermove', function (e) {
      if (target && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) cancel();
    });
    function cancel() { clearTimeout(timer); if (target) target.classList.remove('pressing'); target = null; }
    rooms.addEventListener('pointercancel', cancel);
    rooms.addEventListener('pointerup', function () {
      if (!target) return;
      var t = target; cancel();
      if (!longFired) { var d = state.devices[t.getAttribute('data-id')]; if (d) primaryAction(d); }
    });
    rooms.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  })();

  $('scenes').addEventListener('click', function (e) {
    var b = e.target.closest('.scene');
    if (!b) return;
    var f = cfg.scenes[+b.getAttribute('data-scene')];
    b.classList.add('fired');
    backend.trigger(f).then(function () { toast(f.name + ' er startet'); })
      .catch(function (err) { toast('Kunne ikke starte ' + f.name + ': ' + (err && err.message || err), true); })
      .then(function () { setTimeout(function () { b.classList.remove('fired'); }, 1200); });
  });

  function lightsOffFlow(on, where) {
    if (!on.length) return toast('Lysene er allerede av');
    confirmBox('Slå av ' + on.length + ' lys' + where + '?', 'Slå av').then(function (ok) {
      if (ok) on.forEach(function (d) { setCap(d.id, 'onoff', false); });
    });
  }

  $('status').addEventListener('click', function (e) {
    if (e.target.closest('[data-act="alloff"]')) return lightsOffFlow(lightsOn(), '');
    var a = e.target.closest('[data-dev]');
    if (a && state.devices[a.getAttribute('data-dev')]) openSheet(a.getAttribute('data-dev'));
  });

  $('roombar').addEventListener('click', function (e) {
    var b = e.target.closest('[data-room]');
    if (b) openRoom(b.getAttribute('data-room'));
  });

  $('strip').addEventListener('click', function (e) {
    var dv = e.target.closest('[data-dev]');
    if (dv && state.devices[dv.getAttribute('data-dev')]) return openSheet(dv.getAttribute('data-dev'));
    var l = e.target.closest('[data-list]');
    if (!l) return;
    if (l.getAttribute('data-list') === '_settings') return openSettings();
    openList(l.getAttribute('data-list'));
  });

  $('roomBackdrop').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target.closest('[data-addto]'), inp = $('addTask'), text = inp ? inp.value.trim() : '';
    if (!f || !text) return;
    var pid = f.getAttribute('data-addto');
    inp.value = '';
    addTask(pid, text).then(function (t) {
      if (t && todo.lists[pid] && cfg.todoistToken) todo.lists[pid].tasks.unshift(t);
      toast('«' + text + '» er lagt til');
      renderStrip(); if (listOpen()) { renderListHead(pid); renderRooms(); }
    }).catch(function (err) { toast('Kunne ikke legge til: ' + (err && err.message || err), true); });
  });

  $('roomBackdrop').addEventListener('click', function (e) {
    if (e.target === $('roomBackdrop') || e.target.closest('[data-act="closeroom"]')) return closeRoom();
    var tk = e.target.closest('[data-task]');
    if (tk) return toggleTask(tk.getAttribute('data-task'));
    if (e.target.closest('[data-act="roomoff"]')) {
      var all = openRoomId === '_all';
      lightsOffFlow(all ? lightsOn() : lightsOn(openRoomId), all ? '' : ' i ' + zoneName(openRoomId));
    }
  });

  // ---------------------------------------------------------------- detail sheet
  var sheetId = null, dragging = false, sendTimer = null, sheetTouch = false;
  // Don't redraw the sheet under a finger, or the tap would be lost.
  $('sheet').addEventListener('pointerdown', function () { sheetTouch = true; });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    document.addEventListener(ev, function () { setTimeout(function () { sheetTouch = false; }, 50); });
  });
  function openSheet(id) { sheetId = id; renderSheet(); $('sheetBackdrop').hidden = false; }
  function closeSheet() { sheetId = null; $('sheetBackdrop').hidden = true; }
  $('sheetBackdrop').addEventListener('click', function (e) { if (e.target === $('sheetBackdrop')) closeSheet(); });

  var LABELS = {
    measure_temperature: 'Temperatur', measure_humidity: 'Fuktighet', measure_power: 'Effekt', measure_luminance: 'Lysnivå',
    measure_co2: 'CO₂', measure_battery: 'Batteri', meter_power: 'Energibruk', alarm_contact: 'Kontakt', alarm_motion: 'Bevegelse',
    alarm_water: 'Vann', alarm_smoke: 'Røyk', alarm_co: 'Kullos', alarm_battery: 'Batteri', alarm_tamper: 'Sabotasje'
  };
  // Controls drawn as buttons/sliders in the sheet, so not repeated as rows.
  var CONTROLLED = /^(onoff|dim|target_temperature|windowcoverings_.*|locked|vacuumcleaner_state)$/;
  function readable(d, c) {
    var v = val(d, c);
    if (typeof v === 'boolean') {
      if (c === 'alarm_contact') return v ? 'Åpen' : 'Lukket';
      if (c === 'alarm_motion') return v ? 'Bevegelse' : 'Rolig';
      if (c.indexOf('alarm_') === 0) return v ? 'Alarm' : 'OK';
      return v ? 'Ja' : 'Nei';
    }
    if (typeof v === 'number') return fmtNum(v, c === 'meter_power' ? 2 : 1) + ' ' + unit(d, c, c === 'measure_battery' ? '%' : '');
    return v == null ? '–' : String(v);
  }

  function renderSheet() {
    var d = state.devices[sheetId];
    if (!d) return closeSheet();
    var k = kind(d), h = '';
    h += '<h2>' + esc(d.name) + '</h2><div class="sub">' + esc(zoneName(d.zone)) + (d.available ? '' : ' · utilgjengelig') + '</div>';
    if (k === 'vacuum') {
      h += '<div class="vac-state">' + icon('vacuum') + '<span>' + esc(vacuumState(d)) + '</span>' +
        (typeof val(d, 'measure_battery') === 'number' ? '<span class="vac-bat">' + fmtNum(val(d, 'measure_battery'), 0) + ' %</span>' : '') + '</div>';
      if (has(d, 'vacuumcleaner_state')) {
        h += '<div class="btn-row"><button class="btn" data-act="vac-cleaning">' + icon('play') + 'Start</button>' +
          '<button class="btn" data-act="vac-stopped">' + icon('stop') + 'Stopp</button>' +
          '<button class="btn" data-act="vac-docked">' + icon('home') + 'Til dokken</button></div>';
      } else if (has(d, 'onoff')) {
        var von = !!val(d, 'onoff');
        h += '<button class="big-toggle' + (von ? ' on' : '') + '" data-act="toggle">' + (von ? 'Støvsuger – trykk for å stoppe' : 'Start støvsuging') + '</button>';
      }
    } else if (has(d, 'onoff')) {
      var on = !!val(d, 'onoff');
      h += '<button class="big-toggle' + (on ? ' on' : '') + '" data-act="toggle">' + (on ? 'På' : 'Av') + '</button>';
    }
    if (has(d, 'dim')) {
      var dim = Math.round((val(d, 'dim') || 0) * 100);
      h += '<div class="slider-wrap"><div class="slabel"><span>Lysstyrke</span><b id="dimVal">' + dim + ' %</b></div>' +
        '<input type="range" min="0" max="100" step="1" value="' + dim + '" data-act="dim"></div>';
    }
    if (k === 'thermostat') {
      var c = d.capabilitiesObj.target_temperature;
      h += '<div class="stepper"><button data-act="tminus" aria-label="Lavere">−</button><div class="sval" id="tVal">' +
        fmtNum(c.value) + '<small>°</small></div><button data-act="tplus" aria-label="Høyere">+</button></div>';
    }
    if (k === 'cover') {
      if (has(d, 'windowcoverings_state')) {
        h += '<div class="btn-row"><button class="btn" data-act="cover-up">' + icon('up') + 'Åpne</button><button class="btn" data-act="cover-idle">' +
          icon('stop') + 'Stopp</button><button class="btn" data-act="cover-down">' + icon('down') + 'Lukk</button></div>';
      }
      if (has(d, 'windowcoverings_set')) {
        var pos = Math.round((val(d, 'windowcoverings_set') || 0) * 100);
        h += '<div class="slider-wrap"><div class="slabel"><span>Posisjon</span><b id="posVal">' + pos + ' % åpen</b></div>' +
          '<input type="range" min="0" max="100" step="1" value="' + pos + '" data-act="pos"></div>';
      }
    }
    if (k === 'lock') {
      var locked = !!val(d, 'locked');
      h += '<button class="big-toggle' + (locked ? '' : ' on') + '" data-act="lock">' + (locked ? 'Låst – trykk for å låse opp' : 'Ulåst – trykk for å låse') + '</button>';
    }
    if (isWaste(d)) {
      var pk = pickupsOf(d);
      if (pk.length) h += '<div>' + pk.map(function (p) { return '<div class="row"><span class="label">' + esc(cap1(p.label)) + '</span><span class="val">' + esc(p.when) + '</span></div>'; }).join('') + '</div>';
    } else {
      var rows = Object.keys(d.capabilitiesObj).filter(function (cId) { return !CONTROLLED.test(cId) && val(d, cId) != null && val(d, cId) !== ''; });
      if (rows.length) {
        h += '<div>' + rows.map(function (cId) {
          return '<div class="row"><span class="label">' + esc(d.capabilitiesObj[cId].title || LABELS[cId] || cId) + '</span><span class="val">' + esc(readable(d, cId)) + '</span></div>';
        }).join('') + '</div>';
      }
    }
    h += '<div class="close-row"><button class="btn" data-act="close">Lukk</button></div>';
    $('sheet').innerHTML = h;
  }

  function throttledSend(id, capId, value) {
    clearTimeout(sendTimer);
    sendTimer = setTimeout(function () { setCap(id, capId, value); }, 250);
  }

  $('sheet').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var d = state.devices[sheetId], act = b.getAttribute('data-act');
    if (!d) return;
    if (act === 'close') return closeSheet();
    if (act === 'toggle') return setCap(d.id, 'onoff', !val(d, 'onoff'));
    if (act === 'lock') return primaryAction(d);
    if (act.indexOf('vac-') === 0) return setCap(d.id, 'vacuumcleaner_state', act.slice(4));
    if (act === 'tminus' || act === 'tplus') {
      var c = d.capabilitiesObj.target_temperature, step = c.step || 0.5;
      var min = c.min != null ? c.min : 5, max = c.max != null ? c.max : 35;
      var next = Math.round(Math.min(max, Math.max(min, (c.value || 20) + (act === 'tplus' ? step : -step))) * 10) / 10;
      c.value = next;
      $('tVal').innerHTML = fmtNum(next) + '<small>°</small>';
      updateTileOnly(d.id);
      clearTimeout(sendTimer);
      sendTimer = setTimeout(function () { setCap(d.id, 'target_temperature', next); }, 700);
      return;
    }
    if (act.indexOf('cover-') === 0) return setCap(d.id, 'windowcoverings_state', act.slice(6));
  });
  function updateTileOnly(id) { var keep = sheetId; sheetId = null; updateTile(id); sheetId = keep; }

  $('sheet').addEventListener('input', function (e) {
    var d = state.devices[sheetId], act = e.target.getAttribute('data-act');
    if (!d) return;
    dragging = true;
    var v = +e.target.value / 100;
    if (act === 'dim') { $('dimVal').textContent = Math.round(v * 100) + ' %'; throttledSend(d.id, 'dim', v); }
    if (act === 'pos') { $('posVal').textContent = Math.round(v * 100) + ' % åpen'; throttledSend(d.id, 'windowcoverings_set', v); }
  });
  $('sheet').addEventListener('change', function () { setTimeout(function () { dragging = false; }, 600); });

  // ---------------------------------------------------------------- settings
  (function () {
    var btn = $('settingsBtn'), t = null;
    function start(e) { e.preventDefault(); btn.classList.add('holding'); t = setTimeout(function () { btn.classList.remove('holding'); openSettings(); }, 900); }
    function stop() { clearTimeout(t); btn.classList.remove('holding'); }
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', function () { if (t && btn.classList.contains('holding')) toast('Hold inne tannhjulet i ett sekund for å åpne innstillingene'); stop(); });
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);
  })();

  var settingsMsg = null, placeResults = [], placeMsg = '', debugId = '', todoMsg = null;
  function openSettings() { $('settings').hidden = false; renderSettings(); }
  function closeSettings() { $('settings').hidden = true; settingsMsg = null; placeResults = []; placeMsg = ''; todoMsg = null; renderAll(); loadForecast(); loadTodo(); }

  function renderSettings() {
    var s = '', connected = !!backend;
    s += '<div class="settings-bar"><h1>Innstillinger</h1><button class="btn primary" data-s="done">Ferdig</button></div>';

    s += '<h3>Koble til Homey</h3><div class="card">' +
      '<div class="field"><label for="sAddr">Homeys IP-adresse</label><input type="text" id="sAddr" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="192.168.1.50" value="' + esc(cfg.address) + '">' +
      '<div class="hint">Står i Homey-appen under Innstillinger → Generelt → Nettverk. Kobler til <code id="sResolved">' + esc(resolveAddress(cfg.address) || '…') + '</code></div></div>' +
      '<div class="field"><label for="sToken">API-nøkkel</label><input type="password" id="sToken" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Lim inn API-nøkkelen" value="' + esc(cfg.token) + '">' +
      '<div class="hint">Lag en på my.homey.app → Innstillinger → API-nøkler. Lagres bare på denne iPaden.</div></div>' +
      '<div class="field"><div class="inline"><button class="btn primary" data-s="connect">Koble til</button><button class="btn" data-s="demo">' + (cfg.demo ? 'Demomodus er på' : 'Prøv demomodus') + '</button></div></div></div>';
    if (settingsMsg) s += '<div class="status-msg ' + settingsMsg.type + '">' + settingsMsg.html + '</div>';

    // Weather location
    var locTxt = cfg.weatherLoc ? 'Viser vær for <b>' + esc(cfg.weatherLoc.name) + '</b>.' : 'Bruker Homeys posisjon (krever tillatelsen «Geolokasjon: se» på API-nøkkelen).';
    s += '<h3>Vær</h3><div class="card"><div class="field"><label for="sPlace">Sted for værmeldingen</label><div class="hint">' + locTxt + '</div>' +
      '<div class="inline"><input type="text" id="sPlace" placeholder="F.eks. Bergen eller postnummer" autocorrect="off" spellcheck="false"><button class="btn" data-s="place-search">Søk</button>' +
      (cfg.weatherLoc ? '<button class="btn" data-s="place-homey">Bruk Homeys posisjon</button>' : '') + '</div>' +
      (placeMsg ? '<div class="hint">' + esc(placeMsg) + '</div>' : '') +
      placeResults.map(function (p, i) { return '<button class="check place" data-place="' + i + '">' + esc(p.label) + '</button>'; }).join('') +
      '<div class="hint">Værmeldingen kommer fra Meteorologisk institutt (MET Nordic) via Open-Meteo.</div></div></div>';

    // Todoist
    s += '<h3>Todoist</h3><div class="card"><div class="field"><label for="sTodoist">API-token</label>' +
      '<div class="inline"><input type="password" id="sTodoist" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Lim inn Todoist-tokenet" value="' + esc(cfg.todoistToken) + '">' +
      '<button class="btn" data-s="todo-connect">Koble til Todoist</button></div>' +
      '<div class="hint">Finnes i Todoist under Innstillinger → Integrasjoner → Utvikler. Tokenet gir tilgang til hele Todoist-kontoen din og lagres bare på denne iPaden.</div></div>' +
      (todoMsg ? '<div class="status-msg ' + todoMsg.type + '">' + esc(todoMsg.text) + '</div>' : '');
    if (todo.projects.length) {
      s += '<div class="field"><label>Lister som vises på dashbordet</label></div>' + todo.projects.map(function (p) {
        return '<label class="check"><input type="checkbox" data-todo="' + esc(p.id) + '"' + (cfg.todoLists.indexOf(p.id) >= 0 ? ' checked' : '') + '>' + esc(p.name) +
          '<span class="cmeta">' + (p.is_shared ? 'Delt' : '') + '</span></label>';
      }).join('') +
        '<label class="check"><input type="checkbox" id="sTodoToday"' + (cfg.todoToday ? ' checked' : '') + '>Vis oppgaver for i dag og forfalte oppgaver</label>';
    }
    s += '</div>';

    if (connected) {
      // Scenes
      s += '<h3>Scenknapper</h3><p class="lead">Flows som starter med «Denne flowen er startet» kan brukes som knapper.</p><div class="card">';
      if (!state.flows.length) s += '<div class="check">Fant ingen flows som kan startes.</div>';
      state.flows.forEach(function (f) {
        var on = (cfg.scenes || []).some(function (x) { return x.id === f.id; });
        s += '<label class="check"><input type="checkbox" data-flow="' + esc(f.id) + '"' + (on ? ' checked' : '') + '>' + esc(f.name) +
          '<span class="cmeta">' + (f.type === 'advanced' ? 'Avansert flow' : 'Flow') + '</span></label>';
      });
      s += '</div>';

      // Devices
      s += '<h3>Enheter på dashbordet</h3><p class="lead">' + (cfg.shown ? 'Ditt utvalg.' : 'Viser et foreslått utvalg.') +
        ' Søppeltømming vises i midten uansett. <button class="btn small" data-s="all">Velg alle</button> <button class="btn small" data-s="none">Fjern alle</button> <button class="btn small" data-s="auto">Foreslått</button></p>';
      var byZone = {};
      allDevices().forEach(function (d) { (byZone[d.zone] = byZone[d.zone] || []).push(d); });
      zoneOrder().concat(['_none']).forEach(function (zid) {
        var list = byZone[zid];
        if (!list) return;
        list.sort(function (a, b) { return a.name.localeCompare(b.name, LOCALE); });
        var count = list.filter(isShown).length;
        s += '<details class="zone-group card"' + (count ? ' open' : '') + '><summary>' + esc(zoneName(zid)) +
          '<span>' + count + ' av ' + list.length + '</span></summary>';
        list.forEach(function (d) {
          s += '<label class="check"><input type="checkbox" data-dev="' + esc(d.id) + '"' + (isShown(d) ? ' checked' : '') + '>' + esc(d.name) +
            '<span class="cmeta">' + esc(d.class) + '</span></label>';
        });
        s += '</details>';
      });
    }

    s += '<h3>Visning</h3><div class="card">' +
      '<div class="field"><label for="sSort">Sorter enheter etter</label><select id="sSort">' +
      '<option value="type"' + (cfg.sortBy !== 'room' ? ' selected' : '') + '>Type: lys først, så klima, gardiner, låser og sensorer</option>' +
      '<option value="room"' + (cfg.sortBy === 'room' ? ' selected' : '') + '>Rom</option></select></div>' +
      '<div class="field"><label for="sIdle">Skjermsparer etter (minutter uten berøring, 0 = aldri)</label><input type="number" id="sIdle" min="0" max="120" value="' + esc(cfg.idleMin) + '"></div>' +
      '<div class="field"><label>Natt (mørk klokke etter 1 minutt)</label><div class="inline"><input type="time" id="sNightFrom" value="' + esc(cfg.nightFrom) + '"><input type="time" id="sNightTo" value="' + esc(cfg.nightTo) + '"></div></div>' +
      '<label class="check"><input type="checkbox" id="sWeather"' + (cfg.showWeather ? ' checked' : '') + '>Vis vær</label>' +
      '<label class="check"><input type="checkbox" id="sPresence"' + (cfg.showPresence ? ' checked' : '') + '>Vis hvem som er hjemme</label>' +
      '<label class="check"><input type="checkbox" id="s24h"' + (cfg.use24h ? ' checked' : '') + '>24-timersklokke</label>' +
      '<label class="check"><input type="checkbox" id="sLockConfirm"' + (cfg.lockConfirm ? ' checked' : '') + '>Spør før dører låses opp</label>' +
      '<div class="field"><label for="sTopInset">Plass øverst til iPadens statuslinje (piksler – tomt betyr automatisk, ' + (STANDALONE ? '30' : '0') + ')</label>' +
      '<input type="number" id="sTopInset" min="0" max="120" placeholder="Automatisk" value="' + (typeof cfg.topInset === 'number' ? cfg.topInset : '') + '"></div>' +
      '</div>';

    if (connected) {
      s += '<h3>Feilsøking</h3><div class="card"><div class="field"><label for="sDebug">Vis rådata for en enhet (nyttig hvis noe vises feil)</label>' +
        '<select id="sDebug"><option value="">Velg enhet …</option>' + allDevices().sort(function (a, b) { return a.name.localeCompare(b.name, LOCALE); }).map(function (d) {
          return '<option value="' + esc(d.id) + '"' + (d.id === debugId ? ' selected' : '') + '>' + esc(d.name) + '</option>';
        }).join('') + '</select>' + (debugId && state.devices[debugId] ? '<textarea readonly spellcheck="false">' + esc(debugJSON(state.devices[debugId])) + '</textarea>' : '') + '</div></div>';
    }

    s += '<h3>Sikkerhetskopi</h3><div class="card"><div class="field"><label for="sBackup">Innstillingene uten API-nøkkelen – kopier for å ta vare på, lim inn for å gjenopprette</label>' +
      '<textarea id="sBackup" spellcheck="false">' + esc(JSON.stringify(exportable(), null, 1)) + '</textarea>' +
      '<div class="inline"><button class="btn" data-s="import">Gjenopprett fra tekst</button><button class="btn" data-s="reload">Last inn på nytt</button><button class="btn danger" data-s="reset">Nullstill alt</button></div></div></div>';

    $('settingsInner').innerHTML = s;
    $('sAddr').addEventListener('input', function () { $('sResolved').textContent = resolveAddress(this.value) || '…'; });
    $('sPlace').addEventListener('keydown', function (e) { if (e.key === 'Enter') searchPlace(); });
  }

  function debugJSON(d) {
    var caps = {};
    Object.keys(d.capabilitiesObj).forEach(function (c) { var o = d.capabilitiesObj[c]; caps[c] = { title: o.title, value: o.value, units: o.units }; });
    return JSON.stringify({ name: d.name, class: d.class, driverId: d.driverId, capabilities: caps }, null, 1);
  }

  function searchPlace() {
    var q = $('sPlace').value.trim();
    if (!q) return;
    placeMsg = 'Søker …'; placeResults = []; renderSettings();
    fetch('https://geocoding-api.open-meteo.com/v1/search?count=6&language=nb&name=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        placeResults = (j.results || []).map(function (p) {
          return { name: p.name, lat: p.latitude, lon: p.longitude, label: [p.name, p.admin2 || p.admin1, p.country].filter(Boolean).join(', ') };
        });
        placeMsg = placeResults.length ? 'Velg riktig sted:' : 'Fant ingen steder med det navnet.';
        renderSettings();
      })
      .catch(function () { placeMsg = 'Søket feilet. Er iPaden koblet til internett?'; renderSettings(); });
  }

  function exportable() {
    var c = Object.assign({}, cfg); delete c.token; delete c.todoistToken; return c;
  }

  function readDisplayFields() {
    cfg.idleMin = Math.max(0, +$('sIdle').value || 0);
    cfg.nightFrom = $('sNightFrom').value || DEFAULTS.nightFrom;
    cfg.nightTo = $('sNightTo').value || DEFAULTS.nightTo;
    cfg.showWeather = $('sWeather').checked;
    cfg.showPresence = $('sPresence').checked;
    cfg.use24h = $('s24h').checked;
    cfg.lockConfirm = $('sLockConfirm').checked;
    cfg.sortBy = $('sSort').value === 'room' ? 'room' : 'type';
    var ti = $('sTopInset').value.trim();
    cfg.topInset = ti === '' ? null : Math.max(0, Math.min(120, +ti || 0));
    applyTopInset();
  }

  $('settings').addEventListener('change', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-dev')) {
      if (!cfg.shown) cfg.shown = Object.keys(state.devices).filter(function (id) { return autoShown(state.devices[id]); });
      var id = t.getAttribute('data-dev');
      cfg.shown = cfg.shown.filter(function (x) { return x !== id; });
      if (t.checked) cfg.shown.push(id);
      saveConfig();
    } else if (t.hasAttribute('data-flow')) {
      var fid = t.getAttribute('data-flow'), f = state.flows.filter(function (x) { return x.id === fid; })[0];
      cfg.scenes = (cfg.scenes || []).filter(function (x) { return x.id !== fid; });
      if (t.checked && f) cfg.scenes.push(f);
      saveConfig();
    } else if (t.hasAttribute('data-todo')) {
      var pid = t.getAttribute('data-todo');
      cfg.todoLists = cfg.todoLists.filter(function (x) { return x !== pid; });
      if (t.checked) cfg.todoLists.push(pid);
      saveConfig();
    } else if (t.id === 'sTodoToday') {
      cfg.todoToday = t.checked; saveConfig();
    } else if (t.id === 'sDebug') {
      debugId = t.value; renderSettings();
    } else if (t.id && t.id.indexOf('s') === 0 && ['sAddr', 'sToken', 'sBackup', 'sPlace', 'sTodoist'].indexOf(t.id) < 0) {
      readDisplayFields(); saveConfig(); tick();
    }
  });

  $('settings').addEventListener('click', function (e) {
    var pl = e.target.closest('[data-place]');
    if (pl) {
      var p = placeResults[+pl.getAttribute('data-place')];
      cfg.weatherLoc = { name: p.name, lat: p.lat, lon: p.lon };
      saveConfig(); placeResults = []; placeMsg = ''; renderSettings(); loadForecast();
      return;
    }
    var b = e.target.closest('[data-s]');
    if (!b) return;
    var a = b.getAttribute('data-s');
    if (a === 'done') { readDisplayFields(); saveConfig(); closeSettings(); }
    if (a === 'place-search') searchPlace();
    if (a === 'todo-connect') {
      cfg.todoistToken = $('sTodoist').value.trim(); saveConfig();
      if (!cfg.todoistToken) { todoMsg = null; todo = { projects: [], lists: {}, today: [], error: '', loaded: false }; renderSettings(); return; }
      todoMsg = { type: 'ok', text: 'Kobler til Todoist …' }; renderSettings();
      loadTodo().then(function () {
        todoMsg = todo.error ? { type: 'err', text: todo.error + '. Sjekk at hele tokenet er kopiert.' }
          : { type: 'ok', text: 'Tilkoblet – fant ' + todo.projects.length + ' prosjekter. Kryss av for listene du vil se.' };
        renderSettings();
      });
    }
    if (a === 'place-homey') { cfg.weatherLoc = null; saveConfig(); renderSettings(); loadForecast(); }
    if (a === 'connect') {
      cfg.address = $('sAddr').value.trim();
      cfg.token = $('sToken').value.trim();
      cfg.demo = false;
      saveConfig();
      if (!cfg.address || !cfg.token) { settingsMsg = { type: 'err', html: 'Skriv inn både IP-adressen og API-nøkkelen.' }; return renderSettings(); }
      settingsMsg = { type: 'ok', html: 'Kobler til …' }; renderSettings();
      start().then(function () {
        settingsMsg = { type: 'ok', html: 'Tilkoblet – fant ' + Object.keys(state.devices).length + ' enheter og ' + state.flows.length + ' flows som kan startes. Velg hva som skal vises nedenfor.' };
        renderSettings();
      }).catch(function (err) { settingsMsg = { type: 'err', html: connectErrorHTML(err) }; renderSettings(); });
    }
    if (a === 'demo') {
      cfg.demo = !cfg.demo; saveConfig();
      if (cfg.demo) {
        cfg.scenes = []; cfg.shown = null;
        start().then(function () {
          cfg.scenes = state.flows.slice(); saveConfig();
          settingsMsg = { type: 'ok', html: 'Demomodus er på, med eksempelenheter. Trykk Ferdig for å se deg rundt.' }; renderSettings();
        });
      } else { backend = null; state.devices = {}; state.flows = []; state.users = []; state.weather = null; state.forecast = null; cfg.scenes = []; cfg.shown = null; demoTodo = null; saveConfig(); settingsMsg = null; loadTodo(); renderSettings(); }
    }
    if (a === 'all' || a === 'none' || a === 'auto') {
      cfg.shown = a === 'auto' ? null : a === 'all' ? Object.keys(state.devices) : [];
      saveConfig(); renderSettings();
    }
    if (a === 'import') {
      try {
        var obj = JSON.parse($('sBackup').value);
        var token = cfg.token, tdt = cfg.todoistToken;
        cfg = Object.assign({}, DEFAULTS, obj, { token: token, todoistToken: tdt });
        saveConfig(); settingsMsg = { type: 'ok', html: 'Innstillingene er gjenopprettet.' }; renderSettings();
      } catch (err) { settingsMsg = { type: 'err', html: 'Teksten er ikke gyldige innstillinger.' }; renderSettings(); }
    }
    if (a === 'reload') location.reload();
    if (a === 'reset') {
      confirmBox('Fjerne alle innstillinger, også API-nøkkelen, fra denne iPaden?', 'Nullstill').then(function (ok) {
        if (!ok) return;
        try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
        location.reload();
      });
    }
  });

  function connectErrorHTML(err) {
    var msg = esc(err && err.message || String(err));
    var addr = esc(resolveAddress(cfg.address));
    if (/No Homey Found/i.test(msg)) return 'Noe svarte på <code>' + addr + '</code>, men det er ikke en Homey. Sjekk IP-adressen.';
    if (/401|403|unauthori|forbidden|invalid token|missing scope/i.test(msg)) return 'Homey avviste API-nøkkelen (' + msg + '). Sjekk at hele nøkkelen er kopiert, og at den har tillatelsene som står i README.';
    return 'Fikk ikke kontakt med Homey på <code>' + addr + '</code> (' + msg + ').<br>Sjekk at iPaden er på samme wifi som Homey, at IP-adressen stemmer, og prøv å åpne <code>' +
      addr + '/api/manager/system/ping</code> i Safari – da skal du få et kort svar.';
  }

  // ---------------------------------------------------------------- startup
  function setConn(s) { state.connected = s === 'ok'; $('conn').className = 'conn ' + (s === 'ok' ? 'ok' : s === 'bad' ? 'bad' : ''); }

  function loadExtras() {
    backend.users().then(function (u) { state.users = u; renderPresence(); }).catch(function () { state.users = []; renderPresence(); });
    backend.weather().then(function (w) { state.weather = w; renderWeather(); }).catch(function () { state.weather = null; renderWeather(); });
    loadForecast();
    loadTodo();
  }

  function applyFresh(devs) {
    Object.keys(devs || {}).forEach(function (id) {
      var fresh = snapshot(devs[id]), cur = state.devices[id];
      if (!cur) { state.devices[id] = fresh; return; }
      cur.available = fresh.available; cur.name = fresh.name; cur.zone = fresh.zone;
      Object.keys(fresh.capabilitiesObj).forEach(function (c) { if (cur.capabilitiesObj[c]) cur.capabilitiesObj[c].value = fresh.capabilitiesObj[c].value; });
    });
    if (!dragging && $('settings').hidden) { renderRooms(); renderChips(); }
  }

  var generation = 0;
  function start() {
    var gen = ++generation;
    if (cfg.demo) backend = new window.DemoBackend();
    else backend = new HomeyBackend(resolveAddress(cfg.address), cfg.token);
    var b = backend;
    b.onStatus(setConn);
    b.onReconnect = function () { b.refresh().then(applyFresh).catch(function () {}); loadExtras(); };
    setConn('');
    return b.init()
      .then(function () { return Promise.all([b.zones(), b.devices(), b.flows().catch(function () { return []; })]); })
      .then(function (r) {
        if (gen !== generation) return;
        state.zones = r[0] || {};
        state.devices = {};
        Object.keys(r[1] || {}).forEach(function (id) { state.devices[id] = snapshot(r[1][id]); });
        state.flows = r[2] || [];
        // Drop scenes whose flows no longer exist.
        var ids = state.flows.map(function (f) { return f.id; });
        cfg.scenes = (cfg.scenes || []).filter(function (s) { return ids.indexOf(s.id) >= 0; });
        renderAll();
        // Live updates for every capability of every device, so nothing needs a reconnect.
        Object.keys(state.devices).forEach(function (id) {
          Object.keys(state.devices[id].capabilitiesObj).forEach(function (c) {
            b.watch(id, c, function (v) {
              if (gen !== generation || !state.devices[id]) return;
              state.devices[id].capabilitiesObj[c].value = v;
              updateTile(id);
              renderChips();
            });
          });
        });
        loadExtras();
      })
      .catch(function (err) {
        if (gen === generation) { backend = null; setConn('bad'); renderAll(); }
        throw err;
      });
  }

  // Safety net: refresh values every 2 minutes and when the iPad wakes, in case a socket event was missed.
  setInterval(function () {
    if (backend && backend.refresh && !document.hidden) backend.refresh().then(applyFresh).catch(function () { setConn('bad'); });
    if (backend && !document.hidden && todoActive()) loadTodo();
  }, 120000);
  setInterval(function () { if (backend) loadExtras(); }, 15 * 60000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
      if (backend) backend.refresh().then(applyFresh).catch(function () {});
    }
  });
  // Re-check whether the room pills overflow after rotating the iPad.
  window.addEventListener('resize', function () { if (backend) renderRoomBar(); });

  ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, activity, { capture: true, passive: true }); });

  applyTopInset();
  tick();
  renderSaverSub();
  setInterval(tick, 1000);
  renderAll();
  if (cfg.demo || (cfg.address && cfg.token)) {
    start().catch(function (err) { toast('Fikk ikke kontakt med Homey – hold inne tannhjulet for å sjekke innstillingene. (' + (err && err.message || err) + ')', true); });
  }
})();

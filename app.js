/* Home Panel — a wall dashboard for Homey Pro, talking directly to Homey's local API. */
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
    use24h: true
  };

  function loadConfig() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return Object.assign({}, DEFAULTS, raw ? JSON.parse(raw) : {});
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function saveConfig() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); }
    catch (e) { toast('Could not save settings on this device', true); }
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
    return v.toLocaleString(undefined, { maximumFractionDigits: digits == null ? 1 : digits, minimumFractionDigits: 0 });
  }
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

  // ---------------------------------------------------------------- icons
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
    cloud: '<path d="M7 18h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 10.6 3.8 3.8 0 0 0 7 18z"/>',
    rain: '<path d="M7 15h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 7.6 3.8 3.8 0 0 0 7 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    snow: '<path d="M7 15h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 7.6 3.8 3.8 0 0 0 7 15zM8 19h.01M12 20h.01M16 19h.01"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>'
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
    if (!window.HomeyAPI) return Promise.reject(new Error('The Homey library did not load (vendor/homey-api.min.js missing).'));
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
      return pick(r[0], 'basic').concat(pick(r[1], 'advanced')).sort(function (a, b) { return a.name.localeCompare(b.name); });
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
  var state = { zones: {}, devices: {}, flows: [], users: [], weather: null, connected: false };
  var WATCH = ['onoff', 'dim', 'measure_temperature', 'target_temperature', 'measure_humidity', 'alarm_contact',
    'alarm_motion', 'alarm_water', 'alarm_smoke', 'alarm_co', 'alarm_tamper', 'locked', 'measure_power',
    'windowcoverings_set', 'windowcoverings_state', 'measure_luminance', 'measure_co2', 'alarm_battery', 'volume_mute'];

  function snapshot(d) {
    var co = {};
    Object.keys(d.capabilitiesObj || {}).forEach(function (k) {
      var c = d.capabilitiesObj[k] || {};
      co[k] = { value: c.value, units: c.units, min: c.min, max: c.max, step: c.step, title: c.title, decimals: c.decimals, setable: c.setable };
    });
    return { id: d.id, name: d.name, zone: d.zone, class: d.virtualClass || d.class, capabilities: d.capabilities || Object.keys(co), capabilitiesObj: co, available: d.available !== false };
  }
  function has(d, c) { return d.capabilitiesObj && d.capabilitiesObj[c] !== undefined; }
  function val(d, c) { return has(d, c) ? d.capabilitiesObj[c].value : undefined; }

  // Which devices show up automatically before the user picks.
  function autoShown(d) {
    if (['light', 'thermostat', 'lock', 'windowcoverings', 'blinds', 'curtain', 'heater', 'socket', 'fan'].indexOf(d.class) >= 0) return true;
    return has(d, 'measure_temperature') || has(d, 'alarm_contact') || has(d, 'alarm_motion') || has(d, 'alarm_water');
  }
  function isShown(d) { return cfg.shown ? cfg.shown.indexOf(d.id) >= 0 : autoShown(d); }

  // ---------------------------------------------------------------- tile model
  function kind(d) {
    if (has(d, 'target_temperature')) return 'thermostat';
    if (has(d, 'locked')) return 'lock';
    if (has(d, 'windowcoverings_set') || has(d, 'windowcoverings_state')) return 'cover';
    if (has(d, 'onoff')) return 'switch';
    if (has(d, 'dim')) return 'dimmer';
    return 'sensor';
  }
  function deviceIcon(d) {
    var c = d.class;
    if (c === 'light') return 'bulb';
    if (c === 'socket') return has(d, 'measure_power') ? 'plug' : 'plug';
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

  // Returns { cls, big, state, corner, bar }
  function describe(d) {
    var k = kind(d), out = { cls: '', big: '', state: '', corner: '', bar: null };
    var alarm = ['alarm_water', 'alarm_smoke', 'alarm_co', 'alarm_tamper'].filter(function (a) { return val(d, a) === true; });
    if (k === 'switch' || k === 'dimmer') {
      var on = k === 'switch' ? !!val(d, 'onoff') : val(d, 'dim') > 0;
      out.cls = on ? 'on' : '';
      out.state = on ? (has(d, 'dim') ? Math.round(val(d, 'dim') * 100) + '%' : 'On') : 'Off';
      if (on && has(d, 'dim')) out.bar = val(d, 'dim');
      if (has(d, 'measure_power')) out.corner = fmtNum(val(d, 'measure_power'), 0) + ' ' + unit(d, 'measure_power', 'W');
      else if (has(d, 'measure_temperature')) out.corner = fmtNum(val(d, 'measure_temperature')) + '°';
    } else if (k === 'thermostat') {
      var t = val(d, 'measure_temperature'), target = val(d, 'target_temperature');
      out.big = t != null ? fmtNum(t) + '<small>°</small>' : fmtNum(target) + '<small>°</small>';
      out.state = 'Set to ' + fmtNum(target) + '°' + (val(d, 'onoff') === false ? ' · off' : '');
      if (typeof t === 'number' && typeof target === 'number' && target > t + 0.2 && val(d, 'onoff') !== false) { out.cls = 'heat'; out.state = 'Heating to ' + fmtNum(target) + '°'; }
    } else if (k === 'lock') {
      var locked = val(d, 'locked');
      out.state = locked ? 'Locked' : 'Unlocked';
      out.cls = locked ? '' : 'alert';
    } else if (k === 'cover') {
      var pos = val(d, 'windowcoverings_set'), mv = val(d, 'windowcoverings_state');
      out.state = mv === 'up' ? 'Opening…' : mv === 'down' ? 'Closing…' : (typeof pos === 'number' ? (pos >= 0.99 ? 'Open' : pos <= 0.01 ? 'Closed' : Math.round(pos * 100) + '% open') : 'Idle');
      if (typeof pos === 'number') out.bar = pos;
    } else {
      if (has(d, 'measure_temperature')) {
        out.big = fmtNum(val(d, 'measure_temperature')) + '<small>°</small>';
        if (has(d, 'measure_humidity')) out.state = fmtNum(val(d, 'measure_humidity'), 0) + '% humidity';
      } else if (has(d, 'measure_power')) {
        out.big = fmtNum(val(d, 'measure_power'), 0) + '<small>' + esc(unit(d, 'measure_power', 'W')) + '</small>';
      } else if (has(d, 'measure_co2')) {
        out.big = fmtNum(val(d, 'measure_co2'), 0) + '<small>ppm</small>';
      }
      if (has(d, 'alarm_contact')) { var open = !!val(d, 'alarm_contact'); out.state = open ? 'Open' : 'Closed'; if (open) out.cls = 'alert'; }
      if (has(d, 'alarm_motion')) { var m = !!val(d, 'alarm_motion'); if (!has(d, 'alarm_contact')) out.state = m ? 'Motion' : 'Clear'; if (m) out.cls = 'cool'; }
      if (has(d, 'measure_luminance') && !out.big) out.corner = fmtNum(val(d, 'measure_luminance'), 0) + ' lx';
      if (!out.state && !out.big && has(d, 'alarm_water')) out.state = 'Dry';
    }
    if (alarm.length) { out.cls = 'alert'; out.state = alarm.map(function (a) { return { alarm_water: 'Water!', alarm_smoke: 'Smoke!', alarm_co: 'CO!', alarm_tamper: 'Tampered' }[a]; }).join(' '); }
    if (val(d, 'alarm_battery') === true && !out.corner) out.corner = 'Low battery';
    return out;
  }

  function tileHTML(d) {
    var x = describe(d);
    return '<button class="tile ' + x.cls + (d.available ? '' : ' offline') + '" data-id="' + esc(d.id) + '">' +
      '<div class="t-top"><span class="t-icon">' + icon(deviceIcon(d)) + '</span><span class="t-value">' + esc(x.corner) + '</span></div>' +
      '<div>' + (x.big ? '<div class="t-big">' + x.big + '</div>' : '') +
      '<div class="t-name">' + esc(d.name) + '</div>' +
      '<div class="t-state">' + esc(d.available ? x.state : 'Unavailable') + '</div></div>' +
      (x.bar != null ? '<span class="t-bar" style="width:' + Math.round(x.bar * 100) + '%"></span>' : '') +
      '</button>';
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
      (children[p] || []).sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); })
        .forEach(function (z) { out.push(z.id); walk(z.id); });
    }
    walk('_root');
    Object.keys(zones).forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
    return out;
  }

  function shownDevices() {
    return Object.keys(state.devices).map(function (k) { return state.devices[k]; }).filter(isShown);
  }

  function renderRooms() {
    var rooms = $('rooms'), byZone = {};
    shownDevices().forEach(function (d) { (byZone[d.zone] = byZone[d.zone] || []).push(d); });
    var html = '';
    zoneOrder().concat(['_none']).forEach(function (zid) {
      var list = byZone[zid];
      if (!list || !list.length) return;
      if (cfg.shown) list.sort(function (a, b) { return cfg.shown.indexOf(a.id) - cfg.shown.indexOf(b.id); });
      else list.sort(function (a, b) { return kindRank(a) - kindRank(b) || a.name.localeCompare(b.name); });
      var z = state.zones[zid];
      html += '<section class="room" data-zone="' + esc(zid) + '"><div class="room-head"><span class="room-name">' +
        esc(z ? z.name : 'Other') + '</span><span class="room-meta">' + roomMeta(list) + '</span></div><div class="tiles">' +
        list.map(tileHTML).join('') + '</div></section>';
    });
    if (!html) {
      html = '<div class="empty"><strong>' + (backend ? 'No devices selected' : 'Not connected yet') + '</strong>' +
        (backend ? 'Hold the gear icon (top right) to choose devices.' : 'Hold the gear icon (top right) for 1 second to connect your Homey, or try demo mode.') + '</div>';
    }
    rooms.innerHTML = '<div class="rooms-cols">' + html + '</div>';
  }
  function kindRank(d) { return { switch: 0, dimmer: 0, thermostat: 1, cover: 2, lock: 3, sensor: 4 }[kind(d)]; }
  function roomMeta(list) {
    var temps = list.filter(function (d) { return typeof val(d, 'measure_temperature') === 'number'; });
    if (!temps.length) return '';
    var t = temps.reduce(function (s, d) { return s + val(d, 'measure_temperature'); }, 0) / temps.length;
    return fmtNum(t) + '°';
  }

  function updateTile(id) {
    var d = state.devices[id];
    var el = document.querySelector('.tile[data-id="' + cssEsc(id) + '"]');
    if (el && d) {
      var tmp = document.createElement('div');
      tmp.innerHTML = tileHTML(d);
      el.replaceWith(tmp.firstChild);
      var room = document.querySelector('.room[data-zone="' + cssEsc(d.zone) + '"] .room-meta');
      if (room) {
        var list = shownDevices().filter(function (x) { return x.zone === d.zone; });
        room.textContent = roomMeta(list);
      }
    }
    if (sheetId === id && !dragging && !sheetTouch) renderSheet();
  }
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'); }

  function renderScenes() {
    var el = $('scenes');
    el.innerHTML = (cfg.scenes || []).map(function (f, i) {
      return '<button class="scene" data-scene="' + i + '">' + icon('play') + esc(f.name) + '</button>';
    }).join('');
  }

  function renderChips() {
    var list = shownDevices(), html = '';
    var lightsOn = list.filter(function (d) { return d.class === 'light' && val(d, 'onoff') === true; });
    var open = list.filter(function (d) { return val(d, 'alarm_contact') === true; });
    var unlocked = list.filter(function (d) { return val(d, 'locked') === false; });
    var alarms = list.filter(function (d) { return val(d, 'alarm_water') || val(d, 'alarm_smoke') || val(d, 'alarm_co'); });
    if (alarms.length) html += '<span class="chip alert">' + icon('smoke') + alarms.length + ' alarm' + (alarms.length > 1 ? 's' : '') + '</span>';
    if (open.length) html += '<span class="chip alert">' + icon('doorOpen') + open.length + ' open</span>';
    if (unlocked.length) html += '<span class="chip alert">' + icon('unlock') + unlocked.length + ' unlocked</span>';
    html += '<button class="chip' + (lightsOn.length ? ' warm' : '') + '" id="allOff">' + icon('bulb') +
      (lightsOn.length ? lightsOn.length + ' on' : 'All off') + '</button>';
    $('chips').innerHTML = backend ? html : '';
  }

  function renderPresence() {
    var el = $('presence');
    if (!cfg.showPresence || !state.users.length) { el.innerHTML = ''; return; }
    el.innerHTML = state.users.map(function (u) {
      return '<span class="avatar' + (u.present ? ' home' : '') + (u.asleep ? ' asleep' : '') + '" title="' + esc(u.name) + (u.present ? ' — home' : ' — away') + '">' + esc(initials(u.name)) + '</span>';
    }).join('');
  }

  function weatherIcon(s) {
    s = String(s || '').toLowerCase();
    if (/snow|sleet/.test(s)) return 'snow';
    if (/rain|drizzle|shower|thunder/.test(s)) return 'rain';
    if (/cloud|overcast|fog|mist/.test(s)) return 'cloud';
    return isNight() ? 'moon' : 'sun';
  }
  function renderWeather() {
    var w = state.weather, el = $('weather');
    if (!cfg.showWeather || !w || typeof w.temperature !== 'number') { el.hidden = true; return; }
    el.hidden = false;
    var sub = w.state ? String(w.state).replace(/_/g, ' ') : 'Outside';
    el.innerHTML = icon(weatherIcon(w.state)) + '<div><div class="w-temp">' + fmtNum(w.temperature) + '°</div><div class="w-sub">' + esc(sub) + '</div></div>';
  }

  function renderAll() { renderChips(); renderPresence(); renderWeather(); renderScenes(); renderRooms(); }

  // ---------------------------------------------------------------- clock
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function timeStr(d) {
    if (cfg.use24h) return pad(d.getHours()) + ':' + pad(d.getMinutes());
    var h = d.getHours() % 12 || 12;
    return h + ':' + pad(d.getMinutes());
  }
  function tick() {
    var now = new Date();
    $('time').textContent = timeStr(now);
    var ds = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    $('date').textContent = ds;
    $('saverTime').textContent = timeStr(now);
    $('saverSub').textContent = ds + (state.weather && typeof state.weather.temperature === 'number' && cfg.showWeather ? ' · ' + fmtNum(state.weather.temperature) + '°' : '');
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
    var idleLimit = isNight() ? Math.min(cfg.idleMin || 1, 1) : cfg.idleMin;
    if (!idleLimit || !$('settings').hidden || !$('sheetBackdrop').hidden) return;
    if (Date.now() - lastActivity > idleLimit * 60000) $('saver').hidden = false;
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
    if (!d) return Promise.resolve();
    var prev = val(d, capId);
    d.capabilitiesObj[capId].value = value;   // optimistic update
    updateTile(id); renderChips();
    var el = document.querySelector('.tile[data-id="' + cssEsc(id) + '"]');
    if (el) el.classList.add('busy');
    return backend.setCapability(id, capId, value).catch(function (err) {
      d.capabilitiesObj[capId].value = prev;
      toast('Could not update ' + d.name + ': ' + (err && err.message || err), true);
    }).then(function () { updateTile(id); renderChips(); });
  }

  function primaryAction(d) {
    var k = kind(d);
    if (!d.available) return toast(d.name + ' is unavailable', true);
    if (k === 'switch') return setCap(d.id, 'onoff', !val(d, 'onoff'));
    if (k === 'lock') {
      var locked = val(d, 'locked');
      if (locked && cfg.lockConfirm) {
        return confirmBox('Unlock ' + d.name + '?', 'Unlock').then(function (ok) { if (ok) setCap(d.id, 'locked', false); });
      }
      return setCap(d.id, 'locked', !locked);
    }
    if (k === 'sensor') return openSheet(d.id);
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
    backend.trigger(f).then(function () { toast(f.name + ' started'); })
      .catch(function (err) { toast('Could not start ' + f.name + ': ' + (err && err.message || err), true); })
      .then(function () { setTimeout(function () { b.classList.remove('fired'); }, 1200); });
  });

  $('chips').addEventListener('click', function (e) {
    if (!e.target.closest('#allOff')) return;
    var on = shownDevices().filter(function (d) { return d.class === 'light' && val(d, 'onoff') === true; });
    if (!on.length) return toast('All lights are already off');
    confirmBox('Turn off ' + on.length + ' light' + (on.length > 1 ? 's' : '') + '?', 'Turn off').then(function (ok) {
      if (ok) on.forEach(function (d) { setCap(d.id, 'onoff', false); });
    });
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
    measure_temperature: 'Temperature', measure_humidity: 'Humidity', measure_power: 'Power', measure_luminance: 'Light level',
    measure_co2: 'CO₂', measure_battery: 'Battery', meter_power: 'Energy used', alarm_contact: 'Contact', alarm_motion: 'Motion',
    alarm_water: 'Water', alarm_smoke: 'Smoke', alarm_battery: 'Battery', alarm_tamper: 'Tamper', target_temperature: 'Target'
  };
  function readable(d, c) {
    var v = val(d, c);
    if (typeof v === 'boolean') {
      if (c === 'alarm_contact') return v ? 'Open' : 'Closed';
      if (c === 'alarm_motion') return v ? 'Motion' : 'Clear';
      if (c.indexOf('alarm_') === 0) return v ? 'Alarm' : 'OK';
      return v ? 'Yes' : 'No';
    }
    if (typeof v === 'number') return fmtNum(v, c === 'meter_power' ? 2 : 1) + ' ' + unit(d, c, c === 'measure_battery' ? '%' : '');
    return v == null ? '–' : String(v);
  }

  function renderSheet() {
    var d = state.devices[sheetId];
    if (!d) return closeSheet();
    var z = state.zones[d.zone], k = kind(d), h = '';
    h += '<h2>' + esc(d.name) + '</h2><div class="sub">' + esc(z ? z.name : '') + (d.available ? '' : ' · unavailable') + '</div>';
    if (has(d, 'onoff')) {
      var on = !!val(d, 'onoff');
      h += '<button class="big-toggle' + (on ? ' on' : '') + '" data-act="toggle">' + (on ? 'On' : 'Off') + '</button>';
    }
    if (has(d, 'dim')) {
      var dim = Math.round((val(d, 'dim') || 0) * 100);
      h += '<div class="slider-wrap"><div class="slabel"><span>Brightness</span><b id="dimVal">' + dim + '%</b></div>' +
        '<input type="range" min="0" max="100" step="1" value="' + dim + '" data-act="dim"></div>';
    }
    if (k === 'thermostat') {
      var c = d.capabilitiesObj.target_temperature;
      h += '<div class="stepper"><button data-act="tminus" aria-label="Lower">−</button><div class="sval" id="tVal">' +
        fmtNum(c.value) + '<small>°</small></div><button data-act="tplus" aria-label="Higher">+</button></div>';
    }
    if (k === 'cover') {
      if (has(d, 'windowcoverings_state')) {
        h += '<div class="btn-row"><button class="btn" data-act="cover-up">' + icon('up') + 'Open</button><button class="btn" data-act="cover-idle">' +
          icon('stop') + 'Stop</button><button class="btn" data-act="cover-down">' + icon('down') + 'Close</button></div>';
      }
      if (has(d, 'windowcoverings_set')) {
        var pos = Math.round((val(d, 'windowcoverings_set') || 0) * 100);
        h += '<div class="slider-wrap"><div class="slabel"><span>Position</span><b id="posVal">' + pos + '% open</b></div>' +
          '<input type="range" min="0" max="100" step="1" value="' + pos + '" data-act="pos"></div>';
      }
    }
    if (k === 'lock') {
      var locked = !!val(d, 'locked');
      h += '<button class="big-toggle' + (locked ? '' : ' on') + '" data-act="lock">' + (locked ? 'Locked — tap to unlock' : 'Unlocked — tap to lock') + '</button>';
    }
    var rows = Object.keys(d.capabilitiesObj).filter(function (cId) {
      return LABELS[cId] && !(cId === 'target_temperature');
    });
    if (rows.length) {
      h += '<div>' + rows.map(function (cId) {
        return '<div class="row"><span class="label">' + esc(d.capabilitiesObj[cId].title || LABELS[cId]) + '</span><span class="val">' + esc(readable(d, cId)) + '</span></div>';
      }).join('') + '</div>';
    }
    h += '<div class="close-row"><button class="btn" data-act="close">Close</button></div>';
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
    if (act === 'dim') { $('dimVal').textContent = Math.round(v * 100) + '%'; throttledSend(d.id, 'dim', v); }
    if (act === 'pos') { $('posVal').textContent = Math.round(v * 100) + '% open'; throttledSend(d.id, 'windowcoverings_set', v); }
  });
  $('sheet').addEventListener('change', function () { setTimeout(function () { dragging = false; }, 600); });

  // ---------------------------------------------------------------- settings
  (function () {
    var btn = $('settingsBtn'), t = null;
    function start(e) { e.preventDefault(); btn.classList.add('holding'); t = setTimeout(function () { btn.classList.remove('holding'); openSettings(); }, 900); }
    function stop() { clearTimeout(t); btn.classList.remove('holding'); }
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', function () { if (t && btn.classList.contains('holding')) toast('Hold the gear for 1 second to open settings'); stop(); });
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);
  })();

  var settingsMsg = null;
  function openSettings() { $('settings').hidden = false; renderSettings(); }
  function closeSettings() { $('settings').hidden = true; settingsMsg = null; renderAll(); }

  function renderSettings() {
    var s = '', connected = !!backend;
    s += '<div class="settings-bar"><h1>Settings</h1><button class="btn primary" data-s="done">Done</button></div>';

    s += '<h3>Connect to Homey</h3><div class="card">' +
      '<div class="field"><label for="sAddr">Homey IP address</label><input type="text" id="sAddr" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="192.168.1.50" value="' + esc(cfg.address) + '">' +
      '<div class="hint">Find it in the Homey app: Settings → General → Network. Will connect to <code id="sResolved">' + esc(resolveAddress(cfg.address) || '…') + '</code></div></div>' +
      '<div class="field"><label for="sToken">API key</label><input type="password" id="sToken" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Paste your API key" value="' + esc(cfg.token) + '">' +
      '<div class="hint">Create one at my.homey.app → Settings → API Keys. Stored only on this iPad.</div></div>' +
      '<div class="field"><div class="inline"><button class="btn primary" data-s="connect">Connect</button><button class="btn" data-s="demo">' + (cfg.demo ? 'Demo mode is on' : 'Try demo mode') + '</button></div></div></div>';
    if (settingsMsg) s += '<div class="status-msg ' + settingsMsg.type + '">' + settingsMsg.html + '</div>';

    if (connected) {
      // Scenes
      s += '<h3>Scene buttons</h3><p class="lead">Flows that start with "This flow is started" can be used as buttons.</p><div class="card">';
      if (!state.flows.length) s += '<div class="check">No startable flows found.</div>';
      state.flows.forEach(function (f) {
        var on = (cfg.scenes || []).some(function (x) { return x.id === f.id; });
        s += '<label class="check"><input type="checkbox" data-flow="' + esc(f.id) + '"' + (on ? ' checked' : '') + '>' + esc(f.name) +
          '<span class="cmeta">' + (f.type === 'advanced' ? 'Advanced flow' : 'Flow') + '</span></label>';
      });
      s += '</div>';

      // Devices
      s += '<h3>Devices on the dashboard</h3><p class="lead">' + (cfg.shown ? 'Your selection.' : 'Showing a suggested selection.') +
        ' <button class="btn small" data-s="all">Select all</button> <button class="btn small" data-s="none">Clear</button> <button class="btn small" data-s="auto">Suggested</button></p>';
      var byZone = {};
      Object.keys(state.devices).forEach(function (id) { var d = state.devices[id]; (byZone[d.zone] = byZone[d.zone] || []).push(d); });
      zoneOrder().concat(['_none']).forEach(function (zid) {
        var list = byZone[zid];
        if (!list) return;
        list.sort(function (a, b) { return a.name.localeCompare(b.name); });
        var count = list.filter(isShown).length;
        s += '<details class="zone-group card"' + (count ? ' open' : '') + '><summary>' + esc(state.zones[zid] ? state.zones[zid].name : 'Other') +
          '<span>' + count + ' of ' + list.length + '</span></summary>';
        list.forEach(function (d) {
          s += '<label class="check"><input type="checkbox" data-dev="' + esc(d.id) + '"' + (isShown(d) ? ' checked' : '') + '>' + esc(d.name) +
            '<span class="cmeta">' + esc(d.class) + '</span></label>';
        });
        s += '</details>';
      });
    }

    s += '<h3>Display</h3><div class="card">' +
      '<div class="field"><label for="sIdle">Screensaver after (minutes idle, 0 = never)</label><input type="number" id="sIdle" min="0" max="120" value="' + esc(cfg.idleMin) + '"></div>' +
      '<div class="field"><label>Night hours (dark clock after 1 minute idle)</label><div class="inline"><input type="time" id="sNightFrom" value="' + esc(cfg.nightFrom) + '"><input type="time" id="sNightTo" value="' + esc(cfg.nightTo) + '"></div></div>' +
      '<label class="check"><input type="checkbox" id="sWeather"' + (cfg.showWeather ? ' checked' : '') + '>Show weather</label>' +
      '<label class="check"><input type="checkbox" id="sPresence"' + (cfg.showPresence ? ' checked' : '') + '>Show who is home</label>' +
      '<label class="check"><input type="checkbox" id="s24h"' + (cfg.use24h ? ' checked' : '') + '>24-hour clock</label>' +
      '<label class="check"><input type="checkbox" id="sLockConfirm"' + (cfg.lockConfirm ? ' checked' : '') + '>Ask before unlocking locks</label>' +
      '</div>';

    s += '<h3>Backup</h3><div class="card"><div class="field"><label for="sBackup">Settings without the API key — copy to keep, paste to restore</label>' +
      '<textarea id="sBackup" spellcheck="false">' + esc(JSON.stringify(exportable(), null, 1)) + '</textarea>' +
      '<div class="inline"><button class="btn" data-s="import">Restore from text</button><button class="btn" data-s="reload">Reload dashboard</button><button class="btn danger" data-s="reset">Reset everything</button></div></div></div>';

    $('settingsInner').innerHTML = s;
    $('sAddr').addEventListener('input', function () { $('sResolved').textContent = resolveAddress(this.value) || '…'; });
  }

  function exportable() {
    var c = Object.assign({}, cfg); delete c.token; return c;
  }

  function readDisplayFields() {
    cfg.idleMin = Math.max(0, +$('sIdle').value || 0);
    cfg.nightFrom = $('sNightFrom').value || DEFAULTS.nightFrom;
    cfg.nightTo = $('sNightTo').value || DEFAULTS.nightTo;
    cfg.showWeather = $('sWeather').checked;
    cfg.showPresence = $('sPresence').checked;
    cfg.use24h = $('s24h').checked;
    cfg.lockConfirm = $('sLockConfirm').checked;
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
    } else if (t.id && t.id.indexOf('s') === 0 && ['sAddr', 'sToken', 'sBackup'].indexOf(t.id) < 0) {
      readDisplayFields(); saveConfig(); tick();
    }
  });

  $('settings').addEventListener('click', function (e) {
    var b = e.target.closest('[data-s]');
    if (!b) return;
    var a = b.getAttribute('data-s');
    if (a === 'done') { readDisplayFields(); saveConfig(); closeSettings(); }
    if (a === 'connect') {
      cfg.address = $('sAddr').value.trim();
      cfg.token = $('sToken').value.trim();
      cfg.demo = false;
      saveConfig();
      if (!cfg.address || !cfg.token) { settingsMsg = { type: 'err', html: 'Enter both the IP address and the API key.' }; return renderSettings(); }
      settingsMsg = { type: 'ok', html: 'Connecting…' }; renderSettings();
      start().then(function () {
        settingsMsg = { type: 'ok', html: 'Connected — found ' + Object.keys(state.devices).length + ' devices and ' + state.flows.length + ' startable flows. Choose what to show below.' };
        renderSettings();
      }).catch(function (err) { settingsMsg = { type: 'err', html: connectErrorHTML(err) }; renderSettings(); });
    }
    if (a === 'demo') {
      cfg.demo = !cfg.demo; saveConfig();
      if (cfg.demo) {
        cfg.scenes = []; cfg.shown = null;
        start().then(function () {
          cfg.scenes = state.flows.slice(); saveConfig();
          settingsMsg = { type: 'ok', html: 'Demo mode is on, with sample devices. Tap Done to look around.' }; renderSettings();
        });
      } else { backend = null; state.devices = {}; state.flows = []; state.users = []; state.weather = null; cfg.scenes = []; cfg.shown = null; saveConfig(); settingsMsg = null; renderSettings(); }
    }
    if (a === 'all' || a === 'none' || a === 'auto') {
      cfg.shown = a === 'auto' ? null : a === 'all' ? Object.keys(state.devices) : [];
      saveConfig(); renderSettings();
    }
    if (a === 'import') {
      try {
        var obj = JSON.parse($('sBackup').value);
        var token = cfg.token;
        cfg = Object.assign({}, DEFAULTS, obj, { token: token });
        saveConfig(); settingsMsg = { type: 'ok', html: 'Settings restored.' }; renderSettings();
      } catch (err) { settingsMsg = { type: 'err', html: 'That text is not valid settings JSON.' }; renderSettings(); }
    }
    if (a === 'reload') location.reload();
    if (a === 'reset') {
      confirmBox('Remove all settings, including the API key, from this iPad?', 'Reset').then(function (ok) {
        if (!ok) return;
        try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
        location.reload();
      });
    }
  });

  function connectErrorHTML(err) {
    var msg = esc(err && err.message || String(err));
    var addr = esc(resolveAddress(cfg.address));
    if (/No Homey Found/i.test(msg)) return 'Something answered at <code>' + addr + '</code>, but it is not a Homey. Check the IP address.';
    if (/401|403|unauthori|forbidden|invalid token|missing scope/i.test(msg)) return 'Homey refused the API key (' + msg + '). Make sure you copied the whole key and gave it the scopes listed in the README.';
    return 'Could not reach Homey at <code>' + addr + '</code> (' + msg + ').<br>Check that the iPad is on the same Wi-Fi as Homey, the IP is right, and try opening <code>' +
      addr + '/api/manager/system/ping</code> in Safari — it should show a short reply.';
  }

  // ---------------------------------------------------------------- startup
  function setConn(s) { state.connected = s === 'ok'; $('conn').className = 'conn ' + (s === 'ok' ? 'ok' : s === 'bad' ? 'bad' : ''); }

  function loadExtras() {
    backend.users().then(function (u) { state.users = u; renderPresence(); }).catch(function () { state.users = []; renderPresence(); });
    backend.weather().then(function (w) { state.weather = w; renderWeather(); }).catch(function () { state.weather = null; renderWeather(); });
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
        // Live updates for every capability we can display (all devices, so changing the selection needs no reconnect).
        Object.keys(state.devices).forEach(function (id) {
          var d = state.devices[id];
          WATCH.forEach(function (c) {
            if (!has(d, c)) return;
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
  }, 120000);
  setInterval(function () { if (backend) loadExtras(); }, 10 * 60000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
      if (backend) backend.refresh().then(applyFresh).catch(function () {});
    }
  });

  ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, activity, { capture: true, passive: true }); });

  tick();
  setInterval(tick, 1000);
  renderAll();
  if (cfg.demo || (cfg.address && cfg.token)) {
    start().catch(function (err) { toast('Could not connect to Homey — hold the gear to check settings. (' + (err && err.message || err) + ')', true); });
  }
})();

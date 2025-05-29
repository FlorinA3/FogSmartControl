// ======================
// FogSmartControl v2.3.0 - Production Ready
// ======================
import * as Sentry from '@sentry/browser';

// Initialize error tracking first
Sentry.init({
  dsn: 'https://0b2688b910fa063debc8be8e95d74b43@o4509408364855296.ingest.de.sentry.io/4509408377372752',
  release: 'fog-control@2.3.0',
  integrations: [new Sentry.Integrations.GlobalHandlers()],
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Filter out benign errors
    if (event.exception?.values?.[0]?.value?.includes('User cancelled')) {
      return null;
    }
    return event;
  },
});

// Constants and configuration
const APP_VERSION = '2.3.0';
const MAX_DEVICES = 4;
const COMMAND_QUEUE_LIMIT = 50;
const INACTIVITY_TIMEOUT = 300000; // 5 minutes

const BLE_CONFIG = Object.freeze({
  SERVICE_UUID: '0000ffff-0000-1000-8000-00805f9b34fb',
  CHARACTERISTICS: Object.freeze({
    INTENSITY: '0000ffff-0000-1000-8000-00805f9b34fb',
    DURATION: '0000ffff-0000-1000-8000-00805f9b34fb',
    COMMAND: '0000ffff-0000-1000-8000-00805f9b34fb',
    BATTERY_LEVEL: '00002a19-0000-1000-8000-00805f9b34fb',
    POWER_SOURCE: '0000ff04-0000-1000-8000-00805f9b34fb',
  }),
  POWER_SOURCE: Object.freeze({
    BATTERY: 0,
    AC_POWER: 1,
    USB: 2,
  }),
});

// State management
const state = {
  devices: [],
  activeConnections: {},
  sessionTimers: {},
  activityTimer: null,
  commandQueue: [],
};

// ======================
// Device Class
// ======================
class Device {
  constructor(id, name, index) {
    this.id = id;
    this.name = name;
    this.index = index;
    this.paired = false;
    this.connected = false;
    this.lastSeen = null;
    this.batteryLevel = 0;
    this.powerSource = null;
    this.queue = [];
  }

  updateConnectionStatus(isConnected, deviceName = null) {
    this.connected = isConnected;
    const statusLed = document.getElementById(`statusLed-${this.index}`);
    const statusText = document.getElementById(`statusText-${this.index}`);

    if (statusLed && statusText) {
      statusLed.classList.toggle('connected', isConnected);
      statusText.textContent = isConnected
        ? `Connected to ${deviceName || this.name}`
        : 'Disconnected';
      statusText.style.color = isConnected ? '#00cc66' : '#ff4444';
    }
  }

  addToQueue(command) {
    if (this.queue.length >= COMMAND_QUEUE_LIMIT) {
      return false;
    }
    this.queue.push({ ...command, timestamp: Date.now() });
    return true;
  }

  clearQueue() {
    this.queue = [];
  }
}

// ======================
// Core Functions
// ======================
function initDeviceManager() {
  try {
    const savedDevices = JSON.parse(localStorage.getItem('devices')) || [];
    state.devices = savedDevices.length
      ? savedDevices.map((d, i) =>
          Object.assign(new Device(d.id, d.name, i), d)
        )
      : Array(MAX_DEVICES)
          .fill()
          .map((_, i) => new Device(`device-${i}`, `Fog Device ${i + 1}`, i));

    state.commandQueue = JSON.parse(localStorage.getItem('commandQueue')) || [];
    renderDevices();
  } catch (error) {
    Sentry.captureException(error);
    console.error('Device initialization failed:', error);
  }
}

function persistDevices() {
  try {
    localStorage.setItem('devices', JSON.stringify(state.devices));
    localStorage.setItem('commandQueue', JSON.stringify(state.commandQueue));
  } catch (error) {
    Sentry.captureException(error);
    console.error('Failed to persist devices:', error);
  }
}

function renderDevices() {
  const container = document.getElementById('devices-container');
  if (!container) return;
  container.innerHTML = '';

  state.devices.forEach((device, i) => {
    const isConnected = !!state.activeConnections[device.id];
    const batteryClass =
      device.batteryLevel < 20
        ? 'battery-low'
        : device.batteryLevel < 50
        ? 'battery-medium'
        : 'battery-high';

    container.insertAdjacentHTML(
      'beforeend',
      `
      <div class="device-card" id="device-${i}" data-device-id="${device.id}">
        <div class="device-header">
          <h2 contenteditable="true" onblur="renameDevice(${i}, this.textContent)">
            ${device.name}
          </h2>
          <div class="connection-status">
            <div class="status-led ${
              isConnected ? 'connected' : ''
            }" id="statusLed-${i}"></div>
            <span id="statusText-${i}">${
        isConnected ? 'Connected' : 'Disconnected'
      }</span>
          </div>
        </div>
        <div class="device-info">
          <div class="battery-indicator">
            <div class="battery-fill ${batteryClass}" style="width:${
        device.batteryLevel
      }%"></div>
            <span class="battery-text">${device.batteryLevel}%</span>
          </div>
          <div class="power-source">${
            device.powerSource
              ? '🔌 ' + getPowerSourceName(device.powerSource)
              : ''
          }</div>
        </div>
        <div class="intensity-control">
          <label>Intensity (1-4):</label>
          <input type="range" id="intensity-${i}" min="1" max="4" value="2" oninput="updateIntensityValue(${i}, this.value)">
          <span id="intensityValue-${i}" class="intensity-value">2</span>
        </div>
        <div class="session-timer" id="session-timer-${i}" style="display:none"></div>
        <input type="number" id="duration-${i}" placeholder="Seconds" min="0" max="3600" onchange="validateInput(this, 0, 3600)">
        <div class="button-group">
          <button onclick="${
            device.paired ? `connectDevice(${i})` : `scanForDevices(${i})`
          }">
            ${
              isConnected
                ? 'Reconnect'
                : device.paired
                ? 'Connect'
                : 'Pair Device'
            }
          </button>
          <button onclick="prepareAndStart(${i})">Start Session</button>
          <button onclick="savePreset(${i})">Save Preset</button>
          <button onclick="forgetDevice(${i})" class="danger-btn">Remove</button>
        </div>
        <div class="device-loader" id="device-loader-${i}" style="display:none">
          <div class="loader-spinner"></div>
        </div>
      </div>
    `
    );

    const preset = JSON.parse(localStorage.getItem(`preset-${i}`)) || {};
    if (preset.intensity) {
      document.getElementById(`intensity-${i}`).value = preset.intensity;
      document.getElementById(`intensityValue-${i}`).textContent =
        preset.intensity;
    }
    if (preset.duration)
      document.getElementById(`duration-${i}`).value = preset.duration;
  });
}

async function scanForDevices(i) {
  try {
    showLoader(true, i);
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [BLE_CONFIG.SERVICE_UUID] }],
      optionalServices: Object.values(BLE_CONFIG.CHARACTERISTICS),
    });
    await connectDevice(i, device);
    state.devices[i].paired = true;
    persistDevices();
    triggerNotification('Device Paired', {
      body: `${device.name || 'Device'} paired`,
    });
  } catch (error) {
    if (!error.toString().includes('User cancelled')) {
      Sentry.captureException(error);
    }
    triggerNotification(
      error.toString().includes('User cancelled')
        ? 'Cancelled'
        : 'Pairing Failed',
      { body: error.message }
    );
  } finally {
    showLoader(false, i);
  }
}

async function connectDevice(i, bluetoothDevice = null) {
  try {
    showLoader(true, i);
    const device =
      bluetoothDevice ||
      (await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE_CONFIG.SERVICE_UUID] }],
        optionalServices: Object.values(BLE_CONFIG.CHARACTERISTICS),
      }));

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(BLE_CONFIG.SERVICE_UUID);
    const chars = {};

    for (const [key, uuid] of Object.entries(BLE_CONFIG.CHARACTERISTICS)) {
      chars[key] = await service.getCharacteristic(uuid);
    }

    // Store connection
    state.activeConnections[device.id] = { device, chars };
    const currentDevice = state.devices[i];
    Object.assign(currentDevice, {
      id: device.id,
      name: device.name || currentDevice.name,
      connected: true,
      lastSeen: new Date().toISOString(),
      paired: true,
    });

    // Setup notifications
    await setupCharacteristicNotifications(chars, i);

    // Handle disconnection
    device.addEventListener('gattserverdisconnected', () =>
      handleDeviceDisconnection(i, device)
    );

    persistDevices();
    currentDevice.updateConnectionStatus(true, device.name);
    triggerNotification('Connected', { body: `Connected to ${device.name}` });
    processQueue(device.id);
  } catch (error) {
    state.devices[i].updateConnectionStatus(false);
    if (!error.toString().includes('User cancelled')) {
      Sentry.captureException(error);
      triggerNotification('Connection Failed', { body: error.message });
    }
  } finally {
    showLoader(false, i);
  }
}

async function setupCharacteristicNotifications(chars, i) {
  try {
    chars.powerSource.addEventListener('characteristicvaluechanged', (e) =>
      handlePowerSourceChange(i, e)
    );
    await chars.powerSource.startNotifications();

    chars.batteryLevel.addEventListener('characteristicvaluechanged', (e) =>
      handleBatteryChange(i, e)
    );
    await chars.batteryLevel.startNotifications();

    // Initial reads
    const powerSource = (await chars.powerSource.readValue()).getUint8(0);
    updatePowerSource(i, powerSource);
    const batteryValue = (await chars.batteryLevel.readValue()).getUint8(0);
    updateBatteryLevel(i, batteryValue);
  } catch (error) {
    Sentry.captureException(error);
    console.error('Notification setup failed:', error);
  }
}

function handleDeviceDisconnection(i, device) {
  state.devices[i].updateConnectionStatus(false);
  triggerNotification('Disconnected', { body: `${device.name} disconnected` });
  state.devices[i].connected = false;
  delete state.activeConnections[device.id];
  persistDevices();
}

// ======================
// Command Execution
// ======================
async function sendIntensity(i, value) {
  const deviceId = state.devices[i]?.id;
  const connection = state.activeConnections[deviceId];

  if (!connection) {
    queueCommand(i, 'intensity', value);
    return;
  }

  try {
    const val = sanitizeInput(value, 1, 4);
    await connection.chars.intensity.writeValue(new Uint8Array([val]));
  } catch (error) {
    Sentry.captureException(error);
    handleError(error);
  }
}

async function sendDuration(i, seconds) {
  const deviceId = state.devices[i]?.id;
  const connection = state.activeConnections[deviceId];

  if (!connection) {
    queueCommand(i, 'duration', seconds);
    return;
  }

  try {
    const secs = sanitizeInput(seconds, 0, 3600);
    await connection.chars.duration.writeValue(new Uint32Array([secs]));
  } catch (error) {
    Sentry.captureException(error);
    handleError(error);
  }
}

async function startSession(i) {
  const deviceId = state.devices[i]?.id;
  const connection = state.activeConnections[deviceId];

  if (!connection) {
    queueCommand(i, 'command', 1);
    return;
  }

  try {
    await connection.chars.command.writeValue(new Uint8Array([1]));
    const duration =
      parseInt(document.getElementById(`duration-${i}`).value) || 0;
    trackSession(i, duration);

    const intensityEl = document.getElementById(`intensityValue-${i}`);
    intensityEl.style.color = '#00cc66';
    setTimeout(() => (intensityEl.style.color = ''), 1000);

    if (duration > 0) updateActiveSessionDisplay(i, duration);

    triggerNotification('Session Started', {
      body: `${state.devices[i].name} activated`,
    });
  } catch (error) {
    Sentry.captureException(error);
    handleError(error);
  }
}

async function emergencyStop(i) {
  const deviceId = state.devices[i]?.id;
  const connection = state.activeConnections[deviceId];

  if (!connection) return;

  try {
    showLoader(true, i);
    await connection.chars.command.writeValue(new Uint8Array([0]));

    const deviceCard = document.getElementById(`device-${i}`);
    if (deviceCard) {
      deviceCard.classList.add('emergency-stop-active');
      setTimeout(
        () => deviceCard.classList.remove('emergency-stop-active'),
        2000
      );
    }

    document.getElementById(`session-timer-${i}`).style.display = 'none';
    if (state.sessionTimers[i]) clearInterval(state.sessionTimers[i]);

    triggerNotification('EMERGENCY STOP', {
      body: `${state.devices[i].name} stopped`,
    });
  } catch (error) {
    Sentry.captureException(error);
    handleError(error);
  } finally {
    showLoader(false, i);
  }
}

async function prepareAndStart(i) {
  const intensity = document.getElementById(`intensity-${i}`).value;
  const duration = document.getElementById(`duration-${i}`).value;

  try {
    await sendIntensity(i, intensity);
    await sendDuration(i, duration);
    await startSession(i);
  } catch (error) {
    Sentry.captureException(error);
    triggerNotification('Session Failed', { body: `Error: ${error.message}` });
  }
}

// ======================
// Helper Functions
// ======================
function handlePowerSourceChange(i, event) {
  const source = event.target.value.getUint8(0);
  updatePowerSource(i, source);
  triggerNotification('Power Status', {
    body:
      source === BLE_CONFIG.POWER_SOURCE.BATTERY
        ? 'On battery power'
        : `On ${getPowerSourceName(source)} power`,
  });
}

function updatePowerSource(i, source) {
  if (i < state.devices.length) {
    state.devices[i].powerSource = source;
    persistDevices();
    renderDevices();
  }
}

function handleBatteryChange(i, event) {
  const value = event.target.value.getUint8(0);
  updateBatteryLevel(i, value);
  if (value < 20) triggerNotification('Low Battery', { body: 'Charge soon' });
}

function updateBatteryLevel(i, level) {
  if (i < state.devices.length) {
    state.devices[i].batteryLevel = level;

    // Critical battery handling
    if (
      level < 15 &&
      state.devices[i].powerSource === BLE_CONFIG.POWER_SOURCE.BATTERY
    ) {
      triggerNotification('Critical Battery', {
        body: 'Device will shut down soon',
      });
      if (level < 5) emergencyStop(i);
    }

    persistDevices();
    renderDevices();
  }
}

function getPowerSourceName(source) {
  return (
    {
      0: 'Battery',
      1: 'AC Power',
      2: 'USB Power',
    }[source] || 'Unknown Power'
  );
}

function trackSession(i, duration) {
  if (i >= state.devices.length) return;

  const sessionKey = `sessionCount-${i}`;
  const durationKey = `totalDuration-${i}`;
  const count = (parseInt(localStorage.getItem(sessionKey)) || 0) + 1;
  const total = (parseInt(localStorage.getItem(durationKey)) || 0) + duration;

  localStorage.setItem(sessionKey, count);
  localStorage.setItem(durationKey, total);
  updateStatistics();
}

function updateActiveSessionDisplay(i, totalDuration) {
  const timerEl = document.getElementById(`session-timer-${i}`);
  if (!timerEl) return;

  let secondsLeft = totalDuration;
  timerEl.textContent = formatTime(secondsLeft);
  timerEl.style.display = 'block';

  if (state.sessionTimers[i]) clearInterval(state.sessionTimers[i]);

  state.sessionTimers[i] = setInterval(() => {
    secondsLeft--;
    timerEl.textContent = formatTime(secondsLeft);

    if (secondsLeft <= 0) {
      clearInterval(state.sessionTimers[i]);
      timerEl.style.display = 'none';
    }
  }, 1000);
}

function formatTime(sec) {
  const mins = Math.floor(sec / 60);
  return `${mins.toString().padStart(2, '0')}:${(sec % 60)
    .toString()
    .padStart(2, '0')}`;
}

function validateInput(input, min, max) {
  let val = parseInt(input.value) || min;
  input.value = Math.min(max, Math.max(min, val));
}

function sanitizeInput(val, min, max) {
  return Math.min(max, Math.max(min, parseInt(val) || min));
}

function showLoader(show, i = null) {
  const loader =
    i !== null
      ? document.getElementById(`device-loader-${i}`)
      : document.getElementById('global-loader');

  if (loader) loader.style.display = show ? 'flex' : 'none';
}

function updateIntensityValue(i, val) {
  const el = document.getElementById(`intensityValue-${i}`);
  if (el) el.textContent = val;
}

function renameDevice(i, newName) {
  if (i < state.devices.length && newName.trim()) {
    state.devices[i].name = newName;
    persistDevices();
    renderDevices();
  }
}

function forgetDevice(i) {
  if (!confirm(`Remove ${state.devices[i].name}?`)) return;

  const deviceId = state.devices[i].id;
  if (state.activeConnections[deviceId]) {
    state.activeConnections[deviceId].device.gatt.disconnect();
    delete state.activeConnections[deviceId];
  }

  state.devices[i] = new Device(`device-${i}`, `Fog Device ${i + 1}`, i);
  persistDevices();
  renderDevices();

  triggerNotification('Device Removed', { body: 'Device unpaired' });
}

function queueCommand(i, type, value) {
  if (state.commandQueue.length >= COMMAND_QUEUE_LIMIT) {
    triggerNotification('Queue Full', { body: 'Command queue full' });
    return;
  }

  state.commandQueue.push({
    deviceIndex: i,
    type,
    value,
    timestamp: Date.now(),
  });

  persistDevices();
  triggerNotification('Command Queued', {
    body: 'Will execute when connected',
  });
}

async function processQueue(deviceId) {
  const deviceQueue = state.commandQueue.filter(
    (cmd) => state.devices[cmd.deviceIndex]?.id === deviceId
  );

  for (const cmd of deviceQueue) {
    try {
      switch (cmd.type) {
        case 'intensity':
          await sendIntensity(cmd.deviceIndex, cmd.value);
          break;
        case 'duration':
          await sendDuration(cmd.deviceIndex, cmd.value);
          break;
        case 'command':
          await startSession(cmd.deviceIndex);
          break;
      }
    } catch (error) {
      Sentry.captureException(error);
      console.error('Command failed:', cmd, error);
    }
  }

  // Remove processed commands
  state.commandQueue = state.commandQueue.filter(
    (cmd) => state.devices[cmd.deviceIndex]?.id !== deviceId
  );

  persistDevices();
}

// ======================
// UI and Notification
// ======================
function triggerNotification(title, options) {
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, options);
    } catch (error) {
      console.warn('Notification failed:', error);
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = 'notification-alert';
    alertDiv.innerHTML = `
      <i class="fas fa-info-circle"></i>
      <div class="notification-content">
        <h4>${title}</h4>
        <p>${options.body}</p>
      </div>`;

    document.body.appendChild(alertDiv);
    setTimeout(() => {
      alertDiv.classList.add('fade-out');
      setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
  }
}

function updateStatistics() {
  const container = document.getElementById('stats-container');
  if (!container) return;

  container.innerHTML = '';
  state.devices.forEach((device, i) => {
    const sessions = parseInt(localStorage.getItem(`sessionCount-${i}`)) || 0;
    const totalSec = parseInt(localStorage.getItem(`totalDuration-${i}`)) || 0;

    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const duration = hours
      ? `${hours}h ${mins}m ${secs}s`
      : `${mins}m ${secs}s`;

    container.insertAdjacentHTML(
      'beforeend',
      `
      <div class="stat-card">
        <h3>${device.name}</h3>
        <div class="stat-value">${sessions}</div>
        <div class="stat-label">Sessions</div>
        <div class="stat-value">${duration}</div>
        <div class="stat-label">Total Runtime</div>
      </div>
    `
    );
  });
}

// ======================
// System Functions
// ======================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/src/sw.js')
      .then((reg) => {
        console.log('Service Worker registered');
        setInterval(() => reg.update(), 3600000); // Hourly checks
      })
      .catch((error) => {
        Sentry.captureException(error);
        console.error('Service Worker registration failed:', error);
      });
  }
}

function handleError(error) {
  console.error('Application Error:', error);
  triggerNotification('Error', { body: error.message || 'Unknown error' });
}

function resetActivityTimer() {
  clearTimeout(state.activityTimer);
  state.activityTimer = setTimeout(() => {
    Object.values(state.activeConnections).forEach((conn) => {
      conn.device.gatt.disconnect();
    });
    triggerNotification('Auto-Disconnected', { body: 'Inactivity timeout' });
  }, INACTIVITY_TIMEOUT);
}

function showCompatibilityWarning() {
  const alertDiv = document.createElement('div');
  alertDiv.className = 'notification-alert warning';
  alertDiv.innerHTML = `
    <i class="fas fa-exclamation-triangle"></i>
    <div class="notification-content">
      <h4>Web Bluetooth Not Supported</h4>
      <p>Use Chrome on Android or Edge on Windows</p>
    </div>`;
  document.body.appendChild(alertDiv);

  document.querySelectorAll('button').forEach((btn) => {
    if (
      btn.textContent.includes('Connect') ||
      btn.textContent.includes('Pair')
    ) {
      btn.disabled = true;
    }
  });
}

// ======================
// Initialization
// ======================
window.addEventListener('load', () => {
  try {
    localStorage.setItem('appVersion', APP_VERSION);
    registerServiceWorker();

    Notification.requestPermission().catch((error) => {
      console.warn('Notification permission error:', error);
    });

    initDeviceManager();
    updateStatistics();

    // Activity monitoring
    ['click', 'touchstart', 'keypress'].forEach((event) => {
      document.addEventListener(event, resetActivityTimer);
    });

    // Global error handling
    window.addEventListener('error', (event) => {
      Sentry.captureException(event.error);
      handleError(event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      Sentry.captureException(event.reason);
      handleError(event.reason);
    });

    // Browser capability check
    if (!navigator.bluetooth) {
      showCompatibilityWarning();
    }

    // First run experience
    if (!localStorage.getItem('firstRun')) {
      triggerNotification('Welcome', { body: 'Connect devices to begin' });
      localStorage.setItem('firstRun', 'completed');
    }

    resetActivityTimer();
  } catch (error) {
    Sentry.captureException(error);
    console.error('Application initialization failed:', error);
  }
});

// Export for testing
if (process.env.NODE_ENV === 'test') {
  window.__FogSmartControl = {
    state,
    Device,
    BLE_CONFIG,
  };
}

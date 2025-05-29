// ======================
// Optimized App Configuration
// ======================
const APP_VERSION = '2.2.0';
console.log(`SmartFogControl v${APP_VERSION}`);
const MAX_DEVICES = 4;
const COMMAND_QUEUE_LIMIT = 50;
const INACTIVITY_TIMEOUT = 300000;

const BLE_CONFIG = {
    SERVICE_UUID: '0000ffff-0000-1000-8000-00805f9b34fb',
    CHARACTERISTICS: {
        INTENSITY: '0000ffff-0000-1000-8000-00805f9b34fb',
        DURATION: '0000ffff-0000-1000-8000-00805f9b34fb',
        COMMAND: '0000ffff-0000-1000-8000-00805f9b34fb',
        BATTERY_LEVEL: '00002a19-0000-1000-8000-00805f9b34fb',
        POWER_SOURCE: '0000ff04-0000-1000-8000-00805f9b34fb'
    },
    POWER_SOURCE: { BATTERY: 0, AC_POWER: 1, USB: 2 }
};

let devices = [];
let activeConnections = {};
let activityTimer;
const sessionTimers = {};

function initDeviceManager() {
    devices = JSON.parse(localStorage.getItem('devices')) || [];
    if (!devices.length) {
        devices = Array(MAX_DEVICES).fill().map((_, i) => ({
            id: `device-${i}`, name: `Fog Device ${i+1}`,
            paired: false, connected: false, lastSeen: null,
            batteryLevel: 0, powerSource: null
        }));
        localStorage.setItem('devices', JSON.stringify(devices));
    }
    renderDevices();
}

function renderDevices() {
    const container = document.getElementById('devices-container');
    if (!container) return;
    container.innerHTML = '';
    
    devices.forEach((device, i) => {
        const isConnected = activeConnections[device.id];
        const batteryClass = device.batteryLevel < 20 ? 'battery-low' : 
                           device.batteryLevel < 50 ? 'battery-medium' : 'battery-high';
        
        container.insertAdjacentHTML('beforeend', `
            <div class="device-card" id="device-${i}">
                <div class="device-header">
                    <h2 contenteditable="true" onblur="renameDevice(${i}, this.textContent)">
                        ${device.name}
                    </h2>
                    <div class="connection-status">
                        <div class="status-led ${isConnected ? 'connected' : ''}" id="statusLed-${i}"></div>
                        <span id="statusText-${i}">${isConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                </div>
                <div class="device-info">
                    <div class="battery-indicator">
                        <div class="battery-fill ${batteryClass}" style="width:${device.batteryLevel}%"></div>
                        <span class="battery-text">${device.batteryLevel}%</span>
                    </div>
                    <div class="power-source">${device.powerSource ? '🔌 ' + getPowerSourceName(device.powerSource) : ''}</div>
                </div>
                <div class="intensity-control">
                    <label>Intensity (1-4):</label>
                    <input type="range" id="intensity-${i}" min="1" max="4" value="2" oninput="updateIntensityValue(${i}, this.value)">
                    <span id="intensityValue-${i}" class="intensity-value">2</span>
                </div>
                <div class="session-timer" id="session-timer-${i}" style="display:none"></div>
                <input type="number" id="duration-${i}" placeholder="Seconds" min="0" max="3600" onchange="validateInput(this, 0, 3600)">
                <div class="button-group">
                    <button onclick="${device.paired ? `connectDevice(${i})` : `scanForDevices(${i})`}">
                        ${isConnected ? 'Reconnect' : device.paired ? 'Connect' : 'Pair Device'}
                    </button>
                    <button onclick="prepareAndStart(${i})">Start Session</button>
                    <button onclick="savePreset(${i})">Save Preset</button>
                    <button onclick="forgetDevice(${i})" class="danger-btn">Remove</button>
                </div>
                <div class="device-loader" id="device-loader-${i}" style="display:none"><div class="loader-spinner"></div></div>
            </div>
        `);
        
        const preset = JSON.parse(localStorage.getItem(`preset-${i}`)) || {};
        if (preset.intensity) {
            document.getElementById(`intensity-${i}`).value = preset.intensity;
            document.getElementById(`intensityValue-${i}`).textContent = preset.intensity;
        }
        if (preset.duration) document.getElementById(`duration-${i}`).value = preset.duration;
    });
}

async function scanForDevices(i) {
    try {
        showLoader(true, i);
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [BLE_CONFIG.SERVICE_UUID] }],
            optionalServices: Object.values(BLE_CONFIG.CHARACTERISTICS)
        });
        await connectDevice(i, device);
        devices[i].paired = true;
        localStorage.setItem('devices', JSON.stringify(devices));
        triggerNotification('Device Paired', {body: `${device.name || 'Device'} paired`});
    } catch (err) {
        err.toString().includes('User cancelled') 
            ? triggerNotification('Cancelled', {body: 'Pairing cancelled'})
            : handleError(err);
    } finally {
        showLoader(false, i);
    }
}

async function connectDevice(i, bluetoothDevice = null) {
    try {
        showLoader(true, i);
        const device = bluetoothDevice || await navigator.bluetooth.requestDevice({
            filters: [{ services: [BLE_CONFIG.SERVICE_UUID] }],
            optionalServices: Object.values(BLE_CONFIG.CHARACTERISTICS)
        });

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(BLE_CONFIG.SERVICE_UUID);
        const chars = {};
        
        for (const [key, uuid] of Object.entries(BLE_CONFIG.CHARACTERISTICS)) {
            chars[key] = await service.getCharacteristic(uuid);
        }

        // Store connection by device ID
        activeConnections[device.id] = { device, chars };
        devices[i] = {
            ...devices[i],
            id: device.id,
            name: device.name || devices[i].name,
            connected: true,
            lastSeen: new Date().toISOString(),
            paired: true
        };

        // Setup notifications
        chars.powerSource.addEventListener('characteristicvaluechanged', 
            e => handlePowerSourceChange(i, e));
        await chars.powerSource.startNotifications();
        
        chars.batteryLevel.addEventListener('characteristicvaluechanged', 
            e => handleBatteryChange(i, e));
        await chars.batteryLevel.startNotifications();
        
        // Initial reads
        const powerSource = (await chars.powerSource.readValue()).getUint8(0);
        updatePowerSource(i, powerSource);
        const batteryValue = (await chars.batteryLevel.readValue()).getUint8(0);
        updateBatteryLevel(i, batteryValue);

        // Handle disconnection
        device.addEventListener('gattserverdisconnected', () => {
            updateConnectionStatus(i, false);
            triggerNotification('Disconnected', {body: `${device.name} disconnected`});
            devices[i].connected = false;
            delete activeConnections[device.id];
            localStorage.setItem('devices', JSON.stringify(devices));
        });

        localStorage.setItem('devices', JSON.stringify(devices));
        updateConnectionStatus(i, true, device.name);
        triggerNotification('Connected', {body: `Connected to ${device.name}`});
        processQueue(device.id);
    } catch (err) {
        updateConnectionStatus(i, false);
        if (!err.toString().includes('User cancelled')) {
            triggerNotification('Connection Failed', {body: `Error: ${err.message}`});
            console.error('Connection failed:', err);
        }
    } finally {
        showLoader(false, i);
    }
}

function updateConnectionStatus(i, connected, deviceName = null) {
    const statusLed = document.getElementById(`statusLed-${i}`);
    const statusText = document.getElementById(`statusText-${i}`);
    if (statusLed && statusText) {
        statusLed.classList.toggle('connected', connected);
        statusText.textContent = connected ? `Connected to ${deviceName || devices[i].name}` : 'Disconnected';
        statusText.style.color = connected ? '#00cc66' : '#ff4444';
    }
}

async function sendIntensity(i, value) {
    const deviceId = devices[i]?.id;
    if (!activeConnections[deviceId]) {
        queueCommand(i, 'intensity', value);
        return;
    }
    try {
        const val = sanitizeInput(value, 1, 4);
        await activeConnections[deviceId].chars.intensity.writeValue(new Uint8Array([val]));
    } catch (err) {
        handleError(err);
    }
}

async function sendDuration(i, seconds) {
    const deviceId = devices[i]?.id;
    if (!activeConnections[deviceId]) {
        queueCommand(i, 'duration', seconds);
        return;
    }
    try {
        const secs = sanitizeInput(seconds, 0, 3600);
        await activeConnections[deviceId].chars.duration.writeValue(new Uint32Array([secs]));
    } catch (err) {
        handleError(err);
    }
}

async function startSession(i) {
    const deviceId = devices[i]?.id;
    if (!activeConnections[deviceId]) {
        queueCommand(i, 'command', 1);
        return;
    }
    try {
        await activeConnections[deviceId].chars.command.writeValue(new Uint8Array([1]));
        const duration = parseInt(document.getElementById(`duration-${i}`).value || 0;
        trackSession(i, duration);
        const intensityEl = document.getElementById(`intensityValue-${i}`);
        intensityEl.style.color = '#00cc66';
        setTimeout(() => intensityEl.style.color = '', 1000);
        if (duration > 0) updateActiveSessionDisplay(i, duration);
        triggerNotification('Session Started', {body: `${devices[i].name} activated`});
    } catch (err) {
        handleError(err);
    }
}

async function emergencyStop(i) {
    const deviceId = devices[i]?.id;
    if (!activeConnections[deviceId]) return;
    try {
        showLoader(true, i);
        await activeConnections[deviceId].chars.command.writeValue(new Uint8Array([0]));
        const deviceCard = document.getElementById(`device-${i}`);
        if (deviceCard) {
            deviceCard.classList.add('emergency-stop-active');
            setTimeout(() => deviceCard.classList.remove('emergency-stop-active'), 2000);
        }
        document.getElementById(`session-timer-${i}`).style.display = 'none';
        if (sessionTimers[i]) clearInterval(sessionTimers[i]);
        triggerNotification('EMERGENCY STOP', {body: `${devices[i].name} stopped`});
    } catch (err) {
        handleError(err);
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
    } catch (err) {
        triggerNotification('Session Failed', {body: `Error: ${err.message}`});
        console.error('Session start failed:', err);
    }
}

async function startAllDevices() {
    const startPromises = devices.map((_, i) => {
        const deviceId = devices[i]?.id;
        if (!activeConnections[deviceId]) return;
        const intensity = document.getElementById(`intensity-${i}`).value;
        const duration = document.getElementById(`duration-${i}`).value;
        return sendIntensity(i, intensity)
            .then(() => sendDuration(i, duration))
            .then(() => startSession(i));
    }).filter(Boolean);
    
    if (!startPromises.length) return;
    try {
        await Promise.all(startPromises);
        triggerNotification('Batch Started', {body: 'All devices activated'});
        trackEvent('batch_started');
    } catch (err) {
        handleError(err);
    }
}

function emergencyStopAll() {
    let stoppedCount = 0;
    devices.forEach((_, i) => {
        if (activeConnections[devices[i]?.id]) {
            emergencyStop(i);
            stoppedCount++;
        }
    });
    triggerNotification(stoppedCount ? 'EMERGENCY STOP' : 'No Devices', 
        {body: stoppedCount ? `Stopped ${stoppedCount} devices` : 'No devices to stop'});
}

function savePreset(i) {
    const presetName = prompt("Preset name:");
    if (!presetName) return;
    const preset = {
        name: presetName,
        intensity: document.getElementById(`intensity-${i}`).value,
        duration: document.getElementById(`duration-${i}`).value,
        deviceIndex: i,
        timestamp: new Date().toISOString()
    };
    const presets = JSON.parse(localStorage.getItem('presets')) || [];
    presets.push(preset);
    localStorage.setItem('presets', JSON.stringify(presets));
    triggerNotification('Preset Saved', {body: `"${presetName}" saved`});
    renderPresets();
}

// ======================
// Optimized Helper Functions
// ======================
function handlePowerSourceChange(i, event) {
    const source = event.target.value.getUint8(0);
    updatePowerSource(i, source);
    triggerNotification('Power Status', {
        body: source === BLE_CONFIG.POWER_SOURCE.BATTERY 
            ? 'On battery power' 
            : `On ${getPowerSourceName(source)} power`
    });
}

function updatePowerSource(i, source) {
    if (i < devices.length) {
        devices[i].powerSource = source;
        localStorage.setItem('devices', JSON.stringify(devices));
        renderDevices();
    }
}

function handleBatteryChange(i, event) {
    const value = event.target.value.getUint8(0);
    updateBatteryLevel(i, value);
    if (value < 20) triggerNotification('Low Battery', {body: 'Charge soon'});
}

function updateBatteryLevel(i, level) {
    if (i < devices.length) {
        devices[i].batteryLevel = level;
        localStorage.setItem('devices', JSON.stringify(devices));
        renderDevices();
    }
}

function getPowerSourceName(source) {
    return ({
        0: 'Battery',
        1: 'AC Power',
        2: 'USB Power'
    })[source] || 'Unknown Power';
}

function trackSession(i, duration) {
    if (i >= devices.length) return;
    const sessionKey = `sessionCount-${i}`;
    const durationKey = `totalDuration-${i}`;
    const count = (parseInt(localStorage.getItem(sessionKey)) || 0 + 1;
    const total = (parseInt(localStorage.getItem(durationKey)) || 0 + duration;
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
    
    if (sessionTimers[i]) clearInterval(sessionTimers[i]);
    sessionTimers[i] = setInterval(() => {
        secondsLeft--;
        timerEl.textContent = formatTime(secondsLeft);
        if (secondsLeft <= 0) {
            clearInterval(sessionTimers[i]);
            timerEl.style.display = 'none';
        }
    }, 1000);
}

function formatTime(sec) {
    const mins = Math.floor(sec / 60);
    return `${mins.toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
}

function validateInput(input, min, max) {
    let val = parseInt(input.value) || min;
    input.value = Math.min(max, Math.max(min, val));
}

function sanitizeInput(val, min, max) {
    return Math.min(max, Math.max(min, parseInt(val) || min));
}

function showLoader(show, i = null) {
    const loader = i !== null 
        ? document.getElementById(`device-loader-${i}`)
        : document.getElementById('global-loader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

function updateIntensityValue(i, val) {
    const el = document.getElementById(`intensityValue-${i}`);
    if (el) el.textContent = val;
}

function renameDevice(i, newName) {
    if (i < devices.length && newName.trim()) {
        devices[i].name = newName;
        localStorage.setItem('devices', JSON.stringify(devices));
        renderDevices();
    }
}

function forgetDevice(i) {
    if (!confirm(`Remove ${devices[i].name}?`)) return;
    const deviceId = devices[i].id;
    if (activeConnections[deviceId]) {
        activeConnections[deviceId].device.gatt.disconnect();
        delete activeConnections[deviceId];
    }
    devices[i] = {
        id: `device-${i}`, name: `Fog Device ${i+1}`,
        paired: false, connected: false, 
        lastSeen: null, batteryLevel: 0, powerSource: null
    };
    localStorage.setItem('devices', JSON.stringify(devices));
    renderDevices();
    triggerNotification('Device Removed', {body: 'Device unpaired'});
}

function queueCommand(i, type, value) {
    const queue = JSON.parse(localStorage.getItem('commandQueue')) || [];
    if (queue.length >= COMMAND_QUEUE_LIMIT) {
        triggerNotification('Queue Full', {body: 'Command queue full'});
        return;
    }
    queue.push({ deviceIndex: i, type, value, timestamp: new Date().toISOString() });
    localStorage.setItem('commandQueue', JSON.stringify(queue));
    triggerNotification('Command Queued', {body: 'Will execute when connected'});
}

async function processQueue(deviceId) {
    const queue = JSON.parse(localStorage.getItem('commandQueue')) || [];
    const deviceQueue = queue.filter(cmd => devices[cmd.deviceIndex]?.id === deviceId);
    
    for (const cmd of deviceQueue) {
        try {
            switch(cmd.type) {
                case 'intensity': await sendIntensity(cmd.deviceIndex, cmd.value); break;
                case 'duration': await sendDuration(cmd.deviceIndex, cmd.value); break;
                case 'command': await startSession(cmd.deviceIndex); break;
            }
        } catch (err) {
            console.error('Command failed:', cmd, err);
        }
    }
    localStorage.setItem('commandQueue', JSON.stringify(queue.filter(cmd => devices[cmd.deviceIndex]?.id !== deviceId)));
}

function triggerNotification(title, options) {
    if (Notification.permission === "granted") {
        try { new Notification(title, options); } catch {}
        const alertDiv = document.createElement('div');
        alertDiv.className = 'notification-alert';
        alertDiv.innerHTML = `<i class="fas fa-info-circle"></i><div class="notification-content"><h4>${title}</h4><p>${options.body}</p></div>`;
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
    devices.forEach((device, i) => {
        const sessions = parseInt(localStorage.getItem(`sessionCount-${i}`)) || 0;
        const totalSec = parseInt(localStorage.getItem(`totalDuration-${i}`)) || 0;
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        const duration = hours ? `${hours}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
        container.insertAdjacentHTML('beforeend', `
            <div class="stat-card">
                <h3>${device.name}</h3>
                <div class="stat-value">${sessions}</div>
                <div class="stat-label">Sessions</div>
                <div class="stat-value">${duration}</div>
                <div class="stat-label">Total Runtime</div>
            </div>
        `);
    });
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                setInterval(() => reg.update(), 3600000);
            })
            .catch(console.error);
    }
}

function handleError(err) {
    console.error('App Error:', err);
    triggerNotification('Error', {body: err.message || 'Unknown error'});
}

function resetActivityTimer() {
    clearTimeout(activityTimer);
    activityTimer = setTimeout(() => {
        Object.values(activeConnections).forEach(conn => {
            conn.device.gatt.disconnect();
        });
        triggerNotification('Auto-Disconnected', {body: 'Inactivity timeout'});
    }, INACTIVITY_TIMEOUT);
}

// ======================
// Initialization
// ======================
window.addEventListener('load', () => {
    localStorage.setItem('appVersion', APP_VERSION);
    registerServiceWorker();
    Notification.requestPermission();
    initDeviceManager();
    updateStatistics();
    
    ['click', 'touchstart', 'keypress'].forEach(e => 
        document.addEventListener(e, resetActivityTimer));
    
    window.addEventListener('error', e => handleError(e.error));
    window.addEventListener('unhandledrejection', e => handleError(e.reason));
    
    if (!navigator.bluetooth) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'notification-alert warning';
        alertDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <div class="notification-content">
                <h4>Web Bluetooth Not Supported</h4>
                <p>Use Chrome on Android</p>
            </div>`;
        document.body.appendChild(alertDiv);
        document.querySelectorAll('button').forEach(btn => {
            if (btn.textContent.includes('Connect') || btn.textContent.includes('Pair')) {
                btn.disabled = true;
            }
        });
    }
    
    if (!localStorage.getItem('firstRun')) {
        triggerNotification('Welcome', {body: 'Connect devices to begin'});
        localStorage.setItem('firstRun', 'completed');
    }
    resetActivityTimer();
});
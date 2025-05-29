// CORRECTED setup.js
import '@testing-library/jest-dom'; // Removed '/extend-expect'
// tests/setup.js
import { state, Device, BLE_CONFIG } from '../src/app';

global.__FogSmartControl = { state, Device, BLE_CONFIG };

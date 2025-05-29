// tests/unit.test.js
import { emergencyStopAll } from '../src/app';

describe('Device Management', () => {
  test('Emergency stop halts all devices', () => {
    const devices = [
      { id: 'd1', status: 'running' },
      { id: 'd2', status: 'running' }
    ];
    
    const result = emergencyStopAll(devices);
    
    expect(result).toEqual([
      { id: 'd1', status: 'stopped' },
      { id: 'd2', status: 'stopped' }
    ]);
  });
  
  test('Handles empty device list', () => {
    const result = emergencyStopAll([]);
    expect(result).toEqual([]);
  });
});

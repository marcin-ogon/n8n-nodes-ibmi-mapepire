import { describe, it, expect } from 'vitest';
import { MapepireApi } from '../src/credentials/MapepireApi.credentials';

describe('MapepireApi credentials', () => {
  it('exposes required fields', () => {
    const creds = new MapepireApi();
    const names = creds.properties.map((p) => p.name);
    expect(names).toContain('host');
    expect(names).toContain('port');
    expect(names).toContain('user');
    expect(names).toContain('password');
  });

  it('honors default values', () => {
    const creds = new MapepireApi();
    const host = creds.properties.find((p) => p.name === 'host');
    const port = creds.properties.find((p) => p.name === 'port');
    expect(host?.default).toBe('localhost');
    expect(port?.default).toBe(8085);
  });
});

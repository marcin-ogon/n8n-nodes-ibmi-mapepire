import { describe, it, expect, vi } from 'vitest';
import { Mapepire } from '../src/nodes/Mapepire/Mapepire.node';

// Mock @ibm/mapepire-js
vi.mock('@ibm/mapepire-js', () => {
    class SQLJob {
        async connect() { /* no-op */ }
        async close() { /* no-op */ }

        query(_sql: string, _opts: any) {
            let called = false;
            return {
                execute: async (_fetchSize: number) => {
                    // First (and only) page
                    return {
                        data: [{ COL1: 1 }],
                        is_done: true,
                        metadata: { columns: [{ name: 'COL1' }] },
                        update_count: 0,
                    };
                },
                fetchMore: async () => {
                    called = true;
                    return {
                        data: [],
                        is_done: true,
                        metadata: { columns: [{ name: 'COL1' }] },
                        update_count: 0,
                    };
                },
            };
        }

        clcommand(_cl: string) {
            return {
                execute: async () => ({
                    success: true,
                    data: 'OK',
                    error: null,
                }),
            };
        }
    }
    return { SQLJob };
});

// Minimal fake of n8n IExecuteFunctions subset used
function makeContext(params: Record<string, any>, credOverride?: Record<string, any>) {
    const creds = {
        host: 'h',
        port: 1234,
        user: 'u',
        password: 'p',
        ignoreUnauthorized: true,
        ca: '',
        ...credOverride,
    };
    return {
        getInputData() {
            return [{ json: {} }];
        },
        getCredentials(name: string) {
            if (name !== 'mapepireApi') throw new Error('Unknown creds');
            return creds;
        },
        getNodeParameter(name: string, _i: number, defaultValue?: any) {
            return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : defaultValue;
        },
    } as any;
}

describe('Mapepire node', () => {
    it('executes SQL mode and returns rows', async () => {
        const node = new Mapepire();
        const ctx = makeContext({
            mode: 'sql',
            sql: 'values 1',
            fetchSize: 50,
            additionalFields: { isTerseResults: false },
        });
        const res = await node.execute.call(ctx);
        expect(res).toHaveLength(1);
        expect((res[0][0].json as { rows?: Array<{ COL1: number }> }).rows?.[0]?.COL1).toBe(1);
        expect((res[0][0].json.metadata as { columns?: { name: string }[] })?.columns?.[0]?.name).toBe('COL1');
    });

    it('executes CL mode and returns success', async () => {
        const node = new Mapepire();
        const ctx = makeContext({
            mode: 'cl',
            cl: 'DSPLIBL',
        });
        const res = await node.execute.call(ctx);
        expect(res[0][0].json.success).toBe(true);
        expect(res[0][0].json.data).toBe('OK');
    });
});
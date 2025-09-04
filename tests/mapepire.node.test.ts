import { describe, it, expect, vi } from 'vitest';
import { Mapepire } from '../src/nodes/Mapepire/Mapepire.node';

// Mock @ibm/mapepire-js
const connectSpy = vi.fn();
const querySpy = vi.fn();
vi.mock('@ibm/mapepire-js', () => {
    class SQLJob {
        async connect() { connectSpy(); }
        async close() { /* no-op */ }

        query(_sql: string, opts: any) {
            querySpy(opts);
            return {
                execute: async (_fetchSize: number) => ({
                    data: [{ COL1: 1 }],
                    is_done: true,
                    metadata: { columns: [{ name: 'COL1' }] },
                    update_count: 0,
                }),
                fetchMore: async () => ({
                    data: [],
                    is_done: true,
                    metadata: { columns: [{ name: 'COL1' }] },
                    update_count: 0,
                }),
            };
        }

        clcommand(_cl: string) {
            return {
                execute: async () => ({ success: true, data: 'OK', error: null }),
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

    it('passes parameters when enabled', async () => {
        const node = new Mapepire();
        const ctx = makeContext({
            mode: 'sql',
            sql: 'select * from table where a=?',
            fetchSize: 10,
            additionalFields: { useParameters: true, parametersJson: '[1]' },
        });
        await node.execute.call(ctx);
        expect(querySpy).toHaveBeenCalled();
        const lastCall = querySpy.mock.calls[querySpy.mock.calls.length - 1];
        const opts = lastCall?.[0];
        expect(opts.parameters?.[0]).toBe(1);
    });

    it('reuses connection when flag set', async () => {
        connectSpy.mockClear();
        const node = new Mapepire();
        const ctx: any = makeContext({
            mode: 'sql',
            sql: 'values 1',
            fetchSize: 10,
            additionalFields: { reuseConnection: true },
        });
        // simulate two input items
        ctx.getInputData = () => [{ json: {} }, { json: {} }];
        await node.execute.call(ctx);
        expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('captures error when continueOnFail set', async () => {
        // Force query to throw by providing invalid JSON parameters
        const node = new Mapepire();
        const ctx: any = makeContext({
            mode: 'sql',
            sql: 'values 1',
            fetchSize: 10,
            additionalFields: { useParameters: true, parametersJson: 'not-json' },
        });
        ctx.continueOnFail = () => true;
        const res = await node.execute.call(ctx);
        expect(res[0][0].json.error).toBeDefined();
        const errObj: any = res[0][0].json.error;
        expect(errObj.message).toMatch(/Invalid Parameters JSON/);
    });

    it('honors perRow output mode', async () => {
        const node = new Mapepire();
        const ctx = makeContext({
            mode: 'sql',
            sql: 'values 1',
            fetchSize: 10,
            additionalFields: { outputMode: 'perRow' },
        });
        const res = await node.execute.call(ctx);
        expect(res[0].length).toBeGreaterThanOrEqual(1);
        expect(res[0][0].json.row).toBeDefined();
    });
});
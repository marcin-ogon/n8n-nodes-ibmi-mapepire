import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription, IDataObject } from 'n8n-workflow';
import { SQLJob } from '@ibm/mapepire-js';
import type { DaemonServer, QueryOptions } from '@ibm/mapepire-js/dist/src/types';

/**
 * n8n Node: Mapepire
 *
 * Supports two modes:
 *  - SQL: Execute a SELECT / DML statement and page through result sets until completion.
 *  - CL Command: Run a single CL command (QCMDEXC under the covers in Mapepire).
 *
 * Design notes:
 *  - A fresh SQLJob connection is created per incoming item for isolation; could be optimized later
 *    (e.g., simple pooling) if performance becomes a concern.
 *  - For SQL, paging is performed with fetchSize to avoid large memory spikes on big result sets.
 *  - Terse results option maps directly to Mapepire's query option to reduce payload size.
 *  - Connection is always closed in finally to prevent leaked jobs on failure paths.
 */
export class Mapepire implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mapepire',
		name: 'mapepireNode',
		group: ['transform'],
		version: 1,
		description: 'Run SQL or CL commands on IBM i via Mapepire',
		defaults: {
			name: 'Mapepire',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'mapepireApi', required: true }],
		properties: [
			// Operation mode selector
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				options: [
					{ name: 'SQL', value: 'sql' },
					{ name: 'CL Command', value: 'cl' },
				],
				default: 'sql',
			},
			// SQL text when in SQL mode
			{
				displayName: 'SQL',
				name: 'sql',
				type: 'string',
				typeOptions: { rows: 4 },
				default: 'values current date',
				displayOptions: { show: { mode: ['sql'] } },
			},
			// CL command text when in CL mode
			{
				displayName: 'CL Command',
				name: 'cl',
				type: 'string',
				default: 'DSPLIBL',
				displayOptions: { show: { mode: ['cl'] } },
			},
			// Page size for iterative fetch
			{
				displayName: 'Fetch Size',
				name: 'fetchSize',
				type: 'number',
				default: 100,
				description: 'Number of rows to fetch per page (SQL)',
				displayOptions: { show: { mode: ['sql'] } },
			},
			// Additional optional tuning flags
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Terse Results',
						name: 'isTerseResults',
						type: 'boolean',
						default: false,
						description: 'Return compact rows without metadata for each column where supported',
					},
					{
						displayName: 'Include Metadata',
						name: 'includeMetadata',
						type: 'boolean',
						default: true,
						description: 'Include column metadata and update count in node output',
					},
					{
						displayName: 'Reuse Connection',
						name: 'reuseConnection',
						type: 'boolean',
						default: false,
						description: 'Use a single SQLJob connection for all input items (performance optimization)',
					},
					{
						displayName: 'Use Parameters',
						name: 'useParameters',
						type: 'boolean',
						default: false,
						description: 'Enable prepared/parameterized execution for the SQL. Provide parameters JSON below.',
						displayOptions: { show: { '/mode': ['sql'] } },
					},
					{
						displayName: 'Parameters (JSON)',
						name: 'parametersJson',
						type: 'string',
						typeOptions: { rows: 3 },
						default: '',
						description: 'Array or object of parameter values for the SQL statement (e.g. ["A", 123] or {"ID":1}).',
						displayOptions: { show: { useParameters: [true], '/mode': ['sql'] } },
					},
					{
						displayName: 'Query Timeout (ms)',
						name: 'queryTimeout',
						type: 'number',
						default: 0,
						description: 'Abort the query if it runs longer than this (0 = no timeout)',
						displayOptions: { show: { '/mode': ['sql'] } },
					},
					{
						displayName: 'Output Mode',
						name: 'outputMode',
						type: 'options',
						default: 'single',
						options: [
							{ name: 'Single Item (All Rows Array)', value: 'single' },
							{ name: 'One Item Per Row', value: 'perRow' },
						],
						description: 'How to structure the node output items',
						displayOptions: { show: { '/mode': ['sql'] } },
					},
				],
			},
		]
	};

	/**
	 * Main execution entrypoint called by n8n runtime.
	 * Iterates each incoming item, executes the configured action, and returns aggregated results.
	 */
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnItems: INodeExecutionData[] = [];

		// Retrieve credentials once (n8n handles encryption / secure storage).
		const credentials = await this.getCredentials('mapepireApi');
		const creds: DaemonServer = {
			host: credentials.host as string,
			user: credentials.user as string,
			password: credentials.password as string,
			port: credentials.port as number,
			rejectUnauthorized: !(credentials.ignoreUnauthorized as boolean),
			ca: credentials.ca ? (credentials.ca as string) : undefined,
		};


		// Helper for normalizing error objects without using 'any'
		const normalizeError = (e: unknown) => {
			const err = e as {
				message?: string;
				name?: string;
				code?: string | number;
				sqlcode?: string | number;
				sqlState?: string;
				stack?: string;
			};
			return {
				message: err?.message || String(e),
				name: err?.name,
				code: err?.code ?? err?.sqlcode,
				sqlState: err?.sqlState,
				stack: err?.stack,
			};
		};

		const reuseConnectionFirstItemAdditional = this.getNodeParameter('additionalFields', 0, {}) as { reuseConnection?: boolean };
		const reuseConnection = !!reuseConnectionFirstItemAdditional.reuseConnection;
		let sharedJob: SQLJob | null = null;

		const getJob = async () => {
			if (reuseConnection) {
				if (!sharedJob) {
					sharedJob = new SQLJob();
					await sharedJob.connect(creds);
				}
				return sharedJob;
			}
			const job = new SQLJob();
			await job.connect(creds);
			return job;
		};

		for (let i = 0; i < items.length; i++) {
			const mode = this.getNodeParameter('mode', i) as string;
			const fetchSize = this.getNodeParameter('fetchSize', i, 100) as number;
			const additional = this.getNodeParameter('additionalFields', i, {}) as {
				isTerseResults?: boolean;
				includeMetadata?: boolean;
				useParameters?: boolean;
				parametersJson?: string;
				queryTimeout?: number;
				outputMode?: 'single' | 'perRow';
			};

			const job = await getJob();
			try {
				if (mode === 'sql') {
					const sql = this.getNodeParameter('sql', i) as string;

					// Assemble query options; allow parameters injection if provided.
					const queryOpts: QueryOptions & { parameters?: unknown[] | Record<string, unknown>; timeout?: number } = {
						isTerseResults: additional.isTerseResults,
					};
					if (additional.queryTimeout && additional.queryTimeout > 0) {
						queryOpts.timeout = additional.queryTimeout;
					}
					if (additional.useParameters && additional.parametersJson) {
						try {
							const parsed = JSON.parse(additional.parametersJson);
							if (typeof parsed !== 'object' || parsed === null) {
								throw new Error('Parameters JSON must be an array or object');
							}
							queryOpts.parameters = parsed;
						} catch (err) {
							throw new Error(`Invalid Parameters JSON: ${(err as Error).message}`);
						}
					}

					const query = job.query<unknown[]>(sql, queryOpts as QueryOptions);
					let res = await query.execute(fetchSize);
					const rows: unknown[] = [];
					rows.push(...res.data);
					while (!res.is_done) {
						res = await query.fetchMore(fetchSize);
						rows.push(...res.data);
					}

					const payload: IDataObject = { rows } as IDataObject; // rows may contain primitives or objects
					if (additional.includeMetadata !== false) {
						(payload as IDataObject).metadata = res.metadata as unknown as IDataObject; // treat metadata as opaque
						(payload as IDataObject).updateCount = res.update_count as unknown as IDataObject; // numeric value acceptable
					}
						if (additional.outputMode === 'perRow') {
							for (const r of rows) {
								const rowItem: IDataObject = additional.includeMetadata !== false
									? { row: r as unknown as IDataObject, metadata: res.metadata as unknown as IDataObject }
									: { row: r as unknown as IDataObject };
								returnItems.push({ json: rowItem });
							}
						} else {
						returnItems.push({ json: payload });
					}
				} else {
					const cl = this.getNodeParameter('cl', i) as string;
					const query = await job.clcommand(cl);
					const res = await query.execute();
					returnItems.push({
						json: {
							success: res.success,
							data: res.data,
							message: res.error || null,
						},
					});
				}
			} catch (err) {
				if (this.continueOnFail()) {
					returnItems.push({ json: { error: normalizeError(err) } });
					continue;
				}
				throw err;
			} finally {
				if (!reuseConnection) {
					await job.close();
				}
			}
		}

		if (reuseConnection && sharedJob) {
			await (sharedJob as SQLJob).close();
		}
		return [returnItems];
	}
}

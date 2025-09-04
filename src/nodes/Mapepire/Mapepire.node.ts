import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
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

		for (let i = 0; i < items.length; i++) {
			const mode = this.getNodeParameter('mode', i) as string;
			const fetchSize = this.getNodeParameter('fetchSize', i, 100) as number;
			// Additional optional flags supplied by user
			const additional = this.getNodeParameter('additionalFields', i, {}) as { isTerseResults?: boolean };

			// NOTE: A new SQLJob per item; consider batching or pooling later for performance.
			const job = new SQLJob();
			await job.connect(creds);
			try {
				if (mode === 'sql') {
					const sql = this.getNodeParameter('sql', i) as string;

					// Map n8n option to Mapepire query options.
					const queryOpts: QueryOptions = { isTerseResults: additional.isTerseResults };
					// Result row shape can vary (object map or terse array); use unknown for type safety.
					const query = job.query<unknown[]>(sql, queryOpts);

					// Initial execute with fetchSize; subsequent pages via fetchMore until done.
					let res = await query.execute(fetchSize);
					const rows: unknown[] = [];
					rows.push(...res.data);
					while (!res.is_done) {
						res = await query.fetchMore(fetchSize);
						rows.push(...res.data);
					}

					// Include metadata & update count for client-side decision making.
					returnItems.push({
						json: {
							rows,
							metadata: res.metadata,
							updateCount: res.update_count,
						},
					});
				} else {
					// CL command mode: single execute, result shape differs from SQL.
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
			} finally {
				// Ensure job termination even if an error occurs above.
				await job.close();
			}
		}
		return [returnItems];
	}
}

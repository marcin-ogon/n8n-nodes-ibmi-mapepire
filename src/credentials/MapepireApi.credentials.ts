import type { ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

/**
 * Mapepire server connection definition exposed to n8n.
 * Each property becomes a field in the credentials UI.
 */
export class MapepireApi implements ICredentialType {
  name = 'mapepireApi';
  displayName = 'Mapepire Server';
  // Reuse the same logo as the node. Path is relative to compiled dist credentials file location.
  icon: Icon = 'file:../nodes/Mapepire/mapepire-logo.png';

  // Ordered list of fields the user must supply.
  properties: INodeProperties[] = [
    {
      displayName: 'Host',
      name: 'host',
      type: 'string',
      default: 'localhost',
      required: true,
      description: 'Hostname or IP address of the Mapepire daemon',
    },
    {
      displayName: 'Port',
      name: 'port',
      type: 'number',
      default: 8085,
      required: true,
      description: 'TCP port the Mapepire daemon listens on',
    },
    {
      displayName: 'User',
      name: 'user',
      type: 'string',
      default: '',
      required: true,
      description: 'IBM i user profile used for authentication',
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Password for the IBM i user profile',
    },
    {
      displayName: 'Ignore Unauthorized TLS',
      name: 'ignoreUnauthorized',
      type: 'boolean',
      default: true,
      description:
        'If true, accepts self‑signed or invalid certificates unless a CA is provided below',
    },
    {
      displayName: 'CA Certificate (PEM)',
      name: 'ca',
      type: 'string',
      default: '',
      description:
        'Optional custom CA bundle in PEM format. When set, certificate verification is enforced',
    },
  ];
}

# n8n-nodes-ibmi-mapepire

Custom n8n community node to run IBM i Db2 SQL queries and CL commands through a Mapepire server using `@ibm/mapepire-js`.

## Features
- Execute SQL queries with paging until completion
- Run CL commands
- Optionally return terse results
- Auto-close queries when done
- Support for self-signed certs or custom CA
- Optional connection reuse per execution for performance
- Prepared / parameterized SQL with JSON parameters
- Toggle inclusion of metadata
- Improved error capture with continueOnFail

## License
MIT

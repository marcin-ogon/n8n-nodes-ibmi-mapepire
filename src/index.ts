// Re-export credential and node classes so n8n can discover them when the package is loaded.
// Keep this barrel lightweight to avoid side‑effects.

// Export credentials and nodes
export * from './credentials/MapepireApi.credentials';
export * from './nodes/Mapepire/Mapepire.node';

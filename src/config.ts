// Configuration constants for the Vectra MCP Server

// Load API URL from environment variable or use default (updated to new base path)
export const VECTRA_API_URL = process.env.VECTRA_API_URL || 'http://localhost:3000/api/v1/vectra';

// Load API Key from environment variable
export const VECTRA_API_KEY = process.env.VECTRA_API_KEY;

// Add other configurations here if needed in the future

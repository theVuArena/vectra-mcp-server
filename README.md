# Vectra MCP Server

A Model Context Protocol (MCP) server for interacting with a Vectra knowledge base.

This TypeScript-based MCP server provides tools to manage and query a Vectra instance, enabling integration with MCP-compatible clients. It interacts with a backend Vectra API (presumably running separately).

## Features

### Tools

This server exposes the following tools for interacting with Vectra:

-   **`create_collection`**: Create a new Vectra collection.
    -   *Input*: `name` (string, required), `description` (string, optional)
-   **`list_collections`**: List existing Vectra collections.
    -   *Input*: None
-   **`embed_texts`**: Embeds multiple text items in batch into Vectra.
    -   *Input*: `items` (array of objects with `text` (required) and optional `metadata`), `collectionId` (string, optional)
-   **`embed_files`**: Reads multiple local files and embeds their content into Vectra.
    -   *Input*: `sources` (array of local file paths, required), `collectionId` (string, optional), `metadata` (object, optional - applies to all items)
-   **`add_file_to_collection`**: Add an already embedded file (referenced by its ID) to a specific Vectra collection.
    -   *Input*: `collectionId` (string, required), `fileId` (string, required)
-   **`list_files_in_collection`**: List files within a specific Vectra collection.
    -   *Input*: `collectionId` (string, required)
-   **`query_collection`**: Query the knowledge base within a specific Vectra collection.
    -   *Note*: This tool always uses hybrid search (vector + keyword) and enables graph search enhancement by default.
    -   *Input*: `collectionId` (string, required), `queryText` (string, required), `limit` (number, optional), `maxDistance` (number, optional), `graphDepth` (number, optional), `graphRelationshipTypes` (array of strings, optional), `includeMetadataFilters` (array of objects, optional), `excludeMetadataFilters` (array of objects, optional)
-   **`delete_file`**: Delete a file and its associated embeddings from Vectra.
    -   *Input*: `fileId` (string, required)
-   **`get_arangodb_node`**: Fetch a specific node directly from the underlying ArangoDB database by its key.
    -   *Input*: `nodeKey` (string, required - e.g., `chunk_xyz` or `doc_abc`)

*(Refer to `src/tools.ts` for detailed input schemas)*

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

Run the server (listens on stdio):
```bash
node build/index.js
```

For development with auto-rebuild:
```bash
npm run watch
```

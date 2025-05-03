// Defines the tools provided by the Vectra MCP Server

// Using JSON schema format for MCP tools
export const CreateCollectionArgsSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Name of the collection' },
    description: { type: 'string', description: 'Optional description' },
  },
  required: ['name'],
} as const;

export const ListCollectionsArgsSchema = { type: 'object', properties: {} } as const; // No args needed

// Removed EmbedFileArgsSchema as the tool is removed

export const AddFileToCollectionArgsSchema = {
  type: 'object',
  properties: {
    collectionId: { type: 'string', description: 'ID of the target collection' },
    fileId: { type: 'string', description: 'ID of the file (obtained after embedding)' },
  },
  required: ['collectionId', 'fileId'],
} as const;

export const ListFilesInCollectionArgsSchema = {
  type: 'object',
  properties: {
    collectionId: { type: 'string', description: 'ID of the collection' },
  },
  required: ['collectionId'],
} as const;

export const QueryCollectionArgsSchema = {
  type: 'object',
  properties: {
    collectionId: { type: 'string', description: 'ID of the collection to query within' },
    queryText: { type: 'string', description: 'The query text to search for' },
    limit: { type: 'number', description: 'Maximum number of results (default 10)', default: 10 },
    // searchMode is hardcoded to 'hybrid' in the server logic, removed from schema
    maxDistance: { type: 'number', description: 'Max vector distance (0-2, lower is more similar)' },
    // enableGraphSearch is hardcoded to 'true' in the server logic, removed from schema
    graphDepth: { type: 'number', description: 'Depth for graph traversal (default 1)', default: 1 },
    graphTopN: { type: 'number', description: 'Max number of neighbors to fetch per node during graph traversal (default 5)', default: 5 }, // Added missing param
    graphRelationshipTypes: {
      type: 'array',
      description: 'Optional list of relationship types to filter graph traversal (e.g., ["cites", "mentions"])',
      items: { type: 'string' }
    },
    includeMetadataFilters: {
      type: 'array',
      description: 'Filter results to include only those matching these metadata fields/values',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string', description: 'Metadata field name' },
          value: { type: 'string', description: 'Exact value to match' },
        },
        required: ['field', 'value'],
      },
    },
    excludeMetadataFilters: {
      type: 'array',
      description: 'Filter results to exclude those matching these metadata fields/patterns',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string', description: 'Metadata field name' },
          value: { type: 'string', description: 'Exact value to exclude' },
          pattern: { type: 'string', description: 'LIKE pattern to exclude (e.g., %value%)' },
        },
        required: ['field'], // Either value or pattern must be provided by caller
      },
    },
  },
  required: ['collectionId', 'queryText'], // Keep only essential required fields
} as const;

export const DeleteFileArgsSchema = {
  type: 'object',
  properties: {
    fileId: { type: 'string', description: 'ID of the file to delete' },
  },
  required: ['fileId'],
} as const;

// Removed EmbedTextArgsSchema as the tool is removed

// Schema for embedding multiple texts in batch
export const EmbedTextsArgsSchema = {
  type: 'object',
  properties: {
    collectionId: { type: 'string', description: 'Optional ID of the collection to add all texts to' },
    items: {
      type: 'array',
      description: 'An array of text items to embed',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The text content to embed' },
          metadata: {
            type: 'object',
            description: 'Optional key-value pairs for metadata for this specific text item',
            additionalProperties: { type: 'string' }
          }
        },
        required: ['text']
      }
    }
  },
  required: ['items'],
} as const;

// Schema for embedding multiple local files
export const EmbedFilesArgsSchema = {
  type: 'object',
  properties: {
    sources: {
      type: 'array',
      description: 'An array of local file paths to embed',
      items: {
        type: 'string',
        description: 'A local file path'
      }
    },
    collectionId: { type: 'string', description: 'Optional ID of the collection to add all embedded files to' },
    metadata: { // Adding top-level metadata applicable to all sources unless overridden
      type: 'object',
      description: 'Optional key-value pairs for metadata to apply to all items (e.g., tags)',
      additionalProperties: { type: 'string' }
    }
  },
  required: ['sources'],
} as const;

// Removed GetArangoDbNodeArgsSchema as the tool is removed


// List of all tools provided by the server
export const toolsList = [
  { name: 'create_collection', description: 'Create a new Vectra collection', inputSchema: CreateCollectionArgsSchema },
  { name: 'list_collections', description: 'List existing Vectra collections', inputSchema: ListCollectionsArgsSchema },
  { name: 'add_file_to_collection', description: 'Add an embedded file to a Vectra collection', inputSchema: AddFileToCollectionArgsSchema },
  { name: 'list_files_in_collection', description: 'List files within a specific Vectra collection', inputSchema: ListFilesInCollectionArgsSchema },
  { name: 'embed_texts', description: 'Embeds multiple text items in batch into Vectra', inputSchema: EmbedTextsArgsSchema },
  { name: 'embed_files', description: 'Reads multiple local files and embeds their content', inputSchema: EmbedFilesArgsSchema },
  { name: 'query_collection', description: 'Query the knowledge base within a specific Vectra collection (uses hybrid search with graph traversal)', inputSchema: QueryCollectionArgsSchema }, // Updated description
  { name: 'delete_file', description: 'Delete a file and its embeddings from Vectra', inputSchema: DeleteFileArgsSchema },
];

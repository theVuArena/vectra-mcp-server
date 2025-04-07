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

// Schema expects URL for scraping
export const EmbedFileArgsSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL of the web page to scrape and embed' },
    collectionId: { type: 'string', description: 'Optional ID of the collection to add the file to initially' },
  },
  required: ['url'],
} as const;


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
    searchMode: { type: 'string', enum: ['vector', 'keyword', 'hybrid'], description: 'Search mode (default vector)', default: 'vector' },
    // enableHeuristicReranking: { type: 'boolean', description: 'Enable heuristic re-ranking (default false)', default: false }, // REMOVED
    maxDistance: { type: 'number', description: 'Max vector distance (0-2, lower is more similar)' },
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

// List of all tools provided by the server
export const toolsList = [
  { name: 'create_collection', description: 'Create a new Vectra collection', inputSchema: CreateCollectionArgsSchema },
  { name: 'list_collections', description: 'List existing Vectra collections', inputSchema: ListCollectionsArgsSchema },
  // Using embed_file name with the URL schema
  { name: 'embed_file', description: 'Scrape content from a URL and embed it into Vectra', inputSchema: EmbedFileArgsSchema },
  { name: 'add_file_to_collection', description: 'Add an embedded file to a Vectra collection', inputSchema: AddFileToCollectionArgsSchema },
  { name: 'list_files_in_collection', description: 'List files within a specific Vectra collection', inputSchema: ListFilesInCollectionArgsSchema },
  { name: 'query_collection', description: 'Query the knowledge base within a specific Vectra collection', inputSchema: QueryCollectionArgsSchema },
  { name: 'delete_file', description: 'Delete a file and its embeddings from Vectra', inputSchema: DeleteFileArgsSchema },
];

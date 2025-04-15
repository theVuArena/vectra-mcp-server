import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { type AxiosInstance } from 'axios';
// Removed FirecrawlApp import
import { VECTRA_API_URL } from './config.js';
import { toolsList } from './tools.js';
// Import specific validators including the new one
import {
  isValidCreateCollectionArgs,
  isValidListCollectionsArgs,
  // isValidEmbedFileArgs, // Removed
  // isValidEmbedTextArgs, // Removed
  isValidAddFileToCollectionArgs,
  isValidListFilesInCollectionArgs,
  isValidQueryCollectionArgs,
  isValidDeleteFileArgs,
  isValidEmbedTextsArgs,
  isValidEmbedFilesArgs, // Added new validator import
  isValidGetArangoDbNodeArgs // Import the new validator
} from './validators.js';
// Import new handler, remove unused ones
import { handleApiCall, handleEmbedTexts, handleEmbedFiles } from './handlers.js';

// Removed Firecrawl API key logic and instance creation


export class VectraMcpServer {
  private server: Server;
  private axiosInstance: AxiosInstance;
  // Removed firecrawl instance variable, using the one declared above

  constructor() {
    this.server = new Server(
      {
        name: 'vectra-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: VECTRA_API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      validateStatus: (status) => status >= 200 && status < 500,
    });

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // List Tools Handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: toolsList, // Use the imported list
    }));

    // Call Tool Handler (Main Logic)
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Use the imported handlers and validators
        switch (name) {
          case 'create_collection':
            if (!isValidCreateCollectionArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for create_collection');
            return handleApiCall(this.axiosInstance, '/v1/collections', 'post', name, args);

          case 'list_collections':
             if (!isValidListCollectionsArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for list_collections');
            return handleApiCall(this.axiosInstance, '/v1/collections', 'get', name);

          // Removed embed_file case

          // Removed embed_text case

          case 'embed_texts':
            if (!isValidEmbedTextsArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for embed_texts');
            }
            return handleEmbedTexts(this.axiosInstance, args.items, args.collectionId);

          // Added case for embed_files (batch files/URLs)
          case 'embed_files':
            if (!isValidEmbedFilesArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for embed_files');
            }
            // Call the new batch file handler
            return handleEmbedFiles(this.axiosInstance, args.sources, args.collectionId, args.metadata);

          case 'add_file_to_collection':
            if (!isValidAddFileToCollectionArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for add_file_to_collection');
            return handleApiCall(this.axiosInstance, `/v1/collections/${args.collectionId}/files`, 'post', name, { fileId: args.fileId });

          case 'list_files_in_collection':
             if (!isValidListFilesInCollectionArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for list_files_in_collection');
            return handleApiCall(this.axiosInstance, `/v1/collections/${args.collectionId}/files`, 'get', name);

          case 'query_collection':
            if (!isValidQueryCollectionArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for query_collection');
            // Construct payload with all validated args, enforcing hybrid search and graph search
            const queryPayload = {
              queryText: args.queryText,
              limit: args.limit,
              searchMode: 'hybrid', // Always use hybrid mode
              maxDistance: args.maxDistance,
              includeMetadataFilters: args.includeMetadataFilters,
              excludeMetadataFilters: args.excludeMetadataFilters,
              // --- Add Graph Search Params ---
              enableGraphSearch: true, // Always enable graph search
              graphDepth: args.graphDepth,
              graphTopN: args.graphTopN,
              graphRelationshipTypes: args.graphRelationshipTypes,
              // --- End Graph Search Params ---
            };
            // Remove undefined keys before sending
            Object.keys(queryPayload).forEach(key => queryPayload[key as keyof typeof queryPayload] === undefined && delete queryPayload[key as keyof typeof queryPayload]);
            return handleApiCall(this.axiosInstance, `/v1/collections/${args.collectionId}/query`, 'post', name, queryPayload);

          case 'delete_file':
            if (!isValidDeleteFileArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for delete_file');
            return handleApiCall(this.axiosInstance, `/v1/files/${args.fileId}`, 'delete', name);

          // --- Add handler for the new tool ---
          case 'get_arangodb_node':
            if (!isValidGetArangoDbNodeArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for get_arangodb_node');
            // Call the new backend endpoint
            return handleApiCall(this.axiosInstance, `/v1/arangodb/nodes/${args.nodeKey}`, 'get', name);
          // --- End new tool handler ---

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`Error calling tool ${name}:`, error);
        const message = error instanceof McpError ? error.message : (error instanceof Error ? error.message : 'Unknown internal error');
        // Return error structure expected by MCP CallToolResponse
         return {
            content: [{ type: 'text', text: `Error: ${message}` }],
            isError: true,
          };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Vectra MCP server running on stdio');
  }
}

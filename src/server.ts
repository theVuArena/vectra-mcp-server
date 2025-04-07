import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { type AxiosInstance } from 'axios';
import { VECTRA_API_URL } from './config.js';
import { toolsList } from './tools.js';
import * as validators from './validators.js';
import { handleApiCall, handleEmbedFile } from './handlers.js';

export class VectraMcpServer {
  private server: Server;
  private axiosInstance: AxiosInstance;

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
            if (!validators.isValidCreateCollectionArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for create_collection');
            return handleApiCall(this.axiosInstance, '/v1/collections', 'post', name, args);

          case 'list_collections':
             if (!validators.isValidListCollectionsArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for list_collections');
            return handleApiCall(this.axiosInstance, '/v1/collections', 'get', name);

          case 'embed_file':
            if (!validators.isValidEmbedFileArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for embed_file');
            // Pass url instead of filePath to the handler
            return handleEmbedFile(this.axiosInstance, args.url, args.collectionId);

          case 'add_file_to_collection':
            if (!validators.isValidAddFileToCollectionArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for add_file_to_collection');
            return handleApiCall(this.axiosInstance, `/v1/collections/${args.collectionId}/files`, 'post', name, { fileId: args.fileId });

          case 'list_files_in_collection':
             if (!validators.isValidListFilesInCollectionArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for list_files_in_collection');
            return handleApiCall(this.axiosInstance, `/v1/collections/${args.collectionId}/files`, 'get', name);

          case 'query_collection':
            if (!validators.isValidQueryCollectionArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for query_collection');
            // Construct payload with all validated args
            const queryPayload = {
              queryText: args.queryText,
              limit: args.limit, // Pass directly, backend should handle default
              searchMode: args.searchMode,
              // enableHeuristicReranking: args.enableHeuristicReranking, // REMOVED
              maxDistance: args.maxDistance,
              includeMetadataFilters: args.includeMetadataFilters,
              excludeMetadataFilters: args.excludeMetadataFilters,
            };
            // Remove undefined keys before sending
            Object.keys(queryPayload).forEach(key => queryPayload[key as keyof typeof queryPayload] === undefined && delete queryPayload[key as keyof typeof queryPayload]);
            return handleApiCall(this.axiosInstance, `/v1/collections/${args.collectionId}/query`, 'post', name, queryPayload);

          case 'delete_file':
            if (!validators.isValidDeleteFileArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for delete_file');
            return handleApiCall(this.axiosInstance, `/v1/files/${args.fileId}`, 'delete', name);

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

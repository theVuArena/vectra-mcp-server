import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { type AxiosInstance } from 'axios';
import FirecrawlApp from '@mendable/firecrawl-js'; // Import Firecrawl SDK
import { VECTRA_API_URL } from './config.js';
import { toolsList } from './tools.js';
import * as validators from './validators.js';
import { handleApiCall, handleEmbedFile } from './handlers.js';

// Read Firecrawl API key from environment
const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
if (!firecrawlApiKey) {
  console.warn('FIRECRAWL_API_KEY environment variable not set for vectra-mcp-server. URL ingestion will fail.');
}
const firecrawl = firecrawlApiKey ? new FirecrawlApp({ apiKey: firecrawlApiKey }) : null;


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
            if (!validators.isValidCreateCollectionArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for create_collection');
            return handleApiCall(this.axiosInstance, '/v1/collections', 'post', name, args);

          case 'list_collections':
             if (!validators.isValidListCollectionsArgs(args)) throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for list_collections');
            return handleApiCall(this.axiosInstance, '/v1/collections', 'get', name);

          // Reverted tool name to embed_file and added scraping logic
          case 'embed_file':
            // Validate args and ensure correct type for TypeScript
            if (!validators.isValidEmbedFileArgs(args)) {
               throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for embed_file');
            }
            // Now TypeScript knows args has url and optional collectionId
            const embedArgs = args;

            if (!firecrawl) {
              throw new McpError(ErrorCode.InternalError, 'Firecrawl API key not configured for vectra-mcp-server.');
            }

            try {
              console.log(`Scraping URL: ${embedArgs.url}`);
              // Scrape the URL using the SDK
              const scrapeResult = await firecrawl.scrapeUrl(embedArgs.url, { onlyMainContent: true });

              // Explicitly check for success and markdown content
              let markdownContent: string | null = null;
              if (scrapeResult && 'markdown' in scrapeResult && typeof scrapeResult.markdown === 'string') {
                 markdownContent = scrapeResult.markdown;
              }

              if (!markdownContent) {
                 console.error(`Failed to scrape markdown from ${embedArgs.url}. Result:`, scrapeResult);
                 throw new McpError(ErrorCode.InternalError, `Failed to scrape content from URL: ${embedArgs.url}`);
              }
              console.log(`Scraping successful for ${embedArgs.url}. Uploading content...`);

              // Pass the scraped markdown content and original URL to the handler
              return handleEmbedFile(this.axiosInstance, markdownContent, embedArgs.url, embedArgs.collectionId);

            } catch (scrapeError) {
               console.error(`Error during Firecrawl scraping for ${embedArgs.url}:`, scrapeError);
               const message = scrapeError instanceof Error ? scrapeError.message : 'Unknown scraping error';
               throw new McpError(ErrorCode.InternalError, `Scraping failed for ${embedArgs.url}: ${message}`);
            }

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

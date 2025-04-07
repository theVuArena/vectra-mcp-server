import type { AxiosInstance } from 'axios';
import { AxiosError } from 'axios';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import FormData from 'form-data';
import path from 'path';

// --- Response Formatting ---

// Helper to format tool results concisely
export function formatResponse(toolName: string, responseData: any): { content: Array<{ type: 'text', text: string }> } {
  let summary = `Tool '${toolName}' executed successfully.`; // Default message

  try {
    switch (toolName) {
      case 'list_collections':
        if (Array.isArray(responseData) && responseData.length > 0) {
          summary = "Collections:\n" + responseData.map((col: any) => `- ${col.name} (ID: ${col.id})`).join('\n');
        } else if (Array.isArray(responseData)) {
          summary = "No collections found.";
        } else if (responseData?.data?.collections && Array.isArray(responseData.data.collections)) {
           // Handle potential nesting like { status: 'success', data: { collections: [...] } }
           if (responseData.data.collections.length > 0) {
             summary = "Collections:\n" + responseData.data.collections.map((col: any) => `- ${col.name} (ID: ${col.id})`).join('\n');
           } else {
             summary = "No collections found.";
           }
        }
        break;
      case 'create_collection':
        if (responseData?.id && responseData?.name) {
          summary = `Created collection "${responseData.name}" (ID: ${responseData.id}).`;
        }
        break;
      case 'add_file_to_collection':
        summary = responseData?.message || `File successfully added to collection.`;
        break;
      case 'list_files_in_collection':
         if (responseData?.data?.files && Array.isArray(responseData.data.files)) {
           if (responseData.data.files.length > 0) {
              summary = `Files in collection:\n` + responseData.data.files.map((file: any) => `- ${file.filename} (ID: ${file.id})`).join('\n');
           } else {
              summary = "No files found in this collection.";
           }
         }
        break;
      case 'query_collection':
        if (responseData?.data?.results && Array.isArray(responseData.data.results)) {
          // Filter out results with section title 'DOCKER'
          const filteredResults = responseData.data.results.filter((res: any) => res.metadata?.section_title !== 'DOCKER');

          if (filteredResults.length > 0) {
            summary = "Query Results:\n" + filteredResults.map((res: any, index: number) => {
              const text = res.metadata?.chunk_text || 'No text found';
              const section = res.metadata?.section_title || 'Unknown Section';
              const distance = res.distance?.toFixed(4) || 'N/A';
              // Return the full text instead of a substring
              return `${index + 1}. [Section: ${section}] (Distance: ${distance})\n   ${text}`;
            }).join('\n\n');
          } else {
            summary = "No relevant results found for the query in this collection.";
          }
        }
        break;
       case 'delete_file':
           // API returns 204 No Content, so responseData will be empty on success
           summary = `File deleted successfully.`;
           break;
      // Add cases for other tools if needed
    }
  } catch (e) {
    console.error("Error formatting response:", e);
    summary = `Tool '${toolName}' executed, but response formatting failed. Raw data: ${JSON.stringify(responseData)}`;
  }

  return { content: [{ type: 'text', text: summary }] };
}

// --- API Call Handlers ---

// Helper for standard JSON API calls
export async function handleApiCall(
    axiosInstance: AxiosInstance,
    endpoint: string,
    method: 'get' | 'post' | 'put' | 'delete',
    toolName: string, // Now required
    data?: any
) {
  try {
    const response = await axiosInstance({ method, url: endpoint, data });

    // Check for API-level errors (4xx, 5xx handled by validateStatus)
    if (response.status >= 400) {
       const errorData = response.data;
       const errorMessage = errorData?.message || `API Error: ${response.status} ${response.statusText}`;
       console.error(`API Error calling ${method.toUpperCase()} ${endpoint}:`, errorMessage, errorData);
       throw new McpError(ErrorCode.InternalError, errorMessage);
    }

    // Format the successful response
    // Handle 204 No Content for DELETE
    if (method === 'delete' && response.status === 204) {
       return formatResponse(toolName, null); // Pass null for formatting delete success
    }
    return formatResponse(toolName, response.data);

  } catch (error) {
     if (error instanceof McpError) throw error; // Re-throw known MCP errors

     // Handle Axios-specific errors or network issues
     let errorMessage = `Failed to communicate with Vectra API during ${toolName}`;
     if (error instanceof AxiosError) {
       errorMessage = error.message;
       if (error.response?.data?.message) {
          errorMessage = `${errorMessage}: ${error.response.data.message}`;
       }
     } else if (error instanceof Error) {
       errorMessage = error.message;
     }
     console.error(`Network/Axios Error calling ${method.toUpperCase()} ${endpoint}:`, error);
     throw new McpError(ErrorCode.InternalError, errorMessage);
  }
}

// Specific handler for uploading scraped content
export async function handleEmbedFile(
    axiosInstance: AxiosInstance,
    scrapedContent: string, // Changed from url to scrapedContent (string)
    originalUrl: string, // Keep original URL for filename/metadata
    collectionId?: string
) {
  const toolName = 'embed_file';
  try {
    // Use original URL to generate a filename, or use a UUID
    const fileName = `${new URL(originalUrl).hostname}_${Date.now()}.md`; // Example filename
    const formData = new FormData();
    // Append content as a buffer
    formData.append('file', Buffer.from(scrapedContent, 'utf-8'), fileName);
    if (collectionId) {
      formData.append('collection_id', collectionId); // API expects this field name
    }
    // Add original URL to metadata if the API supports it via form data (check API docs)
    // formData.append('metadata[sourceUrl]', originalUrl); // Example if API supports nested metadata

    // Call the original upload endpoint
    const response = await axiosInstance.post('/v1/files/upload', formData, {
      headers: formData.getHeaders(), // Important for multipart/form-data
    });

     // Check for API-level errors (4xx)
    if (response.status >= 400) {
       const errorData = response.data;
       const errorMessage = errorData?.message || `API Error: ${response.status} ${response.statusText}`;
       console.error(`API Error calling POST /v1/files/upload for scraped content:`, errorMessage, errorData);
       throw new McpError(ErrorCode.InternalError, errorMessage);
    }

    // Format the successful response
    let summary = `Successfully uploaded scraped content from "${originalUrl}". Embedding is pending.`;
    if (response.data?.data?.id) {
       summary += ` File ID: ${response.data.data.id}`;
    }
    return { content: [{ type: 'text', text: summary }] };

  } catch (error) {
     if (error instanceof McpError) throw error; // Re-throw known MCP errors

     let errorMessage = `Failed to upload scraped content from ${originalUrl}`;
      if (error instanceof AxiosError) {
       errorMessage = error.message;
       if (error.response?.data?.message) {
          errorMessage = `${errorMessage}: ${error.response.data.message}`;
       }
     } else if (error instanceof Error) {
       errorMessage = error.message;
     }
     console.error(`Error uploading scraped content from ${originalUrl}:`, error);
     throw new McpError(ErrorCode.InternalError, errorMessage);
  }
}

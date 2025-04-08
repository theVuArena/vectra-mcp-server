import type { AxiosInstance } from 'axios';
import axios, { AxiosError } from 'axios'; // Added axios import
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


// Handler for embedding multiple text items in batch
export async function handleEmbedTexts(
    axiosInstance: AxiosInstance,
    items: Array<{ text: string; metadata?: Record<string, string> }>,
    collectionId?: string
) {
  const toolName = 'embed_texts';
  const results: Array<{ fileId?: string; sourceDesc: string; error?: string }> = [];
  let successCount = 0;
  let errorCount = 0;

  console.log(`Starting batch embed of ${items.length} items...`);

  for (const item of items) {
    // Generate a placeholder URL/filename for each item
    const placeholderUrl = `batch-text-item-${Date.now()}.txt`;
    const sourceDesc = item.metadata?.source_url || item.metadata?.file_path || `text item ${results.length + 1}`;

    try {
      // Call the single embed handler for each item
      const result = await handleEmbedFileContent( // Corrected function name
        axiosInstance,
        item.text,
        placeholderUrl, // Use placeholder for filename generation
        collectionId,
        item.metadata // Pass item-specific metadata
      );

      // Extract file ID from the successful response summary
      let fileId: string | undefined;
      if (result.content[0]?.text) {
         const match = result.content[0].text.match(/File ID: ([a-f0-9-]+)/);
         if (match) {
            fileId = match[1];
         }
      }

      results.push({ fileId, sourceDesc });
      successCount++;
      console.log(`Successfully processed item: ${sourceDesc} (File ID: ${fileId || 'N/A'})`);

    } catch (error) {
      const message = error instanceof McpError ? error.message : (error instanceof Error ? error.message : 'Unknown error');
      console.error(`Error processing item ${sourceDesc}:`, message);
      results.push({ sourceDesc, error: message });
      errorCount++;
    }
    // Optional: Add a small delay between calls if needed to avoid rate limits
    // await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Format the final summary response
  let summary = `Batch embed completed. ${successCount} items succeeded, ${errorCount} items failed.`;
  if (successCount > 0) {
     summary += `\nSuccessful File IDs: ${results.filter(r => r.fileId).map(r => r.fileId).join(', ')}`;
  }
   if (errorCount > 0) {
     summary += `\nFailed items: ${results.filter(r => r.error).map(r => `${r.sourceDesc} (${r.error})`).join(', ')}`;
  }

  return { content: [{ type: 'text', text: summary }] };
}


// Handler for embedding multiple local files
export async function handleEmbedFiles(
    axiosInstance: AxiosInstance,
    sources: string[], // Now expects only file paths
    collectionId?: string,
    baseMetadata?: Record<string, string> // Optional base metadata for all items
) {
  const toolName = 'embed_files';
  const results: Array<{ fileId?: string; source: string; error?: string }> = [];
  let successCount = 0;
  let errorCount = 0;

  console.log(`Starting batch embed of ${sources.length} sources...`);

  for (const source of sources) {
    let content: string | null = null;
    let errorMsg: string | null = null;
    const itemMetadata: Record<string, string> = { ...baseMetadata }; // Start with base metadata

    try {
      // Assume it's a local file path
      itemMetadata['file_path'] = source; // Add file path to metadata
      content = await fs.readFile(source, 'utf-8');
      console.log(`Successfully read content from file: ${source}`);
    } catch (readError) {
      if (readError instanceof Error) {
        errorMsg = `Failed to read file "${source}": ${readError.message}`;
      } else {
        errorMsg = `Failed to read file "${source}": Unknown error`;
      }
      console.error(errorMsg);
    }

    if (content !== null) {
      try {
        // Call the single embed handler for the content
        const result = await handleEmbedFileContent( // Corrected function name
          axiosInstance,
          content,
          source, // Pass original source string for filename generation/fallback
          collectionId,
          itemMetadata // Pass combined metadata
        );

        // Extract file ID from the successful response summary
        let fileId: string | undefined;
        if (result.content[0]?.text) {
           const match = result.content[0].text.match(/File ID: ([a-f0-9-]+)/);
           if (match) {
              fileId = match[1];
           }
        }

        results.push({ fileId, source });
        successCount++;
        console.log(`Successfully processed source: ${source} (File ID: ${fileId || 'N/A'})`);

      } catch (embedError) {
        const message = embedError instanceof McpError ? embedError.message : (embedError instanceof Error ? embedError.message : 'Unknown embedding error');
        errorMsg = `Error processing source ${source}: ${message}`;
        console.error(errorMsg);
        results.push({ source, error: message });
        errorCount++;
      }
    } else {
      // Error occurred during read
      results.push({ source, error: errorMsg || 'Failed to read file content' });
      errorCount++;
    }
     // Optional: Add a small delay between calls if needed
     // await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Format the final summary response
  let summary = `Batch embed files completed. ${successCount} sources succeeded, ${errorCount} sources failed.`;
  if (successCount > 0) {
     summary += `\nSuccessful File IDs: ${results.filter(r => r.fileId).map(r => r.fileId).join(', ')}`;
  }
   if (errorCount > 0) {
     summary += `\nFailed sources: ${results.filter(r => r.error).map(r => `${r.source} (${r.error})`).join(', ')}`;
  }

  return { content: [{ type: 'text', text: summary }] };
}


// Specific handler for uploading file content (renamed from handleEmbedFile for clarity)
// Note: This handler is still used internally by handleEmbedTexts and handleEmbedFiles
export async function handleEmbedFileContent(
    axiosInstance: AxiosInstance,
    scrapedContent: string,
    sourceIdentifier: string, // Used for filename generation or as fallback metadata (can be path or placeholder)
    collectionId?: string,
    metadata?: Record<string, string> // Added optional metadata parameter
) {
  // Determine tool name based on metadata (file_path or placeholder)
  const toolName = metadata?.file_path ? 'embed_files' : 'embed_texts'; // Adjusted logic
  let fileName: string;

  // Generate filename based on sourceIdentifier (prefer path.basename if it looks like a path)
  try {
     // Check if it looks like a path before using basename
     if (sourceIdentifier.includes(path.sep) || sourceIdentifier.includes('/')) {
        fileName = path.basename(sourceIdentifier);
     } else {
        // Use sourceIdentifier directly if it doesn't look like a path (e.g., placeholder)
        // Or create a generic name if it's empty/invalid
        fileName = sourceIdentifier || `embedded-content-${Date.now()}.txt`;
     }
     // Add a timestamp to avoid potential collisions if basename isn't unique enough
     const ext = path.extname(fileName);
     const base = path.basename(fileName, ext);
     fileName = `${base}-${Date.now()}${ext || '.txt'}`; // Ensure extension

  } catch (e) {
     console.warn(`Could not generate filename from sourceIdentifier "${sourceIdentifier}". Using generic name.`);
     fileName = `embedded-content-${Date.now()}.txt`;
  }


  try {
    const formData = new FormData();
    // Append content as a buffer under the 'files' field name
    formData.append('files', Buffer.from(scrapedContent, 'utf-8'), fileName); // Changed 'file' to 'files'
    if (collectionId) {
      formData.append('collection_id', collectionId); // API expects this field name
    }

    // Add provided metadata to the form data, ensuring source_url/file_path from itemMetadata are included
    const finalMetadata = { ...metadata }; // Copy incoming metadata
    if (!finalMetadata.source_url && !finalMetadata.file_path) {
        // Add sourceIdentifier as fallback if no specific source metadata provided
        if (sourceIdentifier.startsWith('http://') || sourceIdentifier.startsWith('https://')) {
            finalMetadata.source_url = sourceIdentifier;
        } else if (sourceIdentifier.includes(path.sep) || sourceIdentifier.includes('/')) {
             finalMetadata.file_path = sourceIdentifier;
        }
    }

    if (finalMetadata) {
      for (const key in finalMetadata) {
        if (Object.prototype.hasOwnProperty.call(finalMetadata, key)) {
          formData.append(`metadata[${key}]`, finalMetadata[key]);
        }
      }
    }

    // Call the original upload endpoint
    const response = await axiosInstance.post('/v1/files/upload', formData, {
      headers: formData.getHeaders(), // Important for multipart/form-data
    });

     // Check for API-level errors (4xx)
    if (response.status >= 400) {
       const errorData = response.data;
       const errorMessage = errorData?.message || `API Error: ${response.status} ${response.statusText}`;
       console.error(`API Error calling POST /v1/files/upload for content from "${sourceIdentifier}":`, errorMessage, errorData);
       throw new McpError(ErrorCode.InternalError, errorMessage);
    }

    // Format the successful response
    let sourceDesc = finalMetadata?.file_path || finalMetadata?.source_url || sourceIdentifier;
    let summary = `Successfully uploaded content from "${sourceDesc}". Embedding is pending.`;
    if (response.data?.data?.id) {
       summary += ` File ID: ${response.data.data.id}`;
    }
    // Include metadata in the response summary if present
    if (finalMetadata && Object.keys(finalMetadata).length > 0) {
       summary += `\nMetadata: ${JSON.stringify(finalMetadata)}`;
    }
    return { content: [{ type: 'text', text: summary }] };

  } catch (error) {
     if (error instanceof McpError) throw error; // Re-throw known MCP errors

     let sourceDesc = metadata?.file_path || metadata?.source_url || sourceIdentifier;
     let errorMessage = `Failed to upload content from "${sourceDesc}"`;
      if (error instanceof AxiosError) {
       errorMessage = error.message;
       if (error.response?.data?.message) {
          errorMessage = `${errorMessage}: ${error.response.data.message}`;
       }
     } else if (error instanceof Error) {
       errorMessage = error.message;
     }
     console.error(`Error uploading content from ${sourceDesc}:`, error);
     throw new McpError(ErrorCode.InternalError, errorMessage);
  }
}

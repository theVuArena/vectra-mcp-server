// Type guards for validating MCP tool arguments

export function isValidCreateCollectionArgs(args: any): args is { name: string; description?: string } {
  return typeof args === 'object' && args !== null && typeof args.name === 'string' && (args.description === undefined || typeof args.description === 'string');
}

export function isValidListCollectionsArgs(args: any): args is {} {
  return typeof args === 'object' && args !== null && Object.keys(args).length === 0;
}

// Reverted validator name and check for 'url'
export function isValidEmbedFileArgs(args: any): args is { url: string; collectionId?: string } {
  // Basic check for url format
  return typeof args === 'object' && args !== null && typeof args.url === 'string' && args.url.length > 0 && (args.collectionId === undefined || typeof args.collectionId === 'string');
}

export function isValidAddFileToCollectionArgs(args: any): args is { collectionId: string; fileId: string } {
  return typeof args === 'object' && args !== null && typeof args.collectionId === 'string' && typeof args.fileId === 'string';
}

export function isValidListFilesInCollectionArgs(args: any): args is { collectionId: string } {
  return typeof args === 'object' && args !== null && typeof args.collectionId === 'string';
}

// Define the type explicitly for clarity, matching the schema
type QueryCollectionArgs = {
  collectionId: string;
  queryText: string;
  limit?: number;
  searchMode?: 'vector' | 'keyword' | 'hybrid';
  // enableHeuristicReranking?: boolean; // REMOVED Property
  maxDistance?: number;
  includeMetadataFilters?: Array<{ field: string; value: string }>;
  excludeMetadataFilters?: Array<{ field: string; value?: string; pattern?: string }>;
};

// Re-declare the function with the explicit type for better type safety
export function isValidQueryCollectionArgs(args: any): args is QueryCollectionArgs {
   if (typeof args !== 'object' || args === null) return false;
   if (typeof args.collectionId !== 'string' || typeof args.queryText !== 'string') return false;
   if (args.limit !== undefined && typeof args.limit !== 'number') return false;
   if (args.searchMode !== undefined && !['vector', 'keyword', 'hybrid'].includes(args.searchMode)) return false;
   // if (args.enableHeuristicReranking !== undefined && typeof args.enableHeuristicReranking !== 'boolean') return false; // REMOVED Check
   if (args.maxDistance !== undefined && typeof args.maxDistance !== 'number') return false;

   // Validate includeMetadataFilters (if present)
   if (args.includeMetadataFilters !== undefined) {
     if (!Array.isArray(args.includeMetadataFilters)) return false;
     for (const filter of args.includeMetadataFilters) {
       if (typeof filter !== 'object' || filter === null || typeof filter.field !== 'string' || typeof filter.value !== 'string') return false;
     }
   }

   // Validate excludeMetadataFilters (if present)
   if (args.excludeMetadataFilters !== undefined) {
     if (!Array.isArray(args.excludeMetadataFilters)) return false;
     for (const filter of args.excludeMetadataFilters) {
       if (typeof filter !== 'object' || filter === null || typeof filter.field !== 'string') return false;
       if (filter.value === undefined && filter.pattern === undefined) return false; // Must have value or pattern
       if (filter.value !== undefined && typeof filter.value !== 'string') return false;
       if (filter.pattern !== undefined && typeof filter.pattern !== 'string') return false;
     }
   }

   return true; // All checks passed
}


export function isValidDeleteFileArgs(args: any): args is { fileId: string } {
  return typeof args === 'object' && args !== null && typeof args.fileId === 'string';
}

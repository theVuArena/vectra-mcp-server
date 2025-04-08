// Type guards for validating MCP tool arguments

export function isValidCreateCollectionArgs(args: any): args is { name: string; description?: string } {
  return typeof args === 'object' && args !== null && typeof args.name === 'string' && (args.description === undefined || typeof args.description === 'string');
}

export function isValidListCollectionsArgs(args: any): args is {} {
  return typeof args === 'object' && args !== null && Object.keys(args).length === 0;
}

// Removed isValidEmbedFileArgs

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

// Removed isValidEmbedTextArgs

// Type definition for a single item in the embed_texts batch
type EmbedTextItem = {
  text: string;
  metadata?: Record<string, string>;
};

// Validator for the batch embed_texts tool
export function isValidEmbedTextsArgs(args: any): args is { items: EmbedTextItem[]; collectionId?: string } {
  if (typeof args !== 'object' || args === null) {
    return false;
  }
  if (args.collectionId !== undefined && typeof args.collectionId !== 'string') {
    return false;
  }
  if (!Array.isArray(args.items)) {
    return false;
  }
  // Check each item in the array
  for (const item of args.items) {
    if (typeof item !== 'object' || item === null || typeof item.text !== 'string') {
      return false; // Each item must be an object with a text string
    }
    // Validate metadata within each item if present
    if (item.metadata !== undefined) {
      if (typeof item.metadata !== 'object' || item.metadata === null || Array.isArray(item.metadata)) {
        return false;
      }
      for (const key in item.metadata) {
        if (Object.prototype.hasOwnProperty.call(item.metadata, key)) {
          if (typeof item.metadata[key] !== 'string') {
            return false; // Ensure all metadata values are strings
          }
        }
      }
    }
  }
  return true; // All checks passed
}


// Type definition for embed_files arguments
type EmbedFilesArgs = {
  sources: string[];
  collectionId?: string;
  metadata?: Record<string, string>;
};

// Validator for the batch embed_files tool
export function isValidEmbedFilesArgs(args: any): args is EmbedFilesArgs {
  if (typeof args !== 'object' || args === null) {
    return false;
  }
  if (args.collectionId !== undefined && typeof args.collectionId !== 'string') {
    return false;
  }
  // Validate sources array
  if (!Array.isArray(args.sources) || args.sources.length === 0) { // Must have at least one source
    return false;
  }
  for (const source of args.sources) {
    if (typeof source !== 'string' || source.trim() === '') {
      return false; // Each source must be a non-empty string
    }
  }
  // Validate optional top-level metadata
  if (args.metadata !== undefined) {
    if (typeof args.metadata !== 'object' || args.metadata === null || Array.isArray(args.metadata)) {
      return false;
    }
    for (const key in args.metadata) {
      if (Object.prototype.hasOwnProperty.call(args.metadata, key)) {
        if (typeof args.metadata[key] !== 'string') {
          return false; // Ensure all metadata values are strings
        }
      }
    }
  }
  return true; // All checks passed
}

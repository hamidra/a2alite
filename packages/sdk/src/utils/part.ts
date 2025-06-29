import type {
  TextPart,
  FilePart,
  DataPart,
  FileWithBytes,
  FileWithUri,
} from "../types/types.js";

/**
 * Creates a text part with the given content and metadata
 */
export function createTextPart(
  text: string,
  metadata?: Record<string, any>
): TextPart {
  return {
    kind: "text",
    text,
    ...(metadata && { metadata }),
  };
}

/**
 * Creates a file part with the given file data and metadata
 */
export function createFilePart(
  file: FileWithBytes | FileWithUri,
  metadata?: Record<string, any>
): FilePart {
  return {
    kind: "file",
    file,
    ...(metadata && { metadata }),
  };
}

export function isFileWithBytes(
  file: FileWithBytes | FileWithUri
): file is FileWithBytes {
  return "bytes" in file;
}

export function isFileWithUri(
  file: FileWithBytes | FileWithUri
): file is FileWithUri {
  return "uri" in file;
}

/**
 * Creates a data part with the given data and metadata
 */
export function createDataPart(
  data: Record<string, any>,
  metadata?: Record<string, any>
): DataPart {
  return {
    kind: "data",
    data,
    ...(metadata && { metadata }),
  };
}

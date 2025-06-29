import type {
  Artifact,
  Part,
  FileWithBytes,
  FileWithUri,
  FilePart,
  DataPart,
  TextPart,
} from "../types/types.js";

import { v4 as uuidv4 } from "uuid";

export class ArtifactHandler {
  private artifact: Artifact;

  constructor(base?: Partial<Artifact> | Artifact) {
    this.artifact = {
      artifactId: base?.artifactId || uuidv4(),
      name: base?.name,
      description: base?.description,
      metadata: base?.metadata,
      parts: base?.parts || [],
    };
  }

  withId(artifactId: string): ArtifactHandler {
    this.artifact.artifactId = artifactId;
    return this;
  }

  withName(name: string): ArtifactHandler {
    this.artifact.name = name;
    return this;
  }

  withDescription(description: string): ArtifactHandler {
    this.artifact.description = description;
    return this;
  }

  withParts(parts: Part[]): ArtifactHandler {
    this.artifact.parts = [...parts];
    return this;
  }

  addParts(parts: Part[]): ArtifactHandler {
    this.artifact.parts.push(...parts);
    return this;
  }

  clearParts(): ArtifactHandler {
    this.artifact.parts = [];
    return this;
  }

  withMetadata(metadata: Record<string, any>): ArtifactHandler {
    this.artifact.metadata = metadata;
    return this;
  }

  getArtifact(): Artifact {
    return { ...this.artifact };
  }

  getParts(): Part[] {
    return [...this.artifact.parts];
  }

  getTextParts(): Array<TextPart> {
    return this.artifact.parts.filter(
      (part: Part): part is TextPart => part.kind === "text"
    );
  }

  getFileParts(): Array<FilePart> {
    return this.artifact.parts.filter(
      (part: Part): part is FilePart => part.kind === "file"
    );
  }

  getDataParts(): Array<DataPart> {
    return this.artifact.parts.filter(
      (part: Part): part is DataPart => part.kind === "data"
    );
  }

  // Static factory methods
  static fromText(
    text: string,
    metadata?: Record<string, any>
  ): ArtifactHandler {
    return new ArtifactHandler({
      parts: [
        {
          kind: "text",
          text,
          metadata,
        },
      ],
    });
  }

  static fromFile(
    file: FileWithBytes | FileWithUri,
    metadata?: Record<string, any>
  ): ArtifactHandler {
    const name = (file as any).name || "file-artifact";
    return new ArtifactHandler({
      name,
      parts: [
        {
          kind: "file",
          file,
          metadata,
        },
      ],
    });
  }

  static fromData(data: any, metadata?: Record<string, any>): ArtifactHandler {
    return new ArtifactHandler({
      parts: [
        {
          kind: "data",
          data,
          metadata,
        },
      ],
    });
  }
}

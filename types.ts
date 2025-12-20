export interface LabParameter {
  id: string;
  label: string;
}

export type LabResults = Record<string, string | null>;

export interface ProcessedBatch {
  id: string;
  originalText: string;
  results: LabResults;
  timestamp: Date;
}
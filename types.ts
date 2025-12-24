export type LabCategory = 'cbc' | 'coagulation' | 'biochemistry';

export interface LabParameter {
  id: string;
  label: string;
  category: LabCategory;
}

export type LabResults = Record<string, string | null>;

export interface ProcessedBatch {
  id: string;
  originalText: string;
  results: LabResults;
  timestamp: Date;
}
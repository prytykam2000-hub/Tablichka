export type LabCategory = 'cbc' | 'biochemistry' | 'coagulation' | 'other';

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
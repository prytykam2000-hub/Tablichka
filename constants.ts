import { LabParameter } from './types';

// Order: CBC -> Biochemistry -> Coagulation -> Procalcitonin (Other)
export const LAB_PARAMETERS: LabParameter[] = [
  // --- Загальний аналіз крові (CBC) ---
  { id: 'leukocytes', label: 'Лейкоцити (WBC)', category: 'cbc' },
  { id: 'erythrocytes', label: 'Еритроцити (RBC)', category: 'cbc' },
  { id: 'hemoglobin', label: 'Гемоглобін (HGB)', category: 'cbc' },
  { id: 'hematocrit', label: 'Гематокрит (HCT)', category: 'cbc' },
  { id: 'platelets', label: 'Тромбоцити (PLT)', category: 'cbc' },
  { id: 'esr', label: 'ШОЕ (ESR)', category: 'cbc' },

  // --- Біохімія (Biochemistry) ---
  { id: 'bilirubin_total', label: 'Білірубін загальний', category: 'biochemistry' },
  { id: 'alt', label: 'АЛТ (ALT)', category: 'biochemistry' },
  { id: 'ast', label: 'АСТ (AST)', category: 'biochemistry' },
  { id: 'urea', label: 'Сечовина', category: 'biochemistry' },
  { id: 'creatinine', label: 'Креатинін', category: 'biochemistry' },
  { id: 'amylase', label: 'Альфа-амілаза', category: 'biochemistry' },
  { id: 'glucose', label: 'Глюкоза', category: 'biochemistry' },
  { id: 'protein_total', label: 'Білок загальний', category: 'biochemistry' },
  { id: 'iron', label: 'Залізо', category: 'biochemistry' },
  { id: 'sodium', label: 'Натрій (Na+)', category: 'biochemistry' },
  { id: 'potassium', label: 'Калій (K+)', category: 'biochemistry' },
  { id: 'chlorine', label: 'Хлор (Cl-)', category: 'biochemistry' },
  { id: 'crp', label: 'CRP (C-реактивний білок)', category: 'biochemistry' },
  { id: 'albumin', label: 'Альбумін', category: 'biochemistry' },

  // --- Коагулограма (Coagulation) ---
  { id: 'prothrombin_time', label: 'Протромбіновий час', category: 'coagulation' },
  { id: 'inr', label: 'МНО (INR)', category: 'coagulation' },
  { id: 'prothrombin_quick', label: 'Протромбін по Квіку', category: 'coagulation' },
  { id: 'fibrinogen', label: 'Фібриноген', category: 'coagulation' },
  { id: 'aptt', label: 'АЧТЧ (APTT)', category: 'coagulation' },
  
  // --- Інше (Other) ---
  { id: 'procalcitonin', label: 'Прокальцитонін', category: 'other' },
];
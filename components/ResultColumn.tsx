import React, { useState, useMemo } from 'react';
import { LAB_PARAMETERS } from '../constants';
import { LabResults, LabCategory } from '../types';

interface ResultColumnProps {
  mergedResults: LabResults;
  fragmentCount: number;
}

interface CategoryConfig {
  id: LabCategory;
  title: string;
}

// Order strictly defined: CBC -> Biochemistry -> Coagulation -> Other
const CATEGORIES: CategoryConfig[] = [
  { id: 'cbc', title: 'Загальний аналіз крові' },
  { id: 'biochemistry', title: 'Біохімія' },
  { id: 'coagulation', title: 'Коагулограма' },
  { id: 'other', title: 'Інше' },
];

export const ResultColumn: React.FC<ResultColumnProps> = ({ mergedResults, fragmentCount }) => {
  const [copied, setCopied] = useState(false);

  // Format value: replaces dot with comma, returns empty string for null/undefined
  const formatValue = (val: string | null | undefined): string => {
    if (val === null || val === undefined || val === '') return '';
    return val.replace('.', ',');
  };

  // Determine which categories have at least one value present
  const activeCategories = useMemo(() => {
    const active = new Set<LabCategory>();
    let hasAnyData = false;

    LAB_PARAMETERS.forEach(param => {
      const val = mergedResults[param.id];
      if (val && val !== '') {
        active.add(param.category);
        hasAnyData = true;
      }
    });

    // If no data is found at all, show all categories by default (empty template)
    if (!hasAnyData) {
      return CATEGORIES;
    }

    // Return only categories that have data, strictly preserving the CATEGORIES order
    return CATEGORIES.filter(cat => active.has(cat.id));
  }, [mergedResults]);

  const generateClipboardString = () => {
    // We iterate through ACTIVE categories only.
    let clipboardText = '';
    
    activeCategories.forEach((cat, index) => {
      const catParams = LAB_PARAMETERS.filter(p => p.category === cat.id);
      const catText = catParams.map(param => formatValue(mergedResults[param.id])).join('\n');
      
      clipboardText += catText;
      
      // Add a newline between blocks if there are multiple active blocks
      if (index < activeCategories.length - 1) {
        clipboardText += '\n';
      }
    });

    return clipboardText;
  };

  const handleCopy = async () => {
    const str = generateClipboardString();
    try {
      await navigator.clipboard.writeText(str);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
        <div className="flex items-baseline gap-2">
          <h2 className="font-semibold text-slate-700">Зведений результат</h2>
          {fragmentCount > 0 && (
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {fragmentCount} фрагм.
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            copied
              ? "bg-green-100 text-green-700 border border-green-200"
              : "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg"
          }`}
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Скопійовано
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Копіювати
            </>
          )}
        </button>
      </div>

      <div className="p-0 overflow-auto flex-1 bg-slate-50/50">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-xs text-slate-500 uppercase bg-slate-100 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-3 w-2/3">Показник</th>
              <th className="px-4 py-3 w-1/3 text-right">Значення (Excel)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeCategories.map((category) => {
              const catParams = LAB_PARAMETERS.filter(p => p.category === category.id);
              
              return (
                <React.Fragment key={category.id}>
                  {/* Category Header */}
                  <tr className="bg-slate-200/60">
                    <td colSpan={2} className="px-4 py-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      {category.title}
                    </td>
                  </tr>
                  
                  {/* Category Rows */}
                  {catParams.map((param) => {
                    const rawValue = mergedResults[param.id];
                    const formattedValue = formatValue(rawValue);
                    const hasValue = formattedValue !== '';

                    return (
                      <tr key={param.id} className={hasValue ? "bg-blue-50/30" : "bg-white"}>
                        <td className="px-4 py-2 text-slate-600 font-medium whitespace-nowrap overflow-hidden text-ellipsis" title={param.label}>
                          {param.label}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-slate-800">
                          {formattedValue || <span className="text-slate-300 italic">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="p-3 text-xs text-center text-slate-400 border-t border-slate-100 bg-slate-50 rounded-b-xl">
        Порядок: Загальний аналіз крові → Біохімія → Коагулограма → Інше
      </div>
    </div>
  );
};
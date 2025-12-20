import React, { useState, useMemo, useRef, useEffect } from 'react';
import { extractLabData } from './services/geminiService';
import { ResultColumn } from './components/ResultColumn';
import { LabResults } from './types';
import Peer from 'peerjs';
import QRCode from 'react-qr-code';

// Icons
const BeakerIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const PhotoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const PaperAirplaneIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

interface BatchData {
  id: number;
  text: string;
  results: LabResults;
  isImage?: boolean;
}

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batches, setBatches] = useState<Array<BatchData>>([]);
  const [error, setError] = useState<string | null>(null);
  
  // State to hold the new result while user decides (Merge vs Replace)
  const [pendingBatch, setPendingBatch] = useState<BatchData | null>(null);

  // Sync / PeerJS State
  const [peerId, setPeerId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [showQrModal, setShowQrModal] = useState(false);
  const [isClientMode, setIsClientMode] = useState(false);
  const peerRef = useRef<any>(null);
  const connRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize PeerJS
  useEffect(() => {
    // Check if we are a client (phone) connecting to a host (PC)
    const params = new URLSearchParams(window.location.search);
    const hostId = params.get('host');

    if (hostId) {
      setIsClientMode(true);
      setConnectionStatus('connecting');
    }

    // Create Peer
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('My peer ID is: ' + id);
      setPeerId(id);

      if (hostId) {
        // We are Client: Connect to Host
        const conn = peer.connect(hostId);
        
        conn.on('open', () => {
          console.log('Connected to host!');
          setConnectionStatus('connected');
          connRef.current = conn;
        });

        conn.on('error', (err) => {
          console.error('Connection error', err);
          setConnectionStatus('disconnected');
          setError('Не вдалося підключитися до комп\'ютера. Спробуйте оновити сторінку.');
        });
      }
    });

    if (!hostId) {
      // We are Host: Listen for connections
      peer.on('connection', (conn) => {
        console.log('Incoming connection...');
        conn.on('open', () => {
           console.log('Device connected!');
           setShowQrModal(false); // Close QR when connected
           setConnectionStatus('connected');
        });

        conn.on('data', (data: any) => {
          console.log('Received data:', data);
          if (data && data.type === 'NEW_BATCH') {
             // Handle incoming data as if local user added it
             const newBatch = data.payload;
             // We need to access the current state of batches. Since we are in an event listener,
             // best to use the functional update of state or a ref.
             // However, React state updates in event listeners are safe.
             // We'll wrap this logic to re-use the "Pending" flow.
             setBatches(currentBatches => {
                if (currentBatches.length > 0) {
                   setPendingBatch(newBatch);
                   return currentBatches;
                } else {
                   return [newBatch];
                }
             });
          }
        });
      });
    }

    return () => {
      peer.destroy();
    };
  }, []);

  const mergedResults = useMemo(() => {
    const final: LabResults = {};
    batches.forEach(batch => {
      Object.entries(batch.results).forEach(([key, value]) => {
        if (typeof value === 'string' && value !== '') {
          final[key] = value;
        }
      });
    });
    return final;
  }, [batches]);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Будь ласка, оберіть файл зображення');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = (event.target?.result as string).split(',')[1];
      setSelectedImage({
        data: base64String,
        mimeType: file.type,
        preview: event.target?.result as string
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault(); 
          processFile(file);
          return;
        }
      }
    }
  };

  const clearInputs = () => {
    setInputText(''); 
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPendingBatch(null);
  };

  const handleAddAndAnalyze = async () => {
    if (!inputText.trim() && !selectedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      const results = await extractLabData(
        inputText, 
        selectedImage ? { data: selectedImage.data, mimeType: selectedImage.mimeType } : undefined
      );
      
      const foundCount = Object.values(results).filter(v => v !== null && v !== '').length;

      if (foundCount === 0) {
        setError("Не вдалося знайти жодного показника. Спробуйте інше фото або перевірте текст.");
      } else {
        const newBatch = {
          id: Date.now(),
          text: selectedImage ? "Аналіз по фото" : inputText,
          results: results,
          isImage: !!selectedImage
        };

        if (isClientMode && connectionStatus === 'connected') {
          // Send to Host
          connRef.current.send({ type: 'NEW_BATCH', payload: newBatch });
          alert("Дані успішно надіслано на головний пристрій!");
          clearInputs();
        } else {
          // Process Locally
          if (batches.length > 0) {
            setPendingBatch(newBatch);
          } else {
            setBatches([newBatch]);
            clearInputs();
          }
        }
      }
    } catch (err) {
      setError("Помилка обробки. Перевірте з'єднання або спробуйте ще раз.");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Decision Modal Handlers
  const handleMerge = () => {
    if (pendingBatch) {
      setBatches(prev => [...prev, pendingBatch]);
      clearInputs();
    }
  };

  const handleReplace = () => {
    if (pendingBatch) {
      setBatches([pendingBatch]);
      clearInputs();
    }
  };

  const handleCancel = () => {
    setPendingBatch(null);
  };

  const getShareUrl = () => {
    if (!peerId) return '';
    const url = new URL(window.location.href);
    url.searchParams.set('host', peerId);
    return url.toString();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 relative">
      
      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 relative">
             <button onClick={() => setShowQrModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
             <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Підключити телефон</h3>
             <p className="text-center text-slate-500 text-sm mb-6">Відскануйте цей QR-код камерою телефону, щоб перетворити його на пульт сканування.</p>
             
             <div className="flex justify-center p-4 bg-white rounded-lg border-2 border-slate-100 mb-4">
                {peerId ? (
                   <div className="h-48 w-48">
                      <QRCode value={getShareUrl()} style={{ height: "100%", width: "100%" }} viewBox={`0 0 256 256`} />
                   </div>
                ) : (
                  <div className="h-48 w-48 flex items-center justify-center text-slate-400">
                    <RefreshIcon className="w-8 h-8 animate-spin" />
                  </div>
                )}
             </div>
             
             <div className="text-center text-xs text-slate-400 break-all px-2">
                {peerId ? 'Очікування підключення...' : 'Ініціалізація мережі...'}
             </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal (Merge/Replace) */}
      {pendingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200 scale-100 transform transition-all">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {isClientMode ? 'Результат оброблено!' : 'Знайдено нові дані'}
            </h3>
            <p className="text-slate-600 mb-6">
              У вашому звіті вже є {batches.length} фрагмент(ів). Що зробити з новими даними?
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={handleMerge}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-md transition-all flex items-center justify-center gap-2"
              >
                <PlusIcon />
                Додати до існуючого звіту
              </button>
              
              <button
                onClick={handleReplace}
                className="w-full py-3 px-4 bg-white border-2 border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                <TrashIcon />
                Почати новий звіт (замінити)
              </button>
              
              <button
                onClick={handleCancel}
                className="mt-2 text-sm text-slate-400 hover:text-slate-600 font-medium"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg">
              <BeakerIcon />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">Lab2Excel</h1>
                {isClientMode && (
                   <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold border border-purple-200">
                     MOBILE MODE
                   </span>
                )}
              </div>
              <p className="text-slate-500 text-sm">Конвертація медичних аналізів</p>
            </div>
          </div>
          
          {!isClientMode && (
            <button
              onClick={() => setShowQrModal(true)}
              className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 border ${
                connectionStatus === 'connected' 
                 ? "text-green-700 border-green-200 bg-green-50" 
                 : "text-slate-600 border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              {connectionStatus === 'connected' ? (
                <>
                   <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                   Телефон підключено
                </>
              ) : (
                <>
                  <PhoneIcon />
                  Підключити телефон
                </>
              )}
            </button>
          )}

          {isClientMode && (
             <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-slate-600">{connectionStatus === 'connected' ? 'З\'єднано з ПК' : 'Немає з\'єднання'}</span>
             </div>
          )}
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Input & History */}
          <div className="flex flex-col gap-6">
            
            {/* Input Section */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="labInput" className="block text-sm font-semibold text-slate-700">
                  Введіть текст або додайте фото
                </label>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 transition-colors"
                >
                  <PhotoIcon />
                  Обрати фото
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              {selectedImage && (
                <div className="mb-3 relative group">
                  <div className="w-full h-32 overflow-hidden rounded-lg border-2 border-blue-200">
                    <img src={selectedImage.preview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                    Зображення готове
                  </div>
                </div>
              )}

              <textarea
                id="labInput"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPaste={handlePaste}
                placeholder="Вставте текст сюди (наприклад: Гемоглобін 135) або натисніть Ctrl+V, щоб вставити скріншот з буфера..."
                className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 resize-none text-slate-700 placeholder:text-slate-400 transition-all"
                disabled={isProcessing}
              />
              
              {error && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100 flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleAddAndAnalyze}
                  disabled={isProcessing || (!inputText.trim() && !selectedImage) || (!isClientMode && pendingBatch !== null)}
                  className={`flex-1 py-2.5 px-4 rounded-lg flex justify-center items-center gap-2 font-medium transition-all ${
                    isProcessing || (!inputText.trim() && !selectedImage) || (!isClientMode && pendingBatch !== null)
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : isClientMode && connectionStatus === 'connected'
                        ? "bg-purple-600 text-white hover:bg-purple-700 shadow-md"
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg active:scale-[0.98]"
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshIcon className="animate-spin" />
                      Аналізую...
                    </>
                  ) : isClientMode && connectionStatus === 'connected' ? (
                     <>
                        <PaperAirplaneIcon />
                        Надіслати на ПК
                     </>
                  ) : (
                    <>
                      <PlusIcon />
                      Додати до звіту
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Added Batches List */}
            {batches.length > 0 && (
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-semibold text-slate-700">Додані тексти та фото ({batches.length})</h3>
                </div>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {batches.map((batch, index) => (
                    <div key={batch.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm group relative">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                           <div className="font-medium text-slate-500 text-xs uppercase tracking-wider">Фрагмент {index + 1}</div>
                           {batch.isImage && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold">ФОТО</span>}
                        </div>
                        <button 
                          onClick={() => setBatches(prev => prev.filter(b => b.id !== batch.id))}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1 -mr-1"
                          title="Видалити"
                        >
                           <TrashIcon />
                        </button>
                      </div>
                      <p className="text-slate-700 line-clamp-2 italic">{batch.text}</p>
                      <div className="mt-2 text-xs text-blue-600 font-medium">
                        Розпізнано: {Object.values(batch.results).filter(v => v !== null && v !== '').length} показників
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Result Table */}
          <div className="h-full min-h-[500px]">
             {isClientMode ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col items-center justify-center p-8 text-center">
                   <div className="bg-purple-100 p-4 rounded-full mb-4">
                      <PhoneIcon />
                   </div>
                   <h2 className="text-xl font-bold text-slate-800 mb-2">Режим "Мобільний сканер"</h2>
                   <p className="text-slate-500">
                      Результати аналізу будуть автоматично надіслані на підключений комп'ютер. Таблиця відображається на головному екрані ПК.
                   </p>
                </div>
             ) : (
                <ResultColumn mergedResults={mergedResults} fragmentCount={batches.length} />
             )}
          </div>

        </main>
      </div>
    </div>
  );
};

export default App;
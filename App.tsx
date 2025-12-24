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

const XMarkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface BatchData {
  id: number;
  text: string;
  results: LabResults;
  isImage?: boolean;
}

interface ImageFile {
  id: string;
  data: string;
  mimeType: string;
  preview: string;
}

const generateShortId = () => {
  return 'lab-' + Math.floor(Math.random() * 9000 + 1000);
};

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [selectedImages, setSelectedImages] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batches, setBatches] = useState<Array<BatchData>>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [pendingBatch, setPendingBatch] = useState<BatchData | null>(null);

  // Sync / PeerJS State
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [showQrModal, setShowQrModal] = useState(false);
  const [isClientMode, setIsClientMode] = useState(false);
  const [manualHostId, setManualHostId] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Reconnection refs
  const peerInstance = useRef<any>(null);
  const connRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetHostIdRef = useRef<string | null>(null);
  const isIntentionalDisconnectRef = useRef<boolean>(false);

  // Init Peer
  useEffect(() => {
    // Determine mode based on URL
    const params = new URLSearchParams(window.location.search);
    const hostIdFromUrl = params.get('host');

    if (hostIdFromUrl) {
      setIsClientMode(true);
      setConnectionStatus('connecting');
      targetHostIdRef.current = hostIdFromUrl;
      initializePeer(null, hostIdFromUrl);
    } else {
      // Host mode: generate a random short ID
      const randomId = generateShortId();
      initializePeer(randomId, null);
    }

    return () => {
      if (peerInstance.current) {
        peerInstance.current.destroy();
        peerInstance.current = null;
      }
    };
  }, []);

  // Listener for tab visibility (Camera app return)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // If we are a client, suppose to be connected, but current status is disconnected/closed
        if (
          isClientMode && 
          targetHostIdRef.current && 
          !isIntentionalDisconnectRef.current &&
          (!connRef.current || !connRef.current.open || connectionStatus !== 'connected')
        ) {
          console.log("App visible again, attempting auto-reconnect...");
          reconnectToHost();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isClientMode, connectionStatus]);


  const initializePeer = (forcedId: string | null, targetHostId: string | null) => {
    // Avoid double init in React StrictMode
    if (peerInstance.current) return;

    const peer = new Peer(forcedId || undefined, {
      debug: 1
    });
    
    peerInstance.current = peer;

    peer.on('open', (id) => {
      console.log('My ID:', id);
      setMyPeerId(id);

      // If we are a client and have a target, connect immediately
      if (targetHostId) {
        connectToHost(peer, targetHostId);
      }
    });

    peer.on('connection', (conn) => {
      // Incoming connection (We are Host)
      console.log('Incoming connection');
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      // If ID is taken, retry?
      if (err.type === 'unavailable-id') {
         peer.destroy();
         peerInstance.current = null;
         initializePeer(generateShortId(), targetHostId); // Retry with new ID
      } else if (err.type === 'peer-unavailable') {
          // Host might be gone, or we just have bad network
          setConnectionStatus('disconnected');
          // Don't error loudly if we are just backgrounding
      } else {
         setError('Помилка з\'єднання: ' + err.type);
         setConnectionStatus('disconnected');
      }
    });

    peer.on('disconnected', () => {
      console.log('Peer disconnected from server');
      // If we are client and didn't mean to disconnect, try to reconnect to the signalling server
      if (isClientMode && !isIntentionalDisconnectRef.current) {
        peer.reconnect();
      }
    });
  };

  const connectToHost = (peer: any, hostId: string) => {
    setConnectionStatus('connecting');
    isIntentionalDisconnectRef.current = false;
    targetHostIdRef.current = hostId;
    
    // Close existing if any
    if (connRef.current) {
      connRef.current.close();
    }

    const conn = peer.connect(hostId, { reliable: true });
    setupConnection(conn);
  };

  const reconnectToHost = async () => {
    if (!peerInstance.current || !targetHostIdRef.current) return;
    
    // If peer is disconnected from server, reconnect peer first
    if (peerInstance.current.disconnected) {
        await peerInstance.current.reconnect();
    }
    
    console.log("Reconnecting to", targetHostIdRef.current);
    connectToHost(peerInstance.current, targetHostIdRef.current);
  };

  const setupConnection = (conn: any) => {
    conn.on('open', () => {
      console.log('Connection established');
      setConnectionStatus('connected');
      connRef.current = conn;
      setShowQrModal(false);
      setShowManualEntry(false);
      setError(null);
    });

    conn.on('data', (data: any) => {
      console.log('Received data:', data);
      if (data && data.type === 'NEW_BATCH') {
         const newBatch = data.payload;
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

    conn.on('close', () => {
      console.log('Connection closed');
      connRef.current = null;
      
      // Only set UI to disconnected if it wasn't an intentional action
      // This helps prevent "flickering" UI if we reconnect immediately
      if (isIntentionalDisconnectRef.current) {
          setConnectionStatus('disconnected');
      } else {
          // If we are client, we might want to stay in 'connecting' state or try reconnect
          if (isClientMode) {
             console.log("Unexpected close, status remains: ", connectionStatus);
             // Optionally trigger reconnect here immediately
             // reconnectToHost(); 
             setConnectionStatus('disconnected');
          } else {
             setConnectionStatus('disconnected');
          }
      }
    });

    conn.on('error', (err: any) => {
      console.error('Connection error', err);
      setConnectionStatus('disconnected');
    });
  };

  const handleDisconnect = () => {
    isIntentionalDisconnectRef.current = true;
    if (connRef.current) {
      connRef.current.close();
    }
    setConnectionStatus('disconnected');
    targetHostIdRef.current = null;
    
    // If we were client mode, remove the ?host param from URL to go back to standalone/host mode capabilities
    if (isClientMode) {
      setIsClientMode(false);
      const url = new URL(window.location.href);
      url.searchParams.delete('host');
      window.history.pushState({}, '', url.toString());
      
      // We might want to re-init as a random host
      if (peerInstance.current) {
        peerInstance.current.destroy();
        peerInstance.current = null;
      }
      setTimeout(() => {
        const randomId = generateShortId();
        initializePeer(randomId, null);
      }, 500);
    }
  };

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualHostId.trim() || !peerInstance.current) return;
    setIsClientMode(true);
    connectToHost(peerInstance.current, manualHostId.trim());
  };

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

  const processFiles = (files: FileList) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
        if (files.length > 0) setError('Будь ласка, оберіть файли зображень');
        return;
    }

    Promise.all(validFiles.map(file => {
        return new Promise<ImageFile>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = (e.target?.result as string).split(',')[1];
                resolve({
                    id: Math.random().toString(36).substring(7),
                    data: base64,
                    mimeType: file.type,
                    preview: e.target?.result as string
                });
            };
            reader.readAsDataURL(file);
        });
    })).then(newImages => {
        setSelectedImages(prev => [...prev, ...newImages]);
        setError(null);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    // reset input to allow re-selecting same files
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      // create a FileList-like object or just adjust processFiles to accept array
      // Simplest is to construct a DataTransfer
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      processFiles(dt.files);
    }
  };

  const removeImage = (id: string) => {
    setSelectedImages(prev => prev.filter(img => img.id !== id));
  };

  const clearInputs = () => {
    setInputText(''); 
    setSelectedImages([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPendingBatch(null);
  };

  const handleAddAndAnalyze = async () => {
    if (!inputText.trim() && selectedImages.length === 0) return;

    setIsProcessing(true);
    setError(null);

    // If client mode, check connection before starting processing
    if (isClientMode && (!connRef.current || !connRef.current.open)) {
      console.log("Connection lost, attempting to reconnect before processing...");
      setConnectionStatus('connecting');
      try {
        await reconnectToHost();
        // Wait a bit for connection to open
        await new Promise<void>((resolve, reject) => {
           let attempts = 0;
           const interval = setInterval(() => {
              attempts++;
              if (connRef.current && connRef.current.open) {
                 clearInterval(interval);
                 resolve();
              }
              if (attempts > 20) { // 2 seconds timeout
                 clearInterval(interval);
                 reject("Timeout connecting");
              }
           }, 100);
        });
      } catch (e) {
         console.error("Failed to reconnect before sending", e);
         setError("Втрачено зв'язок з комп'ютером. Спробуйте оновити сторінку або перепідключитися.");
         setIsProcessing(false);
         setConnectionStatus('disconnected');
         return;
      }
    }

    try {
      const imagesPayload = selectedImages.map(img => ({ data: img.data, mimeType: img.mimeType }));

      const results = await extractLabData(
        inputText, 
        imagesPayload.length > 0 ? imagesPayload : undefined
      );
      
      const foundCount = Object.values(results).filter(v => v !== null && v !== '').length;

      if (foundCount === 0) {
        setError("Не вдалося знайти жодного показника. Спробуйте інше фото або перевірте текст.");
      } else {
        let labelText = inputText;
        if (selectedImages.length > 0) {
          labelText = selectedImages.length === 1 ? "Аналіз фото" : `Аналіз ${selectedImages.length} фото`;
        }

        const newBatch = {
          id: Date.now(),
          text: labelText,
          results: results,
          isImage: selectedImages.length > 0
        };

        if (isClientMode) {
          if (connRef.current && connRef.current.open) {
            connRef.current.send({ type: 'NEW_BATCH', payload: newBatch });
            alert("Дані успішно надіслано на головний пристрій!");
            clearInputs();
          } else {
             // Fallback if reconnection appeared to work but then failed
             setError("Зв'язок нестабільний. Не вдалося надіслати дані.");
          }
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
    if (!myPeerId) return '';
    const url = new URL(window.location.href);
    url.searchParams.set('host', myPeerId);
    return url.toString();
  };

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 relative">
      
      {/* QR Code / Connection Modal */}
      {(showQrModal || showManualEntry) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 relative">
             <button onClick={() => { setShowQrModal(false); setShowManualEntry(false); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
               <XMarkIcon />
             </button>

             {showManualEntry ? (
               <>
                 <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Введіть код</h3>
                 <p className="text-center text-slate-500 text-sm mb-6">Введіть код, який відображається на екрані комп'ютера.</p>
                 <form onSubmit={handleManualConnect} className="space-y-4">
                    <input 
                      type="text" 
                      value={manualHostId}
                      onChange={e => setManualHostId(e.target.value)}
                      placeholder="Наприклад: lab-1234"
                      className="w-full text-center text-lg font-mono p-3 border border-slate-300 rounded-lg uppercase tracking-widest focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors">
                      {connectionStatus === 'connecting' ? 'З\'єднання...' : 'Підключитися'}
                    </button>
                 </form>
               </>
             ) : (
               <>
                  <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Підключити телефон</h3>
                  <p className="text-center text-slate-500 text-sm mb-4">Відскануйте QR-код або введіть код вручну.</p>
                  
                  {isLocalhost && (
                    <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-xs mb-4 border border-amber-200">
                      <strong>Увага:</strong> Ви використовуєте localhost. Для роботи QR-коду переконайтеся, що ви відкрили цей сайт на комп'ютері через локальний IP (наприклад 192.168.x.x), або введіть код вручну.
                    </div>
                  )}

                  <div className="flex justify-center p-4 bg-white rounded-lg border-2 border-slate-100 mb-4">
                      {myPeerId ? (
                        <div className="h-48 w-48 flex items-center justify-center">
                            {/* Updated QRCode with simplified props to prevent rendering crashes */}
                            <QRCode 
                                value={getShareUrl()} 
                                size={192}
                                style={{ height: "100%", width: "100%" }} 
                            />
                        </div>
                      ) : (
                        <div className="h-48 w-48 flex items-center justify-center text-slate-400">
                          <RefreshIcon className="w-8 h-8 animate-spin" />
                        </div>
                      )}
                  </div>
                  
                  <div className="text-center mb-4">
                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Код підключення</p>
                    <div className="text-2xl font-mono font-bold text-slate-800 tracking-wider select-all cursor-pointer bg-slate-100 py-2 rounded">
                      {myPeerId || '...'}
                    </div>
                  </div>
               </>
             )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
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
          
          <div className="flex items-center gap-2">
            {!isClientMode && (
              <button
                onClick={connectionStatus === 'connected' ? handleDisconnect : () => setShowQrModal(true)}
                className={`text-sm font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-2 border group ${
                  connectionStatus === 'connected' 
                  ? "text-green-700 border-green-200 bg-green-50 hover:bg-red-50 hover:text-red-600 hover:border-red-200" 
                  : "text-slate-600 border-slate-200 bg-white hover:bg-slate-50"
                }`}
                title={connectionStatus === 'connected' ? "Натисніть, щоб відключити телефон" : ""}
              >
                {connectionStatus === 'connected' ? (
                  <>
                    <span className="group-hover:hidden flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      Телефон підключено
                    </span>
                    <span className="hidden group-hover:flex items-center gap-2">
                      <XMarkIcon />
                      Відключити
                    </span>
                  </>
                ) : (
                  <>
                    <PhoneIcon />
                    Підключити телефон
                  </>
                )}
              </button>
            )}

            {/* Button to manually enter code if on phone but not connected via URL */}
            {!isClientMode && connectionStatus !== 'connected' && (
              <button 
                onClick={() => setShowManualEntry(true)}
                className="md:hidden text-sm font-medium px-3 py-2 rounded-lg bg-slate-100 text-slate-600 border border-slate-200"
              >
                Ввести код
              </button>
            )}

            {isClientMode && (
              <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className="text-slate-600">
                        {connectionStatus === 'connected' ? 'З\'єднано з ПК' : 
                         connectionStatus === 'connecting' ? 'Відновлення...' : 'Немає з\'єднання'}
                    </span>
                  </div>
                  {connectionStatus === 'connected' && (
                    <button 
                      onClick={handleDisconnect}
                      className="text-xs bg-white border border-slate-200 px-2 py-1 rounded text-slate-500 hover:text-red-500 hover:border-red-200"
                    >
                      Відключитися
                    </button>
                  )}
              </div>
            )}
          </div>
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
                  {selectedImages.length > 0 ? 'Додати ще фото' : 'Обрати фото'}
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                  multiple
                />
              </div>

              {selectedImages.length > 0 && (
                <div className="mb-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {selectedImages.map((img) => (
                    <div key={img.id} className="relative group aspect-square rounded-lg border-2 border-blue-200 overflow-hidden bg-slate-100">
                       <img src={img.preview} alt="Preview" className="w-full h-full object-cover" />
                       <button 
                        onClick={() => removeImage(img.id)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 shadow hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 md:opacity-100"
                      >
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                         </svg>
                      </button>
                    </div>
                  ))}
                  <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-slate-50 transition-all"
                  >
                     <PlusIcon />
                     <span className="text-[10px] font-medium mt-1">Додати</span>
                  </button>
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
                  disabled={isProcessing || (!inputText.trim() && selectedImages.length === 0) || (!isClientMode && pendingBatch !== null)}
                  className={`flex-1 py-2.5 px-4 rounded-lg flex justify-center items-center gap-2 font-medium transition-all ${
                    isProcessing || (!inputText.trim() && selectedImages.length === 0) || (!isClientMode && pendingBatch !== null)
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
                  ) : isClientMode ? (
                     <>
                        <PaperAirplaneIcon />
                        {connectionStatus === 'connected' ? 'Надіслати на ПК' : 'З\'єднати і надіслати'}
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
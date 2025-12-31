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

const VideoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const StopIcon = () => (
  <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const RecordIcon = () => (
  <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
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

const ZapIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

interface BatchData {
  id: number;
  text: string;
  results: LabResults;
  isImage?: boolean; // Keep for legacy, though now it means "Video" or "Media"
}

const DAILY_LIMIT = 20;

const generateShortId = () => {
  return 'lab-' + Math.floor(Math.random() * 9000 + 1000);
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:video/mp4;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [batches, setBatches] = useState<Array<BatchData>>([]);
  const [error, setError] = useState<string | null>(null);
  const [remainingConversions, setRemainingConversions] = useState(DAILY_LIMIT);
  const [pendingBatch, setPendingBatch] = useState<BatchData | null>(null);

  // Video Recording State
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Refs
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Sync / PeerJS State
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [showQrModal, setShowQrModal] = useState(false);
  const [isClientMode, setIsClientMode] = useState(false);
  const [manualHostId, setManualHostId] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);

  const peerInstance = useRef<any>(null);
  const connRef = useRef<any>(null);
  const targetHostIdRef = useRef<string | null>(null);
  const isIntentionalDisconnectRef = useRef<boolean>(false);

  // Daily Usage Tracking
  useEffect(() => {
    const today = new Date().toLocaleDateString();
    const storedStats = localStorage.getItem('lab2excel_usage');
    
    if (storedStats) {
      const { date, used } = JSON.parse(storedStats);
      if (date === today) {
        setRemainingConversions(Math.max(0, DAILY_LIMIT - used));
      } else {
        localStorage.setItem('lab2excel_usage', JSON.stringify({ date: today, used: 0 }));
        setRemainingConversions(DAILY_LIMIT);
      }
    } else {
      localStorage.setItem('lab2excel_usage', JSON.stringify({ date: today, used: 0 }));
      setRemainingConversions(DAILY_LIMIT);
    }
  }, []);

  const trackUsage = () => {
    const today = new Date().toLocaleDateString();
    const storedStats = localStorage.getItem('lab2excel_usage');
    let usedCount = 0;
    
    if (storedStats) {
      const stats = JSON.parse(storedStats);
      usedCount = stats.date === today ? stats.used + 1 : 1;
    } else {
      usedCount = 1;
    }
    
    const newStats = { date: today, used: usedCount };
    localStorage.setItem('lab2excel_usage', JSON.stringify(newStats));
    setRemainingConversions(Math.max(0, DAILY_LIMIT - usedCount));
    return newStats;
  };

  // PeerJS Init
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hostIdFromUrl = params.get('host');

    if (hostIdFromUrl) {
      setIsClientMode(true);
      setConnectionStatus('connecting');
      targetHostIdRef.current = hostIdFromUrl;
      initializePeer(null, hostIdFromUrl);
    } else {
      const randomId = generateShortId();
      initializePeer(randomId, null);
    }

    return () => {
      if (peerInstance.current) {
        peerInstance.current.destroy();
        peerInstance.current = null;
      }
      stopCamera();
    };
  }, []);

  // Listener for tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (
          isClientMode && 
          targetHostIdRef.current && 
          !isIntentionalDisconnectRef.current &&
          (!connRef.current || !connRef.current.open || connectionStatus !== 'connected')
        ) {
          reconnectToHost();
        }
      } else {
        // Stop camera if backgrounded to save battery/privacy
        if (isCameraActive && !isRecording) {
            stopCamera();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isClientMode, connectionStatus, isCameraActive, isRecording]);

  // --- Video Logic ---

  const startCamera = async () => {
    try {
        setError(null);
        // Request video, prefer back camera
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 }, // 720p is usually enough for OCR and keeps size down
                height: { ideal: 720 }
            }, 
            audio: false 
        });
        
        streamRef.current = stream;
        // NOTE: We don't strictly need to set srcObject here because the useEffect below will handle it
        // but it doesn't hurt to do it immediately for faster feedback.
        if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
        }
        setIsCameraActive(true);
        setVideoBlob(null); // Clear previous recording
        setVideoPreviewUrl(null);
    } catch (err) {
        console.error("Camera error:", err);
        setError("Не вдалося отримати доступ до камери. Перевірте дозволи.");
    }
  };

  // THIS IS THE CRITICAL FIX: Ensure stream stays attached during re-renders
  useEffect(() => {
    if (isCameraActive && videoPreviewRef.current && streamRef.current) {
      // Check if it's already set to avoid flickering
      if (videoPreviewRef.current.srcObject !== streamRef.current) {
         videoPreviewRef.current.srcObject = streamRef.current;
      }
    }
  }, [isCameraActive, isRecording]); // Re-run when recording state changes

  const stopCamera = () => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const startRecording = () => {
      if (!streamRef.current) return;
      
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
        ? 'video/webm; codecs=vp9' 
        : MediaRecorder.isTypeSupported('video/mp4') 
            ? 'video/mp4' 
            : 'video/webm'; // Fallback

      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      
      recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
              chunksRef.current.push(e.data);
          }
      };

      recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          setVideoBlob(blob);
          const url = URL.createObjectURL(blob);
          setVideoPreviewUrl(url);
          stopCamera(); // Auto stop camera after recording
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Timer limit (max 10 seconds to keep file size small for API)
      timerRef.current = window.setInterval(() => {
          setRecordingTime(prev => {
              if (prev >= 9) { // Stop at 10s
                  stopRecording();
                  return 10;
              }
              return prev + 1;
          });
      }, 1000);
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
      if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
      }
  };

  const clearVideo = () => {
      setVideoBlob(null);
      setVideoPreviewUrl(null);
      // Don't restart camera automatically, let user choose
  };

  // --- Peer Logic ---

  const initializePeer = (forcedId: string | null, targetHostId: string | null) => {
    if (peerInstance.current) return;
    const peer = new Peer(forcedId || undefined, { debug: 1 });
    peerInstance.current = peer;

    peer.on('open', (id) => {
      setMyPeerId(id);
      if (targetHostId) connectToHost(peer, targetHostId);
    });

    peer.on('connection', (conn) => setupConnection(conn));

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'unavailable-id') {
         peer.destroy();
         peerInstance.current = null;
         initializePeer(generateShortId(), targetHostId);
      } else {
         setConnectionStatus('disconnected');
      }
    });

    peer.on('disconnected', () => {
      if (isClientMode && !isIntentionalDisconnectRef.current) {
        setTimeout(() => {
             if (peerInstance.current && !peerInstance.current.destroyed) {
                peer.reconnect();
             }
        }, 2000);
      }
    });
  };

  const connectToHost = (peer: any, hostId: string) => {
    setConnectionStatus('connecting');
    isIntentionalDisconnectRef.current = false;
    targetHostIdRef.current = hostId;
    if (connRef.current) connRef.current.close();
    const conn = peer.connect(hostId, { reliable: true });
    setupConnection(conn);
  };

  const reconnectToHost = async () => {
    if (!peerInstance.current || !targetHostIdRef.current) return;
    if (peerInstance.current.disconnected) {
        try { await peerInstance.current.reconnect(); } catch (e) {}
    }
    connectToHost(peerInstance.current, targetHostIdRef.current);
  };

  const setupConnection = (conn: any) => {
    conn.on('open', () => {
      setConnectionStatus('connected');
      connRef.current = conn;
      setShowQrModal(false);
      setShowManualEntry(false);
      setError(null);
    });

    conn.on('data', (data: any) => {
      if (data && data.type === 'NEW_BATCH') {
         const newBatch = data.payload;
         if (data.usage) {
           localStorage.setItem('lab2excel_usage', JSON.stringify(data.usage));
           setRemainingConversions(Math.max(0, DAILY_LIMIT - data.usage.used));
         }

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
      connRef.current = null;
      setConnectionStatus('disconnected');
    });

    conn.on('error', () => setConnectionStatus('disconnected'));
  };

  const handleDisconnect = () => {
    isIntentionalDisconnectRef.current = true;
    if (connRef.current) connRef.current.close();
    setConnectionStatus('disconnected');
    targetHostIdRef.current = null;
    
    if (isClientMode) {
      setIsClientMode(false);
      const url = new URL(window.location.href);
      url.searchParams.delete('host');
      window.history.pushState({}, '', url.toString());
      if (peerInstance.current) {
        peerInstance.current.destroy();
        peerInstance.current = null;
      }
      setTimeout(() => initializePeer(generateShortId(), null), 500);
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


  const clearInputs = () => {
    setInputText(''); 
    clearVideo();
    setPendingBatch(null);
  };

  const handleAddAndAnalyze = async () => {
    if (!inputText.trim() && !videoBlob) return;
    if (remainingConversions <= 0) {
        setError("Ви вичерпали денний ліміт (20/20). Повертайтеся завтра!");
        return;
    }

    setIsProcessing(true);
    setError(null);

    if (isClientMode && (!connRef.current || !connRef.current.open)) {
      setConnectionStatus('connecting');
      try {
        await reconnectToHost();
        await new Promise<void>((resolve, reject) => {
           let attempts = 0;
           const interval = setInterval(() => {
              attempts++;
              if (connRef.current && connRef.current.open) { clearInterval(interval); resolve(); }
              if (attempts > 30) { clearInterval(interval); reject("Timeout"); }
           }, 100);
        });
      } catch (e) {
         setError("Втрачено зв'язок з ПК.");
         setIsProcessing(false);
         setConnectionStatus('disconnected');
         return;
      }
    }

    try {
      let videoData = undefined;
      if (videoBlob) {
          const base64 = await blobToBase64(videoBlob);
          videoData = {
              data: base64,
              mimeType: videoBlob.type
          };
      }

      const results = await extractLabData(inputText, videoData);
      
      const foundCount = Object.values(results).filter(v => v !== null && v !== '').length;

      if (foundCount === 0) {
        setError("Не вдалося знайти показників.");
      } else {
        const usageStats = trackUsage();
        
        let labelText = inputText;
        if (videoBlob) {
          labelText = "Аналіз відео";
        }

        const newBatch = {
          id: Date.now(),
          text: labelText,
          results: results,
          isImage: !!videoBlob
        };

        if (isClientMode) {
          if (connRef.current && connRef.current.open) {
            connRef.current.send({ 
              type: 'NEW_BATCH', 
              payload: newBatch,
              usage: usageStats
            });
            alert("Надіслано на ПК!");
            clearInputs();
          } else {
             setError("Зв'язок нестабільний.");
          }
        } else {
          if (batches.length > 0) {
            setPendingBatch(newBatch);
          } else {
            setBatches([newBatch]);
            clearInputs();
          }
        }
      }
    } catch (err: any) {
      let errorMessage = "Помилка обробки. Перевірте з'єднання.";
      const errStr = (err?.message || err?.toString() || "").toLowerCase();
      if (errStr.includes("429")) errorMessage = "Вичерпано ліміт API. Спробуйте через хвилину.";
      if (errStr.includes("payload")) errorMessage = "Відео занадто велике. Спробуйте записати коротше відео.";
      setError(errorMessage);
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

  const handleCancel = () => setPendingBatch(null);

  const getShareUrl = () => {
    if (!myPeerId) return '';
    const url = new URL(window.location.href);
    url.searchParams.set('host', myPeerId);
    return url.toString();
  };

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 relative">
      
      {/* QR Modal */}
      {(showQrModal || showManualEntry) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 relative">
             <button onClick={() => { setShowQrModal(false); setShowManualEntry(false); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
               <XMarkIcon />
             </button>

             {showManualEntry ? (
               <>
                 <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Введіть код</h3>
                 <form onSubmit={handleManualConnect} className="space-y-4">
                    <input 
                      type="text" 
                      value={manualHostId}
                      onChange={e => setManualHostId(e.target.value)}
                      placeholder="Наприклад: lab-1234"
                      className="w-full text-center text-lg font-mono p-3 border border-slate-300 rounded-lg uppercase"
                    />
                    <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold">
                      {connectionStatus === 'connecting' ? 'З\'єднання...' : 'Підключитися'}
                    </button>
                 </form>
               </>
             ) : (
               <>
                  <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Підключити телефон</h3>
                  <div className="flex justify-center p-4 bg-white rounded-lg border-2 border-slate-100 mb-4">
                      {myPeerId ? (
                        <div className="h-48 w-48">
                            <QRCode value={getShareUrl()} size={192} style={{ height: "100%", width: "100%" }} />
                        </div>
                      ) : (
                        <RefreshIcon className="w-8 h-8 animate-spin" />
                      )}
                  </div>
                  <div className="text-center mb-4">
                    <p className="text-xs text-slate-400 uppercase mb-1">Код підключення</p>
                    <div className="text-2xl font-mono font-bold text-slate-800 bg-slate-100 py-2 rounded">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Знайдено нові дані</h3>
            <p className="text-slate-600 mb-6">У звіті вже є {batches.length} фрагмент(ів). Додати нові дані?</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleMerge} className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium shadow-md flex items-center justify-center gap-2">
                <PlusIcon /> Додати до існуючого звіту
              </button>
              <button onClick={handleReplace} className="w-full py-3 px-4 bg-white border-2 border-slate-200 text-slate-700 rounded-lg font-medium flex items-center justify-center gap-2">
                <TrashIcon /> Почати новий звіт
              </button>
              <button onClick={handleCancel} className="mt-2 text-sm text-slate-400 font-medium">Скасувати</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg">
              <BeakerIcon />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">Lab2Excel</h1>
                {isClientMode && (
                   <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold border border-purple-200">MOBILE</span>
                )}
                {/* Usage Counter Badge */}
                <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${remainingConversions <= 3 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  <ZapIcon className="w-3 h-3" />
                  <span>{remainingConversions}/{DAILY_LIMIT}</span>
                </div>
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
                  ? "text-green-700 border-green-200 bg-green-50" 
                  : "text-slate-600 border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                {connectionStatus === 'connected' ? "Телефон підключено" : <><PhoneIcon /> Підключити телефон</>}
              </button>
            )}
            {isClientMode && (
              <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="text-sm text-slate-600">{connectionStatus === 'connected' ? 'З\'єднано' : 'Немає з\'єднання'}</span>
              </div>
            )}
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col gap-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <label className="block text-sm font-semibold text-slate-700 mb-3">Записати відео (сканування) або текст</label>

              {/* Video Recording Area */}
              <div className={`mb-4 bg-slate-900 rounded-lg overflow-hidden relative aspect-video flex flex-col items-center justify-center border-4 shadow-inner transition-colors duration-300 ${isRecording ? 'border-red-600' : 'border-slate-100'}`}>
                {videoPreviewUrl ? (
                   <div className="relative w-full h-full">
                       <video src={videoPreviewUrl} controls className="w-full h-full object-contain bg-black" />
                       <button onClick={clearVideo} className="absolute top-2 right-2 bg-white/20 hover:bg-white/40 backdrop-blur text-white p-1 rounded-full">
                           <XMarkIcon />
                       </button>
                   </div>
                ) : isCameraActive ? (
                   <div className="relative w-full h-full">
                       <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                       
                       {/* REC Indicator */}
                       {isRecording && (
                        <div className="absolute top-4 left-4 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse flex items-center gap-2 z-10">
                           <div className="w-2 h-2 bg-white rounded-full"></div>
                           REC
                        </div>
                       )}

                       <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4 z-20">
                            {!isRecording ? (
                                <button onClick={startRecording} className="bg-white rounded-full p-4 shadow-lg hover:scale-110 transition-transform">
                                    <RecordIcon />
                                </button>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="text-white font-mono font-bold bg-red-600 px-3 py-1 rounded-full text-sm animate-pulse">
                                        00:0{recordingTime} / 00:10
                                    </div>
                                    <button onClick={stopRecording} className="bg-white rounded-full p-4 shadow-lg hover:scale-110 transition-transform">
                                        <StopIcon />
                                    </button>
                                </div>
                            )}
                       </div>
                   </div>
                ) : (
                   <div className="text-center p-6">
                       <button 
                         onClick={startCamera}
                         className="flex flex-col items-center gap-2 text-slate-400 hover:text-white transition-colors"
                       >
                           <div className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors">
                               <VideoIcon />
                           </div>
                           <span className="text-sm font-medium">Натисніть, щоб активувати камеру</span>
                       </button>
                   </div>
                )}
              </div>

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Або вставте текст результатів сюди..."
                className="w-full h-24 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50 resize-none mb-2"
                disabled={isProcessing}
              />
              
              {error && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100 flex items-center gap-2">
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-4">
                <button
                  onClick={handleAddAndAnalyze}
                  disabled={isProcessing || (!inputText.trim() && !videoBlob) || remainingConversions <= 0}
                  className={`w-full py-3 px-4 rounded-lg flex justify-center items-center gap-2 font-medium transition-all text-lg ${
                    isProcessing || (!inputText.trim() && !videoBlob) || remainingConversions <= 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                  }`}
                >
                  {isProcessing ? <RefreshIcon className="animate-spin" /> : <><PaperAirplaneIcon /> Аналізувати відео/текст</>}
                </button>
                {remainingConversions <= 3 && remainingConversions > 0 && (
                  <p className="mt-2 text-[10px] text-amber-600 font-medium text-center">
                    Увага! Залишилося лише {remainingConversions} конверсій на сьогодні.
                  </p>
                )}
              </div>
            </div>

            {batches.length > 0 && (
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 border-b pb-2">Додані фрагменти ({batches.length})</h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {batches.map((batch, index) => (
                    <div key={batch.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm group relative">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                            <div className="font-medium text-slate-500 text-xs uppercase">Фрагмент {index + 1}</div>
                            {batch.isImage && <span className="bg-purple-100 text-purple-600 text-[10px] px-1 rounded font-bold">VIDEO</span>}
                        </div>
                        <button onClick={() => setBatches(prev => prev.filter(b => b.id !== batch.id))} className="text-slate-400 hover:text-red-500">
                           <TrashIcon />
                        </button>
                      </div>
                      <p className="text-slate-700 line-clamp-2 italic">{batch.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-full min-h-[500px]">
             {isClientMode ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col items-center justify-center p-8 text-center">
                   <div className="bg-purple-100 p-4 rounded-full mb-4"><PhoneIcon /></div>
                   <h2 className="text-xl font-bold text-slate-800 mb-2">Мобільний сканер</h2>
                   <p className="text-slate-500">Запишіть відео з результатами аналізів. Дані автоматично надішлються на ПК.</p>
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
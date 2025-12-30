import React, { useState, useEffect } from 'react';
import VideoGenerator from './components/VideoGenerator';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
      const localKey = localStorage.getItem("echo_google_api_key");
      if (localKey) setHasKey(true);
  }, []);

  const saveKey = () => {
      if (apiKey) {
          localStorage.setItem("echo_google_api_key", apiKey);
          setHasKey(true);
          setShowKeyModal(false);
          window.location.reload();
      }
  };

  const removeKey = () => {
      localStorage.removeItem("echo_google_api_key");
      setHasKey(false);
      setApiKey('');
      window.location.reload();
  };

  const openKeyManager = async () => {
      // If we are in an environment with window.aistudio, we use that manager
      if (window.aistudio) {
          await window.aistudio.openSelectKey();
      } else {
          setShowKeyModal(true);
      }
  };

  return (
    <div className="min-h-screen bg-[#080505] text-[#e5d5c0] relative selection:bg-[#c5a059] selection:text-[#0f0a0a] overflow-x-hidden font-serif-georgian">
      
      {/* --- Magical Atmosphere Background --- */}
      <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-[#080505]"></div>
          <div className="absolute inset-0 opacity-10" 
               style={{
                   backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
               }}>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_100%)]"></div>
      </div>

      {/* --- Public API Key Button --- */}
      <div className="absolute top-4 right-4 z-50">
          <button 
            onClick={openKeyManager}
            className={`flex items-center gap-2 border px-3 py-1.5 rounded transition-all duration-300 group bg-[#0f0a0a]/80 backdrop-blur-sm ${hasKey ? 'text-[#c5a059] border-[#c5a059]' : 'text-gray-400 border-gray-600'}`}
          >
              <span className="text-xs uppercase tracking-widest font-bold">
                  {hasKey ? "API KEY (ACTIVE)" : "SET API KEY"}
              </span>
              <div className={`w-2 h-2 rounded-full ${hasKey ? 'bg-green-500 shadow-[0_0_5px_lime]' : 'bg-red-500'} animate-pulse`}></div>
          </button>
      </div>

      {/* --- Main Content --- */}
      <div className="relative z-10 container mx-auto px-4 py-16 flex flex-col items-center min-h-screen">
        
        <header className="text-center mb-16 relative group select-none">
          <div className="absolute -inset-10 bg-[#c5a059]/5 blur-3xl rounded-full opacity-50 group-hover:opacity-70 transition-opacity duration-1000"></div>
          
          <div className="mx-auto w-20 h-20 mb-6 border border-[#4a3b32] rotate-45 flex items-center justify-center bg-[#0f0a0a] shadow-[0_0_30px_rgba(197,160,89,0.15)] transition-transform group-active:scale-95">
             <div className="-rotate-45 text-4xl text-[#c5a059]">⏳</div>
          </div>

          <h1 className="text-6xl md:text-8xl text-transparent bg-clip-text bg-gradient-to-b from-[#c5a059] via-[#e5d5c0] to-[#8a7b72] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] tracking-wide font-bold">
            ექო
          </h1>
          <div className="flex items-center justify-center gap-4 mt-4 text-[#8a7b72] tracking-[0.3em] uppercase text-xs md:text-sm">
             <span className="w-12 h-[1px] bg-gradient-to-r from-transparent to-[#c5a059]"></span>
             <span>Visual Storyteller</span>
             <span className="w-12 h-[1px] bg-gradient-to-l from-transparent to-[#c5a059]"></span>
          </div>
        </header>

        <main className="w-full max-w-5xl">
          <VideoGenerator />
        </main>

        <footer className="mt-auto pt-20 pb-8 text-center text-[#4a3b32] text-xs tracking-widest uppercase">
          <p>© 2024 ECHOES OF HISTORY • POWERED BY GOOGLE VEO</p>
        </footer>
      </div>

      {/* --- API KEY MODAL --- */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#1a1515] border border-[#c5a059] p-8 max-w-md w-full shadow-[0_0_50px_rgba(197,160,89,0.2)] relative mx-4">
            
            <button 
              onClick={() => setShowKeyModal(false)}
              className="absolute top-2 right-4 text-[#4a3b32] hover:text-[#c5a059]"
            >
              ✕
            </button>

            <h2 className="text-[#c5a059] text-xl font-bold uppercase tracking-widest mb-4 text-center">
              Google API Access
            </h2>

            <p className="text-[#8a7b72] text-sm text-center mb-6 leading-relaxed">
              აპლიკაცია იყენებს <span className="text-[#c5a059]">Google Gemini API</span>-ს. 
              გთხოვთ შეიყვანოთ თქვენი API Key.
            </p>

            <div className="flex flex-col gap-4">
                <input 
                  type="password" 
                  placeholder="AIza..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-[#0f0a0a] border border-[#4a3b32] text-[#c5a059] p-3 focus:border-[#c5a059] outline-none tracking-widest text-center"
                />
                
                <button 
                  onClick={saveKey}
                  className="bg-[#c5a059] text-[#0f0a0a] font-bold py-3 uppercase tracking-widest text-xs hover:bg-[#e5d5c0] transition-colors"
                >
                  გასაღების შენახვა
                </button>

                <div className="text-center mt-2">
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-[#8a7b72] hover:text-[#c5a059] text-[10px] uppercase tracking-wider border-b border-transparent hover:border-[#c5a059] transition-all"
                    >
                      Get API Key ↗
                    </a>
                </div>

                {hasKey && (
                     <button 
                        onClick={removeKey}
                        className="text-red-900 hover:text-red-500 text-xs uppercase tracking-widest mt-2 text-center"
                    >
                        გასაღების წაშლა (Log Out)
                    </button>
                )}
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
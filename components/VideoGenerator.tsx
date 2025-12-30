import React, { useState } from 'react';
import { generateStoryVideo, generateDebateExperience } from '../services/geminiService';
import { VideoConfig, DurationOption, GenerationMode } from '../types';

const VideoGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState<string>(''); // General context / Story prompt
  
  // Speaker 1 Data
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [speaker1Name, setSpeaker1Name] = useState<string>('');
  const [speaker1Prompt, setSpeaker1Prompt] = useState<string>(''); // Debate stance

  // Speaker 2 Data
  const [selectedFile2, setSelectedFile2] = useState<File | null>(null);
  const [imagePreview2, setImagePreview2] = useState<string | null>(null);
  const [speaker2Name, setSpeaker2Name] = useState<string>('');
  const [speaker2Prompt, setSpeaker2Prompt] = useState<string>(''); // Debate stance

  // PDF Data
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [duration, setDuration] = useState<DurationOption>('16s');
  const [mode, setMode] = useState<GenerationMode>('story');
  
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState<boolean>(false);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'speaker1' | 'speaker2' | 'pdf') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (type === 'pdf') {
          setPdfFile(file);
          return;
      }

      const reader = new FileReader();
      if (type === 'speaker2') {
        setSelectedFile2(file);
        reader.onloadend = () => setImagePreview2(reader.result as string);
      } else {
        setSelectedFile(file);
        reader.onloadend = () => setImagePreview(reader.result as string);
      }
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    // Validation
    if (mode === 'debate') {
        if (!selectedFile2) {
             setError("დებატებისთვის საჭიროა მეორე მოსაუბრის ფოტოც.");
             return;
        }
    }

    // If PDF is not uploaded, require at least a text prompt
    if (!pdfFile && !prompt.trim() && mode !== 'debate') {
        setError("გთხოვთ შეიყვანოთ აღწერა ან ატვირთოთ PDF დოკუმენტი.");
        return;
    }

    if (!selectedFile) {
        setError("გთხოვთ ატვირთოთ მთავარი ფოტო.");
        return;
    }
   

    setIsGenerating(true);
    setError(null);
    setIsQuotaError(false);
    setVideoUrl(null);
    setStatusMessage("ექო იღვიძებს...");

    try {
      const base64Image = await fileToBase64(selectedFile);
      
      const config: VideoConfig = {
        prompt: prompt, // Use as General Prompt (Optional in Debate) or Main Prompt (Story)
        imageBase64: base64Image,
        mimeType: selectedFile.type,
        duration: duration,
        mode: mode,
        speaker1Name: speaker1Name || "მოსაუბრე 1",
        speaker2Name: speaker2Name || "მოსაუბრე 2",
        // Debate Specifics
        speaker1Prompt: mode === 'debate' ? speaker1Prompt : undefined,
        speaker2Prompt: mode === 'debate' ? speaker2Prompt : undefined,
      };

      if (mode === 'debate' && selectedFile2) {
         config.speaker2ImageBase64 = await fileToBase64(selectedFile2);
         config.speaker2MimeType = selectedFile2.type;
      }

      if (pdfFile) {
          config.pdfBase64 = await fileToBase64(pdfFile);
      }

      let resultUrl = null;
      if (mode === 'debate') {
        resultUrl = await generateDebateExperience(config, (msg) => setStatusMessage(msg));
      } else {
        resultUrl = await generateStoryVideo(config, (msg) => setStatusMessage(msg));
      }
      setVideoUrl(resultUrl);
      
    } catch (err: any) {
      console.error(err);
      const msg = (err.message || JSON.stringify(err)).toLowerCase();

      if (msg.includes("api_key_missing")) {
          setError("გთხოვთ დააჭიროთ 'SET API KEY' ღილაკს მარჯვენა ზედა კუთხეში.");
          setIsQuotaError(true);
      }
      else if (msg.includes("api_key_invalid")) {
          setError("თქვენი API Key ვადაგასულია ან არასწორია. გთხოვთ განაახლოთ.");
          // Clear invalid key immediately
          localStorage.removeItem("echo_google_api_key");
          setIsQuotaError(true); // Re-use quota flag to show 'Change Key' button
      }
      else if (msg.includes("quota") || msg.includes("429") || msg.includes("resource_exhausted")) {
         setError("სამწუხაროდ, ექოს ენერგია დროებით ამოიწურა (Quota Exceeded). სცადეთ მოგვიანებით ან შეცვალეთ გასაღები.");
         setIsQuotaError(true);
      } else {
         setError(`შეცდომა: ${err.message || "გენერაცია ვერ მოხერხდა"}`);
         setIsQuotaError(false);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const durationLabel = {
      '16s': '16 წამი (2 სეგმენტი)',
      '24s': '24 წამი (3 სეგმენტი)',
      '48s': '48 წამი (6 სეგმენტი)'
  };

  return (
    <div className="w-full relative z-20">
      
      {/* Magical Container (The Book/Frame) */}
      <div className="bg-[#120c0c] border border-[#4a3b32] p-1 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative group">
        
        {/* Animated Border Glow */}
        <div className="absolute -inset-[1px] bg-gradient-to-r from-[#c5a059] via-transparent to-[#c5a059] opacity-20 blur-sm"></div>

        <div className="relative bg-[#0f0a0a] border border-[#2a1a1a] p-8 md:p-12 overflow-hidden">
            
            {/* Background Texture inside container */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(197,160,89,0.05),transparent_50%)]"></div>

            {/* INPUT FORM (Hidden when result is shown) */}
            {!videoUrl && !isGenerating && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-10 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    
                    {/* Left: Photos */}
                    <div className="md:col-span-4 flex flex-col space-y-6">
                         {/* Mode Selector (Moved to Top Left for visibility) */}
                         <div>
                             <label className="text-[#c5a059] text-sm tracking-widest uppercase mb-4 block opacity-80">
                                 რეჟიმი
                             </label>
                             <div className="flex flex-col gap-2 bg-[#1a1515] p-2 border border-[#2a1a1a] rounded-xl">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setMode('story')}
                                        className={`flex-1 py-3 px-2 rounded-lg text-[10px] sm:text-xs uppercase tracking-wider transition-all ${mode === 'story' ? 'bg-[#c5a059] text-[#0f0a0a] font-bold' : 'text-[#5a4b42] hover:text-[#8a7b72]'}`}
                                    >
                                        ისტორია
                                    </button>
                                    <button 
                                        onClick={() => setMode('single')}
                                        className={`flex-1 py-3 px-2 rounded-lg text-[10px] sm:text-xs uppercase tracking-wider transition-all ${mode === 'single' ? 'bg-[#c5a059] text-[#0f0a0a] font-bold' : 'text-[#5a4b42] hover:text-[#8a7b72]'}`}
                                    >
                                        სწრაფი
                                    </button>
                                </div>
                                <button 
                                    onClick={() => setMode('debate')}
                                    className={`w-full py-3 px-2 rounded-lg text-[10px] sm:text-xs uppercase tracking-wider transition-all ${mode === 'debate' ? 'bg-[#c5a059] text-[#0f0a0a] font-bold' : 'text-[#5a4b42] hover:text-[#8a7b72]'}`}
                                >
                                    დებატები (Video)
                                </button>
                             </div>
                        </div>

                        {/* Speaker 1 Photo */}
                        <div className="relative mt-4">
                             <label className="text-[#8a7b72] text-[10px] uppercase tracking-widest mb-2 block">
                                {mode === 'debate' ? 'მოსაუბრე 1' : 'მთავარი გმირი'}
                             </label>
                            <div 
                                className={`aspect-[3/4] border border-[#4a3b32] bg-[#1a1515] relative cursor-pointer hover:border-[#c5a059] transition-all duration-500 group/image ${imagePreview ? 'border-[#c5a059]' : ''}`}
                                onClick={() => document.getElementById('fileInput')?.click()}
                            >
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Author" className="w-full h-full object-cover opacity-80" />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[#4a3b32]">
                                        <div className="text-4xl mb-4 opacity-50">✦</div>
                                        <span className="text-xs uppercase tracking-widest">ატვირთე ფოტო</span>
                                    </div>
                                )}
                                <input type="file" id="fileInput" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'speaker1')} />
                            </div>
                        </div>

                        {/* Speaker 2 Photo (Debate Only) */}
                        {mode === 'debate' && (
                             <div className="relative animate-in slide-in-from-left-4 duration-500">
                                <label className="text-[#8a7b72] text-[10px] uppercase tracking-widest mb-2 block">
                                    მოსაუბრე 2
                                </label>
                                <div 
                                    className={`aspect-[3/4] border border-[#4a3b32] bg-[#1a1515] relative cursor-pointer hover:border-[#c5a059] transition-all duration-500 group/image ${imagePreview2 ? 'border-[#c5a059]' : ''}`}
                                    onClick={() => document.getElementById('fileInput2')?.click()}
                                >
                                    {imagePreview2 ? (
                                        <img src={imagePreview2} alt="Speaker 2" className="w-full h-full object-cover opacity-80" />
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#4a3b32]">
                                            <div className="text-4xl mb-4 opacity-50">✦</div>
                                            <span className="text-xs uppercase tracking-widest">ატვირთე ფოტო</span>
                                        </div>
                                    )}
                                    <input type="file" id="fileInput2" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'speaker2')} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Inputs & Controls */}
                    <div className="md:col-span-8 flex flex-col space-y-6">
                        
                        {/* --- NEW: PDF UPLOAD SECTION --- */}
                        <div className="border border-dashed border-[#4a3b32] bg-[#1a1515]/30 p-4 rounded-lg hover:border-[#c5a059] transition-colors relative group/pdf">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-[#2a1a1a] rounded-full flex items-center justify-center text-[#c5a059]">
                                    📄
                                </div>
                                <div className="flex-1">
                                    <label className="text-[#8a7b72] text-[10px] uppercase tracking-widest block mb-1">
                                        დოკუმენტის ანალიზი (PDF)
                                    </label>
                                    <p className="text-[#e5d5c0] text-xs truncate max-w-[200px] sm:max-w-xs">
                                        {pdfFile ? pdfFile.name : "ატვირთეთ მოთხრობა, კვლევა ან თხზულება..."}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => document.getElementById('pdfInput')?.click()}
                                    className="text-[#c5a059] text-xs uppercase tracking-wider border border-[#c5a059] px-3 py-1 rounded hover:bg-[#c5a059] hover:text-[#0f0a0a] transition-all"
                                >
                                    {pdfFile ? 'შეცვლა' : 'ატვირთვა'}
                                </button>
                            </div>
                            <input 
                                type="file" 
                                id="pdfInput" 
                                accept="application/pdf" 
                                className="hidden" 
                                onChange={(e) => handleFileChange(e, 'pdf')} 
                            />
                            {pdfFile && (
                                <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                            )}
                        </div>

                        {/* DEBATE INPUTS */}
                        {mode === 'debate' ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                {/* Speaker 1 Block */}
                                <div className="bg-[#1a1515]/50 border border-[#2a1a1a] p-4 rounded-lg">
                                     <div className="flex gap-4 mb-2">
                                        <input 
                                            type="text" 
                                            placeholder="მოსაუბრე 1-ის სახელი"
                                            value={speaker1Name}
                                            onChange={(e) => setSpeaker1Name(e.target.value)}
                                            className="w-1/2 bg-transparent border-b border-[#4a3b32] text-[#c5a059] text-sm py-1 focus:outline-none placeholder-[#4a3b32]"
                                        />
                                        <span className="text-[#4a3b32] text-xs self-center uppercase">პოზიცია / თემა</span>
                                     </div>
                                     <textarea
                                        value={speaker1Prompt}
                                        onChange={(e) => setSpeaker1Prompt(e.target.value)}
                                        placeholder="რაზე საუბრობს ეს ადამიანი?"
                                        className="w-full h-20 bg-transparent text-[#e5d5c0] text-sm focus:outline-none resize-none placeholder-[#4a3b32]"
                                    />
                                </div>

                                {/* Speaker 2 Block */}
                                <div className="bg-[#1a1515]/50 border border-[#2a1a1a] p-4 rounded-lg">
                                     <div className="flex gap-4 mb-2">
                                        <input 
                                            type="text" 
                                            placeholder="მოსაუბრე 2-ის სახელი"
                                            value={speaker2Name}
                                            onChange={(e) => setSpeaker2Name(e.target.value)}
                                            className="w-1/2 bg-transparent border-b border-[#4a3b32] text-[#c5a059] text-sm py-1 focus:outline-none placeholder-[#4a3b32]"
                                        />
                                        <span className="text-[#4a3b32] text-xs self-center uppercase">პოზიცია / თემა</span>
                                     </div>
                                     <textarea
                                        value={speaker2Prompt}
                                        onChange={(e) => setSpeaker2Prompt(e.target.value)}
                                        placeholder="რა არის მისი საპირისპირო არგუმენტი?"
                                        className="w-full h-20 bg-transparent text-[#e5d5c0] text-sm focus:outline-none resize-none placeholder-[#4a3b32]"
                                    />
                                </div>

                                {/* General Context (Optional) */}
                                <div>
                                    <label className="text-[#8a7b72] text-[10px] uppercase tracking-widest mb-2 block">
                                        ზოგადი კონტექსტი (არასავალდებულო)
                                    </label>
                                    <input 
                                        type="text"
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="მაგ: ისაუბრეთ ლექსად, ან იყავით ძალიან ემოციურები..."
                                        className="w-full bg-[#1a1515] border border-[#2a1a1a] p-3 text-[#e5d5c0] text-sm rounded focus:border-[#c5a059] outline-none"
                                    />
                                </div>
                            </div>
                        ) : (
                            /* STANDARD STORY/SINGLE INPUT */
                            <div className="flex-1">
                                 <div className="flex gap-4 mb-4">
                                     <input 
                                        type="text" 
                                        placeholder="პერსონაჟის სახელი (არასავალდებულო)"
                                        value={speaker1Name}
                                        onChange={(e) => setSpeaker1Name(e.target.value)}
                                        className="w-1/2 bg-transparent border-b border-[#4a3b32] text-[#c5a059] text-sm py-1 focus:outline-none placeholder-[#4a3b32]"
                                    />
                                 </div>
                                 <label className="text-[#c5a059] text-sm tracking-widest uppercase mb-4 block opacity-80">
                                    ისტორიის შინაარსი {pdfFile && "(PDF დოკუმენტი ატვირთულია)"}
                                 </label>
                                 <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder={pdfFile ? "დაწერეთ დამატებითი ინსტრუქცია დოკუმენტის შესახებ..." : "რაზე უნდა გვიამბოს ექომ? ჩაწერეთ მოთხრობის ან პოემის შინაარსი..."}
                                    className="w-full h-32 bg-transparent border-b border-[#4a3b32] text-[#e5d5c0] text-lg p-2 focus:outline-none focus:border-[#c5a059] focus:bg-[#c5a059]/5 transition-all placeholder-[#4a3b32] resize-none leading-relaxed"
                                />
                            </div>
                        )}

                        {/* Duration Slider */}
                        <div className="animate-in fade-in duration-500 pt-4 border-t border-[#2a1a1a]">
                            <label className="text-[#c5a059] text-sm tracking-widest uppercase mb-4 block opacity-80">
                                ხანგრძლივობა: <span className="text-[#e5d5c0] ml-2 normal-case font-bold">{durationLabel[duration]}</span>
                            </label>
                            <div className="flex items-center gap-4 bg-[#1a1515] p-1 border border-[#2a1a1a] rounded-full">
                                <button onClick={() => setDuration('16s')} className={`flex-1 py-2 rounded-full text-xs uppercase tracking-wider transition-all ${duration === '16s' ? 'bg-[#4a3b32] text-[#e5d5c0]' : 'text-[#5a4b42]'}`}>16 წამი</button>
                                <button onClick={() => setDuration('24s')} className={`flex-1 py-2 rounded-full text-xs uppercase tracking-wider transition-all ${duration === '24s' ? 'bg-[#4a3b32] text-[#e5d5c0]' : 'text-[#5a4b42]'}`}>24 წამი</button>
                                <button onClick={() => setDuration('48s')} className={`flex-1 py-2 rounded-full text-xs uppercase tracking-wider transition-all ${duration === '48s' ? 'bg-[#4a3b32] text-[#e5d5c0]' : 'text-[#5a4b42]'}`}>48 წამი</button>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <div className="pt-2">
                            <button
                                onClick={handleGenerate}
                                className="w-full py-5 border border-[#c5a059] text-[#c5a059] hover:bg-[#c5a059] hover:text-[#0f0a0a] transition-all duration-500 uppercase tracking-[0.2em] text-sm relative overflow-hidden group/btn"
                            >
                                <span className="relative z-10 font-bold">
                                    {mode === 'debate' ? 'დებატების დაწყება' : 'ექოს გამოძახება'}
                                </span>
                                <div className="absolute inset-0 bg-[#c5a059] translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500 ease-out z-0"></div>
                            </button>
                        </div>

                        {error && (
                            <div className="flex flex-col items-center gap-2 border-t border-red-900/30 pt-4">
                                <div className="text-red-400/80 text-xs text-center">
                                    {error}
                                </div>
                                {(isQuotaError || error.includes("Quota") || error.includes("Access Token")) && (
                                    <button 
                                        onClick={() => {
                                            if (window.aistudio) {
                                                window.aistudio.openSelectKey();
                                            } else {
                                                // If we are in public mode, we can't trigger the modal from here easily without context
                                                // So we prompt user to look at the top right corner
                                                const btn = document.querySelector('button[class*="border px-3 py-1.5"]');
                                                if (btn instanceof HTMLElement) btn.click();
                                            }
                                        }}
                                        className="mt-3 text-[#c5a059] border border-[#c5a059] px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-[#c5a059] hover:text-[#0f0a0a] transition-all"
                                    >
                                        API Key-ის შეცვლა (ზედა მარჯვენა კუთხე)
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* LOADING STATE */}
            {isGenerating && (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
                    <div className="w-16 h-16 border-2 border-[#4a3b32] border-t-[#c5a059] rounded-full animate-spin mb-8"></div>
                    <p className="text-[#c5a059] text-sm uppercase tracking-[0.2em] animate-pulse">{statusMessage}</p>
                    <p className="text-[#5a4b42] text-xs mt-4">გთხოვთ დაელოდოთ, ექო ისტორიას წერს...</p>
                </div>
            )}

            {/* RESULT VIEW (Universal for Story and Debate now) */}
            {videoUrl && (
                <div className="animate-in zoom-in-95 duration-1000 relative">
                    <div className="aspect-video w-full bg-black border border-[#4a3b32] relative overflow-hidden shadow-2xl group/video">
                        <video 
                             src={videoUrl} 
                             controls 
                             autoPlay 
                             className="w-full h-full object-cover" 
                        />
                    </div>
                    <div className="mt-8 flex justify-center gap-4">
                        <button 
                            onClick={() => { setVideoUrl(null); }}
                            className="text-[#8a7b72] hover:text-[#c5a059] text-xs uppercase tracking-widest transition-colors"
                        >
                            ← ახალი გენერაცია
                        </button>
                        <a 
                            href={videoUrl} 
                            download="echo_video.mp4"
                            className="text-[#c5a059] border-b border-[#c5a059] pb-1 text-xs uppercase tracking-widest hover:text-[#e5d5c0] hover:border-[#e5d5c0] transition-colors"
                        >
                            გადმოწერა
                        </a>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default VideoGenerator;
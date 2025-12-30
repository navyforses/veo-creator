import { GoogleGenAI, VideoGenerationReferenceType } from "@google/genai";
import { VideoConfig, Resolution, AspectRatio, DurationOption } from "../types";

// --- ინსტრუქცია: ჩასვით თქვენი API Key ბრჭყალებში ქვემოთ, თუ არ გსურთ UI-ის გამოყენება ---
const HARDCODED_API_KEY = ""; // მაგალითად: "AIzaSyD..."
// -------------------------------------------------------------------------------------------

const getClient = async (): Promise<GoogleGenAI> => {
  // 1. პრიორიტეტი: კოდში ჩაწერილი გასაღები
  if (HARDCODED_API_KEY) {
      return new GoogleGenAI({ apiKey: HARDCODED_API_KEY });
  }

  // 2. პრიორიტეტი: ბრაუზერში შენახული გასაღები (UI-დან)
  const localKey = localStorage.getItem("echo_google_api_key");
  if (localKey) {
    return new GoogleGenAI({ apiKey: localKey });
  }

  // 3. პრიორიტეტი: Google-ის შიდა გარემო (თუ IDX ან AI Studio-ში ეშვება)
  if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
      }
      return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  throw new Error("API_KEY_MISSING");
};

async function waitForOperation(ai: GoogleGenAI, operation: any) {
  let currentOp = operation;
  let errorCount = 0;
  const startTime = Date.now();
  const MAX_WAIT_TIME = 600000; // Increased to 10 Minutes Timeout Safety for deep queues
  
  while (!currentOp.done) {
    // Safety check for infinite loop
    if (Date.now() - startTime > MAX_WAIT_TIME) {
        throw new Error("Operation timed out (stuck in loop). Please try again.");
    }

    // SPEED OPTIMIZATION: Polling every 2s (slightly increased to be safer)
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    try {
      currentOp = await ai.operations.getVideosOperation({ operation: currentOp });
      errorCount = 0; 
    } catch (e: any) {
      console.warn("Transient error polling operation:", e);
      const errStr = (e.message || JSON.stringify(e)).toLowerCase();
      
      // If we hit rate limit while polling, wait longer
      if (errStr.includes("429") || errStr.includes("quota") || errStr.includes("resource_exhausted")) {
          await new Promise(r => setTimeout(r, 5000));
      }
      
      errorCount++;
      if (errorCount > 10) throw e; // Increased tolerance for polling errors
      continue;
    }
  }
  
  if (currentOp.error) {
    throw new Error(currentOp.error.message || "Video generation failed");
  }
  if (!currentOp.response && !currentOp.result) {
     throw new Error("Safety Block: Video filtered by AI policies.");
  }
  return currentOp;
}

async function executeGenerationWithRetry(ai: GoogleGenAI, request: any, stepIndex: number, totalSteps: number): Promise<any> {
    let attempts = 0;
    const maxAttempts = 5; // Increased attempts for high traffic
    let lastError: any = null;
    
    while (attempts < maxAttempts) {
        try {
            const op = await ai.models.generateVideos(request);
            const result = await waitForOperation(ai, op);
            
            const video = result.response?.generatedVideos?.[0]?.video;
            if (video) {
                return result; 
            }
            console.warn(`Step ${stepIndex + 1}: Empty response. Retrying...`);
        } catch (e: any) {
             const errStr = (e.message || JSON.stringify(e)).toLowerCase();
             console.warn(`Step ${stepIndex + 1} Attempt ${attempts + 1}: Failed. Error:`, errStr);
             lastError = e;

             // FATAL ERROR: API Key invalid/expired - Stop Retrying Immediately
             if (errStr.includes("api_key_invalid") || errStr.includes("expired") || errStr.includes("key not found")) {
                 throw new Error("API_KEY_INVALID");
             }
             
             // RETRYABLE ERROR: Resource exhausted / Quota
             if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('resource_exhausted')) {
                 // Exponential Backoff: 5s, 10s, 20s, 40s...
                 const waitTime = 5000 * Math.pow(2, attempts); 
                 console.log(`Quota limit hit. Waiting ${waitTime/1000}s before retry...`);
                 await new Promise(r => setTimeout(r, waitTime));
             } else {
                 // Standard backoff for other errors
                 await new Promise(r => setTimeout(r, 2000));
             }
        }
        attempts++;
    }
    
    throw lastError || new Error(`Generation failed at step ${stepIndex + 1}`);
}

async function retryOperation<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
  let delay = 2000;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      const errStr = (error.message || JSON.stringify(error)).toLowerCase();

      // Stop if key invalid
      if (errStr.includes("api_key_invalid") || errStr.includes("expired")) throw error;

      if (i < retries - 1) {
        // Longer wait for quota errors during script generation
        if (errStr.includes("429") || errStr.includes("quota")) {
             delay = Math.max(delay, 5000); 
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw error;
    }
  }
  throw new Error("Operation failed after retries");
}

interface ScriptScene {
  visual_en: string;
  environment_en: string;
  hand_action_en: string;
  dialogue_ka: string;
  dialogue_en: string;
  character_type: 'author' | 'story_character';
}

// Generate a sequence of visual prompts
async function generateCreativeScript(ai: GoogleGenAI, userPrompt: string, segmentCount: number, pdfBase64?: string): Promise<ScriptScene[]> {
  const model = 'gemini-2.5-flash'; 
  
  const systemPrompt = `
    You are 'Echo', a magical Georgian visual storyteller. 
    
    TASK: Write a CONTINUOUS NARRATIVE split into exactly ${segmentCount} parts.
    TIMING: Each part represents exactly 8 seconds of video.
    
    CRITICAL RULES FOR PACING & TIMING:
    1. **WORD COUNT LIMIT**: Each part MUST contain MAXIMUM 10-15 Georgian words. Do not exceed this. 
       *Reason: To ensure the character finishes speaking within 8 seconds.*
    2. **SENTENCE COMPLETION**: Each part MUST end with a strong punctuation mark (. or ! or ?). Never end a part with a comma or in the middle of a thought.
    3. **CHAINED NARRATIVE**: Part 2 continues Part 1 perfectly.
    
    VISUALS:
    - Describe facial expressions that match the PUNCTUATION (e.g., if there is a comma, say "Brief pause, looks to side").

    Content Source: ${pdfBase64 ? "Analyze the attached PDF." : "User topic."}

    Output a JSON array (length ${segmentCount}) of objects:
    {
      "environment_en": "Environment description (consistent with previous)",
      "hand_action_en": "Action matching the rhythm (e.g. 'Head nod on emphasis', 'Pause')",
      "visual_en": "Facial expression matching the emotion",
      "dialogue_ka": "Georgian dialogue (Short, max 15 words, Ends with .!? )",
      "dialogue_en": "English translation."
    }
  `;

  const reqContents: any[] = [];
  if (pdfBase64) {
      reqContents.push({
          parts: [
              { text: userPrompt || "Analyze this document." },
              { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }
          ]
      });
  } else {
      reqContents.push({ parts: [{ text: userPrompt }] });
  }

  const response = await ai.models.generateContent({
    model: model,
    contents: reqContents,
    config: { systemInstruction: systemPrompt, responseMimeType: "application/json" }
  });

  try {
    const cleanText = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";
    return JSON.parse(cleanText);
  } catch (e) {
    throw new Error("Failed to parse script");
  }
}

function getSegmentCount(duration: DurationOption): number {
  switch (duration) {
    case '16s': return 2;
    case '24s': return 3;
    case '48s': return 6;
    default: return 1;
  }
}

export const generateDebateExperience = async (config: VideoConfig, onStatusUpdate: (status: string) => void): Promise<string> => {
    return generateStoryVideo(config, onStatusUpdate);
};


export const generateStoryVideo = async (
  config: VideoConfig, 
  onStatusUpdate: (status: string) => void
): Promise<string> => {
  const ai = await getClient();
  
  // Using AI Studio model ID (Fast Preview)
  const modelId = 'veo-3.1-fast-generate-preview';
  
  const fixedResolution = config.mode === 'single' ? Resolution.HD_1080P : Resolution.HD_720P;
  const fixedAspectRatio = AspectRatio.LANDSCAPE;

  let segmentCount = getSegmentCount(config.duration);
  if (config.mode === 'single') segmentCount = 1;

  try {
    // --- Step 0: Scripting ---
    onStatusUpdate("ექო ამზადებს 8-წამიან სცენებს (Strict Timing)...");
    const scriptScenes = await retryOperation(async () => {
        return await generateCreativeScript(ai, config.prompt, segmentCount, config.pdfBase64);
    }, 3);
    
    const safeSegmentCount = Math.min(segmentCount, scriptScenes.length);

    let previousVideo = null;
    let currentVideoUri = null;

    // --- Loop through segments ---
    for (let i = 0; i < safeSegmentCount; i++) {
        const isFirst = i === 0;
        const scene = scriptScenes[i] || scriptScenes[scriptScenes.length - 1];
        
        onStatusUpdate(`სცენა ${i + 1} / ${safeSegmentCount}: "${scene.dialogue_ka.substring(0, 30)}..."`);

        let prompt = "";
        
        // FIX 1: Explicit Visual Pacing instructions
        const pacingInstruction = `
        VISUAL PACING RULES: 
        1. Sync lip movements strictly to: "${scene.dialogue_ka}". 
        2. IF PUNCTUATION (Comma/Period): The subject MUST visually pause (close mouth momentarily or nod) at punctuation marks.
        3. EMOTION: Match the sentiment of: "${scene.visual_en}".
        `;

        if (isFirst) {
            // STEP 1: INITIAL GENERATION
            // FIX 2: STRONGER IDENTITY LOCK
            prompt = `
            CINEMATIC PORTRAIT. 
            SUBJECT: The exact person from the input image.
            IDENTITY_LOCK: 100%. DO NOT change facial structure, nose shape, or eye color. The input image is the Absolute Truth.
            ACTION: Speaking naturally.
            ${pacingInstruction}
            BACKGROUND: ${scene.environment_en}.
            LIGHTING: Cinematic volumetric lighting.
            `;
        } else {
            // STEP 2+: EXTENSION
            prompt = `
            CONTINUE VIDEO.
            SUBJECT: The character from the video history.
            IDENTITY_LOCK: 100%. STRICT FACIAL CONSISTENCY. No morphing. No aging.
            ACTION: Continuing to speak.
            ${pacingInstruction}
            TRANSITION: The background subtlely evolves to: ${scene.environment_en}.
            CAMERA: Smooth continuation.
            `;
        }

        let request: any = {
            model: modelId,
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: fixedResolution,
                aspectRatio: fixedAspectRatio,
            }
        };

        if (isFirst) {
            request.image = {
                imageBytes: config.imageBase64,
                mimeType: config.mimeType,
            };
        } else {
            if (!previousVideo) throw new Error("Previous video segment lost.");
            request.video = previousVideo;
        }

        const result = await executeGenerationWithRetry(ai, request, i, safeSegmentCount);
        
        previousVideo = result.response?.generatedVideos?.[0]?.video;
        currentVideoUri = result.response?.generatedVideos?.[0]?.video?.uri;
    }

    if (!currentVideoUri) throw new Error("Final video URI missing");

    // Standard fetch for AI Studio
    let downloadUrl = `${currentVideoUri}`;
    
    if (HARDCODED_API_KEY) {
        downloadUrl += `&key=${HARDCODED_API_KEY}`;
    } else if (localStorage.getItem("echo_google_api_key")) {
        downloadUrl += `&key=${localStorage.getItem("echo_google_api_key")}`;
    } else {
        downloadUrl += `&key=${process.env.API_KEY}`;
    }
    
    const response = await retryOperation(async () => {
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
        return res;
    }, 3);

    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error: any) {
    console.error("Echo generation error:", error);
    const msg = (error.message || JSON.stringify(error)).toLowerCase();
    
    if (msg.includes("api_key_missing")) throw new Error("API_KEY_MISSING");
    
    // Explicitly handle Invalid/Expired Key errors
    if (msg.includes("api_key_invalid") || msg.includes("expired") || msg.includes("key not found") || msg.includes("invalid_argument")) {
        throw new Error("API_KEY_INVALID");
    }

    if (msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted")) {
         throw new Error("სამწუხაროდ, ექოს ენერგია დროებით ამოიწურა (API Quota Exceeded).");
    }
    throw error;
  }
};
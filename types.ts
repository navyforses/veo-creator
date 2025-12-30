export enum AspectRatio {
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
}

export enum Resolution {
  HD_720P = '720p',
  HD_1080P = '1080p',
}

export type DurationOption = '16s' | '24s' | '48s';

export type GenerationMode = 'story' | 'single' | 'debate';

export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface VideoConfig {
  prompt: string; // General prompt (Story context OR Debate extra context)
  imageBase64: string;
  mimeType: string;
  duration: DurationOption;
  mode: GenerationMode;
  
  // Optional Document Context
  pdfBase64?: string; // Base64 encoded PDF content

  // Debate specific fields
  speaker1Prompt?: string; // What Speaker 1 talks about
  speaker2Prompt?: string; // What Speaker 2 talks about
  speaker2ImageBase64?: string;
  speaker2MimeType?: string;
  speaker1Name?: string;
  speaker2Name?: string;
  speaker1Voice?: VoiceName;
  speaker2Voice?: VoiceName;
}

export interface GenerationStatus {
  step: number;
  totalSteps: number;
  message: string;
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  
  // AudioContext type definition fix for some environments
  interface Window {
    webkitAudioContext: typeof AudioContext;
    aistudio?: AIStudio;
  }
}
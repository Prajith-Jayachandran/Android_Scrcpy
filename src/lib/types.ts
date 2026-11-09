export interface DeviceInfo {
  id: string;
  status: 'device' | 'unauthorized' | 'offline' | 'unknown';
  model?: string;
  product?: string;
  isWireless?: boolean;
}

export interface StreamMeta {
  codec: string;
  width: number;
  height: number;
  physicalWidth?: number;
  physicalHeight?: number;
  deviceId?: string;
}

export interface LogMessage {
  id: string;
  message: string;
  timestamp: number;
  type?: 'info' | 'error' | 'system';
}

// Feature #8: Macro Recorder Types
export type MacroActionType = 'tap' | 'swipe' | 'key' | 'text' | 'delay' | 'wait_for_text';
export type MacroErrorPolicy = 'abort_and_home' | 'pause_prompt' | 'skip';

export interface MacroStep {
  id: string;
  type: MacroActionType;
  delayMs: number; // Delay before executing this step
  // Tap parameters
  x?: number;
  y?: number;
  // Swipe parameters
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  duration?: number;
  // Key parameters
  keyCode?: number;
  // Text parameters
  text?: string;
  // OCR / Vision Trigger parameters
  targetText?: string;
  timeoutMs?: number;
  packageName?: string;
}

export interface MacroWorkflow {
  id: string;
  name: string;
  steps: MacroStep[];
  createdAt: number;
}

// Feature #3: Gamepad Virtual Keys & Layout
export interface GamepadButtonConfig {
  id: string;
  label: string;
  key: string;
  xPercent: number; // 0 to 100% on screen
  yPercent: number;
  type: 'button' | 'joystick' | 'aim';
  actionKeyCode?: number;
}

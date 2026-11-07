export interface DeviceInfo {
  id: string;
  status: 'device' | 'unauthorized' | 'offline' | 'unknown';
  model?: string;
  product?: string;
}

export interface StreamMeta {
  codec: string;
  width: number;
  height: number;
  physicalWidth?: number;
  physicalHeight?: number;
}

export interface LogMessage {
  id: string;
  message: string;
  timestamp: number;
  type?: 'info' | 'error' | 'system';
}

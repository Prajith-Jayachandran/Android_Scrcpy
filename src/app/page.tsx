'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DeviceManager } from '@/components/DeviceManager';
import { ControlsSidebar } from '@/components/ControlsSidebar';
import { ScreenViewer } from '@/components/ScreenViewer';
import { DiagnosticsPanel } from '@/components/DiagnosticsPanel';
import { LogsConsole } from '@/components/LogsConsole';
import { CursorTrail } from '@/components/CursorTrail';
import { DeviceTabBar } from '@/components/DeviceTabBar';
import { NewUsbDeviceModal } from '@/components/NewUsbDeviceModal';
import { MacroEditor } from '@/components/MacroEditor';
import { useMultiWebCodecs } from '@/hooks/useMultiWebCodecs';
import { useMacroRecorder } from '@/hooks/useMacroRecorder';
import { useCanvasOcr } from '@/hooks/useCanvasOcr';
import { usePictureInPicture } from '@/hooks/usePictureInPicture';
import { useDeviceAudio } from '@/hooks/useDeviceAudio';
import { useAdaptiveBitrate } from '@/hooks/useAdaptiveBitrate';
import { useSecurityShield } from '@/hooks/useSecurityShield';
import { DeviceInfo, StreamMeta, LogMessage } from '@/lib/types';
import { Cast } from 'lucide-react';

export default function Home() {
  // Layer 3: DevTools, Inspection & Anti-Debugging Lockdown
  useSecurityShield();

  const wsRef = useRef<WebSocket | null>(null);

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const selectedDeviceIdRef = useRef<string>('');
  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  const [streamingDeviceIds, setStreamingDeviceIds] = useState<Set<string>>(new Set());
  const [deviceMetas, setDeviceMetas] = useState<Record<string, StreamMeta>>({});
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);

  // Feature #4: Multi-Device Parallel View Modes ('tabs' or 'split')
  const [viewMode, setViewMode] = useState<'tabs' | 'split'>('tabs');

  // Feature #4: Multi-Device Sync Input Toggle
  const [syncAll, setSyncAll] = useState<boolean>(false);

  // Feature #10: Quick-Draw Privacy Mode State
  const [privacyMode, setPrivacyMode] = useState<boolean>(false);

  // Feature #3: Context-Aware Game Detection State
  const [isGameActive, setIsGameActive] = useState<boolean>(false);
  const [activePackage, setActivePackage] = useState<string>('');
  const manualGamepadRef = useRef<boolean>(false);

  // USB Multi-Device Link Pop-up Modal State
  const [newUsbModalOpen, setNewUsbModalOpen] = useState<boolean>(false);
  const newUsbModalOpenRef = useRef<boolean>(false);
  useEffect(() => {
    newUsbModalOpenRef.current = newUsbModalOpen;
  }, [newUsbModalOpen]);

  const [detectedUsbDevice, setDetectedUsbDevice] = useState<DeviceInfo | null>(null);
  const isManualRefreshRef = useRef<boolean>(false);
  const knownDeviceIdsRef = useRef<Set<string>>(new Set());
  const isInitialBootRef = useRef<boolean>(true);

  const devicesRef = useRef<DeviceInfo[]>([]);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [
      ...prev.slice(-150),
      {
        id: Math.random().toString(36).substring(2, 9),
        message,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  // Multi-Device WebCodecs Decoder Pool (Decodes each device in parallel)
  const { registerCanvas, decodeChunk, resetDecoder, fpsMap } = useMultiWebCodecs();

  // Active Canvas Element Ref Map (Tracks mounted canvas for OCR and PiP sync)
  const selectedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasElementsRef = useRef<Record<string, HTMLCanvasElement>>({});

  useEffect(() => {
    selectedCanvasRef.current = canvasElementsRef.current[selectedDeviceId] || null;
  }, [selectedDeviceId]);

  const handleRegisterCanvas = useCallback(
    (deviceId: string, canvas: HTMLCanvasElement | null) => {
      if (canvas) {
        canvasElementsRef.current[deviceId] = canvas;
        if (deviceId === selectedDeviceIdRef.current) {
          selectedCanvasRef.current = canvas;
        }
      } else {
        delete canvasElementsRef.current[deviceId];
        if (selectedCanvasRef.current === canvasElementsRef.current[deviceId]) {
          selectedCanvasRef.current = null;
        }
      }
      registerCanvas(deviceId, canvas);
    },
    [registerCanvas]
  );

  // Current active device streaming state and fps
  const activeDevice = devices.find((d) => d.id === selectedDeviceId);
  const isStreaming = streamingDeviceIds.has(selectedDeviceId);
  const activeMeta = deviceMetas[selectedDeviceId] || null;
  const currentFps = fpsMap[selectedDeviceId] || 0;

  // Raw command dispatches targeted to specific or all devices
  const rawSendKey = useCallback(
    (targetDeviceId: string, code: number) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !targetDeviceId) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'key',
          deviceId: targetDeviceId,
          code,
          syncAll,
        })
      );
    },
    [syncAll]
  );

  const rawSendText = useCallback(
    (targetDeviceId: string, text: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !targetDeviceId) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'text',
          deviceId: targetDeviceId,
          text,
          syncAll,
        })
      );
    },
    [syncAll]
  );

  const rawTap = useCallback(
    (targetDeviceId: string, x: number, y: number, relX?: number, relY?: number) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !targetDeviceId) return;
      const meta = deviceMetas[targetDeviceId];
      const targetW = meta?.physicalWidth || meta?.width;
      const targetH = meta?.physicalHeight || meta?.height;
      const normX = typeof relX === 'number' ? relX : (targetW ? x / targetW : undefined);
      const normY = typeof relY === 'number' ? relY : (targetH ? y / targetH : undefined);
      wsRef.current.send(
        JSON.stringify({
          type: 'tap',
          deviceId: targetDeviceId,
          x,
          y,
          normX,
          normY,
          syncAll,
        })
      );
    },
    [deviceMetas, syncAll]
  );

  const rawSwipe = useCallback(
    (
      targetDeviceId: string,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      duration: number = 150,
      normX1?: number,
      normY1?: number,
      normX2?: number,
      normY2?: number
    ) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !targetDeviceId) return;
      const meta = deviceMetas[targetDeviceId];
      const targetW = meta?.physicalWidth || meta?.width;
      const targetH = meta?.physicalHeight || meta?.height;
      const nX1 = typeof normX1 === 'number' ? normX1 : (targetW ? x1 / targetW : undefined);
      const nY1 = typeof normY1 === 'number' ? normY1 : (targetH ? y1 / targetH : undefined);
      const nX2 = typeof normX2 === 'number' ? normX2 : (targetW ? x2 / targetW : undefined);
      const nY2 = typeof normY2 === 'number' ? normY2 : (targetH ? y2 / targetH : undefined);

      wsRef.current.send(
        JSON.stringify({
          type: 'swipe',
          deviceId: targetDeviceId,
          x1,
          y1,
          x2,
          y2,
          normX1: nX1,
          normY1: nY1,
          normX2: nX2,
          normY2: nY2,
          duration,
          syncAll,
        })
      );
    },
    [deviceMetas, syncAll]
  );

  // Feature: Canvas OCR & Vision Triggers
  const ocr = useCanvasOcr({
    canvasRef: selectedCanvasRef as React.RefObject<HTMLCanvasElement>,
    onLog: addLog,
  });

  // Feature #8: Macro Recorder Hook with Self-Healing Vision Guard
  const macroRecorder = useMacroRecorder({
    deviceId: selectedDeviceId,
    onDispatchTap: (x, y) => rawTap(selectedDeviceId, x, y),
    onDispatchSwipe: (x1, y1, x2, y2, d) => rawSwipe(selectedDeviceId, x1, y1, x2, y2, d),
    onDispatchKey: (code) => rawSendKey(selectedDeviceId, code),
    onDispatchText: (text) => rawSendText(selectedDeviceId, text),
    onVerifyText: ocr.waitForTextOnCanvas,
    onLog: addLog,
  });

  // Feature: Document Picture-in-Picture Pop-out Mode
  const pip = usePictureInPicture({
    deviceId: selectedDeviceId,
    meta: activeMeta,
    canvasRef: selectedCanvasRef as React.RefObject<HTMLCanvasElement>,
    onTap: (targetId, x, y) => rawTap(targetId, x, y),
    onSwipe: (targetId, x1, y1, x2, y2, d) => rawSwipe(targetId, x1, y1, x2, y2, d),
    onSendKey: (code) => rawSendKey(selectedDeviceId, code),
  });

  // Feature: Web Audio API Streamer & Speaker Destination Toggle
  const audio = useDeviceAudio({
    deviceId: selectedDeviceId,
    wsRef,
    onLog: addLog,
  });

  // Feature: Dynamic Adaptive Bitrate & Resolution (ABR) Monitor
  const abr = useAdaptiveBitrate({
    deviceId: selectedDeviceId,
    wsRef,
    onLog: addLog,
  });

  const handlePongRef = useRef(abr.handlePong);
  useEffect(() => {
    handlePongRef.current = abr.handlePong;
  }, [abr.handlePong]);

  // Action dispatches for current active device
  const sendKey = useCallback(
    (code: number) => {
      macroRecorder.recordAction({ type: 'key', keyCode: code });
      rawSendKey(selectedDeviceId, code);
    },
    [macroRecorder, rawSendKey, selectedDeviceId]
  );

  const sendText = useCallback(
    (text: string) => {
      macroRecorder.recordAction({ type: 'text', text });
      rawSendText(selectedDeviceId, text);
    },
    [macroRecorder, rawSendText, selectedDeviceId]
  );

  const handleTapForDevice = useCallback(
    (deviceId: string, x: number, y: number, relX?: number, relY?: number) => {
      if (deviceId === selectedDeviceId) {
        macroRecorder.recordAction({ type: 'tap', x, y });
      }
      rawTap(deviceId, x, y, relX, relY);
    },
    [macroRecorder, rawTap, selectedDeviceId]
  );

  const handleSwipeForDevice = useCallback(
    (
      deviceId: string,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      duration: number,
      normX1?: number,
      normY1?: number,
      normX2?: number,
      normY2?: number
    ) => {
      if (deviceId === selectedDeviceId) {
        macroRecorder.recordAction({ type: 'swipe', x1, y1, x2, y2, duration });
      }
      rawSwipe(deviceId, x1, y1, x2, y2, duration, normX1, normY1, normX2, normY2);
    },
    [macroRecorder, rawSwipe, selectedDeviceId]
  );

  // Connect to WebSocket Server
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    addLog(`Connecting to backend server at ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      addLog('WebSocket connection established. Scanning for devices...');
      ws.send(JSON.stringify({ type: 'get-devices' }));
    };

    ws.onmessage = (event) => {
      // Parallel Binary Video Packet from Server
      if (event.data instanceof ArrayBuffer) {
        const view = new Uint8Array(event.data);
        if (view[0] === 0x01) {
          const idLen = view[1];
          let targetDevId = selectedDeviceIdRef.current;
          let flags = 0;
          let pts = 0;
          let naluPayload: Uint8Array;

          if (idLen > 3 && view.length > 11 + idLen) {
            // Multi-device frame tagged with exact target deviceId
            targetDevId = new TextDecoder().decode(view.subarray(2, 2 + idLen));
            flags = view[2 + idLen];
            const dataView = new DataView(event.data);
            pts = Number(dataView.getBigUint64(3 + idLen, false));
            naluPayload = view.subarray(11 + idLen);
          } else {
            // Legacy untagged frame fallback
            flags = view[1];
            const dataView = new DataView(event.data);
            pts = Number(dataView.getBigUint64(2, false));
            naluPayload = view.subarray(10);
          }

          const isKeyFrame = (flags & 0x01) !== 0;
          const isConfig = (flags & 0x02) !== 0;

          // Decodes directly to the corresponding device's independent decoder & canvas in parallel
          decodeChunk(targetDevId, naluPayload, isKeyFrame, isConfig, pts);
        } else if (view[0] === 0x02) {
          // Parallel Binary Audio Packet from Server (Web Audio API Stream)
          const idLen = view[1];
          let targetDevId = selectedDeviceIdRef.current;
          let pcmPayload: Uint8Array;
          if (idLen > 0 && view.length > 10 + idLen) {
            targetDevId = new TextDecoder().decode(view.subarray(2, 2 + idLen));
            pcmPayload = view.subarray(10 + idLen);
          } else {
            pcmPayload = view.subarray(2);
          }
          audio.feedAudioChunk(targetDevId, pcmPayload);
        }
        return;
      }

      // JSON Control/Log messages
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'devices': {
            setIsScanning(false);
            const incomingDevices: DeviceInfo[] = msg.devices || [];
            const incomingIds = new Set(incomingDevices.map((d) => d.id));

            // On initial boot, link all currently detected devices directly
            if (isInitialBootRef.current) {
              isInitialBootRef.current = false;
              incomingDevices.forEach((d) => knownDeviceIdsRef.current.add(d.id));
              setDevices(incomingDevices);

              if (incomingDevices.length > 0 && !selectedDeviceIdRef.current) {
                const readyDev = incomingDevices.find((d: DeviceInfo) => d.status === 'device');
                setSelectedDeviceId(readyDev ? readyDev.id : incomingDevices[0].id);
                addLog(`✔ Initialized tool with ${incomingDevices.length} USB device(s).`);
              }
              isManualRefreshRef.current = false;
              break;
            }

            // 1. Clean up disconnected devices from known set
            for (const id of Array.from(knownDeviceIdsRef.current)) {
              if (!incomingIds.has(id)) {
                knownDeviceIdsRef.current.delete(id);
              }
            }

            // Update existing connected devices (handles unplugging & status changes like unauthorized -> device)
            setDevices((prevConnected) => {
              const updated = prevConnected
                .filter((d) => incomingIds.has(d.id))
                .map((d) => {
                  const latest = incomingDevices.find((inc) => inc.id === d.id);
                  if (latest) {
                    if (d.status === 'unauthorized' && latest.status === 'device') {
                      addLog(`✔ Device ${latest.model || latest.id} authorized on phone! Ready to mirror.`);
                    }
                    return latest;
                  }
                  return d;
                });

              // If currently selected device was disconnected, switch to first remaining
              if (selectedDeviceIdRef.current && !incomingIds.has(selectedDeviceIdRef.current)) {
                const fallback = updated[0];
                setSelectedDeviceId(fallback ? fallback.id : '');
                addLog(`Device ${selectedDeviceIdRef.current} disconnected.`);
              }

              return updated;
            });

            // 2. Check for New Devices (Authorized OR Unauthorized)
            if (isManualRefreshRef.current) {
              isManualRefreshRef.current = false;
              // User clicked refresh: find any physical USB device not yet connected to the tool
              const currentConnectedIds = new Set(devicesRef.current.map((d) => d.id));
              const unlinkedCandidate = incomingDevices.find((d) => !currentConnectedIds.has(d.id));

              if (unlinkedCandidate) {
                setDetectedUsbDevice(unlinkedCandidate);
                setNewUsbModalOpen(true);
                addLog(
                  `Detected new USB device: ${unlinkedCandidate.model || unlinkedCandidate.id} (${unlinkedCandidate.status}). Prompting to connect to tool...`
                );
              } else if (incomingDevices.length > 0) {
                addLog(`✔ Device list refreshed: ${incomingDevices.length} device(s) active and ready.`);
              } else {
                addLog('No USB devices detected. Connect a phone via USB with USB debugging enabled.');
              }
            } else {
              // Automatic 4s background scan:
              // Prompt for any new device that hasn't been acknowledged (not in knownDeviceIdsRef)
              if (!newUsbModalOpenRef.current) {
                const brandNewCandidate = incomingDevices.find(
                  (d) => !knownDeviceIdsRef.current.has(d.id)
                );

                if (brandNewCandidate) {
                  setDetectedUsbDevice(brandNewCandidate);
                  setNewUsbModalOpen(true);
                  addLog(
                    `Detected new USB device: ${brandNewCandidate.model || brandNewCandidate.id} (${brandNewCandidate.status}). Prompting to connect to tool...`
                  );
                }
              }
            }
            break;
          }

          case 'meta': {
            const devId = msg.deviceId || selectedDeviceIdRef.current;
            if (devId) {
              setDeviceMetas((prev) => ({
                ...prev,
                [devId]: {
                  codec: msg.codec,
                  width: msg.width,
                  height: msg.height,
                  physicalWidth: msg.physicalWidth,
                  physicalHeight: msg.physicalHeight,
                  deviceId: devId,
                },
              }));
              setStreamingDeviceIds((prev) => new Set(prev).add(devId));
            }
            break;
          }

          case 'stream-stopped': {
            const stoppedDevId = msg.deviceId || selectedDeviceIdRef.current;
            if (stoppedDevId) {
              setStreamingDeviceIds((prev) => {
                const next = new Set(prev);
                next.delete(stoppedDevId);
                return next;
              });
              resetDecoder(stoppedDevId);
            }
            break;
          }

          case 'privacy-mode-status': {
            if (msg.deviceId === selectedDeviceIdRef.current) {
              setPrivacyMode(msg.enabled);
            }
            break;
          }

          case 'game-mode-status': {
            if (msg.deviceId === selectedDeviceIdRef.current) {
              setActivePackage(msg.package);
              if (msg.isGame) {
                setIsGameActive(true);
              } else if (!manualGamepadRef.current) {
                setIsGameActive(false);
              }
            }
            break;
          }

          case 'pong': {
            if (typeof msg.timestamp === 'number') {
              handlePongRef.current(msg.timestamp);
            }
            break;
          }

          case 'clipboard-update': {
            if (msg.text && typeof msg.text === 'string' && msg.text.trim()) {
              if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(msg.text).catch(() => {});
              }
              addLog(`[Clipboard Sync]: Device clipboard synced ("${msg.text.length > 25 ? msg.text.substring(0, 25) + '...' : msg.text}")`);
            }
            break;
          }

          case 'log': {
            addLog(msg.message);
            break;
          }
        }
      } catch (e) {
        console.warn('Non-JSON message received:', event.data);
      }
    };

    ws.onerror = () => {
      addLog('[Error] WebSocket error encountered.');
    };

    ws.onclose = () => {
      addLog('[System] Connection to server lost. Reconnecting in 3s...');
      setStreamingDeviceIds(new Set());
    };

    return () => {
      ws.close();
    };
  }, [addLog, decodeChunk, resetDecoder]);

  // Periodic device scanning when not all devices streaming
  useEffect(() => {
    const timer = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'get-devices' }));
      }
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  // Periodic foreground game detection for active device
  useEffect(() => {
    if (!isStreaming || !selectedDeviceId) return;

    const gameCheckTimer = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'check-game-mode',
            deviceId: selectedDeviceId,
          })
        );
      }
    }, 3500);

    return () => clearInterval(gameCheckTimer);
  }, [isStreaming, selectedDeviceId]);

  // Manual Refresh Button Action -> Scans USB and triggers prompt
  const handleManualRefresh = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsScanning(true);
      isManualRefreshRef.current = true;
      addLog('Scanning for connected USB devices...');
      wsRef.current.send(JSON.stringify({ type: 'get-devices' }));
    }
  }, [addLog]);

  // Start stream explicitly (does NOT auto-run on tab switch)
  const startStream = useCallback(
    (targetId?: string) => {
      const devId = targetId || selectedDeviceId;
      if (!devId || !wsRef.current) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'start-stream',
          deviceId: devId,
        })
      );
    },
    [selectedDeviceId]
  );

  // Stop stream explicitly for current device
  const stopStream = useCallback(
    (targetId?: string) => {
      const devId = targetId || selectedDeviceId;
      if (!wsRef.current || !devId) return;
      manualGamepadRef.current = false;
      setIsGameActive(false);
      wsRef.current.send(
        JSON.stringify({
          type: 'stop-stream',
          deviceId: devId,
        })
      );
    },
    [selectedDeviceId]
  );

  // Dropdown Selection: Switches active tab WITHOUT auto-starting mirroring
  const handleSelectDeviceFromDropdown = useCallback((deviceId: string) => {
    if (!deviceId) return;
    manualGamepadRef.current = false;
    setIsGameActive(false);
    setSelectedDeviceId(deviceId);
  }, []);

  // Tab Selection: Switches active tab WITHOUT auto-starting mirroring
  const handleSelectTab = useCallback(
    (newDeviceId: string) => {
      if (newDeviceId === selectedDeviceId) return;
      manualGamepadRef.current = false;
      setIsGameActive(false);
      setSelectedDeviceId(newDeviceId);
    },
    [selectedDeviceId]
  );

  // Manual Gamepad Toggle & Close Handlers
  const handleToggleGamepad = useCallback(() => {
    const nextState = !isGameActive;
    manualGamepadRef.current = nextState;
    setIsGameActive(nextState);
    addLog(nextState ? '🎮 Gamepad Overlay manually ENABLED.' : '🎮 Gamepad Overlay manually DISABLED.');
  }, [isGameActive, addLog]);

  const handleCloseGamepad = useCallback(() => {
    manualGamepadRef.current = false;
    setIsGameActive(false);
    addLog('🎮 Gamepad Overlay closed.');
  }, [addLog]);

  // Synchronized Multi-Boxing Toggle (Replicates touch/key inputs across all devices)
  const handleToggleSync = useCallback(() => {
    const nextState = !syncAll;
    setSyncAll(nextState);
    if (nextState) {
      devices.forEach((d) => {
        if (d.status === 'device' && !streamingDeviceIds.has(d.id)) {
          startStream(d.id);
        }
      });
      addLog('⚡ Synchronized Multi-Boxing ENABLED: Inputs replicated across all devices.');
    } else {
      addLog('Synchronized Multi-Boxing DISABLED.');
    }
  }, [syncAll, devices, streamingDeviceIds, startStream, addLog]);

  // Confirm Pop-up: Connect New USB Device as Tab & Start Mirroring
  const handleConfirmNewUsbLink = useCallback(() => {
    if (!detectedUsbDevice) return;
    const targetId = detectedUsbDevice.id;
    const brand = detectedUsbDevice.model || detectedUsbDevice.product || targetId;
    knownDeviceIdsRef.current.add(targetId);
    setNewUsbModalOpen(false);

    // Add to connected devices list so it appears in the top tab bar and dropdown
    setDevices((prev) => {
      if (prev.some((d) => d.id === targetId)) {
        return prev.map((d) => (d.id === targetId ? detectedUsbDevice : d));
      }
      return [...prev, detectedUsbDevice];
    });

    setSelectedDeviceId(targetId);

    if (detectedUsbDevice.status === 'device') {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'start-stream',
            deviceId: targetId,
          })
        );
      }
      addLog(`✔ Created new USB link tab for ${brand} and started mirroring!`);
    } else {
      addLog(
        `✔ Added ${brand} as a tab in the tool. Please tap "Allow USB debugging" on the phone screen to enable mirroring.`
      );
    }

    setDetectedUsbDevice(null);
  }, [detectedUsbDevice, addLog]);

  // Cancel Pop-up: Dismiss modal and keep existing tabs untouched
  const handleCancelNewUsbLink = useCallback(() => {
    if (detectedUsbDevice) {
      knownDeviceIdsRef.current.add(detectedUsbDevice.id);
      addLog(
        `Ignored USB device: ${detectedUsbDevice.model || detectedUsbDevice.id}. Click the refresh icon near the dropdown to connect it at any time.`
      );
    }
    setNewUsbModalOpen(false);
    setDetectedUsbDevice(null);
  }, [detectedUsbDevice, addLog]);

  // Toggle Quick-Draw Privacy Mode
  const togglePrivacyMode = useCallback(() => {
    if (!wsRef.current || !selectedDeviceId) return;
    const nextState = !privacyMode;
    setPrivacyMode(nextState);
    wsRef.current.send(
      JSON.stringify({
        type: 'set-privacy-mode',
        deviceId: selectedDeviceId,
        enabled: nextState,
      })
    );
  }, [privacyMode, selectedDeviceId]);

  // Clipboard paste handler
  const handleClipboardPaste = useCallback(
    (text: string) => {
      if (!wsRef.current || !selectedDeviceId) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'clipboard-paste',
          deviceId: selectedDeviceId,
          text,
        })
      );
    },
    [selectedDeviceId]
  );

  // Bidirectional Clipboard Sync: PC copy automatically injects to Android
  useEffect(() => {
    const handleCopy = async () => {
      if (!selectedDeviceId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          wsRef.current.send(
            JSON.stringify({
              type: 'clipboard-paste',
              deviceId: selectedDeviceId,
              text,
            })
          );
          addLog(`[Clipboard Sync]: PC clipboard synced to device (${text.length > 25 ? text.substring(0, 25) + '...' : text})`);
        }
      } catch (e) {}
    };

    window.addEventListener('copy', handleCopy);
    return () => window.removeEventListener('copy', handleCopy);
  }, [selectedDeviceId, addLog]);

  // Periodic device clipboard fetch on window focus
  useEffect(() => {
    const syncDeviceClipboard = () => {
      if (selectedDeviceId && isStreaming && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'clipboard-fetch',
            deviceId: selectedDeviceId,
          })
        );
      }
    };

    window.addEventListener('focus', syncDeviceClipboard);
    const interval = setInterval(syncDeviceClipboard, 8000);
    return () => {
      window.removeEventListener('focus', syncDeviceClipboard);
      clearInterval(interval);
    };
  }, [selectedDeviceId, isStreaming]);

  // Tab number calculation for modal
  const targetTabNumber = detectedUsbDevice
    ? devices.findIndex((d) => d.id === detectedUsbDevice.id) !== -1
      ? devices.findIndex((d) => d.id === detectedUsbDevice.id) + 1
      : devices.length + 1
    : devices.length + 1;

  return (
    <main className="relative flex h-screen w-screen bg-[#04060c] overflow-hidden text-slate-100 font-sans select-none">
      {/* Lightweight, GPU-friendly Cursor Trail */}
      <CursorTrail />

      {/* Pop-up: Connect New USB Device Modal */}
      <NewUsbDeviceModal
        isOpen={newUsbModalOpen}
        device={detectedUsbDevice}
        targetTabNumber={targetTabNumber}
        onConfirm={handleConfirmNewUsbLink}
        onCancel={handleCancelNewUsbLink}
      />

      {/* Static 3D Ambient Mesh Glow (Zero CPU/Compositor Load) */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(circle 800px at 25% 15%, rgba(99, 102, 241, 0.12) 0%, transparent 70%), radial-gradient(circle 700px at 80% 85%, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* Left Frosted Glass Sidebar */}
      <aside className="w-[360px] flex-shrink-0 ultra-glass p-5 flex flex-col gap-4 overflow-y-auto z-10 border-r border-white/10">
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 pb-3 border-b border-white/10">
          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.35)]">
            <Cast className="w-5 h-5 text-white drop-shadow-md" />
            <div className="absolute inset-0 rounded-2xl bg-white/20 blur-[2px] pointer-events-none" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
                Aether Mirror
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                PRO 60 FPS
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Ultra Glass • Parallel WebCodecs
            </p>
          </div>
        </div>

        {/* Device Manager Glass Card with Dropdown and Refresh */}
        <DeviceManager
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          streamingDeviceIds={streamingDeviceIds}
          onSelectDevice={handleSelectDeviceFromDropdown}
          onRefresh={handleManualRefresh}
          isScanning={isScanning}
          isStreaming={isStreaming}
          onStartStream={() => startStream()}
          onStopStream={() => stopStream()}
        />

        {/* Live Diagnostics Glass Card */}
        <DiagnosticsPanel fps={currentFps} meta={activeMeta} isStreaming={isStreaming} />

        {/* Feature #8: Macro Timeline Automator */}
        <MacroEditor
          targetDeviceName={activeDevice ? `${activeDevice.model || activeDevice.product || activeDevice.id}` : undefined}
          isRecording={macroRecorder.isRecording}
          isPlaying={macroRecorder.isPlaying}
          steps={macroRecorder.steps}
          currentStepIndex={macroRecorder.currentStepIndex}
          speedMultiplier={macroRecorder.speedMultiplier}
          loopCount={macroRecorder.loopCount}
          errorPolicy={macroRecorder.errorPolicy}
          failedStepId={macroRecorder.failedStepId}
          lastErrorMessage={macroRecorder.lastErrorMessage}
          onStartRecording={macroRecorder.startRecording}
          onStopRecording={macroRecorder.stopRecording}
          onPlay={() => macroRecorder.playWorkflow()}
          onStopPlayback={macroRecorder.stopPlayback}
          onSetSpeed={macroRecorder.setSpeedMultiplier}
          onSetLoop={macroRecorder.setLoopCount}
          onSetErrorPolicy={macroRecorder.setErrorPolicy}
          onAddVisionTrigger={macroRecorder.addVisionTriggerStep}
          onDeleteStep={macroRecorder.deleteStep}
          onClearSteps={macroRecorder.clearSteps}
          onImportSteps={macroRecorder.importSteps}
        />
      </aside>

      {/* Main Viewport: Multi-Device Numbered Tabs & Parallel Stages */}
      <section className="flex-1 flex flex-col items-center justify-between p-4 relative overflow-hidden z-10">
        {/* Feature #4: Multi-Device Numbered Tabs with Side-by-Side Split View toggle */}
        <DeviceTabBar
          devices={devices}
          activeDeviceId={selectedDeviceId}
          streamingDeviceIds={streamingDeviceIds}
          syncAll={syncAll}
          privacyMode={privacyMode}
          viewMode={viewMode}
          isAudioToPc={audio.isAudioToPc}
          audioLevel={audio.audioLevel}
          isPipActive={pip.isPipActive}
          isPipSupported={pip.isPipSupported}
          latencyMs={abr.latencyMs}
          qualityTier={abr.currentTier}
          onSelectTab={handleSelectTab}
          onToggleSync={handleToggleSync}
          onTogglePrivacy={togglePrivacyMode}
          onToggleViewMode={() => setViewMode((prev) => (prev === 'tabs' ? 'split' : 'tabs'))}
          onToggleAudio={audio.toggleAudioDestination}
          onOpenPip={pip.openPip}
        />

        {/* Parallel Device Display Stages */}
        <div className="flex-1 flex items-center justify-center w-full overflow-y-auto no-scrollbar">
          {devices.length === 0 ? (
            <div className="text-center text-slate-500 text-xs">
              Connect a device via USB to start mirroring.
            </div>
          ) : viewMode === 'split' ? (
            // Side-by-Side (2 Active at a time in parallel)
            <div className="flex items-center justify-center gap-6 flex-wrap w-full animate-in fade-in duration-200">
              {devices.map((device, idx) => {
                const isSelected = device.id === selectedDeviceId;
                return (
                  <div
                    key={device.id}
                    onClick={() => setSelectedDeviceId(device.id)}
                    className={`transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-indigo-500/60 rounded-[3.8rem] shadow-[0_0_40px_rgba(99,102,241,0.3)]'
                        : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    <ScreenViewer
                      onRegisterCanvas={handleRegisterCanvas}
                      activeDeviceId={device.id}
                      deviceName={`Tab #${idx + 1}: ${device.model || device.product || device.id}`}
                      isCompact={true}
                      isStreaming={streamingDeviceIds.has(device.id)}
                      meta={deviceMetas[device.id] || null}
                      isGameActive={isSelected && isGameActive}
                      activePackage={activePackage}
                      onTap={(x, y, rx, ry) => handleTapForDevice(device.id, x, y, rx, ry)}
                      onSwipe={(x1, y1, x2, y2, d, nx1, ny1, nx2, ny2) =>
                        handleSwipeForDevice(device.id, x1, y1, x2, y2, d, nx1, ny1, nx2, ny2)
                      }
                      onSendKey={(code) => rawSendKey(device.id, code)}
                      onSendText={(text) => rawSendText(device.id, text)}
                      onCloseGamepad={handleCloseGamepad}
                      onNotifyLog={addLog}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            // Single Tab View (Maintains all canvases mounted in parallel, instant 0ms tab switching)
            <div className="relative w-full flex items-center justify-center">
              {devices.map((device, idx) => {
                const isSelected = device.id === selectedDeviceId;
                return (
                  <div
                    key={device.id}
                    className={`w-full flex items-center justify-center transition-opacity duration-150 ${
                      isSelected ? 'block opacity-100' : 'hidden opacity-0 absolute pointer-events-none'
                    }`}
                  >
                    <ScreenViewer
                      onRegisterCanvas={handleRegisterCanvas}
                      activeDeviceId={device.id}
                      deviceName={`Tab #${idx + 1}: ${device.model || device.product || device.id}`}
                      isCompact={false}
                      isStreaming={streamingDeviceIds.has(device.id)}
                      meta={deviceMetas[device.id] || null}
                      isGameActive={isSelected && isGameActive}
                      activePackage={activePackage}
                      onTap={(x, y, rx, ry) => handleTapForDevice(device.id, x, y, rx, ry)}
                      onSwipe={(x1, y1, x2, y2, d, nx1, ny1, nx2, ny2) =>
                        handleSwipeForDevice(device.id, x1, y1, x2, y2, d, nx1, ny1, nx2, ny2)
                      }
                      onSendKey={sendKey}
                      onSendText={sendText}
                      onCloseGamepad={handleCloseGamepad}
                      onNotifyLog={addLog}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Status Pill & Engineering Watermark */}
        <div className="mt-2 flex flex-col items-center gap-1.5 z-10 select-none">
          <div className="flex items-center gap-3 text-[11px] text-slate-400 ultra-glass px-4 py-1.5 rounded-full border border-white/5 shadow-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span>Parallel Hardware Decoders Active</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Instantaneous 0ms Tab Switching</span>
            </span>
            {devices.length > 1 && (
              <>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Side-by-Side Dual Mirror Available</span>
                </span>
              </>
            )}
          </div>

          {/* Proprietary Engineering Watermark */}
          <div className="text-[10px] tracking-wider uppercase font-mono text-slate-400/80 flex items-center gap-1.5">
            <span>This tool is engineered by</span>
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-cyan-300 to-purple-300 tracking-normal px-1.5 py-0.5 rounded bg-white/5 border border-white/10 shadow-sm">
              Prajith-Jayachandran
            </span>
          </div>
        </div>
      </section>

      {/* Right Frosted Glass Sidebar */}
      <aside className="w-[360px] flex-shrink-0 ultra-glass p-5 flex flex-col gap-4 overflow-y-auto z-10 border-l border-white/10">
        {/* Hardware & Navigation Controls with Clipboard & Gamepad toggles */}
        <ControlsSidebar
          isStreaming={isStreaming}
          isGameActive={isGameActive}
          privacyMode={privacyMode}
          onSendKey={sendKey}
          onSendText={sendText}
          onClipboardPaste={handleClipboardPaste}
          onToggleGamepad={handleToggleGamepad}
          onTogglePrivacy={togglePrivacyMode}
        />

        {/* Cyberpunk Glass Console */}
        <LogsConsole logs={logs} onClearLogs={() => setLogs([])} />
      </aside>
    </main>
  );
}

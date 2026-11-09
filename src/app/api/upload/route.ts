import { NextRequest, NextResponse } from 'next/server';
import { AdbManager } from '../../../../server/adb';
import fs from 'fs';
import path from 'path';
import os from 'os';

const adb = new AdbManager();

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const deviceId = formData.get('deviceId') as string | null;

    if (!file || !deviceId) {
      return NextResponse.json(
        { success: false, message: 'Missing file or deviceId parameter' },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const isApk = fileName.toLowerCase().endsWith('.apk');
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save temporary file in /tmp
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `aether_${Date.now()}_${fileName}`);
    fs.writeFileSync(tempFilePath, buffer);

    // Handle multi-device broadcast installation or push (Feature #5)
    let targetDeviceIds: string[] = [];
    if (deviceId === 'all') {
      const devices = await adb.getDevices();
      targetDeviceIds = devices.filter((d) => d.status === 'device').map((d) => d.id);
      if (targetDeviceIds.length === 0) {
        return NextResponse.json(
          { success: false, message: 'No authorized Android devices online for broadcast' },
          { status: 400 }
        );
      }
    } else {
      targetDeviceIds = [deviceId];
    }

    try {
      if (isApk) {
        // Feature #2 & #5: Sideload APK and auto-launch (supports single or all devices)
        const results = await Promise.all(
          targetDeviceIds.map(async (devId) => {
            const res = await adb.installApk(devId, tempFilePath);
            return { deviceId: devId, ...res };
          })
        );
        const allSuccess = results.every((r) => r.success);
        return NextResponse.json({
          success: allSuccess,
          message: allSuccess
            ? `Successfully installed on ${targetDeviceIds.length} device(s)!`
            : `Installed with partial warnings: ${results.map((r) => `${r.deviceId}: ${r.message}`).join(', ')}`,
          results,
          type: 'apk',
        });
      } else {
        // Feature #2 & #5: Push photos / videos / music / documents and scan into Android Gallery
        const results = await Promise.all(
          targetDeviceIds.map(async (devId) => {
            const res = await adb.pushMedia(devId, tempFilePath, fileName);
            return { deviceId: devId, ...res };
          })
        );
        const allSuccess = results.every((r) => r.success);
        return NextResponse.json({
          success: allSuccess,
          message: allSuccess
            ? `Pushed to ${targetDeviceIds.length} device(s) and scanned into Gallery!`
            : `Pushed with partial warnings: ${results.map((r) => `${r.deviceId}: ${r.message}`).join(', ')}`,
          fileName,
          results,
          type: 'media',
        });
      }
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {}
      }
    }
  } catch (err: any) {
    console.error('[Upload API Error]', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Internal upload error' },
      { status: 500 }
    );
  }
}

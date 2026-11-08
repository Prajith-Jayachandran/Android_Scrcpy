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

    try {
      if (isApk) {
        // Feature #2: Sideload APK and auto-launch
        const installResult = await adb.installApk(deviceId, tempFilePath);
        return NextResponse.json({
          success: installResult.success,
          message: installResult.message,
          packageName: installResult.packageName,
          type: 'apk'
        });
      } else {
        // Feature #2: Push photos / videos / music / documents and scan into Android Gallery
        const pushResult = await adb.pushMedia(deviceId, tempFilePath, fileName);
        return NextResponse.json({
          success: pushResult.success,
          message: pushResult.message,
          fileName,
          type: 'media'
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

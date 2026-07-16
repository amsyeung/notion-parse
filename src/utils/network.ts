import * as fs from 'fs';
import * as https from 'https';
import Jimp from 'jimp';
import { ImageResult } from '../types.js';

/**
 * Ensures a directory exists on the local filesystem.
 */
export function checkFolder(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Downloads a file from a URL to a local destination, resolving redirects.
 */
export function wget(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (response) => {
      const statusCode = response.statusCode;
      const location = response.headers.location;

      if (statusCode === 302 && location) {
        console.log('Redirecting to:', location);
        wget(location, dest).then(resolve).catch(reject);
      } else {
        console.log('Downloading:', url, 'to:', dest);
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error(`Download timeout: ${url}`));
    });
    req.on('error', reject);
  });
}

/**
 * Downloads an image and computes its layout dimensions.
 */
export async function downloadImage(fileUrl: string, destination: string): Promise<ImageResult> {
  const file = './public' + destination;
  if (!fs.existsSync(file)) {
    await wget(fileUrl, file);
  }
  const img = await Jimp.read(file);
  return {
    src: destination,
    width: img.getWidth(),
    height: img.getHeight(),
  };
}

import { Platform } from 'react-native';

/**
 * Cloudinary image uploads (Phase 5).
 *
 * The app uploads straight to Cloudinary with an *unsigned* upload preset,
 * then stores the returned URL (profile avatar → PATCH /api/me; listing
 * photos → POST /api/listings). No backend round-trip needed.
 *
 * Configure in apps/mobile/.env:
 *   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=…
 *   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=…   (Unsigned, folders allowed)
 */
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const isCloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

/** True when the URI is already hosted (https) — nothing to upload. */
export function isHostedUri(uri: string): boolean {
  return /^https?:\/\//.test(uri);
}

function fileNameFromUri(uri: string): string {
  const base = (uri.split('/').pop() ?? '').split('?')[0];
  if (base.includes('.')) return base;
  return `photo-${Date.now()}.jpg`;
}

function mimeFromUri(uri: string): string {
  const dataMatch = uri.match(/^data:([^;,]+)/);
  if (dataMatch) return dataMatch[1];
  switch ((uri.split('.').pop() ?? '').toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
}

async function blobFromUri(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error('Could not read the photo from this device.');
  return res.blob();
}

/**
 * Uploads one local image to Cloudinary and returns its secure URL.
 * `folder` keeps uploads tidy (e.g. 'nairobi-rentals/avatars').
 */
export async function uploadImage(uri: string, folder: string): Promise<string> {
  if (!isCloudinaryConfigured) {
    throw new Error(
      'Image upload isn’t configured yet — add Cloudinary keys to apps/mobile/.env.',
    );
  }

  const form = new FormData();
  if (Platform.OS === 'web') {
    // Web pickers return data:/blob: URIs — send the bytes as a Blob.
    form.append('file', await blobFromUri(uri), fileNameFromUri(uri));
  } else {
    // React Native's FormData file-object shape.
    form.append(
      'file',
      { uri, name: fileNameFromUri(uri), type: mimeFromUri(uri) } as unknown as Blob,
    );
  }
  form.append('upload_preset', UPLOAD_PRESET as string);
  form.append('folder', folder);

  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: form,
    });
  } catch {
    throw new Error('Can’t reach the image uploader — check your connection and try again.');
  }
  if (!res.ok) {
    throw new Error('Couldn’t upload the photo — try a smaller image or try again.');
  }
  const data = (await res.json()) as { secure_url?: string };
  if (!data.secure_url) throw new Error('The uploader didn’t return an image URL.');
  return data.secure_url;
}

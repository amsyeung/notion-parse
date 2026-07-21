import { slugify } from "transliteration";

const IMAGE_EXT_REG = /\.(jpg|jpeg|png|gif|webp|avif|tiff|bmp|svg)$/i;

/**
 * Escapes special characters inside a string to make it safe for RegExp construction.
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts an image filename into a valid JavaScript camelCase variable name.
 */
export function filenameToJsVar(filename: string): string {
  const nameWithoutExt = filename.replace(/\.\w+$/, '');
  const clean = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
  const parts = clean.split('-').filter(Boolean);
  return parts
    .map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('');
}

/**
 * Extracts a filename complete with its file extension from a URL.
 * Handles query parameters and provides defaults if extensions are missing.
 */
export function getImageFilenameFromUrl(url: string): string {
  const pathOnly = url.split('?')[0];
  const basename = pathOnly.split('/').pop() ?? '';

  if (IMAGE_EXT_REG.test(basename)) {
    return basename;
  }

  // Fallback default for Unsplash CDN
  if (url.includes('images.unsplash.com')) {
    return `${basename}.jpg`;
  }

  // Generic fallback for nameless CDN files
  return `${basename}.jpg`;
}

/**
 * Sanitizes image filenames, removing unsafe characters, parentheses, and spaces.
 */
export function sanitizeImageFilename(rawName: string): string {
  const extMatch = rawName.match(/(\.\w+)$/);
  const ext = extMatch ? extMatch[1] : '.jpg';
  const base = rawName
    .replace(/\.\w+$/, '')
    .replace(/[()\[\]{}#&%?+* ]/g, '-') // Replace unsafe symbols with hyphens
    .replace(/-+/g, '-') // Merge consecutive hyphens
    .replace(/^-+|-+$/g, ''); // Trim hyphens from ends
  return `${base}${ext}`;
}

/**
 * Generate a clean, URL-safe slug from a string.
 */
export function generateSlug(text: string): string {
  return slugify(text, { lowercase: true });
}

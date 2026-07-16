// src/fileManagement.ts
import * as path from 'path';

// 預設的內容根目錄，會透過 setRootFolder 被動態修改
let rootFolder = './content';

/**
 * 設定全域的內容根目錄路徑
 */
export const setRootFolder = (pathStr: string): void => {
  rootFolder = pathStr;
};

/**
 * 取得特定內容類型（與語言）的資料夾路徑
 * 例如: "content/posts" 或 "content/posts/zh-tw"
 */
export const getFileFolder = (type: string, lang?: string): string => {
  const cleanType = type.toLowerCase();
  if (lang) {
    return path.join(rootFolder, cleanType, lang);
  }
  return path.join(rootFolder, cleanType);
};

/**
 * 取得 MD/MDX 檔案的完整實體寫入路徑
 * 例如: "content/posts/my-first-post.md"
 */
export const getFilePath = (slug: string, type: string, lang?: string): string => {
  const folder = getFileFolder(type, lang);
  return path.join(folder, `${slug}.md`);
};

/**
 * 取得特定內容類型的全域圖片存放目錄（相對於 public）
 * 例如: "/images/posts/"
 */
export const getImageFolder = (contentType: string): string => {
  return `/images/${contentType.toLowerCase()}/`;
};

/**
 * 取得特定文章專屬的圖片存放目錄（相對於 public，適用於舊版全域圖片模式）
 * 例如: "/images/posts/my-first-post/"
 */
export const getImageFolderPath = (slug: string, type: string): string => {
  return `/images/${type.toLowerCase()}/${slug}/`;
};

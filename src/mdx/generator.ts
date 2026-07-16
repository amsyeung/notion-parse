import * as fs from 'fs';
import { NotionProperties, DocumentType, ParsedPage, ImageMeta } from '../types.js';
import {
  escapeRegExp,
  getImageFilenameFromUrl,
  sanitizeImageFilename,
  generateSlug,
} from '../utils/regex.js';
import { checkFolder, wget, downloadImage } from '../utils/network.js';
import { getFieldInfo } from '../notion/properties.js';
import { n2m, setNotionSecret, getDatabase, fetchPageComments } from '../notion/client.js';
import {
  getFileFolder,
  getFilePath,
  getImageFolder,
  getImageFolderPath,
  setRootFolder,
} from '../fileManagement.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const documentTypes: DocumentType[] = [];

export const addDocumentTypes = (types: DocumentType[]): void => {
  documentTypes.push(...types);
};

/**
 * Legacy configuration helper to download assets and construct public folders.
 */
export async function manageImage(
  properties: NotionProperties,
  url: string,
  contentType: string,
  name?: string
) {
  const titleVal = await getFieldInfo(properties, 'title', contentType);
  const title = typeof titleVal === 'string' ? titleVal : '';

  const slugVal = await getFieldInfo(properties, 'slug', contentType);
  const slug = typeof slugVal === 'string' ? slugVal : generateSlug(title);

  if (!slug) throw new Error('No slug could be resolved for the image manager');

  const destFolder = './public' + getImageFolder(contentType);
  checkFolder(destFolder);

  const destination = getImageFolder(contentType) + (name ?? 'image.jpg');
  return await downloadImage(url, destination);
}

/**
 * Builds the MDX Header featuring dependency ES imports and layout wrappers.
 */
function buildMdxHeader(frontMatter: ParsedPage, imageImports: string[]): string {
  const layoutImport = `import { ArticleLayout } from '@/components/ArticleLayout'\n`;
  const allImports = [layoutImport, ...imageImports].join('');
  const articleExport = `export const article = ${JSON.stringify(frontMatter, null, 2).replace(/\\n/g, ' ')};\n\n`;
  const metadataExport = `export const metadata = {
  title: article.title,
  description: article.description
}\n\n`;
  const defaultExport = `export default (props) => <ArticleLayout article={article} {...props} />\n\n`;

  return allImports + articleExport + metadataExport + defaultExport;
}

function buildYamlHeader(frontMatter: ParsedPage): string {
  let yaml = '---\n';
  for (const [key, value] of Object.entries(frontMatter)) {
    if (key === 'comments') continue;
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      yaml += `${key}:\n`;
      for (const item of value) {
        yaml += `  - ${typeof item === 'object' ? JSON.stringify(item) : item}\n`;
      }
    } else if (typeof value === 'object') {
      yaml += `${key}: ${JSON.stringify(value)}\n`;
    } else {
      yaml += `${key}: ${JSON.stringify(value)}\n`;
    }
  }
  yaml += '---\n\n';
  return yaml;
}

/**
 * Compiles Notion Page data to markdown structure, managing localized storage schemes.
 */
async function saveFile(
  frontMatter: ParsedPage,
  type: string,
  lang?: string,
  useNextMdxFolderMode = false,
  contentRoot?: string
): Promise<void> {
  if (!n2m) throw new Error('Notion markdown parser is not initialized');

  const notionId = frontMatter.notionId;
  frontMatter.comments = await fetchPageComments(notionId);

  const rawTitle = frontMatter.title;
  if (!rawTitle && !frontMatter.slug) {
    throw new Error(`No title or slug in front matter for page ${notionId} of type ${type}`);
  }

  const customSlug = (frontMatter.slug || generateSlug(rawTitle as string)) as string;
  const titleSlug = generateSlug(rawTitle as string);
  frontMatter.slug = customSlug;

  const mdblocks = await n2m.pageToMarkdown(notionId);
  const imageBlocks = mdblocks
    .filter((block) => block.type === 'image')
    .map((block) => block.parent);

  const imageImports: string[] = [];
  const imageMap = new Map<string, ImageMeta>();

  if (useNextMdxFolderMode) {
    // ----------------------------------------------------
    // Nextjs .mdx format
    // ----------------------------------------------------
    const baseFolder = lang ? `${getFileFolder(type, lang)}` : `${contentRoot}/${titleSlug}/`;
    checkFolder(baseFolder);
    const pageMdxPath = `${baseFolder}page.mdx`;
    let imgIndex = 0;

    for (const block of imageBlocks) {
      const data = block.replace('![', '').replace(']', '').replace(')', '').split('(');
      if (data.length !== 2) continue;
      const altText = data[0];
      const url = data[1];

      const rawFilename = getImageFilenameFromUrl(url);
      const filename = sanitizeImageFilename(rawFilename);
      const localFile = `${baseFolder}${filename}`;

      if (!fs.existsSync(localFile)) {
        await wget(url, localFile);
      }

      const jsVar = `img${imgIndex}`;
      const importLine = `import ${jsVar} from './${filename}'\n`;
      imageImports.push(importLine);
      imageMap.set(url, { var: jsVar, alt: altText, importPath: `./${filename}` });
      imgIndex++;
    }

    const mdRawObj = n2m.toMarkdownString(mdblocks);
    let mdRaw = mdRawObj.parent ?? '';
    for (const [originUrl, meta] of imageMap) {
      const safeAlt = escapeRegExp(meta.alt);
      const safeUrl = escapeRegExp(originUrl);
      const regex = new RegExp(`!\\[${safeAlt}\\]\\(${safeUrl}\\)`, 'g');
      mdRaw = mdRaw.replace(regex, `<Image src={${meta.var}} alt="${meta.alt}" />`);
    }

    const mdxHeader = buildMdxHeader(frontMatter, imageImports);
    const fullMdxContent = mdxHeader + mdRaw;
    fs.writeFileSync(pageMdxPath, fullMdxContent, 'utf8');
    console.log('✅ Generated (.mdx):', pageMdxPath);
  } else {
    // ----------------------------------------------------
    // .md format
    // ----------------------------------------------------
    checkFolder(getFileFolder(type, lang));

    const imagePath = getImageFolderPath(customSlug, type);
    checkFolder('./public' + imagePath);

    const localImageMap = new Map<string, { alt: string; relativeUrl: string }>();

    for (const block of imageBlocks) {
      const data = block.replace('![', '').replace(']', '').replace(')', '').split('(');
      if (data.length !== 2) continue;
      const altText = data[0];
      const url = data[1];

      const filename = getImageFilenameFromUrl(url);
      const localRelative = imagePath + filename;
      const file = `./public/${localRelative}`;
      if (!fs.existsSync(file)) {
        await wget(url, file);
      }
      localImageMap.set(url, { alt: altText, relativeUrl: localRelative });
    }

    const mdRawObj = n2m.toMarkdownString(mdblocks);
    let mdRaw = mdRawObj.parent ?? '';

    for (const [originUrl, meta] of localImageMap) {
      const safeAlt = escapeRegExp(meta.alt);
      const safeUrl = escapeRegExp(originUrl);
      const regex = new RegExp(`!\\[${safeAlt}\\]\\(${safeUrl}\\)`, 'g');
      mdRaw = mdRaw.replace(regex, `![${meta.alt}](${meta.relativeUrl})`);
    }

    const yamlHeader = buildYamlHeader(frontMatter);
    const fullMdContent = yamlHeader + mdRaw;
    const mdPath = getFilePath(customSlug, type, lang);

    fs.writeFileSync(mdPath, fullMdContent, 'utf8');
    console.log('✅ Generated (.md):', mdPath);
  }
}

/**
 * Main parser entry orchestrator.
 */
export const parseNotion = async (
  token: string,
  contentRoot: string,
  contentTypes: DocumentType[]
): Promise<void> => {
  console.log('Fetching data from Notion');
  setNotionSecret(token);
  setRootFolder(contentRoot);
  addDocumentTypes(contentTypes);

  for (const type of contentTypes) {
    const databaseId = type.databaseId;
    const langField = type.languageField;
    const contentType = type.contentType || databaseId;
    const useNextMode = type.useNextMdxFolderMode ?? false;

    if (useNextMode) {
      console.warn(
        '⚠️ [experimental] useNextMdxFolderMode is experimental, API & folder structure may break in minor versions'
      );
    }

    if (!databaseId) throw new Error('No database id for type ' + type.contentType);
    if (!contentType) throw new Error('contentType id missing');

    console.log(`Fetching ${contentType} data`);
    const database = await getDatabase(databaseId, contentType);
    if (!database.length)
      console.error(`Got ${database.length} items from ${contentType} database`);

    const baseTypeDir = `${contentRoot}`;
    console.log(`baseTypeDir: ${baseTypeDir}`);
    checkFolder(baseTypeDir);

    for (const page of database) {
      await sleep(400);

      // Filter unwanted properties
      for (const field of type.filterFields || []) {
        if (page[field]) delete page[field];
      }

      const pageLang =
        langField && typeof page[langField] === 'string' ? page[langField] : undefined;
      await saveFile(page, contentType, pageLang, useNextMode, contentRoot);
    }
  }
};

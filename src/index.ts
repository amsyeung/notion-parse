import { Client } from '@notionhq/client';
import {
  DatabaseObjectResponse,
  PageObjectResponse,
  PartialDatabaseObjectResponse,
  PartialPageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import { NotionToMarkdown } from 'notion-to-md';
import {
  getFileFolder,
  getFilePath,
  getImageFolder,
  getImageFolderPath,
  setRootFolder,
} from './fileManagement.js';

import * as yaml from 'yaml';
import * as fs from 'fs';
import * as https from 'https';
import slugify from 'slugify';
import Jimp from 'jimp';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Global state management
let notionClient: Client | null = null;
let n2m: NotionToMarkdown | null = null;

export interface DocumentType {
  databaseId: string;
  languageField?: string;
  contentType: string;
  filterFields?: Array<string>;
}

const documentTypes: DocumentType[] = [];

export const setNotionSecret = (auth: string) => {
  notionClient = new Client({
    auth,
  });

  n2m = new NotionToMarkdown({ notionClient });
};

export const addDocumentTypes = (types: Array<DocumentType>) => {
  documentTypes.push(...types);
};

/**
 * 單獨拉取 Page 評論（Comments 不屬於 page.properties，需獨立接口）
 */
async function fetchPageComments(pageId: string) {
  if (!notionClient) return [];
  try {
    const res = await notionClient.comments.list({ block_id: pageId });
    // 過濾已關閉 resolved 的評論，只保留開放留言
    return res.results;
  } catch (err) {
    console.warn(`Failed to fetch comments for page ${pageId}`, err);
    return [];
  }
}

// Helper functions for field processing
const getFieldInfo = async (properties: Record<string, any>, name: string, contentType: string) => {
  const element = properties[name];

  if (!element) {
    return null;
  }

  const type = element.type;

  switch (type) {
    case 'title':
      return element.title[0]?.plain_text;
    case 'rich_text': {
      const texts = element.rich_text;
      if (!texts.length) return null;

      let mdStr = '';
      for (const t of texts) {
        let content = t.text.content;
        if (t.annotations.bold) content = `**${content}**`;
        if (t.annotations.italic) content = `*${content}*`;
        if (t.annotations.underline) content = `<u>${content}</u>`;
        if (t.annotations.strikethrough) content = `~~${content}~~`;
        if (t.annotations.code) content = `\`${content}\``;

        mdStr += content;
      }
      return mdStr;
    }
    case 'date':
      return element.date?.start;
    case 'url':
      return element.url;
    case 'checkbox':
      return element.checkbox;
    case 'number':
      return element.number;
    case 'select':
      return element.select?.name;
    case 'created_time':
      return element.created_time;
    case 'last_edited_time':
      return element.last_edited_time;
    case 'email':
      return element.email;
    case 'status':
      return element.status?.name ?? null;
    case 'formula':
      const formula = element.formula;
      if (formula.type === 'date') {
        const d = new Date(formula.date.start);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        const sec = String(d.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}${hour}${min}${sec}`;
      } else if (formula.type === 'number') {
        return formula.number;
      } else if (formula.type === 'string') {
        return formula.string;
      } else if (formula.type === 'boolean') {
        return formula.boolean;
      }
      return null;
    case 'phone_number':
      return element.phone_number;
    case 'relation':
      return element.relation.map((item: { id: any }) => item.id);
    case 'multi_select':
      return element.multi_select.map((item: { name: any }) => item.name);
    case 'files':
      const url = element.files[0]?.url || element.files[0]?.file?.url;
      if (!url) {
        return null;
      }
      return await manageImage(properties, url, contentType, element.files[0]?.name);
    case 'people':
      const users = element.people;
      if (!Array.isArray(users) || users.length === 0) return null;
      return users.map((user) => ({
        id: user.id,
        name: user.name,
        avatar_url: user.avatar_url,
        email: user.person?.email ?? null,
      }));
    default:
      throw new Error(`Unknown type ${type}`);
  }
};

const toFrontMatter = (data: object) => '---\n' + yaml.stringify(data) + '\n---\n';

// Download image helper
const downloadImage = async (fileUrl: string, destination: string) => {
  const file = './public' + destination;

  if (!fs.existsSync(file)) {
    await wget(fileUrl, file);
  }

  const img = await Jimp.read(file);

  const width = img.getWidth();
  const height = img.getHeight();

  return {
    src: destination,
    width,
    height,
  };
};

// Image management helper
const manageImage = async (
  properties: { [key: string]: any },
  url: string,
  contentType: string,
  name?: string
) => {
  const title = await getFieldInfo(properties, 'title', contentType);

  const slug =
    (await getFieldInfo(properties, 'slug', contentType)) ||
    slugify(title, {
      lower: true,
      strict: true,
    });

  if (!slug) {
    throw new Error('No slug');
  }

  checkFolder('./public' + getImageFolder(contentType));

  const destination: string = getImageFolder(contentType) + name;

  return await downloadImage(url, destination);
};

// File system helpers
const checkFolder = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const wget = (url: string, dest: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        const statusCode = response.statusCode;
        const location = response.headers.location;

        if (statusCode === 302 && location) {
          console.log('redirecting to ', location);
          // 遞歸下載重定向連結
          wget(String(location), dest).then(resolve).catch(reject);
        } else {
          console.log('Downloading', url, 'to', dest);
          const file = fs.createWriteStream(dest);
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }
      })
      .on('error', reject);
  });
};

// Parse Notion page to object
export const parseNotionPage = async (
  page:
    | PageObjectResponse
    | PartialPageObjectResponse
    | PartialDatabaseObjectResponse
    | DatabaseObjectResponse,
  contentType: string,
  debug = false
) => {
  const obj: { [key: string]: any } = {
    notionId: page.id,
    type: contentType,
  };

  if ('properties' in page) {
    for (const field in page.properties || {}) {
      const value = await getFieldInfo(page.properties, field, contentType);
      if (value !== null && value !== undefined && !obj[field]) {
        obj[field] = value;
      }
    }
  }

  return obj;
};

// Get database data with pagination
const getDatabase = async (
  notion: Client,
  database_id: string,
  contentType: string,
  debug = false
) => {
  let hasMore = true;
  const ret = [];

  let next_cursor: string | undefined = undefined;

  while (hasMore) {
    const queryParams: any = { database_id };
    if (next_cursor) {
      queryParams.start_cursor = next_cursor;
    }

    const request = await notion.databases.query(queryParams);

    const results = request.results;

    next_cursor = request.next_cursor ?? undefined;
    hasMore = request.has_more;

    if (debug) {
      console.log(`Got ${results.length} results from ${contentType} database`);
    }

    for (const page of results) {
      const item = await parseNotionPage(page, contentType, debug);
      ret.push(item);
    }
  }

  return ret;
};

// Save file with frontmatter and markdown content
const saveFile = async (
  frontMatter: { [key: string]: any },
  type: string,
  languageField?: string
) => {
  if (!n2m || !notionClient) {
    throw new Error('Notion client not set');
  }

  const notionId = frontMatter['notionId'];
  // 新增：抓取該頁所有評論塞入 frontmatter
  const comments = await fetchPageComments(notionId);
  frontMatter.comments = comments;

  const lang = languageField ? frontMatter[languageField] : '';

  if (lang) {
    checkFolder(getFileFolder(type, lang));
  }

  const title = frontMatter['title'];

  if (!title && !frontMatter['slug']) {
    throw new Error(`No title or slug in front matter for ${notionId} of type ${type}`);
  }

  const slug =
    frontMatter['slug'] ||
    slugify(title, {
      lower: true,
      strict: true,
    });

  frontMatter['slug'] = slug;

  const mdblocks = await n2m.pageToMarkdown(notionId);

  const imageBlocks = mdblocks
    .filter((block) => block.type === 'image')
    .map((block) => block.parent);

  const images = [];

  const imagePath = getImageFolderPath(slug, type);

  console.log('checking imagePath ./public' + imagePath);

  checkFolder('./public' + imagePath);

  for (const block of imageBlocks) {
    const data = block.replace('![', '').replace(']', '').replace(')', '').split('(');

    if (data.length !== 2) {
      console.log('Error with image block: ', block);
      continue;
    }

    const url = data[1];
    const name = data[0];

    const filename = name.split('/').pop();

    const src = imagePath + filename;

    const file = `./public/${src}`;
    if (!fs.existsSync(file)) {
      await wget(url, file);
    }

    images.push({
      src,
      url,
      name,
    });
  }

  const mdBody = n2m.toMarkdownString(mdblocks);

  for (const image of images) {
    mdBody.parent = mdBody.parent.replace(image.url, image.src);
  }

  const newFile = getFilePath(slug, type, lang);

  try {
    fs.writeFileSync(newFile, toFrontMatter(frontMatter) + mdBody.parent);
  } catch (e) {
    console.log('error with file: ', newFile);
    console.error(e);
  }
};

// Main parsing function
export const parseNotion = async (
  token: string,
  contentRoot: string,
  contentTypes: Array<DocumentType>,
  debug = false
) => {
  console.log('Fetching data from Notion');

  setNotionSecret(token);
  setRootFolder(contentRoot);
  addDocumentTypes(contentTypes);

  if (!notionClient) {
    throw new Error('Notion client incorrectly setup');
  }

  for (const type of contentTypes) {
    const databaseId = type.databaseId;
    const lang = type.languageField;
    const contentType = type.contentType || databaseId;

    if (!databaseId) {
      throw new Error('No database id for type ' + type.contentType);
    }

    if (!contentType) {
      throw new Error('contentType id missing');
    }

    console.log(`Fetching ${contentType} data`);

    const database = await getDatabase(notionClient, databaseId, contentType, debug);

    if (!database.length) {
      console.error(`Got ${database.length} items from ${contentType} database`);
    }

    console.log('checking ' + contentRoot + '/' + contentType.toLowerCase());
    checkFolder(contentRoot + '/' + contentType.toLowerCase());

    for (const page of database) {
      sleep(400);

      for (const field of type.filterFields || []) {
        if (page[field]) {
          delete page[field];
        }
      }

      await saveFile(page, contentType, lang);
    }
  }
};

import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import {
  PageObjectResponse,
  PartialPageObjectResponse,
  PartialDatabaseObjectResponse,
  DatabaseObjectResponse,
  CommentObjectResponse,
  QueryDatabaseParameters,
} from '@notionhq/client/build/src/api-endpoints.js';
import { ParsedPage, NotionProperties } from '../types.js';
import { getFieldInfo } from './properties.js';

export let notionClient: Client | null = null;
export let n2m: NotionToMarkdown | null = null;

export const setNotionSecret = (auth: string): void => {
  notionClient = new Client({ auth });
  n2m = new NotionToMarkdown({ notionClient });
};

/**
 * Fetches comments belonging to a specific Notion Page block.
 * Comments do not belong to page properties and must be fetched independently.
 */
export async function fetchPageComments(pageId: string): Promise<CommentObjectResponse[]> {
  if (!notionClient) return [];
  try {
    const res = await notionClient.comments.list({ block_id: pageId });
    return res.results;
  } catch (err) {
    console.warn(`Failed to fetch comments for page ${pageId}`, err);
    return [];
  }
}

/**
 * Compiles a database page object into a clean key-value pair map.
 */
export async function parseNotionPage(
  page:
    | PageObjectResponse
    | PartialPageObjectResponse
    | PartialDatabaseObjectResponse
    | DatabaseObjectResponse,
  contentType: string
): Promise<ParsedPage> {
  const obj: ParsedPage = {
    notionId: page.id,
    type: contentType,
  };

  if ('properties' in page) {
    const properties = page.properties as NotionProperties;
    for (const field in properties) {
      const value = await getFieldInfo(properties, field, contentType);
      if (value !== null && value !== undefined && !obj[field]) {
        obj[field] = value;
      }
    }
  }
  return obj;
}

/**
 * Fetches and aggregates all pages in a database using automatic pagination.
 */
export async function getDatabase(database_id: string, contentType: string): Promise<ParsedPage[]> {
  if (!notionClient) throw new Error('Notion client is not initialized');

  let hasMore = true;
  const list: ParsedPage[] = [];
  let next_cursor: string | undefined = undefined;

  while (hasMore) {
    const queryParams: QueryDatabaseParameters = { database_id };
    if (next_cursor) queryParams.start_cursor = next_cursor;

    const request = await notionClient.databases.query(queryParams);
    next_cursor = request.next_cursor ?? undefined;
    hasMore = request.has_more;

    for (const page of request.results) {
      const item = await parseNotionPage(page, contentType);
      list.push(item);
    }
  }
  return list;
}

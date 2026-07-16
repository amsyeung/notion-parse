import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { parseNotion, DocumentType } from '../../src/index.js';
import { describe, beforeAll, it, expect } from '@jest/globals';

dotenv.config();

const TEST_OUTPUT_DIR = path.join(process.cwd(), 'test-output');

function hasMdxFile(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (hasMdxFile(fullPath)) return true;
    } else if (file.endsWith('.mdx')) {
      return true;
    }
  }
  return false;
}

describe('Full Notion database sync integration test', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
    }
  });

  it('should connect to Notion API and export blog markdown files successfully', async () => {
    const NOTION_SECRET = process.env.NOTION_SECRET;
    const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
    const NOTION_CONTENT_TYPE = process.env.NOTION_CONTENT_TYPE || 'posts';

    if (!NOTION_SECRET || !NOTION_DATABASE_ID) {
      console.log('Missing required Notion environment variables, skipping live API test');
      return;
    }

    const useNextMdxFolderMode = false;
    const databaseConfigs: DocumentType[] = [
      {
        databaseId: NOTION_DATABASE_ID,
        contentType: NOTION_CONTENT_TYPE,
        useNextMdxFolderMode: useNextMdxFolderMode,
      },
    ];

    await parseNotion(NOTION_SECRET, TEST_OUTPUT_DIR, databaseConfigs);

    expect(fs.existsSync(TEST_OUTPUT_DIR)).toBe(true);

    const outputFiles = fs.readdirSync(TEST_OUTPUT_DIR);
    expect(outputFiles.length).toBeGreaterThan(0);

    if (useNextMdxFolderMode) {
      const mdxGenerated = hasMdxFile(TEST_OUTPUT_DIR);
      expect(mdxGenerated).toBe(true);
    }
    console.log('✅ Integration test passed! Files successfully generated in test-output.');
  }, 120000);
});

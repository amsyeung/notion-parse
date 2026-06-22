import { parseNotion } from '../index';
import dotenv from 'dotenv';
dotenv.config();

describe('Full Notion database sync integration test', () => {
  it('should connect to Notion API and export blog markdown files successfully', async () => {
    const NOTION_SECRET = process.env.NOTION_SECRET;
    const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
    const NOTION_CONTENT_TYPE = process.env.NOTION_CONTENT_TYPE;

    // Skip real API test if required environment variables are missing
    if (!NOTION_SECRET || !NOTION_DATABASE_ID) {
      console.log('Missing required Notion environment variables, skipping live API test');
      return;
    }

    const databaseConfigs = [
      {
        databaseId: NOTION_DATABASE_ID!,
        contentType: NOTION_CONTENT_TYPE!,
      },
    ];

    // Run full sync logic identical to production sync script
    // Output all test generated files under __tests__/test-output
    await parseNotion(NOTION_SECRET, './test-output', databaseConfigs, true);

    // Basic assertion: test passes if no uncaught error thrown during sync
    expect(true).toBe(true);
  }, 30000); // Set 30s timeout for slow Notion API pagination & image downloads
});

# Notion Parse

An NPM module for downloading Notion content and saving it as Markdown with FrontMatter. This module takes data from Notion database pages and converts them into Markdown files with structured frontmatter.

## Installation

```bash
npm install @amsyn/notion-parse
```

## Usage

```javascript
const NotionParse = require('@amsyn/notion-parse');
require('dotenv').config();

// Global Notion sync configuration
const NOTION_CONFIG = {
  outputBaseDir: ".",
  databases: [
    {
      envDbKey: "NOTION_DATABASE_ID",
      contentType: "NOTION_DATABASE_NAME",
    },
  ],
};

// Main function to fetch and parse Notion database content
async function parseNotionContent() {
  const { NOTION_SECRET } = process.env;
  // Validate Notion API secret key
  if (!NOTION_SECRET) {
    throw new Error("Environment variable NOTION_SECRET is missing, cannot connect to Notion API");
  }

  // Map configured databases with IDs loaded from environment variables
  const databaseConfigs = NOTION_CONFIG.databases.map((db) => {
    const databaseId = process.env[db.envDbKey];
    if (!databaseId) {
      throw new Error(`Environment variable ${db.envDbKey} is missing, skip this database`);
    }
    return {
      databaseId,
      contentType: db.contentType,
    };
  });

  console.log("Start syncing Notion database content...");
  await NotionParse.parseNotion(NOTION_SECRET, NOTION_CONFIG.outputBaseDir, databaseConfigs);
  console.log("Notion database sync completed");
}

// Execute sync task and handle success/error logs
parseNotionContent()
  .then(() => console.log("✅ Notion database parsed successfully"))
  .catch((err) => {
    console.error("❌ Failed to sync Notion data:", err.message);
  });
```

## Environment Variables

```env
NOTION_SECRET=${YOUR_NOTION_CONNECTIONS_ACCESS_TOKEN}
NOTION_DATABASE_ID=${YOUR_DATABSE_ID}
```

> You can copy link in your notion database page to find `DATABASE_ID`
> For example, 
>   https://www.notion.so/23e31f81586120ba8478ead83604b567?v=23e31f81586120ba8478ead83604b567&source=copy_link
>
>   DATABASE_ID=23e31f81586120ba8478ead83604b567

## Features

- Converts Notion database pages to Markdown with frontmatter
- Supports multiple content types
- Handles image downloads and path management
- Language-specific content support
- Pagination for large databases
- Compatible with ContentLayer2

## Requirements

- Node.js 20+
- Notion API token
- Database IDs for content types

## License

MIT
```
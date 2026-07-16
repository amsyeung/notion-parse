# Notion Parse

An NPM module for downloading Notion content and saving it as Markdown with FrontMatter. This module takes data from Notion database pages and converts them into structured Markdown or MDX files.

## Installation

```bash
# Using npm
npm install @amsyn/notion-parse

# Using pnpm
pnpm add @amsyn/notion-parse

# Using yarn
yarn add @amsyn/notion-parse
```

## Standard Markdown Mode (.md)

Generates traditional .md files with clean YAML Frontmatter. Images are downloaded to your public directory and referenced via relative paths.

```javascript
import { parseNotion } from '@amsyn/notion-parse';
import dotenv from 'dotenv';
dotenv.config();

const databaseConfigs = [
  {
    databaseId: process.env.NOTION_DATABASE_ID,
    contentType: "blogs", // Files will be generated under [outputDir]/blogs/
    languageField: "lang", // Optional: for multi-language support (e.g. "en", "zh")
  },
];

async function sync() {
  const { NOTION_SECRET } = process.env;
  if (!NOTION_SECRET) throw new Error("Missing NOTION_SECRET");

  // Sync to './content' directory
  await parseNotion(NOTION_SECRET, './src/app/content', databaseConfigs); 
  console.log("Sync completed!");
}

sync().catch(console.error);
```

## Next.js MDX Folder Mode (.mdx)

Designed for Next.js App Router (e.g., ./src/app/content/[slug]/page.mdx).

When useNextMdxFolderMode: true is enabled, the parser isolates each article into its own folder containing a page.mdx and its local images. Images are automatically imported as ESM modules and rendered using custom React components.

```javascript
// everything unchanged
const databaseConfigs = [
  {
    databaseId: process.env.NOTION_DATABASE_ID,
    contentType: "blogs",
    useNextMdxFolderMode: true, // 💡 Enables experimental MDX isolation mode
  },
];
```

## Generated page.mdx Preview
```tsx
import { ArticleLayout } from '@/components/ArticleLayout'
import img0 from './cover.png'

export const article = {
  "notionId": "1a2b3c4d-...",
  "type": "blogs",
  "title": "My Awesome Notion Blog",
  "slug": "my-awesome-notion-blog",
  "comments": []
};

export const metadata = {
  title: article.title,
  description: article.description
}

export default (props) => <ArticleLayout article="{article}" {...props}/>

# Hello World

<Image alt="My Cover Image" src="{img0}"/>
```

## Configuration API (DocumentType)

The databaseConfigs array accepts objects with the following properties:

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `database` | `string` | **Yes** | The Notion Database ID. |
| `contentType` | `string` | **Yes** | Content type name (used as folder directory). |
| `languageField` | `string` | **No** | Property name in Notion for language code (e.g., "en"). |
| `filterFields` | `string[]` | **No** | Array of Notion properties to exclude from Frontmatter. |
| `useNextMdxFolderMode` | `boolean` | **No** | If true, outputs .mdx with ESM imports. Default false. |


## Environment Variables

Create a .env file in the root of your project:

```env
NOTION_SECRET=ntn_xxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Where is my Database ID?**
> 
> Copy the link of your Notion database page. The ID is the 32-character string in the URL.

## Features

- Double-Track Generation: Choose between traditional .md or Next.js App Router compatible .mdx.
- Smart Asset Pipeline: Automatically downloads and maps remote Notion images to local storage.
- Auto Comments Sync: Automatically fetches and nests database page comments into frontmatter.
- Contentlayer 2 Friendly: Easily integrated into modern SSG pipelines.

## Requirements

- Node.js: `20.x` or higher
- Notion: An integration token with "Read" access.

## License

MIT
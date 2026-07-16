import {
  CommentObjectResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints.js';

export interface DocumentType {
  databaseId: string;
  languageField?: string;
  contentType: string;
  filterFields?: string[];
  /**
   * @experimental Next App Router page.mdx isolated folder mode.
   * Experimental feature: paths or behaviors might change in minor versions.
   */
  useNextMdxFolderMode?: boolean;
}

export interface NotionPerson {
  id: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export interface ImageResult {
  src: string;
  width: number;
  height: number;
}

export type NotionPropertyValue =
  | string
  | number
  | boolean
  | string[]
  | NotionPerson[]
  | ImageResult
  | null
  | undefined;

type ParsedPageBase = {
  notionId: string;
  type: string;
  comments?: CommentObjectResponse[];
};

export type ParsedPage = ParsedPageBase & {
  [key: string]: NotionPropertyValue;
};

export interface ImageMeta {
  var: string;
  alt: string;
  importPath: string;
}

// Extract the typing for individual property types directly from the official client
export type NotionProperties = PageObjectResponse['properties'];
export type NotionProperty = NotionProperties[string];

import { TextRichTextItemResponse } from '@notionhq/client/build/src/api-endpoints.js';
import { manageImage } from '../mdx/generator.js';
import { NotionProperty, NotionPropertyValue } from '../types.js';

/**
 * Parses dynamic property types out of Notion's complex response payloads.
 */
export async function getFieldInfo(
  properties: Record<string, NotionProperty>,
  name: string,
  contentType: string
): Promise<NotionPropertyValue> {
  const element = properties[name];
  if (!element) return null;

  const type = element.type;
  switch (type) {
    case 'title':
      return element.title[0]?.plain_text || '';
    case 'rich_text': {
      const texts = element.rich_text;
      if (!texts.length) return null;
      let mdStr = '';
      for (const t of texts) {
        let content = (t as TextRichTextItemResponse).text.content;
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
      return element.date?.start ?? null;
    case 'url':
      return element.url;
    case 'checkbox':
      return element.checkbox;
    case 'number':
      return element.number;
    case 'select':
      return element.select?.name ?? null;
    case 'created_time':
      return element.created_time;
    case 'last_edited_time':
      return element.last_edited_time;
    case 'email':
      return element.email;
    case 'status':
      return element.status?.name ?? null;
    case 'formula': {
      const formula = element.formula;
      if (formula.type === 'date' && formula.date?.start) {
        const d = new Date(formula.date.start);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        const sec = String(d.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}${hour}${min}${sec}`;
      } else if (formula.type === 'number') return formula.number;
      else if (formula.type === 'string') return formula.string;
      else if (formula.type === 'boolean') return formula.boolean;
      return null;
    }
    case 'phone_number':
      return element.phone_number;
    case 'relation':
      return element.relation.map((item) => item.id);
    case 'multi_select':
      return element.multi_select.map((item) => item.name);
    case 'files': {
      const fileObj = element.files[0];
      if (!fileObj) return null;
      const url =
        'file' in fileObj ? fileObj.file.url : 'external' in fileObj ? fileObj.external.url : null;
      if (!url) return null;
      return await manageImage(properties, url, contentType, fileObj.name);
    }
    case 'people':
      return element.people.map((user) => ({
        id: user.id,
        name: 'name' in user ? user.name : null,
        avatar_url: 'avatar_url' in user ? user.avatar_url : null,
        email: 'person' in user ? (user.person?.email ?? null) : null,
      }));
    default:
      throw new Error(`Unhandled or unknown Notion property type: ${type}`);
  }
}

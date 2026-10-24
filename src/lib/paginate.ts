import { CATEGORIES, type Category, type NewsItem } from '../types';

export interface Page {
  category: Category;
  part: number; // 1-based part within the category
  parts: number;
  items: NewsItem[];
}

const MAX_ITEMS = 5;
const MAX_CHARS = 1150;
const len = (i: NewsItem) => i.headline.length + i.bullets.reduce((n, b) => n + b.length, 0);

/** Groups items by topic and cuts them into pages of about 4-6 short items. Empty categories get no page. */
export function paginate(items: NewsItem[]): Page[] {
  const pages: Page[] = [];
  for (const category of CATEGORIES) {
    const list = items.filter((i) => i.category === category);
    if (!list.length) continue;
    const chunks: NewsItem[][] = [];
    let cur: NewsItem[] = [];
    let chars = 0;
    for (const it of list) {
      if (cur.length && (cur.length >= MAX_ITEMS || chars + len(it) > MAX_CHARS)) {
        chunks.push(cur);
        cur = [];
        chars = 0;
      }
      cur.push(it);
      chars += len(it);
    }
    if (cur.length) chunks.push(cur);
    // fold a lone leftover item into the previous page so pages stay full
    if (chunks.length > 1 && chunks[chunks.length - 1].length === 1 && chunks[chunks.length - 2].length < 6) {
      chunks[chunks.length - 2].push(chunks.pop()![0]);
    }
    chunks.forEach((c, i) => pages.push({ category, part: i + 1, parts: chunks.length, items: c }));
  }
  return pages;
}

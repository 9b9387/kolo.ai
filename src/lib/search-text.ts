// The single builder for food.searchText — used by both the ETL pipelines
// and create_food so the FULLTEXT index always sees the same shape.

export function buildSearchText(parts: {
  name: string;
  nameZh?: string | null;
  nameEn?: string | null;
  aliases?: string | null;
  brand?: string | null;
}): string {
  return [parts.name, parts.nameZh, parts.nameEn, parts.aliases?.replaceAll('|', ' '), parts.brand]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

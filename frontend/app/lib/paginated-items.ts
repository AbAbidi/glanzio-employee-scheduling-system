export type ItemsPage<T> = {
  items: T[];
  page: number;
  pageCount: number;
};

/** Load a complete bounded result; never silently present a partial calendar. */
export async function loadPaginatedItems<T extends { id: string }>(
  loadPage: (page: number) => Promise<ItemsPage<T>>,
  isActive: () => boolean = () => true,
): Promise<T[]> {
  const items = new Map<string, T>();
  let page = 1;
  while (isActive()) {
    const result = await loadPage(page);
    if (!Array.isArray(result.items) || result.page !== page ||
        !Number.isInteger(result.pageCount) || result.pageCount < 0) {
      throw new Error("The calendar returned invalid pagination data. Please retry.");
    }
    for (const item of result.items) items.set(item.id, item);
    if (page >= result.pageCount) return [...items.values()];
    if (page >= 1000 || result.items.length === 0) {
      throw new Error("The complete calendar could not be loaded. Please retry.");
    }
    page += 1;
  }
  return [];
}

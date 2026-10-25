import type { PaginationMetaDto, PaginationQueryDto } from './pagination.dto';

type PageRange = { skip: number; take: number };

/** The service keeps control of filters, ordering and the read transaction. */
export async function paginate<T>(
  query: PaginationQueryDto,
  read: (range: PageRange) => Promise<[T[], number]>,
): Promise<{ items: T[]; meta: PaginationMetaDto }> {
  const { page = 1, limit = 10 } = query;
  const [items, total] = await read({ skip: (page - 1) * limit, take: limit });
  return {
    items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

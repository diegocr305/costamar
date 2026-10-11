import * as fc from 'fast-check';
import { CartaService } from './carta.service';
import type { SupabaseService } from '../supabase/supabase.service';

interface FakeProduct {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  base_price: number;
  is_available: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  product_images: [];
}

/**
 * Mock de SupabaseService que simula el comportamiento de PostgREST:
 * respeta el filtro .eq('is_available', true) sobre products y
 * .eq('is_active', true) sobre categories.
 */
function buildSupabaseMock(allProducts: FakeProduct[]): SupabaseService {
  const category = {
    id: 'cat-1',
    name: 'Ceviches',
    description: null,
    position: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };

  const client = {
    from(table: string) {
      if (table === 'categories') {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({ data: [category], error: null }),
            }),
          }),
        };
      }
      // products
      const filters: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return builder;
        },
        order: () => {
          let rows = allProducts;
          if (filters['is_available'] === true) {
            rows = rows.filter((p) => p.is_available === true);
          }
          if (filters['category_id'] !== undefined) {
            rows = rows.filter((p) => p.category_id === filters['category_id']);
          }
          return Promise.resolve({ data: rows, error: null });
        },
      };
      return builder;
    },
  };

  return { client } as unknown as SupabaseService;
}

describe('CartaService.getCartaPublica', () => {
  // Feature: costamar-platform, Propiedad 13: Carta pública solo productos disponibles
  // Para cualquier mezcla de productos disponibles/no disponibles, la carta
  // pública debe retornar ÚNICAMENTE los que tienen is_available = true.
  it('retorna solo productos disponibles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 30 }),
        async (availabilityFlags) => {
          const products: FakeProduct[] = availabilityFlags.map((avail, i) => ({
            id: `p-${i}`,
            category_id: 'cat-1',
            name: `Producto ${i}`,
            description: null,
            base_price: 1000,
            is_available: avail,
            position: i,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            product_images: [],
          }));

          const service = new CartaService(buildSupabaseMock(products));
          const carta = await service.getCartaPublica();

          const returned = carta.categories.flatMap((c) => c.products);
          // Todos los retornados deben estar disponibles.
          expect(returned.every((p) => p.isAvailable === true)).toBe(true);
          // La cantidad coincide con los disponibles del input.
          const expectedCount = availabilityFlags.filter((a) => a).length;
          expect(returned.length).toBe(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});

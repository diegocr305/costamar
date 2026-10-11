import { ConflictException } from '@nestjs/common';
import { CartaService } from './carta.service';
import type { SupabaseService } from '../supabase/supabase.service';

function supabaseWithProductsInCategory(count: number): SupabaseService {
  const products = Array.from({ length: count }, (_, i) => ({
    id: `p-${i}`,
    name: `Producto ${i}`,
  }));
  const client = {
    from: (table: string) => {
      if (table === 'products') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: products, error: null }),
          }),
        };
      }
      return {
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    },
  };
  return { client } as unknown as SupabaseService;
}

describe('CartaService.deleteCategory', () => {
  it('rechaza eliminar una categoría con productos (409)', async () => {
    const service = new CartaService(supabaseWithProductsInCategory(3));
    await expect(service.deleteCategory('cat-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('elimina una categoría vacía', async () => {
    const service = new CartaService(supabaseWithProductsInCategory(0));
    const result = await service.deleteCategory('cat-1');
    expect(result).toEqual({ id: 'cat-1', deleted: true });
  });
});

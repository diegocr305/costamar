import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CartaPublica } from '@costamar/shared';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import type { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class CartaService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Carta pública: solo categorías activas con sus productos disponibles,
   * ordenadas por posición. (Propiedad 13)
   */
  async getCartaPublica(): Promise<CartaPublica> {
    const { data: categories, error } = await this.supabase.client
      .from('categories')
      .select('id, name, description, position, is_active, created_at')
      .eq('is_active', true)
      .order('position', { ascending: true });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const result: CartaPublica = { categories: [] };

    for (const cat of categories ?? []) {
      const { data: products } = await this.supabase.client
        .from('products')
        .select(
          'id, category_id, name, description, base_price, is_available, position, created_at, updated_at, product_images(id, product_id, storage_path, position, created_at)',
        )
        .eq('category_id', cat.id)
        .eq('is_available', true)
        .order('position', { ascending: true });

      result.categories.push({
        id: cat.id,
        name: cat.name,
        description: cat.description ?? undefined,
        position: cat.position,
        isActive: cat.is_active,
        createdAt: cat.created_at,
        products: (products ?? []).map((p) => ({
          id: p.id,
          categoryId: p.category_id,
          name: p.name,
          description: p.description ?? undefined,
          basePrice: Number(p.base_price),
          isAvailable: p.is_available,
          position: p.position,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          images: (p.product_images ?? []).map((img) => ({
            id: img.id,
            productId: img.product_id,
            storagePath: img.storage_path,
            position: img.position,
            createdAt: img.created_at,
          })),
        })),
      });
    }

    return result;
  }

  // ---------- Categorías ----------

  async listCategories() {
    const { data, error } = await this.supabase.client
      .from('categories')
      .select('*')
      .order('position', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createCategory(dto: CreateCategoryDto) {
    const { data, error } = await this.supabase.client
      .from('categories')
      .insert({
        name: dto.name,
        description: dto.description ?? null,
        position: dto.position ?? 0,
        is_active: dto.isActive ?? true,
      })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const { data, error } = await this.supabase.client
      .from('categories')
      .update({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Categoría no encontrada');
    return data;
  }

  /** Rechaza eliminar una categoría que contiene productos (409). */
  async deleteCategory(id: string) {
    const { data: products, error: countError } = await this.supabase.client
      .from('products')
      .select('id, name')
      .eq('category_id', id);
    if (countError) throw new BadRequestException(countError.message);

    if (products && products.length > 0) {
      throw new ConflictException(
        `No se puede eliminar la categoría: contiene ${products.length} producto(s).`,
      );
    }

    const { error } = await this.supabase.client
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { id, deleted: true };
  }

  // ---------- Productos ----------

  async listProducts() {
    const { data, error } = await this.supabase.client
      .from('products')
      .select('*')
      .order('position', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createProduct(dto: CreateProductDto) {
    const { data, error } = await this.supabase.client
      .from('products')
      .insert({
        category_id: dto.categoryId,
        name: dto.name,
        description: dto.description ?? null,
        base_price: dto.basePrice,
        is_available: dto.isAvailable ?? true,
        position: dto.position ?? 0,
      })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const { data, error } = await this.supabase.client
      .from('products')
      .update({
        ...(dto.categoryId !== undefined
          ? { category_id: dto.categoryId }
          : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.basePrice !== undefined ? { base_price: dto.basePrice } : {}),
        ...(dto.isAvailable !== undefined
          ? { is_available: dto.isAvailable }
          : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Producto no encontrado');
    return data;
  }

  async deleteProduct(id: string) {
    const { error } = await this.supabase.client
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { id, deleted: true };
  }
}

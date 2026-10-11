export interface Category {
  id: string;
  name: string;
  description?: string;
  position: number;
  isActive: boolean;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  price: number;
  isActive: boolean;
}

export interface ProductImage {
  id: string;
  productId: string;
  storagePath: string;
  position: number;
  createdAt: string;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  basePrice: number;
  isAvailable: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  variants?: ProductVariant[];
  images?: ProductImage[];
}

export interface CartaPublica {
  categories: Array<Category & { products: Product[] }>;
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PublicRoute } from '../common/decorators/public-route.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CartaService } from './carta.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Controller('carta')
export class CartaController {
  constructor(private readonly carta: CartaService) {}

  /** Carta pública: solo productos disponibles. Sin autenticación. */
  @PublicRoute()
  @Get()
  getCarta() {
    return this.carta.getCartaPublica();
  }

  // ---------- Categorías (admin) ----------

  @Roles('superadmin', 'admin', 'manager')
  @Get('categories')
  listCategories() {
    return this.carta.listCategories();
  }

  @Roles('superadmin', 'admin')
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.carta.createCategory(dto);
  }

  @Roles('superadmin', 'admin')
  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.carta.updateCategory(id, dto);
  }

  @Roles('superadmin', 'admin')
  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.carta.deleteCategory(id);
  }

  // ---------- Productos (admin) ----------

  @Roles('superadmin', 'admin', 'manager')
  @Get('products')
  listProducts() {
    return this.carta.listProducts();
  }

  @Roles('superadmin', 'admin')
  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.carta.createProduct(dto);
  }

  @Roles('superadmin', 'admin')
  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.carta.updateProduct(id, dto);
  }

  @Roles('superadmin', 'admin')
  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.carta.deleteProduct(id);
  }
}

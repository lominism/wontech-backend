export class CreateProductDto {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  commission?: number | null;
  description?: string | null;
  brand?: string | null;
  weight?: string | null;
  dimensions?: string | null;
  originCountry?: string | null;
  imageUrl?: string | null;
}


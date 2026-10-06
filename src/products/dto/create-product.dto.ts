export class CreateProductDto {
  sku: string;
  name: string;
  category?: string | null;
  price: number;
  stock: number;
  commission?: number | null;
  kolCommission?: number | null;
  description?: string | null;
  brand?: string | null;
  weight?: string | null;
  dimensions?: string | null;
  originCountry?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
}


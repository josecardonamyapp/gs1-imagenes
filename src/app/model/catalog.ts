export interface CatalogProduct {
  gtin: string;
  name?: string;
  imageUrl?: string;
  producName?: string;
  images?: CatalogProductImage[];
  currentIndex?: number;
  isImageLoading?: boolean;
}

export interface CatalogProductImage {
  uniformresourceidentifier: string;
}

export interface Catalog {
  id?: string;
  name: string;
  description?: string;
  products?: CatalogProduct[];
  productGtins: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCatalogPayload {
  name: string;
  description?: string;
  productGtins: string[];
}

export interface CreateCatalogApiPayload {
  gln: string;
  name: string;
  description?: string;
  data: CatalogProductApiEntry[];
}

export interface CatalogProductApiEntry {
  gtin: string;
  producName?: string;
  images?: CatalogProductImage[];
  currentIndex?: number;
}
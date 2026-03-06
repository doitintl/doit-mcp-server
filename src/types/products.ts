export type Product = {
    displayName: string;
    id: string;
    platform: string;
};

export type ProductsResponse = {
    products: Product[];
};

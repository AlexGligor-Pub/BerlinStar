import { crudApi, http, type CursorQuery, type Schemas } from "./client";

export type Category = Schemas["CategoryRead"];
export type CategoryCreate = Schemas["CategoryCreate"];
export type CategoryUpdate = Schemas["CategoryUpdate"];
export type Item = Schemas["ItemRead"];
export type ItemCreate = Schemas["ItemCreate"];
export type ItemUpdate = Schemas["ItemUpdate"];
export type ItemType = Schemas["ItemType"];

export interface CategoriesQuery extends CursorQuery {
  q?: string | null;
  sort?: string | null;
  department_id?: number | null;
  include_deleted?: boolean;
}

export interface ItemsQuery extends CursorQuery {
  q?: string | null;
  sort?: string | null;
  category_id?: number | null;
  department_id?: number | null;
  type?: ItemType | null;
  include_deleted?: boolean;
}

export const categoriesApi = crudApi<Category, CategoryCreate, CategoryUpdate, CategoriesQuery>("/api/categories");

const itemsBase = crudApi<Item, ItemCreate, ItemUpdate, ItemsQuery>("/api/items");

export const itemsApi = {
  ...itemsBase,
  uploadImage: (id: number, fd: FormData) =>
    http.upload<{ image_path: string | null }>(`/api/items/${id}/image`, fd, {
      errorMessage: "Eroare la upload imagine.",
    }),
};

import { crudApi, type Schemas } from "./client";

export type Register = Schemas["RegisterRead"];
export type RegisterCreate = Schemas["RegisterCreate"];
export type RegisterUpdate = Schemas["RegisterUpdate"];

export const registersApi = crudApi<Register, RegisterCreate, RegisterUpdate>("/api/registers");

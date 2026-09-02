import { crudApi, type Schemas } from "./client";

export type Disclaimer = Schemas["DisclaimerRead"];
export type DisclaimerCreate = Schemas["DisclaimerCreate"];
export type DisclaimerUpdate = Schemas["DisclaimerUpdate"];

export const disclaimersApi = crudApi<Disclaimer, DisclaimerCreate, DisclaimerUpdate>("/api/disclaimers");

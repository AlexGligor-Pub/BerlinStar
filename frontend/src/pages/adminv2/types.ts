/** Tipuri partajate intre sectiunile AdminV2. */

export interface Account {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
  is_deleted: boolean;
  username: string;
  /** Codul firmei, introdus la login alaturi de utilizator si parola. */
  code: string | null;
  email: string | null;
  image_url: string | null;
  is_locked: boolean;
  locked_at: string | null;
}

export interface HotelImages {
  hotel_cazare_image_path: string | null;
  hotel_scoatere_image_path: string | null;
  hotel_montare_image_path: string | null;
}

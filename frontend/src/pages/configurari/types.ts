/** Tipuri partajate intre panourile paginii Configurari. */

export interface Location {
  id: number;
  name: string;
  description: string | null;
  disclaimer_id: number | null;
  register_id: number | null;
  company_id: number | null;
  department_ids: number[];
  employee_ids: number[];
  image_path: string | null;
}

export interface CompanyItem {
  id: number;
  cui: number;
  name: string;
  address: string | null;
  nr_reg_com: string | null;
  phone: string | null;
  postal_code: string | null;
  is_vat_payer: boolean | null;
  tva_percentage: number | null;
  registration_status: string | null;
  description: string | null;
  comments: string | null;
  logo_path: string | null;
  background_path: string | null;
  website: string | null;
  bank_name: string | null;
  iban: string | null;
  capital_social: number | null;
}

export interface Department {
  id: number;
  name: string;
  description: string | null;
  image_path: string | null;
}

export interface Employee {
  id: number;
  name: string;
}

export interface EmployeeItem {
  id: number;
  name: string;
  description: string | null;
  target: string;
  image_path: string | null;
  annual_vacation_days: number;
}

export interface Category {
  id: number;
  name: string;
  department_id: number;
}

export interface Item {
  id: number;
  name: string;
  description: string | null;
  price: string;
  unit: string;
  type: string;
  category_id: number;
  category_name: string | null;
  image_path: string | null;
}

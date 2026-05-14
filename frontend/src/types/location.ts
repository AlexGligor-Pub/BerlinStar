export interface Location {
  id: number;
  name: string;
  description: string | null;
  disclaimer_id?: number | null;
  register_id?: number | null;
  company_id?: number | null;
  department_ids?: number[];
  employee_ids?: number[];
  image_path?: string | null;
}

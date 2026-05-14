export interface PaginatedResponse<T> {
  items: T[];
  total?: number;
  next_cursor?: string | null;
}

export interface ApiErrorBody {
  detail?: unknown;
  message?: string;
}

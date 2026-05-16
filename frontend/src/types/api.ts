export interface PaginatedResponse<T> {
  items: T[];
  total?: number;
  next_cursor?: string | null;
}

export interface ApiErrorBody {
  detail?: unknown;
  message?: string;
}

/** Forma uzuala pentru body-uri JSON intoarse de FastAPI (atat success cat si error). */
export interface ApiMessageBody {
  detail?: string;
  message?: string;
  ok?: boolean;
}

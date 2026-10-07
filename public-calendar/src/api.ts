// Clientul API. Toate cererile merg la `api/…` pe acelasi domeniu; proxy-ul
// instalarii le trimite la Berlin Star (/api/public/v1) si adauga cheia API.

export type Service = { id: number; name: string; duration_minutes: number }

export type PublicConfig = {
  site_name: string
  location_name: string
  company_name: string | null
  address: string | null
  phone: string | null
  email: string | null
  timezone: string
  slot_minutes: number
  horizon_days: number
  cancel_cutoff_minutes: number
  services: Service[]
  mcp_path: string | null
  mcp_url: string | null
}

export type Slot = { start: string; end: string }

export type Booking = {
  ref: string
  start: string
  end: string
  service: string | null
  status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
}

export type BookingForm = {
  start: string
  nume: string
  telefon: string
  descriere: string
  service_id: number | null
  marca: string | null
  model: string | null
  an: number | null
  website: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`api/${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError(0, 'Nu ne putem conecta. Verificați conexiunea la internet.')
  }
  if (!res.ok) {
    let message = 'A apărut o eroare. Încercați din nou.'
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') message = body.detail
      else if (Array.isArray(body.detail)) message = 'Verificați datele introduse.'
    } catch {
      /* raspuns fara JSON */
    }
    throw new ApiError(res.status, message)
  }
  return (await res.json()) as T
}

export const api = {
  config: () => request<PublicConfig>('config'),
  slots: (from: string, to: string, serviceId: number | null) =>
    request<Slot[]>(
      `slots?from=${from}&to=${to}` + (serviceId ? `&service_id=${serviceId}` : ''),
    ),
  book: (form: BookingForm) =>
    request<Booking>('bookings', { method: 'POST', body: JSON.stringify(form) }),
  myBookings: (telefon: string) =>
    request<Booking[]>(`bookings?telefon=${encodeURIComponent(telefon)}`),
  cancel: (ref: string, telefon: string) =>
    request<Booking>(`bookings/${encodeURIComponent(ref)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ telefon }),
    }),
}

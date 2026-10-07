// Numele afisat cand nici instalarea (SITE_NAME), nici Berlin Star nu dau altul.
// Singurul loc din site-ul public unde apare valoarea implicita.
export const DEFAULT_SITE_NAME = 'Vulcanizare Alex'

export const TIMEZONE = 'Europe/Bucharest'

type EnvConfig = { siteName?: string }

// Suprascrierea per instalare: nginx serveste `env.json` din variabila SITE_NAME.
// Lipsa fisierului (ex. in dev) nu e o eroare.
export async function loadEnvConfig(): Promise<EnvConfig> {
  try {
    const res = await fetch('env.json', { cache: 'no-store' })
    if (!res.ok) return {}
    const data = (await res.json()) as EnvConfig
    return { siteName: data.siteName?.trim() || undefined }
  } catch {
    return {}
  }
}

export function resolveSiteName(env?: string, api?: string): string {
  return env || api?.trim() || DEFAULT_SITE_NAME
}

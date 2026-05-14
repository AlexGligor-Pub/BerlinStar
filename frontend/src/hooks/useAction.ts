import { createSignal, type Accessor } from "solid-js";
import { parseApiError, readApiError } from "../utils/api";
import { notify } from "../store/notificationsStore";

export interface UseActionOptions<TArgs extends unknown[], TResult> {
  fn: (...args: TArgs) => Promise<TResult>;
  onSuccess?: (result: TResult, ...args: TArgs) => void;
  onError?: (err: string, raw: unknown) => void;
  successMessage?: string | ((result: TResult) => string);
  errorMessage?: string;
  silentError?: boolean;
}

export interface ActionApi<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult | undefined>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  reset: () => void;
}

export function useAction<TArgs extends unknown[], TResult>(
  options: UseActionOptions<TArgs, TResult>,
): ActionApi<TArgs, TResult> {
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function run(...args: TArgs): Promise<TResult | undefined> {
    setLoading(true);
    setError(null);
    try {
      const result = await options.fn(...args);
      if (options.successMessage) {
        const msg = typeof options.successMessage === "function"
          ? options.successMessage(result)
          : options.successMessage;
        notify(msg, "success");
      }
      options.onSuccess?.(result, ...args);
      return result;
    } catch (e: unknown) {
      let msg = options.errorMessage ?? "Eroare la operațiune.";
      if (e instanceof Response) {
        msg = await readApiError(e, msg);
      } else if (e instanceof Error) {
        msg = e.message || msg;
      } else {
        msg = parseApiError(e, msg);
      }
      setError(msg);
      if (!options.silentError) notify(msg, "error");
      options.onError?.(msg, e);
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  return { run, loading, error, reset: () => setError(null) };
}

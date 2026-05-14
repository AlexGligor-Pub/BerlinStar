import { createSignal, type Accessor } from "solid-js";

export type FormErrors<T> = Partial<Record<keyof T, string>>;

export interface FormApi<T extends Record<string, unknown>> {
  values: Accessor<T>;
  setValue: <K extends keyof T>(key: K, value: T[K]) => void;
  setValues: (patch: Partial<T>) => void;
  reset: (next?: T) => void;
  errors: Accessor<FormErrors<T>>;
  setError: <K extends keyof T>(key: K, message: string | null) => void;
  clearErrors: () => void;
  submit: (handler: (values: T) => void | Promise<void>) => (e?: Event) => Promise<void>;
  submitting: Accessor<boolean>;
}

export interface CreateFormOptions<T extends Record<string, unknown>> {
  initialValues: T;
  validate?: (values: T) => FormErrors<T>;
}

export function createForm<T extends Record<string, unknown>>(
  options: CreateFormOptions<T>,
): FormApi<T> {
  const [values, setValuesRaw] = createSignal<T>({ ...options.initialValues });
  const [errors, setErrorsRaw] = createSignal<FormErrors<T>>({});
  const [submitting, setSubmitting] = createSignal(false);

  function setValue<K extends keyof T>(key: K, value: T[K]): void {
    setValuesRaw((prev) => ({ ...prev, [key]: value }));
    setErrorsRaw((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function setValues(patch: Partial<T>): void {
    setValuesRaw((prev) => ({ ...prev, ...patch }));
  }

  function reset(next?: T): void {
    setValuesRaw(() => ({ ...(next ?? options.initialValues) }));
    setErrorsRaw({});
  }

  function setError<K extends keyof T>(key: K, message: string | null): void {
    setErrorsRaw((prev) => {
      const next = { ...prev };
      if (message === null) delete next[key];
      else next[key] = message;
      return next;
    });
  }

  function submit(handler: (values: T) => void | Promise<void>) {
    return async (e?: Event): Promise<void> => {
      e?.preventDefault();
      if (options.validate) {
        const ve = options.validate(values());
        setErrorsRaw(() => ve);
        if (Object.keys(ve).length > 0) return;
      }
      setSubmitting(true);
      try {
        await handler(values());
      } finally {
        setSubmitting(false);
      }
    };
  }

  return {
    values,
    setValue,
    setValues,
    reset,
    errors,
    setError,
    clearErrors: () => setErrorsRaw({}),
    submit,
    submitting,
  };
}

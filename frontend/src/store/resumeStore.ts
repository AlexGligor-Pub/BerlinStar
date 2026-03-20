import { createSignal } from "solid-js";
import type { CartItem } from "./cartStore";

interface ResumeData {
  titlu: string;
  descriere: string;
  dateTehn: string;
  items: CartItem[];
}

const [resumeData, setResumeData] = createSignal<ResumeData | null>(null);

export function setResume(data: ResumeData) {
  setResumeData(data);
}

export function consumeResume(): ResumeData | null {
  const d = resumeData();
  setResumeData(null);
  return d;
}

export { resumeData };

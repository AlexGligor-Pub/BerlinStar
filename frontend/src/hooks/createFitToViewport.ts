/**
 * Pagini cu antet fix și o listă care se derulează singură (Recepție, Hotel
 * anvelope): lista primește o înălțime în pixeli, exact cât a rămas de la ea
 * până la marginea de jos a ecranului.
 *
 * Nu se poate lăsa pe seama CSS-ului (`calc(100dvh - navbar)`): deasupra
 * navbar-ului apar și dispar bannere (abonament, conectivitate), iar pagina ar
 * depăși ecranul cu exact cât țin ele — și atunci s-ar derula tot documentul,
 * cu antet cu tot. Aici se măsoară, nu se presupune.
 *
 * Folosire: se apelează în componentă, cu accesori către elementele din `ref`;
 * pagina trebuie să aibă clasa `reception-page`, iar lista `reception-scroll`.
 */
import { onCleanup, onMount } from "solid-js";

export function createFitToViewport(opts: {
  /** Containerul derulabil al listei. */
  scroll: () => HTMLElement | undefined;
  /** Rădăcina paginii: când își schimbă mărimea (apare un sumar, un banner),
   *  poziția listei se mută și înălțimea trebuie refăcută. */
  page: () => HTMLElement | undefined;
  /** Spațiul lăsat sub listă, în pixeli. */
  bottomGap?: number;
  /** Apelat după fiecare redimensionare efectivă (ex. încărcare progresivă). */
  onFit?: () => void;
}): () => void {
  const gap = opts.bottomGap ?? 12;

  function fit() {
    const el = opts.scroll();
    if (!el) return;
    // `+ scrollY`: poziția față de document, ca măsurătoarea să nu depindă de
    // cât s-a derulat deja fereastra.
    const top = el.getBoundingClientRect().top + window.scrollY;
    const h = `${Math.max(200, Math.round(window.innerHeight - top - gap))}px`;
    // Fără verificare, scrierea ar redimensiona pagina și ar reporni
    // observatorul la nesfârșit.
    if (el.style.height !== h) {
      el.style.height = h;
      if (opts.onFit) requestAnimationFrame(opts.onFit);
    }
  }

  onMount(() => {
    fit();
    window.addEventListener("resize", fit);
    const ro = new ResizeObserver(() => fit());
    const page = opts.page();
    if (page) ro.observe(page);
    // Părintele (shell-ul aplicației) își schimbă mărimea când apare un banner.
    if (page?.parentElement) ro.observe(page.parentElement);
    onCleanup(() => {
      window.removeEventListener("resize", fit);
      ro.disconnect();
    });
  });

  return fit;
}

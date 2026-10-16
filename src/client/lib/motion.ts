const query = matchMedia("(prefers-reduced-motion: reduce)");

/** True when the visitor asked for reduced motion. Follows live changes. */
export const reducedMotion = () => query.matches;

/** Keeps the `reduced` class on <body> in sync for CSS. */
export function watchMotion(): void {
  const apply = () => document.body.classList.toggle("reduced", query.matches);
  query.addEventListener("change", apply);
  apply();
}

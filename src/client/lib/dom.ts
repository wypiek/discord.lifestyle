type Attrs = Record<string, string | number | boolean>;

/** Creates an element with attributes and children. `false` attributes are left off. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = String(v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false) el.setAttribute(k, String(v));
  }
  el.append(...children);
  return el;
}

/** 24x24 stroke icon from static SVG markup. */
export function icon(body: string): SVGSVGElement {
  const t = document.createElement("template");
  t.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  return t.content.firstElementChild as SVGSVGElement;
}

export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** The first element matching `selector`. Throws when there is none. */
export function find<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

export const findOptional = <T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
) => root.querySelector<T>(selector);

/** The element matching `selector` that the event happened in, if any */
export const eventTarget = <T extends Element = HTMLElement>(
  e: Event,
  selector: string,
) => (e.target instanceof Element ? e.target.closest<T>(selector) : null);

/** Value of a CSS variable on the root element */
export const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const setPressed = (buttons: Iterable<Element>, pressed: Element) => {
  for (const b of buttons)
    b.setAttribute("aria-pressed", String(b === pressed));
};

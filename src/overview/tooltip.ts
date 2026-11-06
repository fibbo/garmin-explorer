import { find } from "../dom";

/** Shows the tooltip next to the mouse, flipped to the other side near the window edge. */
export function showTooltip(e: MouseEvent, html: string) {
  const tip = find("#tip");
  tip.innerHTML = html;
  tip.style.display = "block";
  const size = tip.getBoundingClientRect();
  let x = e.clientX + 14,
    y = e.clientY + 14;
  if (x + size.width > innerWidth - 8) x = e.clientX - size.width - 14;
  if (y + size.height > innerHeight - 8) y = e.clientY - size.height - 14;
  tip.style.left = x + "px";
  tip.style.top = y + "px";
}

export function hideTooltip() {
  find("#tip").style.display = "none";
}

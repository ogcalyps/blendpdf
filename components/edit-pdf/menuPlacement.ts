/**
 * Where a toolbar dropdown goes, in viewport pixels for `position: fixed`.
 * Under its button with the start edges lined up (left in English, right in
 * Arabic); lined up on the end edges instead when that would run off screen
 * (the Insert menu at the end of the row, at 1280 px), clamped inside the
 * screen when neither fits; above the button when there's more room there
 * and it doesn't fit below. Pure, so it is tested without a browser.
 */
export interface MenuPlace {
  top: number;
  left: number;
  /** The menu scrolls past this. */
  maxHeight: number;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Between the button and its menu. */
export const MENU_GAP = 6;
/** Kept clear at the screen's edges. */
export const MENU_EDGE = 8;

export function placeMenu(
  trigger: Box,
  menu: { width: number; height: number },
  viewport: { width: number; height: number },
  rtl: boolean,
): MenuPlace {
  const width = Math.min(menu.width, viewport.width - 2 * MENU_EDGE);
  const startLeft = rtl ? trigger.right - width : trigger.left;
  const endLeft = rtl ? trigger.left : trigger.right - width;
  const fits = (left: number) => left >= MENU_EDGE && left + width <= viewport.width - MENU_EDGE;
  const left = fits(startLeft)
    ? startLeft
    : fits(endLeft)
      ? endLeft
      : Math.min(Math.max(MENU_EDGE, startLeft), viewport.width - MENU_EDGE - width);

  const below = viewport.height - MENU_EDGE - (trigger.bottom + MENU_GAP);
  const above = trigger.top - MENU_GAP - MENU_EDGE;
  if (menu.height <= below || below >= above) {
    return { top: trigger.bottom + MENU_GAP, left, maxHeight: Math.max(0, below) };
  }
  return { top: Math.max(MENU_EDGE, trigger.top - MENU_GAP - menu.height), left, maxHeight: above };
}

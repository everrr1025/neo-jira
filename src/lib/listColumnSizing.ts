export const DISPLAY_LIST_COLUMN_MIN_WIDTH = 80;

export const LIST_ACTION_BUTTON_SIZE = 24;
export const LIST_ACTION_BUTTON_GAP = 8;
export const LIST_ACTION_COLUMN_PADDING_X = 16;

export function getListActionColumnWidth(buttonCount: number) {
  if (buttonCount === 0) return 0;
  return LIST_ACTION_COLUMN_PADDING_X * 2
    + LIST_ACTION_BUTTON_SIZE * buttonCount
    + LIST_ACTION_BUTTON_GAP * (buttonCount - 1);
}

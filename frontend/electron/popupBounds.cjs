// All Electron window/display bounds use device-independent pixels.
const DEFAULT_POPUP_SIZE = Object.freeze({ width: 360, height: 420 });
const MIN_POPUP_SIZE = Object.freeze({ width: 300, height: 340 });
const MAX_POPUP_SIZE = Object.freeze({ width: 1600, height: 1200 });
const RESIZE_EDGES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

function normalizePopupSize(size) {
  if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height)) return { ...DEFAULT_POPUP_SIZE };
  return {
    width: Math.max(MIN_POPUP_SIZE.width, Math.min(MAX_POPUP_SIZE.width, Math.round(size.width))),
    height: Math.max(MIN_POPUP_SIZE.height, Math.min(MAX_POPUP_SIZE.height, Math.round(size.height))),
  };
}

function fitPopupSize(size, workArea) {
  const preferred = normalizePopupSize(size);
  return { width: Math.min(preferred.width, workArea.width), height: Math.min(preferred.height, workArea.height) };
}

function getPopupBounds(pet, workArea, size = DEFAULT_POPUP_SIZE) {
  const gap = 8;
  const { width, height } = fitPopupSize(size, workArea);
  const right = workArea.x + workArea.width;
  const bottom = workArea.y + workArea.height;
  const clampX = (x) => Math.max(workArea.x, Math.min(x, right - width));
  const clampY = (y) => Math.max(workArea.y, Math.min(y, bottom - height));
  const centerY = pet.y + (pet.height - height) / 2;
  const centerX = pet.x + (pet.width - width) / 2;

  let x;
  let y;
  if (pet.x + pet.width + gap + width <= right) {
    x = pet.x + pet.width + gap;
    y = centerY;
  } else if (pet.x - gap - width >= workArea.x) {
    x = pet.x - gap - width;
    y = centerY;
  } else if (pet.y + pet.height + gap + height <= bottom) {
    x = centerX;
    y = pet.y + pet.height + gap;
  } else if (pet.y - gap - height >= workArea.y) {
    x = centerX;
    y = pet.y - gap - height;
  } else {
    // On small displays, keep the popup inside the screen with minimum overlap.
    const candidates = [
      { x: pet.x + pet.width + gap, y: centerY },
      { x: pet.x - gap - width, y: centerY },
      { x: centerX, y: pet.y + pet.height + gap },
      { x: centerX, y: pet.y - gap - height },
    ].map(point => ({ x: clampX(point.x), y: clampY(point.y) }));
    const overlap = point =>
      Math.max(0, Math.min(point.x + width, pet.x + pet.width) - Math.max(point.x, pet.x)) *
      Math.max(0, Math.min(point.y + height, pet.y + pet.height) - Math.max(point.y, pet.y));
    candidates.sort((a, b) => overlap(a) - overlap(b));
    ({ x, y } = candidates[0]);
  }
  return { x: Math.round(clampX(x)), y: Math.round(clampY(y)), width, height };
}

function getDetachedPopupBounds(position, workArea, size = DEFAULT_POPUP_SIZE) {
  const { width, height } = fitPopupSize(size, workArea);
  return {
    x: Math.round(Math.max(workArea.x, Math.min(position.x, workArea.x + workArea.width - width))),
    y: Math.round(Math.max(workArea.y, Math.min(position.y, workArea.y + workArea.height - height))),
    width,
    height,
  };
}

// Preserve the opposite edge for each resize direction. Clamp the dragged
// edge to the current display, with a smaller minimum only on tiny screens.
function resizePopupBounds(initial, edge, dx, dy, workArea) {
  if (!RESIZE_EDGES.includes(edge) || !Number.isFinite(dx) || !Number.isFinite(dy)) return initial;
  const base = getDetachedPopupBounds(initial, workArea, initial);
  let left = base.x, top = base.y, right = base.x + base.width, bottom = base.y + base.height;
  const clamp = (value, minimum, maximum) => Math.round(Math.max(minimum, Math.min(value, maximum)));
  const minWidth = Math.min(MIN_POPUP_SIZE.width, workArea.width);
  const minHeight = Math.min(MIN_POPUP_SIZE.height, workArea.height);
  if (edge.includes('w')) {
    left = clamp(left + dx, Math.max(workArea.x, right - MAX_POPUP_SIZE.width), right - minWidth);
  } else if (edge.includes('e')) {
    right = clamp(right + dx, left + minWidth, Math.min(workArea.x + workArea.width, left + MAX_POPUP_SIZE.width));
  }
  if (edge.includes('n')) {
    top = clamp(top + dy, Math.max(workArea.y, bottom - MAX_POPUP_SIZE.height), bottom - minHeight);
  } else if (edge.includes('s')) {
    bottom = clamp(bottom + dy, top + minHeight, Math.min(workArea.y + workArea.height, top + MAX_POPUP_SIZE.height));
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

module.exports = { DEFAULT_POPUP_SIZE, MIN_POPUP_SIZE, MAX_POPUP_SIZE, RESIZE_EDGES,
  normalizePopupSize, getPopupBounds, getDetachedPopupBounds, resizePopupBounds };

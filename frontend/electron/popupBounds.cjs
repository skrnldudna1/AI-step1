// All Electron window/display bounds use device-independent pixels.
function getPopupBounds(pet, workArea) {
  const gap = 8;
  const width = Math.min(360, workArea.width);
  const height = Math.min(420, workArea.height);
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

function getDetachedPopupBounds(position, workArea) {
  const width = Math.min(360, workArea.width);
  const height = Math.min(420, workArea.height);
  return {
    x: Math.round(Math.max(workArea.x, Math.min(position.x, workArea.x + workArea.width - width))),
    y: Math.round(Math.max(workArea.y, Math.min(position.y, workArea.y + workArea.height - height))),
    width,
    height,
  };
}

module.exports = { getPopupBounds, getDetachedPopupBounds };

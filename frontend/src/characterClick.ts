interface Point {
  x: number;
  y: number;
}

// Wait briefly before committing a single click so a double click never
// flashes the mini chat open and then immediately switches windows.
export function createCharacterClickHandler({
  onSingle,
  onDouble,
  delay = 350,
  tolerance = 14,
}: {
  onSingle: () => void;
  onDouble: () => void;
  delay?: number;
  tolerance?: number;
}) {
  let pending: { point: Point; timer: ReturnType<typeof setTimeout> } | null = null;

  const cancel = () => {
    if (pending) clearTimeout(pending.timer);
    pending = null;
  };

  function click(point: Point) {
    if (pending) {
      const distance = Math.hypot(point.x - pending.point.x, point.y - pending.point.y);
      cancel();
      if (distance <= tolerance) {
        onDouble();
        return;
      }
      onSingle();
    }
    const timer = setTimeout(() => {
      pending = null;
      onSingle();
    }, delay);
    pending = { point, timer };
  }

  return { click, cancel };
}

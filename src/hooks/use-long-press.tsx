import { useCallback, useRef, useState, MouseEvent, TouchEvent } from "react";

interface LongPressOptions {
  shouldPreventDefault?: boolean;
  delay?: number;
}

type LongPressEvent = MouseEvent | TouchEvent;

export const useLongPress = (
  onLongPress: (e: LongPressEvent) => void,
  onClick: () => void,
  { shouldPreventDefault = true, delay = 300 }: LongPressOptions = {}
) => {
  const [longPressTriggered, setLongPressTriggered] = useState<boolean>(false);
  const [longPressCancelled, setLongPressCancelled] = useState<boolean>(false);
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const target = useRef<EventTarget | null>(null);
  const [touchOnly, setTouchOnly] = useState<boolean>(false);

  const start = useCallback(
    (event: LongPressEvent) => {
      if (shouldPreventDefault && event.target) {
        event.target.addEventListener("touchend", preventDefault, {
          passive: false,
        });
        target.current = event.target;
      }

      if (isTouchEvent(event)) {
        setTouchOnly(true);
      }

      setLongPressCancelled(false);
      setLongPressTriggered(false);
      timeout.current = setTimeout(() => {
        onLongPress(event);
        setLongPressTriggered(true);
      }, delay);
    },
    [
      onLongPress,
      delay,
      shouldPreventDefault,
      setLongPressCancelled,
      setLongPressCancelled,
      setTouchOnly,
    ]
  );

  const clear = useCallback(
    ({
      event,
      shouldTriggerClick = true,
      shouldCancelLongPress = false,
    }: {
      event: MouseEvent | TouchEvent;
      shouldTriggerClick?: boolean;
      shouldCancelLongPress?: boolean;
    }) => {
      if (!isTouchEvent(event) && touchOnly) {
        return;
      }

      if (shouldCancelLongPress) {
        setLongPressCancelled(true);
      }

      timeout.current && clearTimeout(timeout.current);

      if (shouldTriggerClick && !longPressTriggered && !longPressCancelled) {
        console.log("clicked");
        onClick();
      }

      if (shouldPreventDefault && target.current) {
        target.current.removeEventListener("touchend", preventDefault);
      }
    },
    [
      shouldPreventDefault,
      onClick,
      longPressTriggered,
      longPressCancelled,
      touchOnly,
    ]
  );

  return {
    onMouseDown: (e: MouseEvent) => start(e),
    onTouchStart: (e: TouchEvent) => start(e),
    onMouseUp: (e: MouseEvent) => clear({ event: e, shouldTriggerClick: true }),
    onMouseLeave: (e: MouseEvent) =>
      clear({
        event: e,
        shouldTriggerClick: false,
        shouldCancelLongPress: true,
      }),
    onTouchEnd: (e: TouchEvent) =>
      clear({ event: e, shouldTriggerClick: true }),
    onMouseMove: (e: MouseEvent) =>
      clear({
        event: e,
        shouldTriggerClick: false,
        shouldCancelLongPress: true,
      }),
    onTouchMove: (e: TouchEvent) =>
      clear({
        event: e,
        shouldTriggerClick: false,
        shouldCancelLongPress: true,
      }),
  };
};

const isTouchEvent = (event: any): event is TouchEvent => {
  return "touches" in event;
};

const preventDefault = (event: Event): void => {
  if (!isTouchEvent(event)) return;

  if (event.touches.length < 2 && event.preventDefault) {
    event.preventDefault();
  }
};

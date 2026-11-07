import React, { useCallback, useEffect, useRef } from 'react';
import {
  findNodeHandle,
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  type ScrollViewProps,
  type ScrollViewInstance,
} from 'react-native';

/** Scrolls a focused form control into view after the native keyboard opens. */
export default function KeyboardAwareJournalScrollView(props: ScrollViewProps) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const focusedHandle = useRef<number | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToInput = useCallback(() => {
    const focused = TextInput.State.currentlyFocusedInput();
    const target = focusedHandle.current ?? (focused ? findNodeHandle(focused) : null);
    if (target == null) return;
    scrollRef.current?.getScrollResponder()?.scrollResponderScrollNativeHandleToKeyboard(
      target,
      100,
      true
    );
  }, []);

  const scheduleScroll = useCallback((delay: number) => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      scrollToInput();
    }, delay);
  }, [scrollToInput]);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      scheduleScroll(50);
    });
    return () => {
      subscription.remove();
      if (pending.current) clearTimeout(pending.current);
    };
  }, [scheduleScroll]);

  return (
    <ScrollView
      {...props}
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      contentContainerStyle={[props.contentContainerStyle, { paddingBottom: 120 }]}
      onFocusCapture={(event) => {
        const target = event.nativeEvent.target;
        if (typeof target === 'number') focusedHandle.current = target;
        else focusedHandle.current = findNodeHandle(event.target) ?? null;
        scheduleScroll(Platform.OS === 'android' ? 300 : 120);
        props.onFocusCapture?.(event);
      }}
    />
  );
}

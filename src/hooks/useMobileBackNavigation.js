import { useEffect, useRef } from 'react';
import {
  pushAppHistoryState,
  registerBackHandler,
  runBackHandlers,
} from '../utils/backNavigation';

/**
 * Android / PWA hardware back: sub-screens → main, main → confirm exit.
 * @param {{
 *   isAtRoot: () => boolean,
 *   onReturnToMain: () => void,
 *   exitMessage?: string,
 * }} options
 */
export function useMobileBackNavigation({
  isAtRoot,
  onReturnToMain,
  exitMessage = 'Leave the Lawn Pack Companion?',
}) {
  const isAtRootRef = useRef(isAtRoot);
  const onReturnToMainRef = useRef(onReturnToMain);

  useEffect(() => {
    isAtRootRef.current = isAtRoot;
    onReturnToMainRef.current = onReturnToMain;
  }, [isAtRoot, onReturnToMain]);

  useEffect(() => {
    pushAppHistoryState({ trap: 'root' });

    const onPopState = () => {
      if (runBackHandlers()) {
        pushAppHistoryState({ trap: 'handled' });
        return;
      }

      if (!isAtRootRef.current()) {
        onReturnToMainRef.current();
        pushAppHistoryState({ trap: 'main' });
        return;
      }

      if (window.confirm(exitMessage)) {
        window.history.back();
        return;
      }

      pushAppHistoryState({ trap: 'root' });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [exitMessage]);
}

/**
 * @param {() => boolean} handler Return true when this layer consumed the back press.
 * @param {boolean} enabled
 */
export function useRegisterBackHandler(handler, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return undefined;

    return registerBackHandler(() => handlerRef.current());
  }, [enabled]);
}

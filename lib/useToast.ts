import { useCallback, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

const DEFAULT_DURATION_MS = 2000;

export function useToast() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('success');
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION_MS);

  const show = useCallback(
    (msg: string, t: ToastType = 'success', d?: number) => {
      setMessage(msg);
      setType(t);
      setDuration(d ?? DEFAULT_DURATION_MS);
      setVisible(true);
    },
    [],
  );

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  return { visible, message, type, duration, show, hide };
}

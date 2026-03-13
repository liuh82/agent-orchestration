/**
 * 防抖工具函数 - 防止快速重复点击
 */

export interface DebouncedFn<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  pending: () => boolean;
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 1000
): DebouncedFn<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) {
      return; // 正在防抖中，忽略
    }

    fn(...args);

    // 重置防抖状态
    timeoutId = setTimeout(() => {
      timeoutId = null;
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  debounced.pending = () => timeoutId !== null;

  return debounced as DebouncedFn<T>;
}

/**
 * 异步防抖 - 等待异步操作完成
 */
export function asyncDebounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number = 1000
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  let pending = false;
  let lastCall: Promise<ReturnType<T>> | undefined = undefined;

  return async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
    if (pending) {
      return lastCall;
    }

    pending = true;
    lastCall = fn(...args);

    try {
      const result = await lastCall;
      return result;
    } finally {
      // 延迟重置状态
      setTimeout(() => {
        pending = false;
      }, delay);
    }
  };
}

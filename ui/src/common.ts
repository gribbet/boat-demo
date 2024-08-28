export const delay = (timeout = 0) =>
  new Promise<void>(resolve => setTimeout(resolve, timeout));

export const signal = <T = void>() => {
  let onTrigger: ((value: T) => void) | undefined;
  const signal = new Promise<T>(resolve => {
    onTrigger = resolve;
  });
  const trigger = (value: T) => onTrigger?.(value);
  return [signal, trigger] as const;
};

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

const ViewSettingsContext = createContext<Map<string, unknown> | null>(null);

// タブ切替でビューがアンマウントされても設定値を保持するためのストア。
// タブ切替をまたいで生存するコンポーネント(Home)に置くこと。
export function ViewSettingsProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<Map<string, unknown> | null>(null);
  storeRef.current ??= new Map();
  return (
    <ViewSettingsContext.Provider value={storeRef.current}>{children}</ViewSettingsContext.Provider>
  );
}

// useState 互換。Provider 配下ではアンマウント後の再マウントで直前の値を復元する。
// Provider が無い場合(単体テスト等)は通常の useState と同じ振る舞いになる。
export function useViewSetting<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const store = useContext(ViewSettingsContext);
  const [value, setValue] = useState<T>(() => {
    if (store?.has(key)) return store.get(key) as T;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      setValue((prev) => {
        const next = typeof action === "function" ? (action as (prev: T) => T)(prev) : action;
        store?.set(key, next);
        return next;
      });
    },
    [store, key],
  );
  return [value, set];
}

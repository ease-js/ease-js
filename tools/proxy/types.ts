export type ProxyRevocableReturnType<T> = { proxy: T; revoke: () => void };

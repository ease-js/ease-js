export type Awaitable<T> = T extends Promise<unknown> ? T : (T | Promise<T>);

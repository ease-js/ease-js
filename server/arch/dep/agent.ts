import { type DepHost } from "./host.ts";

export interface DepAgentInit<Host extends DepHost> {
  readonly host: Host;
}

export declare class DepAgent<Host extends DepHost> {
  readonly #host: Host;

  constructor(init: DepAgentInit<Host>);
}

// deno-lint-ignore no-explicit-any
export type DepHostOfAgent<Agent extends DepAgent<any>> = Agent extends
  DepAgent<infer Host> ? Host : never;

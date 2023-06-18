import { DepAgent, type DepAgentInit } from "../../arch/dependency.ts";
import { type SessionHost } from "./host.ts";

// deno-lint-ignore no-empty-interface
export interface SessionAgentInit extends DepAgentInit<SessionHost> {}

export declare class SessionAgent extends DepAgent<SessionHost> {
  constructor(init: SessionAgentInit);
}

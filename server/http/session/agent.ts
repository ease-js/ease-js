import { DepAgent, type DepAgentInit } from "../../arch/dep.ts";
import { type SessionHost } from "./host.ts";

export type SessionAgentInit = DepAgentInit<SessionHost>;

export declare class SessionAgent extends DepAgent<SessionHost> {
  constructor(init: SessionAgentInit);
}

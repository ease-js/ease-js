import { DepAgent, type DepAgentInit } from "../../arch/dep.ts";
import { type ServiceHost } from "./host.ts";

// deno-lint-ignore no-empty-interface
export interface ServiceAgentInit extends DepAgentInit<ServiceHost> {}

export declare class ServiceAgent extends DepAgent<ServiceHost> {
  constructor(init: ServiceAgentInit);
}

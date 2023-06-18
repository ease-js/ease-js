import { DepAgent, type DepAgentInit } from "../../arch/dep.ts";
import { type ServiceHost } from "./host.ts";

export type ServiceAgentInit = DepAgentInit<ServiceHost>;

export declare class ServiceAgent extends DepAgent<ServiceHost> {
  constructor(init: ServiceAgentInit);
}

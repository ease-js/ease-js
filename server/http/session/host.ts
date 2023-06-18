import { type ServiceHost } from "../../app/service/host.ts";
import { DepHost } from "../../arch/dep.ts";

export interface SessionHostInit {
  readonly serviceHost: ServiceHost;
}

export declare class SessionHost extends DepHost {
  constructor(init: SessionHostInit);
}

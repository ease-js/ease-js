import { DepAgent } from "./agent.ts";
import { type DepGraph } from "./graph.ts";

export interface DepHostInit {
  readonly graph: DepGraph;
  readonly parent?: DepHost;
}

export class DepHost {
  readonly #graph: DepGraph;
  readonly #parent: DepHost | undefined;

  constructor(init: DepHostInit) {
    this.#graph = init.graph;
    this.#parent = init.parent;
  }

  createAgent(): DepAgent<this> {
    return new DepAgent({ host: this });
  }
}

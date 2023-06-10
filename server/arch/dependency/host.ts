export interface DepHostInit {
  readonly parent?: DepHost;
}

export declare class DepHost {
  readonly #parent: DepHost | undefined;

  constructor(init: DepHostInit);
}

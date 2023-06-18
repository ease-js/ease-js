// deno-lint-ignore-file no-explicit-any
import { type Awaitable } from "../../../tools/promise/types.ts";
import { type DepAgent, type DepHostOfAgent } from "./agent.ts";
import { type DepHost } from "./host.ts";

interface ClassDecoratorContext<_> {
  readonly kind: "class";
}

interface FunctionDecoratorContext<_> {
  readonly kind: "function";
}

export interface CallableDepDef<
  Agent extends DepAgent<any>,
  ImportMap extends DepImportTokenMap,
  Export,
> extends DepMeta<DepHostOfAgent<Agent>, ImportMap> {
  readonly kind: "callable";
  readonly impl: CallableDepImpl<Agent, ResolvedDepImport<ImportMap>, Export>;
}

export type CallableDepImpl<
  Agent extends DepAgent<any>,
  Import extends DepImport,
  Export,
> = (imports: Import, agent: Agent) => Awaitable<Export>;

export type DepDef<
  Agent extends DepAgent<any>,
  ImportMap extends DepImportTokenMap,
  Export,
> =
  | CallableDepDef<Agent, ImportMap, Export>
  | NewableDepDef<Agent, ImportMap, Export>;

export type DepImpl<
  Agent extends DepAgent<any>,
  Import extends DepImport,
  Export,
> =
  | CallableDepImpl<Agent, Import, Export>
  | NewableDepImpl<Agent, Import, Export>;

export type DepImport = {
  readonly [Alias: string | symbol]: any;
};

export type DepImportToken<
  Agent extends DepAgent<any>,
  ImportMap extends DepImportTokenMap,
  Export,
> =
  | DepDef<Agent, ImportMap, Export>
  | DepImpl<Agent, ResolvedDepImport<ImportMap>, Export>;

export interface DepImportTokenLoadableSource<
  Token extends DepImportToken<any, any, any>,
> {
  readonly kind: "loadable";
  readonly impl: () => Awaitable<Token>;
}

export type DepImportTokenMap = {
  readonly [Alias: string | symbol]: DepImportTokenSource<any, any, any>;
};

export type DepImportTokenSource<
  Agent extends DepAgent<any>,
  ImportMap extends DepImportTokenMap,
  Export,
> =
  | DepImportToken<Agent, ImportMap, Export>
  | DepImportTokenLoadableSource<DepImportToken<Agent, ImportMap, Export>>;

export interface DepMeta<
  Host extends DepHost,
  ImportMap extends DepImportTokenMap,
> {
  readonly host: new (...params: any) => Host;
  readonly import: ImportMap;
  readonly kind: "callable" | "newable";
}

export interface NewableDepDef<
  Agent extends DepAgent<any>,
  ImportMap extends DepImportTokenMap,
  Export,
> extends DepMeta<DepHostOfAgent<Agent>, ImportMap> {
  readonly kind: "newable";
  readonly impl: NewableDepImpl<Agent, ImportMap, Export>;
}

export type NewableDepImpl<
  Agent extends DepAgent<any>,
  Import extends DepImport,
  Export,
> = new (imports: Import, agent: Agent) => Export;

export type ResolvedDepImport<ImportMap extends DepImportTokenMap> = {
  readonly [Alias in keyof ImportMap]: ImportMap[Alias] extends
    DepImportTokenSource<infer _1, infer _2, infer Export> ? Export : never;
};

export abstract class DepChain<
  Agent extends DepAgent<any>,
  ImportMap extends DepImportTokenMap,
> {
  readonly #metaInit: Omit<DepMeta<DepHostOfAgent<Agent>, ImportMap>, "kind">;

  constructor(
    host: new (...params: any) => DepHostOfAgent<Agent>,
    importMap: ImportMap,
  ) {
    this.#metaInit = { host, import: importMap };
  }

  decorate<
    const T extends CallableDepImpl<Agent, ResolvedDepImport<ImportMap>, any>,
  >(impl: T, context: FunctionDecoratorContext<T>): void;
  decorate<
    const T extends NewableDepImpl<Agent, ResolvedDepImport<ImportMap>, any>,
  >(impl: T, context: ClassDecoratorContext<T>): void;
  decorate(
    impl: DepImpl<Agent, any, any>,
    context:
      | ClassDecoratorContext<NewableDepImpl<Agent, any, any>>
      | FunctionDecoratorContext<CallableDepImpl<Agent, any, any>>,
  ): void {
    const meta = Object.freeze<DepMeta<DepHostOfAgent<Agent>, ImportMap>>({
      ...this.#metaInit,
      kind: context.kind === "class" ? "newable" : "callable",
    });
    Reflect.defineProperty(impl, "dep_meta", { value: meta });
  }

  // decorator(): DepChainDecorator<this> {
  //   return new Proxy(this.decorate, {}) as DepChainDecorator<this>;
  // }
}

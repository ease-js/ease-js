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
  readonly [Key in keyof ImportMap]: ImportMap[Key] extends
    DepImportTokenSource<infer _1, infer _2, infer Export> ? Export : never;
};

export type TokenSourceOfDepImport<Import extends DepImport> = {
  readonly [Key in keyof Import]: DepImportTokenSource<any, any, Import[Key]>;
};

export abstract class DepChain<
  Agent extends DepAgent<any>,
  ImportMap extends DepImportTokenMap,
> {
  // static resolveToken<
  //   Agent extends DepAgent<any>,
  //   ImportMap extends DepImportTokenMap,
  //   Export,
  // >(
  //   def: DepImportToken<Agent, ImportMap, Export>,
  // ): DepDef<Agent, ImportMap, Export> {
  //   if (typeof def === "object") return def;
  //   Object.hasOwn(def, "dep_def");
  //   return (def as any).dep_def;
  // }

  readonly #meta: DepMeta<DepHostOfAgent<Agent>, ImportMap>;

  constructor(
    host: new (...params: any) => DepHostOfAgent<Agent>,
    importMap: ImportMap,
  ) {
    this.#meta = { host, import: importMap };
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
    const def = Object.freeze({
      ...this.#meta,
      kind: context.kind === "class" ? "newable" : "callable",
      impl,
    });
    Reflect.defineProperty(impl, "dep_def", { value: def });
  }

  // decorator(): DepChainDecorator<this> {
  //   return new Proxy(this.decorate, {}) as DepChainDecorator<this>;
  // }
}

// export class CallableDepDef {}

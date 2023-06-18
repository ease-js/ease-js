// deno-lint-ignore-file no-explicit-any
import { type Awaitable } from "../../../tools/promise/types.ts";
import { type DepAgent, type DepHostOfAgent } from "./agent.ts";

export interface CallableDepDef<
  Agent extends DepAgent<any>,
  ImportMap extends DepImportTokenMap,
  Export,
> extends DepMeta<Agent, ImportMap> {
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

export type DepImport = {
  readonly [Alias: string | symbol]: any;
};

export type DepImportToken<
  Agent extends DepAgent<any>,
  ImportMap extends DepImportTokenMap,
  Export,
> =
  | DepDef<Agent, ImportMap, Export>
  | NewableDepImpl<Agent, ImportMap, Export>;

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
  Agent extends DepAgent<any>,
  ImportMap extends DepImportTokenMap,
> {
  readonly host: new (...params: any[]) => DepHostOfAgent<Agent>;
  readonly import: ImportMap;
}

export interface NewableDepDef<
  Agent extends DepAgent<any>,
  ImportMap extends DepImportTokenMap,
  Export,
> extends DepMeta<Agent, ImportMap> {
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

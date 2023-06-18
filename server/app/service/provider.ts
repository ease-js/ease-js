// deno-lint-ignore-file no-empty-interface, no-explicit-any
import { type Awaitable } from "../../../tools/promise/types.ts";
import {
  type CallableDepDef,
  type CallableDepImpl,
  type DepImport,
  type DepMeta,
  type NewableDepDef,
  type NewableDepImpl,
} from "../../arch/dep.ts";
import { type ServiceAgent } from "./agent.ts";

export interface CallableServiceDef<
  ImportMap extends ServiceImportTokenMap,
  Export,
> extends CallableDepDef<ServiceAgent, ImportMap, Export> {}

export type CallableServiceImpl<
  Import extends ServiceImport,
  Export,
> = CallableDepImpl<ServiceAgent, Import, Export>;

export interface NewableServiceDef<
  ImportMap extends ServiceImportTokenMap,
  Export,
> extends NewableDepDef<ServiceAgent, ImportMap, Export> {}

export type NewableServiceImpl<
  Import extends ServiceImport,
  Export,
> = NewableDepImpl<ServiceAgent, Import, Export>;

export type ServiceDef<
  ImportMap extends ServiceImportTokenMap,
  Export,
> =
  | CallableServiceDef<ImportMap, Export>
  | NewableServiceDef<ImportMap, Export>;

export type ServiceImport = DepImport;

export type ServiceImportToken<
  ImportMap extends ServiceImportTokenMap,
  Export,
> =
  | ServiceDef<ImportMap, Export>
  | NewableServiceImpl<ImportMap, Export>;

export type ServiceImportTokenMap = {
  readonly [Alias: string | symbol]: ServiceImportTokenSource<any, any>;
};

export type ServiceImportTokenSource<
  ImportMap extends ServiceImportTokenMap,
  Export,
> =
  | ServiceImportToken<ImportMap, Export>
  | (() => Awaitable<ServiceImportToken<ImportMap, Export>>);

export type ServiceMeta<
  ImportMap extends ServiceImportTokenMap,
> = DepMeta<ServiceAgent, ImportMap>;

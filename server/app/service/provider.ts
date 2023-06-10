import { type Awaitable } from "../../../tools/promise/types.ts";
import {
  type CallableDepDef,
  type CallableDepImpl,
  type DepImport,
  type DepMeta,
  type NewableDepDef,
  type NewableDepImpl,
} from "../../arch/dependency.ts";
import { type ServiceHost } from "./host.ts";

export interface CallableServiceDef<
  ImportMap extends ServiceImportTokenMap,
  Export,
> extends CallableDepDef<ServiceHost, ImportMap, Export> {
  readonly as: "service";
}

export type CallableServiceImpl<
  Import extends ServiceImport,
  Export,
> = CallableDepImpl<ServiceHost, Import, Export>;

export interface NewableServiceDef<
  ImportMap extends ServiceImportTokenMap,
  Export,
> extends NewableDepDef<ServiceHost, ImportMap, Export> {
  readonly as: "service";
}

export type NewableServiceImpl<
  Import extends ServiceImport,
  Export,
> = NewableDepImpl<ServiceHost, Import, Export>;

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
  | NewableServiceImpl<ImportMap, Export>
  | (() => Awaitable<
    | ServiceDef<ImportMap, Export>
    | NewableServiceImpl<ImportMap, Export>
  >);

export type ServiceImportTokenMap = {
  // deno-lint-ignore no-explicit-any
  readonly [Alias: string | symbol]: ServiceImportToken<any, any>;
};

export type ServiceMeta<
  ImportMap extends ServiceImportTokenMap,
> = DepMeta<ImportMap>;

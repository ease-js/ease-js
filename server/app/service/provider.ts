// deno-lint-ignore-file no-explicit-any
import {
  type CallableDepDef,
  type CallableDepImpl,
  DepChain,
  type DepImport,
  type DepImportTokenLoadableSource,
  type DepMeta,
  type NewableDepDef,
  type NewableDepImpl,
  type ResolvedDepImport,
} from "../../arch/dep.ts";
import { type ServiceAgent } from "./agent.ts";
import { ServiceHost } from "./host.ts";

export type CallableServiceDef<
  ImportMap extends ServiceImportTokenMap,
  Export,
> = CallableDepDef<ServiceAgent, ImportMap, Export>;

export type CallableServiceImpl<
  Import extends ServiceImport,
  Export,
> = CallableDepImpl<ServiceAgent, Import, Export>;

export type NewableServiceDef<
  ImportMap extends ServiceImportTokenMap,
  Export,
> = NewableDepDef<ServiceAgent, ImportMap, Export>;

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

export type ServiceImpl<
  Import extends ServiceImport,
  Export,
> =
  | CallableServiceImpl<Import, Export>
  | NewableServiceImpl<Import, Export>;

export type ServiceImport = DepImport;

export type ServiceImportToken<
  ImportMap extends ServiceImportTokenMap,
  Export,
> =
  | ServiceDef<ImportMap, Export>
  | ServiceImpl<ResolvedDepImport<ImportMap>, Export>;

export type ServiceImportTokenMap = {
  readonly [Alias: string | symbol]: ServiceImportTokenSource<any, any>;
};

export type ServiceImportTokenSource<
  ImportMap extends ServiceImportTokenMap,
  Export,
> =
  | ServiceImportToken<ImportMap, Export>
  | DepImportTokenLoadableSource<ServiceImportToken<ImportMap, Export>>;

export type ServiceMeta<
  ImportMap extends ServiceImportTokenMap,
> = DepMeta<ServiceHost, ImportMap>;

export class ServiceChain<const ImportMap extends ServiceImportTokenMap>
  extends DepChain<ServiceAgent, ImportMap> {
  constructor(importMap: ImportMap) {
    super(ServiceHost, importMap);
  }
}

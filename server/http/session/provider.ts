// deno-lint-ignore-file no-explicit-any
import {
  type CallableDepDef,
  type CallableDepImpl,
  type DepImport,
  type DepImportTokenLoadableSource,
  type DepMeta,
  type NewableDepDef,
  type NewableDepImpl,
} from "../../arch/dep.ts";
import { type ServiceImportToken } from "../../app/service/provider.ts";
import { type SessionAgent } from "./agent.ts";

export type CallableSessionDef<
  ImportMap extends SessionImportTokenMap,
  Export,
> = CallableDepDef<SessionAgent, ImportMap, Export>;

export type CallableSessionImpl<
  Import extends SessionImport,
  Export,
> = CallableDepImpl<SessionAgent, Import, Export>;

export type NewableSessionDef<
  ImportMap extends SessionImportTokenMap,
  Export,
> = NewableDepDef<SessionAgent, ImportMap, Export>;

export type NewableSessionImpl<
  Import extends SessionImport,
  Export,
> = NewableDepImpl<SessionAgent, Import, Export>;

export type SessionDef<
  ImportMap extends SessionImportTokenMap,
  Export,
> =
  | CallableSessionDef<ImportMap, Export>
  | NewableSessionDef<ImportMap, Export>;

export type SessionImport = DepImport;

export type SessionImportToken<
  ImportMap extends SessionImportTokenMap,
  Export,
> =
  | ServiceImportToken<ImportMap, Export>
  | SessionDef<ImportMap, Export>
  | NewableSessionImpl<ImportMap, Export>;

export type SessionImportTokenMap = {
  readonly [Alias: string | symbol]: SessionImportTokenSource<any, any>;
};

export type SessionImportTokenSource<
  ImportMap extends SessionImportTokenMap,
  Export,
> =
  | SessionImportToken<ImportMap, Export>
  | DepImportTokenLoadableSource<SessionImportToken<ImportMap, Export>>;

export type SessionMeta<
  ImportMap extends SessionImportTokenMap,
> = DepMeta<SessionAgent, ImportMap>;

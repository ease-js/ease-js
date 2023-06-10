import { type Awaitable } from "../../../tools/promise/types.ts";
import {
  type CallableDepDef,
  type CallableDepImpl,
  type DepImport,
  type DepMeta,
  type NewableDepDef,
  type NewableDepImpl,
} from "../../arch/dependency.ts";
import { ServiceImportToken } from "../service/provider.ts";
import { type SessionHost } from "./host.ts";

export interface CallableSessionDef<
  ImportMap extends SessionImportTokenMap,
  Export,
> extends CallableDepDef<SessionHost, ImportMap, Export> {
  readonly as: "session";
}

export type CallableSessionImpl<
  Import extends SessionImport,
  Export,
> = CallableDepImpl<SessionHost, Import, Export>;

export interface NewableSessionDef<
  ImportMap extends SessionImportTokenMap,
  Export,
> extends NewableDepDef<SessionHost, ImportMap, Export> {
  readonly as: "session";
}

export type NewableSessionImpl<
  Import extends SessionImport,
  Export,
> = NewableDepImpl<SessionHost, Import, Export>;

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
  | SessionDef<ImportMap, Export>
  | NewableSessionImpl<ImportMap, Export>
  | (() => Awaitable<
    | SessionDef<ImportMap, Export>
    | NewableSessionImpl<ImportMap, Export>
  >);

export type SessionImportTokenMap = {
  readonly [Alias: string | symbol]:
    // deno-lint-ignore no-explicit-any
    | ServiceImportToken<any, any>
    // deno-lint-ignore no-explicit-any
    | SessionImportToken<any, any>;
};

export type SessionMeta<
  ImportMap extends SessionImportTokenMap,
> = DepMeta<ImportMap>;

import { identity } from "../fp/identity.ts";

export function propertyIdentity<T>(): <
  const PropertyList extends readonly (keyof T)[],
>(memberNames: PropertyList) => PropertyList {
  return identity;
}

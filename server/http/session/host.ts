import { DepHost } from "../../arch/dependency.ts";

// export interface SessionHostInit {}

export class SessionHost extends DepHost {
  constructor() {
    super({});
  }

  get req() {
    return null;
  }

  get res() {
    return null;
  }
}

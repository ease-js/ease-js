import "https://esm.sh/raf@3.4.0/polyfill";
import { useConstant } from "./use-constant.ts";
import { asserts } from "../../../core/deps.ts";
import { mock, TestRenderer } from "../../dev-deps.ts";
import { React } from "../../deps.ts";

Deno.test("useConstant(initializer)", async (t): Promise<void> => {
  await t.step(
    "should return a Constant when a React component is rendered for the first time",
    (): void => {
      let constant: number | undefined;
      const expectedConstant = 1;
      const load = mock.spy(() => expectedConstant);
      const rendered = TestRenderer.create(<TestComponent />);
      rendered.update(<TestComponent />);
      mock.assertSpyCalls(load, 1);
      mock.assertSpyCallArgs(load, 0, []);
      asserts.assertStrictEquals(constant, expectedConstant);

      function TestComponent(): null {
        constant = useConstant(load);
        return null;
      }
    },
  );
});

import {
  assert,
  assertExists,
  assertFalse,
  assertInstanceOf,
  AssertionError,
  assertNotStrictEquals,
  assertStrictEquals,
  assertThrows,
} from "../../../tools/std/testing/asserts.ts";
import {
  assertSpyCallArgs,
  assertSpyCalls,
  spy,
} from "../../../tools/std/testing/mock.ts";
import type {
  AnyDependencyDefinition,
  AnyDependencyNode,
  DependencyDefinition,
  DependencyWeakRefHandle,
} from "./graph.ts";
import { DependencyNode } from "./graph.ts";

// 设置 --v8-flags=--expose-gc 即可启用此 API
declare const gc: undefined | (() => void);

Deno.test("new DependencyNode()", async (t) => {
  await t.step("node.payload", async (t) => {
    await t.step(
      "should throw an assertion when accessed after the node has been revoked",
      () => {
        const root = new DependencyNode();
        const node = root.link("key", __def(() => 0));
        const { key: shadowKey, shadow } = node.shadow();

        shadow.payload;
        node.unlink(shadowKey);
        assertThrows(() => {
          shadow.payload;
        }, AssertionError);

        node.payload;
        root.unlink("key");
        assertThrows(() => {
          node.payload;
        }, AssertionError);
      },
    );

    await t.step(
      "should throw an assertion if the current node is root",
      () => {
        assertThrows(() => {
          new DependencyNode().payload;
        }, AssertionError);
      },
    );

    await t.step(
      "should throw an assertion if the current node is a shadow of root",
      () => {
        assertThrows(() => {
          new DependencyNode().shadow().shadow.payload;
        }, AssertionError);
      },
    );

    await t.step(
      "should invoke `definition.load()` when `node.payload` is accessed for the first time",
      () => {
        const root = new DependencyNode();
        const def = __def(spy(() => ({})));
        const node = root.link("key", def);

        assertSpyCalls(def.load, 0);

        // normal node
        assertStrictEquals(node.payload, node.payload);
        assertStrictEquals(node.payload, def.load.calls[0].returned);
        // shadow node
        assertStrictEquals(
          node.shadow().shadow.payload,
          def.load.calls[0].returned,
        );
        assertStrictEquals(
          node.shadow().shadow.payload,
          node.shadow().shadow.payload,
        );

        assertSpyCalls(def.load, 1);
        assertSpyCallArgs(def.load, 0, [node]);
      },
    );

    await t.step(
      "should throw an assertion if the circular reference relationship is not built lazily",
      () => {
        const root = new DependencyNode();
        const loadA = spy((node: DependencyNode): unknown => {
          return node.link("b", defB).payload;
        });
        const loadB = spy((node: DependencyNode): unknown => {
          return node.link("a", defA).payload;
        });
        const defA = __def(loadA, false);
        const defB = __def(loadB, true);

        // normal node
        assertThrows(() => {
          root.link("a", defA).payload;
        }, AssertionError);

        // shadow node
        assertThrows(() => {
          root.link("c", __def((node) => node.shadow().shadow.payload)).payload;
        }, AssertionError);
      },
    );

    await t.step(
      "should throw an assertion if accessed inside `definition.load()`",
      () => {
        const root = new DependencyNode();
        const node = root.link("key", __def((instance) => instance.payload));

        assertThrows(() => {
          node.payload;
        }, AssertionError);
      },
    );

    await t.step(
      "should not throw an assertion if the circular reference relationship is built lazily",
      () => {
        const root = new DependencyNode();
        const loadA = (node: AnyDependencyNode): [0, () => number] => {
          return [0, () => node.link("b", defB).payload];
        };
        const loadB = (node: AnyDependencyNode): number => {
          return node.link("a", defA).payload[0] + 1;
        };
        const defA = __def(loadA, true);
        const defB = __def(loadB, true);

        assertStrictEquals(root.link("a", defA).payload[1](), 1);
        assertStrictEquals(root.link("b", defB).payload, 1);
      },
    );
  });

  await t.step("node.stack", async (t) => {
    await t.step(
      "should throw an assertion when accessed after the node has been revoked",
      () => {
        const root = new DependencyNode();
        const node = root.link("key", __def(() => 0));

        node.stack;
        root.unlink("key");
        assertThrows(() => {
          node.stack;
        }, AssertionError);
      },
    );

    await t.step("should be an instance of DisposableStack", () => {
      const root = new DependencyNode();
      assertInstanceOf(root.stack, DisposableStack);
    });

    await t.step(
      "should be disposed after the node has been revoked",
      () => {
        const root = new DependencyNode();
        const node = root.link("key", __def(() => 0));
        const { stack } = node;
        assertFalse(stack.disposed);
        root.unlink("key");
        assert(stack.disposed);
      },
    );
  });

  await t.step("node[@@toStringTag]", async (t) => {
    await t.step("should equal `'DependencyNode'`", () => {
      const root = new DependencyNode();
      assertStrictEquals(root[Symbol.toStringTag], "DependencyNode");
      assertStrictEquals(
        DependencyNode.prototype[Symbol.toStringTag],
        "DependencyNode",
      );
    });
  });

  await t.step("node.clear()", async (t) => {
    await t.step(
      "should throw an assertion when invoked after the node has been revoked",
      () => {
        const root = new DependencyNode();
        const node = root.link("key", __def(() => 0));

        node.clear();
        root.clear();
        assertThrows(() => {
          node.clear();
        }, AssertionError);
      },
    );

    await t.step("should do nothing if no reference exists", () => {
      const root = new DependencyNode();
      root.clear();
      assertStrictEquals(root.link("key", __def(() => 1)).payload, 1);
      root.clear();
      assertStrictEquals(root.link("key", __def(() => 2)).payload, 2);
    });

    await t.step(
      "should revoke all of the unreachable nodes",
      async () => {
        const cleanedToken = new Set<string>();
        const finalization = new FinalizationRegistry<string>((token) => {
          cleanedToken.add(token);
        });
        const hoistMap: Record<string, AnyDependencyDefinition["hoist"]> = {
          a: true,
        };
        const [a, b, c] = ["a", "b", "c"].map((key) => {
          const unload = spy();
          const load = (node: AnyDependencyNode): unknown => {
            const value = {};
            node.stack.defer(unload);
            node.shadow().shadow.stack.defer(unload);
            finalization.register(value, key);
            return value;
          };
          return { def: __def(load, hoistMap[key]), key, load, unload };
        });
        const root = new DependencyNode();
        const [nodeA, nodeB] = [
          root.link(a.key, a.def),
          root.link(b.key, b.def),
        ];
        const nodeC = nodeB.link(c.key, c.def);

        assertStrictEquals(nodeA, nodeB.link(a.key, a.def));
        assert(typeof nodeA.payload === "object");
        assert(typeof nodeB.payload === "object");
        assert(typeof nodeC.payload === "object");

        nodeB.clear();
        assertSpyCalls(a.unload, 0);
        assertSpyCalls(b.unload, 1);
        assertSpyCalls(c.unload, 2);

        if (typeof gc === "function") {
          await __waitGC();
          assertFalse(cleanedToken.has(a.key));
          assertFalse(cleanedToken.has(b.key));
          assert(cleanedToken.has(c.key));
        }
      },
    );

    await t.step(
      "should delay the execution of `stack.dispose()` until the node collection is completed, " +
        "so as to avoid node collection being interrupted by the error thrown by `stack.dispose()`",
      () => {
        const root = new DependencyNode();
        const destructorA = spy(() => {
          assertThrows(() => {
            nodeA.payload;
          }, AssertionError);
          assertThrows(() => {
            nodeB.payload;
          }, AssertionError);
        });
        const destructorB = spy(() => {
          assertThrows(() => {
            nodeA.payload;
          }, AssertionError);
          assertThrows(() => {
            nodeB.payload;
          }, AssertionError);
        });
        const nodeA = root.link(
          "a",
          __def((node) => {
            node.stack.defer(destructorA);
          }),
        );
        const nodeB = root.link(
          "b",
          __def((node) => {
            node.stack.defer(destructorB);
          }),
        );

        nodeA.payload;
        nodeB.payload;

        root.clear();
        assertSpyCalls(destructorA, 1);
        assertSpyCalls(destructorB, 1);
      },
    );

    await t.step(
      "should throw a SuppressedError if the error thrown by `stack.dispose()` is suppressed",
      () => {
        const root = new DependencyNode();
        const destructorA = spy(() => {
          throw destructorA;
        });
        const destructorB = spy(() => {
          throw destructorB;
        });
        const nodeA = root.link("a", __def((n) => n.stack.defer(destructorA)));
        const nodeB = root.link("b", __def((n) => n.stack.defer(destructorB)));

        nodeA.payload;
        nodeB.payload;

        try {
          root.clear();
          throw null;
        } catch (error) {
          assertInstanceOf(error, SuppressedError);
          assertStrictEquals(error.error, destructorA);
          assertStrictEquals(error.suppressed, destructorB);
        }

        assertSpyCalls(destructorA, 1);
        assertSpyCalls(destructorB, 1);
      },
    );
  });

  await t.step("node.link(key, definition)", async (t) => {
    await t.step(
      "should throw an assertion when invoked after the node has been revoked",
      () => {
        // check step 1
        const root = new DependencyNode();
        const node = root.link("key", __def(() => 0));

        node.link("key", __def(() => 0));
        root.unlink("key");
        assertThrows(() => {
          node.link("key", __def(() => 0));
        }, AssertionError);
      },
    );

    await t.step(
      "should return the same node for the same `key`",
      () => {
        // check step 2
        const root = new DependencyNode();
        assertStrictEquals(
          root.link("k", __def(() => ({}))),
          root.link("k", __def(() => ({}))),
        );
      },
    );

    await t.step(
      "should return the existing shadow node for the same `key` returned by the `node.shadow()`",
      () => {
        // check step 2
        const root = new DependencyNode();
        const { key, shadow } = root.shadow();
        assertStrictEquals(root.link(key, __def(() => 0)), shadow);
      },
    );

    await t.step(
      "should lookup and return the existing hoisted node installed at an ancestor for the same `key`",
      () => {
        const root = new DependencyNode();
        const load = () => 0;
        const parentDef = __def(load);
        const defA = __def(load, false);
        const defB = __def(load, false);
        const defC = __def(load, true);
        const defD = __def(load, "parent");
        const defE = __def(load, "parent");
        const defF = __def(load, false);
        const defG = __def(load, "nothing");
        const parent = root.link("parent", parentDef);
        const nodeA = parent.link("a", defA);
        const nodeB = parent.link("b", defB);

        // check step 3.2
        // 不提升则不可复用
        assertNotStrictEquals(nodeA.link("a", defA), nodeA);
        assertNotStrictEquals(nodeB.link("a", defA), nodeA);
        assertNotStrictEquals(nodeB.link("b", defB), nodeB);
        assertNotStrictEquals(nodeA.link("b", defB), nodeB);

        // check step 3.1
        // 复用提升到根节点的依赖
        assertStrictEquals(nodeA.link("c", defC), nodeB.link("c", defC));
        assertStrictEquals(nodeA.link("c", defC), parent.link("c", defC));
        assertStrictEquals(nodeA.link("c", defC), root.link("c", defC));
        assertStrictEquals(
          nodeA.link("c", defC),
          root.shadow().shadow.link("c", defC),
        );

        // check step 3.3
        // 复用提升到指定节点的依赖
        assertStrictEquals(nodeA.link("d", defD), nodeB.link("d", defD));
        assertStrictEquals(nodeA.link("d", defD), parent.link("d", defD));
        assertStrictEquals(
          nodeA.link("d", defD),
          parent.shadow().shadow.link("d", defD),
        );
        assertNotStrictEquals(nodeA.link("d", defD), root.link("d", defD));
        assertNotStrictEquals(
          parent.shadow().shadow.link("e", defE),
          parent.link("e", defE),
        );

        // check step 3.2
        // 不进行提升的节点
        assertNotStrictEquals(nodeA.link("f", defF), nodeB.link("f", defF));
        assertNotStrictEquals(nodeA.link("f", defF), root.link("f", defF));

        // check step 3.3
        // 无法提升到指定节点，则安装在当前节点不提升
        assertNotStrictEquals(nodeA.link("g", defG), nodeB.link("g", defG));
        assertNotStrictEquals(nodeA.link("g", defG), root.link("g", defG));
        assertNotStrictEquals(
          nodeA.link("g", defG),
          nodeA.shadow().shadow.link("g", defG),
        );
        assertNotStrictEquals(
          nodeA.link("g", defG),
          root.shadow().shadow.link("g", defG),
        );
      },
    );

    await t.step(
      "should use the nearest matched ancestor as the hoist target",
      () => {
        const root = new DependencyNode();
        const load = () => 0;
        const defA = __def(load, false);
        const defB = __def(load, false);
        const defC = __def(load, "b");
        const nodeA = root.link("a", defA);
        const nodeB1 = root.link("b", defB);
        const nodeB2 = nodeA.link("b", defB);
        const nodeB3 = nodeA.shadow().shadow.link("b", defB);
        const nodeB4 = nodeA.shadow().shadow.shadow().shadow.link("b", defB);

        const nodeBList = [nodeB1, nodeB2, nodeB3, nodeB4];
        assertStrictEquals(new Set(nodeBList).size, nodeBList.length);

        const nodeCList = [root, nodeB1, nodeB2, nodeB3, nodeB4].map((node) => {
          return node.link("c", defC);
        });
        assertStrictEquals(new Set(nodeCList).size, nodeCList.length);
        assertNotStrictEquals(root.link("c", defC), nodeA.link("c", defC));
      },
    );
  });

  await t.step("node.shadow()", async (t) => {
    await t.step("should return a key-node pair", () => {
      const root = new DependencyNode();
      const node = root.link("key", __def(() => 0));
      const { key: shadowKey, shadow } = node.shadow();

      assertExists(shadowKey);
      assertNotStrictEquals(shadow, node);
      assert(shadow instanceof DependencyNode);
    });

    await t.step("should reuse the payload of its host node", () => {
      const root = new DependencyNode();
      const node = root.link("key", __def(() => ({})));
      assertStrictEquals(
        node.shadow().shadow.shadow().shadow.payload,
        node.payload,
      );
    });
  });

  await t.step("node.unlink(...keys)", async (t) => {
    await t.step(
      "should throw an assertion when invoked after the node has been revoked",
      () => {
        const root = new DependencyNode();
        const node = root.link("key", __def(() => 0));

        node.unlink("key");
        root.unlink("key");
        assertThrows(() => {
          node.unlink("key");
        }, AssertionError);
      },
    );

    await t.step(
      "should do nothing if no reference record is found for the `definition`",
      () => {
        let value = 0;
        const root = new DependencyNode();
        const def = __def(() => ++value);
        root.unlink("key");
        assertStrictEquals(root.link("key", def).payload, 1);
        root.unlink("key");
        assertStrictEquals(root.link("key", def).payload, 2);
      },
    );

    await t.step("should not revoke the reachable node", () => {
      const root = new DependencyNode();
      const destructorB = spy();
      const destructorC = spy();
      const loadB = spy((node: AnyDependencyNode) => {
        node.stack.defer(destructorB);
        return {};
      });
      const loadC = spy((node: AnyDependencyNode) => {
        node.stack.defer(destructorC);
        return {};
      });
      const defA = __def(() => 0);
      const defB = __def(loadB, true);
      const defC = __def(loadC, true);
      const nodeA = root.link("a", defA);
      const nodeB = root.link("b", defB);
      const nodeC = nodeB.link("c", defC);

      assertStrictEquals(nodeB, nodeA.link("b", defB));
      assertStrictEquals(nodeC, nodeA.link("c", defC));
      assertStrictEquals(nodeB.payload, loadB.calls[0].returned);
      assertStrictEquals(nodeC.payload, loadC.calls[0].returned);

      nodeA.unlink("c");
      assertSpyCalls(destructorC, 0);
      nodeB.unlink("c");
      assertSpyCalls(destructorC, 1);

      root.unlink("b");
      assertSpyCalls(destructorB, 0);
      nodeA.unlink("b");
      assertSpyCalls(destructorB, 1);
    });

    await t.step("should revoke the unreachable nodes", async () => {
      const cleanedToken = new Set<string>();
      const finalization = new FinalizationRegistry<string>((token) => {
        cleanedToken.add(token);
      });
      const hoistMap: Record<string, AnyDependencyDefinition["hoist"]> = {
        a: true,
      };
      const shadowUnload = spy();
      const [a, b, c] = ["a", "b", "c"].map((key) => {
        const unload = spy();
        const load = (node: AnyDependencyNode): unknown => {
          const value = {};
          node.stack.defer(unload);
          finalization.register(value, key);
          return value;
        };
        return { def: __def(load, hoistMap[key]), key, load, unload };
      });
      const root = new DependencyNode();
      const nodeA = root.link(a.key, a.def);
      const nodeB = nodeA.link(b.key, b.def);
      const nodeC = root.link(c.key, c.def);

      assertStrictEquals(nodeA, nodeB.link(a.key, a.def));
      assert(typeof nodeA.payload === "object");
      assert(typeof nodeB.payload === "object");
      assert(typeof nodeC.payload === "object");

      const { key: shadowKey, shadow } = root.shadow();
      shadow.stack.defer(shadowUnload);
      assertSpyCalls(shadowUnload, 0);
      assertStrictEquals(nodeA, shadow.link(a.key, a.def));
      root.unlink(shadowKey);
      assertSpyCalls(shadowUnload, 1);

      root.unlink(a.key, c.key);
      assertSpyCalls(a.unload, 1);
      assertSpyCalls(b.unload, 1);
      assertSpyCalls(c.unload, 1);

      if (typeof gc === "function") {
        await __waitGC();
        assert(cleanedToken.has(a.key));
        assert(cleanedToken.has(b.key));
        assert(cleanedToken.has(c.key));
      }
    });

    await t.step(
      "should delay the execution of `stack.dispose()` until the node collection is completed, " +
        "so as to avoid node collection being interrupted by the error thrown by `stack.dispose()`",
      () => {
        const root = new DependencyNode();
        const destructorA = spy(() => {
          assertThrows(() => {
            nodeA.payload;
          }, AssertionError);
          assertThrows(() => {
            nodeB.payload;
          }, AssertionError);
        });
        const destructorB = spy(() => {
          assertThrows(() => {
            nodeA.payload;
          }, AssertionError);
          assertThrows(() => {
            nodeB.payload;
          }, AssertionError);
        });
        const nodeA = root.link("a", __def((n) => n.stack.defer(destructorA)));
        const nodeB = root.link("b", __def((n) => n.stack.defer(destructorB)));

        nodeA.payload;
        nodeB.payload;

        root.unlink("a", "b");
        assertSpyCalls(destructorA, 1);
        assertSpyCalls(destructorB, 1);
      },
    );

    await t.step(
      "should throw a SuppressedError if the error thrown by `stack.dispose()` is suppressed",
      () => {
        const root = new DependencyNode();
        const destructorA = spy(() => {
          throw destructorA;
        });
        const destructorB = spy(() => {
          throw destructorB;
        });
        const nodeA = root.link("a", __def((n) => n.stack.defer(destructorA)));
        const nodeB = root.link("b", __def((n) => n.stack.defer(destructorB)));

        nodeA.payload;
        nodeB.payload;

        try {
          root.unlink("a", "b");
          throw null;
        } catch (error) {
          assertInstanceOf(error, SuppressedError);
          assertStrictEquals(error.error, destructorA);
          assertStrictEquals(error.suppressed, destructorB);
        }

        assertSpyCalls(destructorA, 1);
        assertSpyCalls(destructorB, 1);
      },
    );
  });

  await t.step("node.weaken(key, handle)", async (t) => {
    await t.step(
      "should throw an assertion when invoked after the node has been revoked",
      () => {
        const root = new DependencyNode();
        const node = root.link("key", __def(() => 0));

        node.weaken("key", {});
        root.unlink("key");
        assertThrows(() => {
          node.weaken("key", {});
        }, AssertionError);
      },
    );

    await t.step(
      "should do nothing if no reference record is found for the `key`",
      () => {
        const root = new DependencyNode();
        root.weaken("key", {});
        assertStrictEquals(root.link("key", __def(() => 1)).payload, 1);
      },
    );

    if (typeof gc === "function") {
      await t.step(
        "should execute `node.unlink(key)` after the last `handle` object has been revoked by GC",
        async () => {
          let handle: DependencyWeakRefHandle;

          const root = new DependencyNode();
          const destructor = spy();
          const load = spy((instance: AnyDependencyNode) => {
            instance.stack.defer(destructor);
            return {};
          });
          const def = __def(load);
          const node = root.link("key", def);
          const unlink = spy(root, "unlink");

          assertStrictEquals(node.payload, load.calls[0].returned);
          assertSpyCalls(load, 1);
          assertSpyCalls(destructor, 0);
          assertSpyCalls(unlink, 0);

          handle = {};
          root.weaken("key", handle);
          handle = {};
          root.weaken("key", handle);
          await __waitGC();
          assertSpyCalls(destructor, 0);
          assertSpyCalls(unlink, 0);
          assertStrictEquals(root.link("key", def), node);

          root.weaken("key", null);
          handle = {};
          await __waitGC();
          assertSpyCalls(destructor, 0);
          assertSpyCalls(unlink, 0);
          assertStrictEquals(root.link("key", def), node);

          root.weaken("key", handle);
          handle = {};
          await __waitGC();
          assertSpyCalls(destructor, 1);
          assertSpyCalls(unlink, 1);
          assertNotStrictEquals(root.link("key", def), node);
        },
      );

      await t.step(
        "should unregister `handle` after the node has been revoked manually",
        async () => {
          let handle: DependencyWeakRefHandle;

          const root = new DependencyNode();
          const defA = __def(spy(() => ({})));
          const defB = __def(spy(() => ({})));
          const nodeA = root.link("a", defA);
          const nodeB = nodeA.link("b", defB);
          const unlink0 = spy(root, "unlink");
          const unlink1 = spy(nodeA, "unlink");

          assertStrictEquals(
            nodeA.payload,
            defA.load.calls[0].returned,
          );
          assertStrictEquals(
            nodeB.payload,
            defB.load.calls[0].returned,
          );
          assertSpyCalls(defA.load, 1);
          assertSpyCalls(defB.load, 1);
          assertSpyCalls(unlink0, 0);
          assertSpyCalls(unlink1, 0);

          handle = {};
          root.weaken(defA, handle);
          nodeA.weaken(defB, handle);
          root.unlink(defA);
          assertSpyCalls(unlink0, 1);
          assertSpyCalls(unlink1, 0);

          handle = {};
          await __waitGC();
          assertSpyCalls(unlink0, 1);
          assertSpyCalls(unlink1, 0);
        },
      );
    }
  });

  await t.step(`[@@Deno.customInspect]()`, async (t) => {
    await t.step("should return a human-readable string", () => {
      const root = new DependencyNode();
      const node = root.link("key", __def(() => ({})));
      const customInspect = spy(
        node as unknown as Record<symbol, unknown>,
        Symbol.for("Deno.customInspect"),
      );

      assert(typeof Deno.inspect(node) === "string");
      assertSpyCalls(customInspect, 1);

      root.unlink("key");
      assert(typeof Deno.inspect(node) === "string");
      assertSpyCalls(customInspect, 2);
    });
  });
});

function __def<Load extends AnyDependencyDefinition["load"]>(
  load: Load,
  hoist: AnyDependencyDefinition["hoist"] = false,
) {
  return { hoist, load } satisfies DependencyDefinition<ReturnType<Load>>;
}

function __waitGC(): Promise<void> {
  assert(typeof gc === "function");
  gc();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

import { asserts } from "../deps.ts";
import { mock } from "../dev-deps.ts";

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
        asserts.assertThrows(() => {
          shadow.payload;
        }, asserts.AssertionError);

        node.payload;
        root.unlink("key");
        asserts.assertThrows(() => {
          node.payload;
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should throw an assertion if the current node is root",
      () => {
        asserts.assertThrows(() => {
          new DependencyNode().payload;
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should throw an assertion if the current node is a shadow of root",
      () => {
        asserts.assertThrows(() => {
          new DependencyNode().shadow().shadow.payload;
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should invoke `definition.load()` when `node.payload` is accessed for the first time",
      () => {
        const root = new DependencyNode();
        const def = __def(mock.spy(() => ({})));
        const node = root.link("key", def);

        mock.assertSpyCalls(def.load, 0);

        // normal node
        asserts.assertStrictEquals(node.payload, node.payload);
        asserts.assertStrictEquals(node.payload, def.load.calls[0].returned);
        // shadow node
        asserts.assertStrictEquals(
          node.shadow().shadow.payload,
          def.load.calls[0].returned,
        );
        asserts.assertStrictEquals(
          node.shadow().shadow.payload,
          node.shadow().shadow.payload,
        );

        mock.assertSpyCalls(def.load, 1);
        mock.assertSpyCallArgs(def.load, 0, [node]);
      },
    );

    await t.step(
      "should throw an assertion if the circular reference relationship is not built lazily",
      () => {
        const root = new DependencyNode();
        const loadA = mock.spy((node: DependencyNode): unknown => {
          return node.link("b", defB).payload;
        });
        const loadB = mock.spy((node: DependencyNode): unknown => {
          return node.link("a", defA).payload;
        });
        const defA = __def(loadA, false);
        const defB = __def(loadB, true);

        // normal node
        asserts.assertThrows(() => {
          root.link("a", defA).payload;
        }, asserts.AssertionError);

        // shadow node
        asserts.assertThrows(() => {
          root.link("c", __def((node) => node.shadow().shadow.payload)).payload;
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should throw an assertion if accessed inside `definition.load()`",
      () => {
        const root = new DependencyNode();
        const node = root.link("key", __def((instance) => instance.payload));

        asserts.assertThrows(() => {
          node.payload;
        }, asserts.AssertionError);
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

        asserts.assertStrictEquals(root.link("a", defA).payload[1](), 1);
        asserts.assertStrictEquals(root.link("b", defB).payload, 1);
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
        asserts.assertThrows(() => {
          node.stack;
        }, asserts.AssertionError);
      },
    );

    await t.step("should be an instance of DisposableStack", () => {
      const root = new DependencyNode();
      asserts.assertInstanceOf(root.stack, DisposableStack);
    });

    await t.step(
      "should be disposed after the node has been revoked",
      () => {
        const root = new DependencyNode();
        const node = root.link("key", __def(() => 0));
        const { stack } = node;
        asserts.assertFalse(stack.disposed);
        root.unlink("key");
        asserts.assert(stack.disposed);
      },
    );
  });

  await t.step("node[@@toStringTag]", async (t) => {
    await t.step("should equal `'DependencyNode'`", () => {
      const root = new DependencyNode();
      asserts.assertStrictEquals(root[Symbol.toStringTag], "DependencyNode");
      asserts.assertStrictEquals(
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
        asserts.assertThrows(() => {
          node.clear();
        }, asserts.AssertionError);
      },
    );

    await t.step("should do nothing if no reference exists", () => {
      const root = new DependencyNode();
      root.clear();
      asserts.assertStrictEquals(root.link("key", __def(() => 1)).payload, 1);
      root.clear();
      asserts.assertStrictEquals(root.link("key", __def(() => 2)).payload, 2);
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
          const unload = mock.spy();
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

        asserts.assertStrictEquals(nodeA, nodeB.link(a.key, a.def));
        asserts.assert(typeof nodeA.payload === "object");
        asserts.assert(typeof nodeB.payload === "object");
        asserts.assert(typeof nodeC.payload === "object");

        nodeB.clear();
        mock.assertSpyCalls(a.unload, 0);
        mock.assertSpyCalls(b.unload, 1);
        mock.assertSpyCalls(c.unload, 2);

        if (typeof gc === "function") {
          await __waitGC();
          asserts.assertFalse(cleanedToken.has(a.key));
          asserts.assertFalse(cleanedToken.has(b.key));
          asserts.assert(cleanedToken.has(c.key));
        }
      },
    );

    await t.step(
      "should delay the execution of `stack.dispose()` until the node collection is completed, " +
        "so as to avoid node collection being interrupted by the error thrown by `stack.dispose()`",
      () => {
        const root = new DependencyNode();
        const destructorA = mock.spy(() => {
          asserts.assertThrows(() => {
            nodeA.payload;
          }, asserts.AssertionError);
          asserts.assertThrows(() => {
            nodeB.payload;
          }, asserts.AssertionError);
        });
        const destructorB = mock.spy(() => {
          asserts.assertThrows(() => {
            nodeA.payload;
          }, asserts.AssertionError);
          asserts.assertThrows(() => {
            nodeB.payload;
          }, asserts.AssertionError);
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
        mock.assertSpyCalls(destructorA, 1);
        mock.assertSpyCalls(destructorB, 1);
      },
    );

    await t.step(
      "should throw a SuppressedError if the error thrown by `stack.dispose()` is suppressed",
      () => {
        const root = new DependencyNode();
        const destructorA = mock.spy(() => {
          throw destructorA;
        });
        const destructorB = mock.spy(() => {
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
          asserts.assertInstanceOf(error, SuppressedError);
          asserts.assertStrictEquals(error.error, destructorA);
          asserts.assertStrictEquals(error.suppressed, destructorB);
        }

        mock.assertSpyCalls(destructorA, 1);
        mock.assertSpyCalls(destructorB, 1);
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
        asserts.assertThrows(() => {
          node.link("key", __def(() => 0));
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should return the same node for the same `key`",
      () => {
        // check step 2
        const root = new DependencyNode();
        asserts.assertStrictEquals(
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
        asserts.assertStrictEquals(root.link(key, __def(() => 0)), shadow);
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
        asserts.assertNotStrictEquals(nodeA.link("a", defA), nodeA);
        asserts.assertNotStrictEquals(nodeB.link("a", defA), nodeA);
        asserts.assertNotStrictEquals(nodeB.link("b", defB), nodeB);
        asserts.assertNotStrictEquals(nodeA.link("b", defB), nodeB);

        // check step 3.1
        // 复用提升到根节点的依赖
        asserts.assertStrictEquals(
          nodeA.link("c", defC),
          nodeB.link("c", defC),
        );
        asserts.assertStrictEquals(
          nodeA.link("c", defC),
          parent.link("c", defC),
        );
        asserts.assertStrictEquals(
          nodeA.link("c", defC),
          root.link("c", defC),
        );
        asserts.assertStrictEquals(
          nodeA.link("c", defC),
          root.shadow().shadow.link("c", defC),
        );

        // check step 3.3
        // 复用提升到指定节点的依赖
        asserts.assertStrictEquals(
          nodeA.link("d", defD),
          nodeB.link("d", defD),
        );
        asserts.assertStrictEquals(
          nodeA.link("d", defD),
          parent.link("d", defD),
        );
        asserts.assertStrictEquals(
          nodeA.link("d", defD),
          parent.shadow().shadow.link("d", defD),
        );
        asserts.assertNotStrictEquals(
          nodeA.link("d", defD),
          root.link("d", defD),
        );
        asserts.assertNotStrictEquals(
          parent.shadow().shadow.link("e", defE),
          parent.link("e", defE),
        );

        // check step 3.2
        // 不进行提升的节点
        asserts.assertNotStrictEquals(
          nodeA.link("f", defF),
          nodeB.link("f", defF),
        );
        asserts.assertNotStrictEquals(
          nodeA.link("f", defF),
          root.link("f", defF),
        );

        // check step 3.3
        // 无法提升到指定节点，则安装在当前节点不提升
        asserts.assertNotStrictEquals(
          nodeA.link("g", defG),
          nodeB.link("g", defG),
        );
        asserts.assertNotStrictEquals(
          nodeA.link("g", defG),
          root.link("g", defG),
        );
        asserts.assertNotStrictEquals(
          nodeA.link("g", defG),
          nodeA.shadow().shadow.link("g", defG),
        );
        asserts.assertNotStrictEquals(
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
        asserts.assertStrictEquals(new Set(nodeBList).size, nodeBList.length);

        const nodeCList = [root, nodeB1, nodeB2, nodeB3, nodeB4].map((node) => {
          return node.link("c", defC);
        });
        asserts.assertStrictEquals(new Set(nodeCList).size, nodeCList.length);

        asserts.assertNotStrictEquals(
          root.link("c", defC),
          nodeA.link("c", defC),
        );
      },
    );
  });

  await t.step("node.shadow()", async (t) => {
    await t.step("should return a key-node pair", () => {
      const root = new DependencyNode();
      const node = root.link("key", __def(() => 0));
      const { key: shadowKey, shadow } = node.shadow();

      asserts.assertExists(shadowKey);
      asserts.assertNotStrictEquals(shadow, node);
      asserts.assert(shadow instanceof DependencyNode);
    });

    await t.step("should reuse the payload of its host node", () => {
      const root = new DependencyNode();
      const node = root.link("key", __def(() => ({})));
      asserts.assertStrictEquals(
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
        asserts.assertThrows(() => {
          node.unlink("key");
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should do nothing if no reference record is found for the `definition`",
      () => {
        let value = 0;
        const root = new DependencyNode();
        const def = __def(() => ++value);
        root.unlink("key");
        asserts.assertStrictEquals(root.link("key", def).payload, 1);
        root.unlink("key");
        asserts.assertStrictEquals(root.link("key", def).payload, 2);
      },
    );

    await t.step("should not revoke the reachable node", () => {
      const root = new DependencyNode();
      const destructorB = mock.spy();
      const destructorC = mock.spy();
      const loadB = mock.spy((node: AnyDependencyNode) => {
        node.stack.defer(destructorB);
        return {};
      });
      const loadC = mock.spy((node: AnyDependencyNode) => {
        node.stack.defer(destructorC);
        return {};
      });
      const defA = __def(() => 0);
      const defB = __def(loadB, true);
      const defC = __def(loadC, true);
      const nodeA = root.link("a", defA);
      const nodeB = root.link("b", defB);
      const nodeC = nodeB.link("c", defC);

      asserts.assertStrictEquals(nodeB, nodeA.link("b", defB));
      asserts.assertStrictEquals(nodeC, nodeA.link("c", defC));
      asserts.assertStrictEquals(nodeB.payload, loadB.calls[0].returned);
      asserts.assertStrictEquals(nodeC.payload, loadC.calls[0].returned);

      nodeA.unlink("c");
      mock.assertSpyCalls(destructorC, 0);
      nodeB.unlink("c");
      mock.assertSpyCalls(destructorC, 1);

      root.unlink("b");
      mock.assertSpyCalls(destructorB, 0);
      nodeA.unlink("b");
      mock.assertSpyCalls(destructorB, 1);
    });

    await t.step("should revoke the unreachable nodes", async () => {
      const cleanedToken = new Set<string>();
      const finalization = new FinalizationRegistry<string>((token) => {
        cleanedToken.add(token);
      });
      const hoistMap: Record<string, AnyDependencyDefinition["hoist"]> = {
        a: true,
      };
      const [a, b, c] = ["a", "b", "c"].map((key) => {
        const unload = mock.spy();
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

      asserts.assertStrictEquals(nodeA, nodeB.link(a.key, a.def));
      asserts.assert(typeof nodeA.payload === "object");
      asserts.assert(typeof nodeB.payload === "object");
      asserts.assert(typeof nodeC.payload === "object");

      root.unlink(a.key, c.key);
      mock.assertSpyCalls(a.unload, 1);
      mock.assertSpyCalls(b.unload, 1);
      mock.assertSpyCalls(c.unload, 1);

      if (typeof gc === "function") {
        await __waitGC();
        asserts.assert(cleanedToken.has(a.key));
        asserts.assert(cleanedToken.has(b.key));
        asserts.assert(cleanedToken.has(c.key));
      }
    });

    await t.step(
      "should delay the execution of `stack.dispose()` until the node collection is completed, " +
        "so as to avoid node collection being interrupted by the error thrown by `stack.dispose()`",
      () => {
        const root = new DependencyNode();
        const destructorA = mock.spy(() => {
          asserts.assertThrows(() => {
            nodeA.payload;
          }, asserts.AssertionError);
          asserts.assertThrows(() => {
            nodeB.payload;
          }, asserts.AssertionError);
        });
        const destructorB = mock.spy(() => {
          asserts.assertThrows(() => {
            nodeA.payload;
          }, asserts.AssertionError);
          asserts.assertThrows(() => {
            nodeB.payload;
          }, asserts.AssertionError);
        });
        const nodeA = root.link("a", __def((n) => n.stack.defer(destructorA)));
        const nodeB = root.link("b", __def((n) => n.stack.defer(destructorB)));

        nodeA.payload;
        nodeB.payload;

        root.unlink("a", "b");
        mock.assertSpyCalls(destructorA, 1);
        mock.assertSpyCalls(destructorB, 1);
      },
    );

    await t.step(
      "should throw a SuppressedError if the error thrown by `stack.dispose()` is suppressed",
      () => {
        const root = new DependencyNode();
        const destructorA = mock.spy(() => {
          throw destructorA;
        });
        const destructorB = mock.spy(() => {
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
          asserts.assertInstanceOf(error, SuppressedError);
          asserts.assertStrictEquals(error.error, destructorA);
          asserts.assertStrictEquals(error.suppressed, destructorB);
        }

        mock.assertSpyCalls(destructorA, 1);
        mock.assertSpyCalls(destructorB, 1);
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
        asserts.assertThrows(() => {
          node.weaken("key", {});
        }, asserts.AssertionError);
      },
    );

    await t.step(
      "should do nothing if no reference record is found for the `key`",
      () => {
        const root = new DependencyNode();
        root.weaken("key", {});
        asserts.assertStrictEquals(root.link("key", __def(() => 1)).payload, 1);
      },
    );

    if (typeof gc === "function") {
      await t.step(
        "should execute `node.unlink(key)` after the last `handle` object has been revoked by GC",
        async () => {
          let handle: DependencyWeakRefHandle;

          const root = new DependencyNode();
          const destructor = mock.spy();
          const load = mock.spy((instance: AnyDependencyNode) => {
            instance.stack.defer(destructor);
            return {};
          });
          const def = __def(load);
          const node = root.link("key", def);
          const unlink = mock.spy(root, "unlink");

          asserts.assertStrictEquals(node.payload, load.calls[0].returned);
          mock.assertSpyCalls(load, 1);
          mock.assertSpyCalls(destructor, 0);
          mock.assertSpyCalls(unlink, 0);

          handle = {};
          root.weaken("key", handle);
          handle = {};
          root.weaken("key", handle);
          await __waitGC();
          mock.assertSpyCalls(destructor, 0);
          mock.assertSpyCalls(unlink, 0);
          asserts.assertStrictEquals(root.link("key", def), node);

          root.weaken("key", null);
          handle = {};
          await __waitGC();
          mock.assertSpyCalls(destructor, 0);
          mock.assertSpyCalls(unlink, 0);
          asserts.assertStrictEquals(root.link("key", def), node);

          root.weaken("key", handle);
          handle = {};
          await __waitGC();
          mock.assertSpyCalls(destructor, 1);
          mock.assertSpyCalls(unlink, 1);
          asserts.assertNotStrictEquals(root.link("key", def), node);
        },
      );

      await t.step(
        "should unregister `handle` after the node has been revoked manually",
        async () => {
          let handle: DependencyWeakRefHandle;

          const root = new DependencyNode();
          const defA = __def(mock.spy(() => ({})));
          const defB = __def(mock.spy(() => ({})));
          const nodeA = root.link("a", defA);
          const nodeB = nodeA.link("b", defB);
          const unlink0 = mock.spy(root, "unlink");
          const unlink1 = mock.spy(nodeA, "unlink");

          asserts.assertStrictEquals(
            nodeA.payload,
            defA.load.calls[0].returned,
          );
          asserts.assertStrictEquals(
            nodeB.payload,
            defB.load.calls[0].returned,
          );
          mock.assertSpyCalls(defA.load, 1);
          mock.assertSpyCalls(defB.load, 1);
          mock.assertSpyCalls(unlink0, 0);
          mock.assertSpyCalls(unlink1, 0);

          handle = {};
          root.weaken(defA, handle);
          nodeA.weaken(defB, handle);
          root.unlink(defA);
          mock.assertSpyCalls(unlink0, 1);
          mock.assertSpyCalls(unlink1, 0);

          handle = {};
          await __waitGC();
          mock.assertSpyCalls(unlink0, 1);
          mock.assertSpyCalls(unlink1, 0);
        },
      );
    }
  });

  await t.step(`[Symbol.for("Deno.customInspect")]()`, async (t) => {
    await t.step("should return a human-readable string", () => {
      const root = new DependencyNode();
      const node = root.link("key", __def(() => ({})));
      const customInspect = mock.spy(
        node as unknown as Record<symbol, unknown>,
        Symbol.for("Deno.customInspect"),
      );

      asserts.assert(typeof Deno.inspect(node) === "string");
      mock.assertSpyCalls(customInspect, 1);

      root.unlink("key");
      asserts.assert(typeof Deno.inspect(node) === "string");
      mock.assertSpyCalls(customInspect, 2);
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
  asserts.assert(typeof gc === "function");
  gc();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

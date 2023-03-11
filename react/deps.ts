// 在 Compartments 提案之后，可以在测试时动态切换 dev 与 prod 模式
// @see https://github.com/tc39/proposal-compartments

export * from "../core/deps.ts";
export * as core from "../core.ts";

export * as immer from "https://esm.sh/immer@9.0.17?bundle&deno-std=0.179.0&pin=v111";
export { default as React } from "https://esm.sh/react@18.2.0?deno-std=0.179.0&pin=v111";
export { default as ReactDOM } from "https://esm.sh/react-dom@18.2.0?deno-std=0.179.0&pin=v111";
export { default as ReactDOMClient } from "https://esm.sh/react-dom@18.2.0/client?deno-std=0.179.0&pin=v111";

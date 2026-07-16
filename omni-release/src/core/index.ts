/**
 * omni-release — core barrel.
 *
 * Peers import shared contracts and helpers from here:
 *
 *   import { ResearchResult, CaptionSet, loadConfig, paths, createLogger } from "../core/index.js";
 *
 * (Remember the `.js` extension on relative imports — NodeNext ESM.)
 */

export * from "./types.js";
export * from "./config.js";
export * from "./paths.js";
export * from "./logger.js";
export * from "./util.js";

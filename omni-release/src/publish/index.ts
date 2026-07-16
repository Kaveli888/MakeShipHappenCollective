/**
 * Publish layer — public surface.
 *
 * Publisher adapters (API + browser-assisted) behind core's `Publisher`
 * interface, route resolution, and the ready-to-post fallback writer.
 */

export {
  makeApiPublisher,
  makeBrowserPublisher,
  getPublisher,
  resolveRoute,
} from "./publishers.js";
export {
  renderReadyToPost,
  writeReadyToPostPackage,
  type WriteReadyToPostOptions,
} from "./readyToPost.js";
export type {
  PublishRoute,
  PackageSource,
  PackagePost,
  ReadyToPostPackage,
} from "./types.js";

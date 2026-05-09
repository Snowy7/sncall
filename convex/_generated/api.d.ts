/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as channels from "../channels.js";
import type * as dms from "../dms.js";
import type * as files from "../files.js";
import type * as livekit from "../livekit.js";
import type * as members from "../members.js";
import type * as messages from "../messages.js";
import type * as polls from "../polls.js";
import type * as reactions from "../reactions.js";
import type * as readState from "../readState.js";
import type * as servers from "../servers.js";
import type * as typing from "../typing.js";
import type * as users from "../users.js";
import type * as voice from "../voice.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  channels: typeof channels;
  dms: typeof dms;
  files: typeof files;
  livekit: typeof livekit;
  members: typeof members;
  messages: typeof messages;
  polls: typeof polls;
  reactions: typeof reactions;
  readState: typeof readState;
  servers: typeof servers;
  typing: typeof typing;
  users: typeof users;
  voice: typeof voice;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

/// <reference path="../.astro/types.d.ts" />

/**
 * Vite's `?worker` suffix turns a module into a Worker constructor. The type is
 * declared here because the project does not pull in vite/client's ambient types.
 */
declare module "*?worker" {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}

// The little that the two tools in this folder need from the runtime they are
// run in, reached without pulling node's type definitions into a project that is
// otherwise pure browser. `process` is not declared anywhere in this tsconfig,
// and adding @types/node to get at two fields would put node's `setTimeout` and
// node's `console` in front of the browser's everywhere else in the app.

interface NodeLike {
  argv?: string[];
  exitCode?: number;
}

function host(): NodeLike | undefined {
  return (globalThis as { process?: NodeLike }).process;
}

/** The words after the script name, or nothing when there is no shell above us. */
export function args(): string[] {
  return host()?.argv?.slice(2) ?? [];
}

/** Fail the run. A tool that reports a failure and exits 0 is a tool CI ignores. */
export function fail(): void {
  const node = host();
  if (node) node.exitCode = 1;
}

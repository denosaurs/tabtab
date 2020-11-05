import { BASH_LOCATION, FISH_LOCATION, ZSH_LOCATION } from "./constants.ts";
import { debug as dbg } from "./deps.ts";
import { Shell, shell } from "./shell.ts";

import * as installer from "./installer.ts";

const debug = dbg("tabtab");

/** Install and enable completion on user system. */
export async function install(options: {
  name: string;
  completer: string;
  location?: string;
  cmd?: string;
}): Promise<void> {
  if (!options.location) options.location = defaultLocation();
  if (!options.cmd) options.cmd = "completions";
  return await installer.install(options as installer.Options);
}

/** Remove completion on user system. */
export async function uninstall(options: { name: string }): Promise<void> {
  return await installer.uninstall(options);
}

/**
 * Public: Main utility to extract information from command line arguments and
 * Environment variables, namely COMP args in "plumbing" mode.
 *
 * options -  The options hash as parsed by minimist, plus an env property
 *            representing user environment (default: { env: process.env })
 *    :_      - The arguments Array parsed by minimist (positional arguments)
 *    :env    - The environment Object that holds COMP args (default: process.env)
 *
 * Examples
 *
 *   const env = tabtab.parseEnv();
 *   // env:
 *   // complete    A Boolean indicating whether we act in "plumbing mode" or not
 *   // words       The Number of words in the completed line
 *   // point       A Number indicating cursor position
 *   // line        The String input line
 *   // partial     The String part of line preceding cursor position
 *   // last        The last String word of the line
 *   // lastPartial The last word String of partial
 *   // prev        The String word preceding last
 */
export interface Env {
  COMP_CWORD: string;
  COMP_POINT: string;
  COMP_LINE: string;
}

export interface ParsedEnv {
  env: Env;
  complete: boolean;
  words: number;
  point: number;
  line: string;
  partial: string;
  last: string;
  lastPartial: string;
  prev: string;
}

export function parseEnv(env?: Env): ParsedEnv {
  if (!env) {
    env = {
      COMP_CWORD: Deno.env.get("COMP_CWORD")!,
      COMP_LINE: Deno.env.get("COMP_LINE")!,
      COMP_POINT: Deno.env.get("COMP_POINT")!,
    };
  }

  debug(
    "Parsing env. CWORD: %s, COMP_POINT: %s, COMP_LINE: %s",
    env.COMP_CWORD,
    env.COMP_POINT,
    env.COMP_LINE,
  );

  let cword = Number(env.COMP_CWORD);
  let point = Number(env.COMP_POINT);
  const line = env.COMP_LINE || "";

  if (Number.isNaN(cword)) cword = 0;
  if (Number.isNaN(point)) point = 0;

  const partial = line.slice(0, point);

  const parts = line.split(" ");
  const prev = parts.slice(0, -1).slice(-1)[0];

  const last = parts.slice(-1).join("");
  const lastPartial = partial.split(" ").slice(-1).join("");

  let complete = true;
  if (!env.COMP_CWORD || !env.COMP_POINT || !env.COMP_LINE) {
    complete = false;
  }

  return {
    env,
    complete,
    words: cword,
    point,
    line,
    partial,
    last,
    lastPartial,
    prev,
  };
}

export interface CompletionItem {
  name: string;
  description: string;
}

/** Helper to normalize String and Objects with { name, description } when logging out. */
export function completionItem(item: string | CompletionItem) {
  debug("completion item", item);

  if (typeof item !== "string") return item;
  const sysShell = shell();

  let name = item;
  let description = "";
  const matching = /^(.*?)(\\)?:(.*)$/.exec(item);
  if (matching) {
    [, name, , description] = matching;
  }

  if (sysShell === "zsh" && /\\/.test(item)) {
    name += "\\";
  }

  return {
    name,
    description,
  };
}

export function defaultLocation(): string {
  return location(shell());
}

export function location(shell: Shell): string {
  switch (shell) {
    case "bash":
      return BASH_LOCATION;
    case "fish":
      return FISH_LOCATION;
    case "zsh":
      return ZSH_LOCATION;
  }
}

/**
 * Main logging utility to pass completion items.
 *
 * This is simply an helper to log to stdout with each item separated by a new
 * line.
 *
 * Bash needs in addition to filter out the args for the completion to work
 * (zsh, fish don't need this).
 */
export function log(args: (string | CompletionItem)[]) {
  const sysShell = shell();

  if (!Array.isArray(args)) {
    throw new Error("log: Invalid arguments, must be an array");
  }

  // Normalize arguments if there are some Objects { name, description } in them.
  let normalized = args.map(completionItem).map((item) => {
    const { name, description } = item;
    let str = name;
    if (sysShell === "zsh" && description) {
      str = `${name.replace(/:/g, "\\:")}:${description}`;
    } else if (sysShell === "fish" && description) {
      str = `${name}\t${description}`;
    }

    return str;
  });

  if (sysShell === "bash") {
    const env = parseEnv();
    normalized = normalized.filter((arg) => normalized.indexOf(env.last) === 0);
  }

  for (const arg of normalized) {
    console.log(`${arg}`);
  }
}

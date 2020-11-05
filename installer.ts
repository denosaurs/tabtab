import {
  debug as dbg,
  dirname,
  encode,
  ensureDir,
  exists,
  join,
} from "./deps.ts";

import { untildify } from "./home.ts";
import { scripts } from "./scripts.ts";
import { Shell, shell } from "./shell.ts";

import {
  BASH_LOCATION,
  COMPLETION_DIR,
  FISH_LOCATION,
  TABTAB_SCRIPT_NAME,
  ZSH_LOCATION,
} from "./constants.ts";

export interface Options {
  name: string;
  completer: string;
  location: string;
  cmd: string;
}

const debug = dbg("tabtab");

/** Little helper to return the correct file extension based on the SHELL value */
function shellExtension() {
  return shell();
}

/** Helper to return the correct script template based on the SHELL provided */
function scriptFromShell(shell: Shell) {
  return scripts[shell];
}

/** Helper to return the expected location for SHELL config file, based on the
 * provided shell value */
function locationFromShell(shell: Shell) {
  if (shell === "bash") return untildify(BASH_LOCATION);
  if (shell === "zsh") return untildify(ZSH_LOCATION);
  if (shell === "fish") return untildify(FISH_LOCATION);
  return BASH_LOCATION;
}

/** Helper to return the source line to add depending on the SHELL provided or detected.
 * If the provided SHELL is not known, it returns the source line for a Bash shell */
function sourceLineForShell(scriptname: string, shell: Shell) {
  if (shell === "fish") {
    return `[ -f ${scriptname} ]; and . ${scriptname}; or true`;
  }

  if (shell === "zsh") {
    return `[[ -f ${scriptname} ]] && . ${scriptname} || true`;
  }

  // For Bash and others
  return `[ -f ${scriptname} ] && . ${scriptname} || true`;
}

/** Helper to check if a filename is one of the SHELL config we expect */
function isInShellConfig(filename: string) {
  return [
    BASH_LOCATION,
    ZSH_LOCATION,
    FISH_LOCATION,
    untildify(BASH_LOCATION),
    untildify(ZSH_LOCATION),
    untildify(FISH_LOCATION),
  ].includes(filename);
}

/** Checks a given file for the existence of a specific line. Used to prevent
 * adding multiple completion source to SHELL scripts */
async function checkFilenameForLine(
  filename: string,
  line: string,
): Promise<boolean> {
  debug('Check filename (%s) for "%s"', filename, line);

  let filecontent = "";
  try {
    filecontent = await Deno.readTextFile(untildify(filename));
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      console.error(
        "Got an error while trying to read from %s file",
        filename,
        err,
      );
      return false;
    }
  }

  return !!filecontent.match(line);
}
/** Opens a file for modification adding a new `source` line for the given
 * SHELL. Used for both SHELL script and tabtab internal one */
async function writeLineToFilename(
  filename: string,
  scriptname: string,
  name: string,
): Promise<void> {
  const filepath = untildify(filename);

  debug("Creating directory for %s file", filepath);
  await ensureDir(dirname(filepath));
  const file = await Deno.open(
    filepath,
    { append: true, create: true, write: true },
  );

  debug("Writing to shell configuration file (%s)", filename);
  debug("scriptname:", scriptname);

  const inShellConfig = isInShellConfig(filename);
  if (inShellConfig) {
    await file.write(encode(`\n# deno tabtab source for modules`));
  } else {
    await file.write(encode(`\n# deno tabtab source for ${name} module`));
  }

  await file.write(encode("\n# uninstall by removing these lines"));
  await file.write(encode(`\n${sourceLineForShell(scriptname, shell())}`));
  await file.write(encode("\n"));
  Deno.close(file.rid);

  debug('=> Added tabtab source line in "%s" file', filename);
}

/** Writes to SHELL config file adding a new line, but only one, to the SHELL
 * config script. This enables tabtab to work for the given SHELL */
async function writeToShellConfig(location: string, name: string) {
  const scriptname = join(
    COMPLETION_DIR,
    `${TABTAB_SCRIPT_NAME}.${shellExtension()}`,
  );

  const filename = location;

  // Check if SHELL script already has a line for tabtab
  const existing = await checkFilenameForLine(filename, scriptname);
  if (existing) {
    return debug("=> Tabtab line already exists in %s file", filename);
  }

  return await writeLineToFilename(filename, scriptname, name);
}

/** Writes to tabtab internal script that acts as a frontend router for the
 * completion mechanism, in the internal ~/.config/tabtab directory. Every
 * completion is added to this file */
async function writeToTabtabScript(name: string) {
  const filename = join(
    COMPLETION_DIR,
    `${TABTAB_SCRIPT_NAME}.${shellExtension()}`,
  );

  const scriptname = join(COMPLETION_DIR, `${name}.${shellExtension()}`);

  // Check if tabtab completion file already has this line in it
  const existing = await checkFilenameForLine(filename, scriptname);
  if (existing) {
    return debug("=> Tabtab line already exists in %s file", filename);
  }

  return await writeLineToFilename(filename, scriptname, name);
}

/** This writes a new completion script in the internal `~/.config/tabtab`
 * directory. Depending on the SHELL used, a different script is created for
 * the given SHELL */
async function writeToCompletionScript(
  name: string,
  completer: string,
  cmd: string,
) {
  const filename = untildify(
    join(COMPLETION_DIR, `${name}.${shellExtension()}`),
  );

  let script = scriptFromShell(shell());
  debug("Writing completion script to", filename);
  debug("with", script);

  script = script
    .replace(/{pkgname}/g, name)
    .replace(/{completer}/g, completer)
    .replace(/{completion_cmd}/g, cmd)
    // on Bash on windows, we need to make sure to remove any \r
    .replace(/\r?\n/g, "\n");

  ensureDir(dirname(filename));
  await Deno.writeTextFile(filename, script);

  debug("=> Wrote completion script to %s file", filename);
}

/**
 * Top level install method. Does three things:
 *
 * - Writes to SHELL config file, adding a new line to tabtab internal script.
 * - Creates or edit tabtab internal script
 * - Creates the actual completion script for this module.
 */
export async function install(options: Options) {
  debug("Install with options", options);

  const { name, completer, location, cmd } = options;

  await Promise.all([
    writeToShellConfig(location, name),
    writeToTabtabScript(name),
    writeToCompletionScript(name, completer, cmd),
  ]);

  debug(`
    => Tabtab source line added to ${location} for ${name} module.
    Make sure to reload your SHELL.
  `);
}

/** Removes the 3 relevant lines from provided filename, based on the module
 * name passed in */
async function removeLinesFromFilename(filename: string, name: string) {
  /* eslint-disable no-unused-vars */
  debug("Removing lines from %s file, looking for %s module", filename, name);
  if (!(await exists(filename))) {
    return debug("File %s does not exist", filename);
  }

  const filecontent = await Deno.readTextFile(filename);
  const lines = filecontent.split(/\r?\n/);

  const sourceLine = isInShellConfig(filename)
    ? `# deno tabtab source for modules`
    : `# deno tabtab source for ${name} module`;

  const hasLine = !!filecontent.match(`${sourceLine}`);
  if (!hasLine) {
    return debug("File %s does not include the line: %s", filename, sourceLine);
  }

  let lineIndex = -1;
  const buffer = lines
    // Build up the new buffer, removing the 3 lines following the sourceline
    .map((line, index) => {
      const match = line.match(sourceLine);
      if (match) {
        lineIndex = index;
      } else if (lineIndex + 3 <= index) {
        lineIndex = -1;
      }

      return lineIndex === -1 ? line : "";
    })
    // Remove any double empty lines from this file
    .map((line, index, array) => {
      const next = array[index + 1];
      if (line === "" && next === "") {
        return;
      }

      return line;
    })
    // Remove any undefined value from there
    .filter((line) => line !== undefined)
    .join("\n")
    .trim();

  await Deno.writeTextFile(filename, buffer);
  debug("=> Removed tabtab source lines from %s file", filename);
}

/** Here the idea is to uninstall a given module completion from internal
 * tabtab scripts and / or the SHELL config.
 *
 * It also removes the relevant scripts if no more completion are installed on
 * the system */
export async function uninstall(options: { name: string }) {
  debug("Uninstall with options", options);
  const { name } = options;

  if (!name) {
    throw new Error("Unable to uninstall if options.name is missing");
  }

  const completionScript = untildify(
    join(COMPLETION_DIR, `${name}.${shellExtension()}`),
  );

  // First, lets remove the completion script itself
  if (await exists(completionScript)) {
    await Deno.remove(completionScript);
    debug("=> Removed completion script (%s)", completionScript);
  }

  // Then the lines in ~/.config/tabtab/__tabtab.shell
  const tabtabScript = untildify(
    join(COMPLETION_DIR, `${TABTAB_SCRIPT_NAME}.${shellExtension()}`),
  );
  await removeLinesFromFilename(tabtabScript, name);

  // Then, check if __tabtab.shell is empty, if so remove the last source line in SHELL config
  const isEmpty = (await Deno.readTextFile(tabtabScript)).trim() === "";
  if (isEmpty) {
    const shellScript = locationFromShell(shell());
    debug(
      "File %s is empty. Removing source line from %s file",
      tabtabScript,
      shellScript,
    );
    await removeLinesFromFilename(shellScript, name);
  }

  debug("=> Uninstalled completion for %s module", name);
}

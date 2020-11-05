import { ParsedEnv, tabtab } from "../mod.ts";
import { parse } from "https://deno.land/std@0.75.0/flags/mod.ts";

const opts = parse(Deno.args, {
  string: ["foo", "bar"],
  boolean: ["help", "version", "loglevel"],
});

const args = opts._;
const completion = (env: ParsedEnv) => {
  if (!env.complete) return;

  if (env.prev === "someCommand") {
    return tabtab.log(["is", "this", "the", "real", "life"]);
  }

  if (env.prev === "anotherOne") {
    return tabtab.log(["is", "this", "just", "fantasy"]);
  }

  if (env.prev === "--loglevel") {
    return tabtab.log(["error", "warn", "info", "notice", "verbose"]);
  }

  return tabtab.log([
    "--help",
    "--version",
    "--loglevel",
    "foo",
    "bar",
    "someCommand:a comprehensive description of the command",
    {
      name: "someOtherCommand",
      description: "comprehensive description of the other command",
    },
    "anotherOne",
  ]);
};

const run = async () => {
  const cmd = args[0];

  if (opts.help) {
    return console.log("Output help here");
  }

  if (opts.version) {
    return console.log("Output version here");
  }

  if (opts.loglevel) {
    return console.log("Output version here");
  }

  if (cmd === "foo") {
    return console.log("foobar");
  }

  if (cmd === "bar") {
    return console.log("barbar");
  }

  if (cmd === "someCommand") {
    return console.log("is this the real life ?");
  }

  if (cmd === "anotherOne") {
    return console.log("is this just fantasy ?");
  }

  if (cmd === "install-completion") {
    // Here we install for the program `hello` (this file), with
    // completer being the same program. Sometimes, you want to complete
    // another program that's where the `completer` option might come handy.
    await tabtab
      .install({
        name: "hello",
        completer: "hello",
        cmd: "__generate_completions",
      });

    return;
  }

  if (cmd === "uninstall-completion") {
    // Here we uninstall for the program `hello` (this file).
    await tabtab
      .uninstall({
        name: "hello",
      });

    return;
  }

  // Defined by the `cmd` option. Defaults to "completions".
  if (cmd === "__generate_completions") {
    const env = tabtab.parseEnv();
    return completion(env);
  }
};

run();

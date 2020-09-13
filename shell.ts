export type Shell = "bash" | "fish" | "zsh";

/** Return current shell name of undefined */
export function shell(): Shell {
  const name = Deno.env.get("SHELL") ?? "";
  return name.split("/").slice(-1)[0] as Shell ?? null;
}

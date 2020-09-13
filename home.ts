/** Return cpath to user home directory */
export function home(): string | null {
  switch (Deno.build.os) {
    case "linux":
    case "darwin":
      return Deno.env.get("HOME") ?? null;
    case "windows":
      return Deno.env.get("FOLDERID_Profile") ?? null;
  }
}

/** Return cpath to user home directory */
export function untildify(path: string): string {
  const homeDir = home();
  return homeDir ? path.replace(/^~(?=$|\/|\\)/, homeDir) : path;
}

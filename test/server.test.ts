import * as fs from "fs";
import * as path from "path";

describe("repository wiring", () => {
  const repoRoot = path.resolve(__dirname, "..");

  it("provides the missing src/server.ts entrypoint", () => {
    expect(fs.existsSync(path.join(repoRoot, "src/server.ts"))).toBe(true);
  });

  it("moves github instructions under .github", () => {
    expect(fs.existsSync(path.join(repoRoot, ".github/github-instruction.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "github-instruction.md"))).toBe(false);
  });

  it("uses a dev script that does not point at the missing ts-node entry", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
    ) as { scripts: { dev: string } };

    expect(packageJson.scripts.dev).toBe("npm run build && node dist/server.js");
  });
});

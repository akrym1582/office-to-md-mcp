import { execCommand } from "../utils/exec.js";
import { fileExists } from "../utils/fs.js";
import { logger } from "../utils/logger.js";

export interface Capabilities {
  libreOffice: boolean;
  libreOfficePath: string | null;
  python: boolean;
  pythonPath: string | null;
  pythonVersion: string | null;
  unoHelper: boolean;
  pdfRenderer: boolean;
  pdfRendererPath: string | null;
  pdfRendererTool: "pdftoppm" | "convert" | null;
  copilotCli: boolean;
  copilotCliPath: string | null;
  githubToken: boolean;
}

async function findExecutable(names: string[]): Promise<string | null> {
  for (const name of names) {
    try {
      const result = await execCommand("which", [name], { timeoutMs: 5000 });
      if (result.exitCode === 0) {
        return result.stdout.trim();
      }
    } catch {
      // continue
    }
  }
  return null;
}

export async function detectCapabilities(unoHelperPath?: string): Promise<Capabilities> {
  const [loPath, pyPath, pdftoppmPath, convertPath, copilotPath] = await Promise.all([
    findExecutable(["soffice", "libreoffice"]),
    findExecutable(["python3", "python"]),
    findExecutable(["pdftoppm"]),
    findExecutable(["convert"]),
    findExecutable(["gh"]),
  ]);

  let pythonVersion: string | null = null;
  if (pyPath) {
    try {
      const r = await execCommand(pyPath, ["--version"], { timeoutMs: 5000 });
      pythonVersion = (r.stdout + r.stderr).trim();
    } catch {
      // ignore
    }
  }

  let unoHelper = false;
  if (unoHelperPath) {
    unoHelper = await fileExists(unoHelperPath);
  }

  const pdfRendererPath = pdftoppmPath ?? convertPath;
  const pdfRendererTool: "pdftoppm" | "convert" | null = pdftoppmPath
    ? "pdftoppm"
    : convertPath
    ? "convert"
    : null;

  const githubToken = !!(process.env.GITHUB_TOKEN ?? process.env.github_token);

  const caps: Capabilities = {
    libreOffice: !!loPath,
    libreOfficePath: loPath,
    python: !!pyPath,
    pythonPath: pyPath,
    pythonVersion,
    unoHelper,
    pdfRenderer: !!pdfRendererPath,
    pdfRendererPath,
    pdfRendererTool,
    copilotCli: !!copilotPath,
    copilotCliPath: copilotPath,
    githubToken,
  };

  logger.debug("Detected capabilities", caps as unknown as Record<string, unknown>);
  return caps;
}

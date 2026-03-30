import { execCommand } from "../utils/exec.js";
import { AppError, ErrorCode } from "../types/errors.js";
import { logger } from "../utils/logger.js";

export type CopilotProvider = "github-copilot-cli" | "unavailable";

export function getGithubToken(): string | null {
  return process.env.GITHUB_TOKEN ?? process.env.github_token ?? null;
}

export async function convertImageToMarkdown(
  imagePath: string,
  copilotCliPath: string,
  token: string,
  timeoutMs = 60_000
): Promise<string> {
  logger.info("Converting image to Markdown with Copilot CLI", { imagePath });
  const result = await execCommand(
    copilotCliPath,
    ["api", "copilot", "--method", "POST", "--field", `image=@${imagePath}`],
    { timeoutMs, env: { ...process.env, GITHUB_TOKEN: token } }
  ).catch((err) => {
    if ((err as NodeJS.ErrnoException).code === "ENOENT")
      throw new AppError(ErrorCode.COPILOT_CLI_NOT_FOUND, `GitHub Copilot CLI not found: ${copilotCliPath}`);
    throw err;
  });
  if (result.exitCode !== 0)
    throw new AppError(ErrorCode.COPILOT_MARKDOWN_FAILED, "Copilot CLI failed to convert image", { stderr: result.stderr, exitCode: result.exitCode });
  return result.stdout.trim();
}

import { readFile } from "fs/promises";
import path from "path";
import { CopilotClient, approveAll } from "@github/copilot-sdk";
import { AppError, ErrorCode } from "../types/errors.js";
import { logger } from "../utils/logger.js";

const IMAGE_PROMPT =
  "Convert this image to Markdown. Preserve all text, formatting, tables, and structure as closely as possible. Output only the Markdown content.";

export function getGithubToken(): string | null {
  return process.env.GITHUB_TOKEN ?? process.env.github_token ?? null;
}

function getMimeType(imagePath: string): string {
  const ext = path.extname(imagePath).toLowerCase().slice(1);
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

export async function convertImageToMarkdown(
  imagePath: string,
  token: string,
  timeoutMs = 60_000
): Promise<string> {
  logger.info("Converting image to Markdown with GitHub Copilot SDK", { imagePath });

  const imageBuffer = await readFile(imagePath).catch(() => {
    throw new AppError(ErrorCode.FILE_NOT_FOUND, `Image file not found: ${imagePath}`);
  });
  const base64Image = imageBuffer.toString("base64");
  const mimeType = getMimeType(imagePath);
  const displayName = path.basename(imagePath);

  const client = new CopilotClient({ githubToken: token });
  await client.start();

  try {
    const session = await client.createSession({
      model: "gpt-4o",
      onPermissionRequest: approveAll,
    });

    try {
      const response = await session.sendAndWait(
        {
          prompt: IMAGE_PROMPT,
          attachments: [
            {
              type: "blob",
              data: base64Image,
              mimeType,
              displayName,
            },
          ],
        },
        timeoutMs
      );

      if (!response?.data?.content) {
        throw new AppError(ErrorCode.COPILOT_MARKDOWN_FAILED, "No Markdown content received from GitHub Copilot");
      }
      return response.data.content.trim();
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(ErrorCode.COPILOT_MARKDOWN_FAILED, "GitHub Copilot SDK failed to convert image to Markdown", {
        message: String(err),
      });
    } finally {
      await session.disconnect();
    }
  } finally {
    await client.stop();
  }
}

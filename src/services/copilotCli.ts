import { readFile } from "fs/promises";
import path from "path";
import { Octokit } from "@octokit/core";
import { AppError, ErrorCode } from "../types/errors.js";
import { logger } from "../utils/logger.js";

const IMAGE_PROMPT =
  "Convert this image to Markdown. Preserve all text, formatting, tables, and structure as closely as possible. Output only the Markdown content.";

interface CopilotChatMessage {
  role: string;
  content: string;
}

interface CopilotChatChoice {
  message: CopilotChatMessage;
}

interface CopilotChatResponse {
  data: {
    choices: CopilotChatChoice[];
  };
}

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

  const octokit = new Octokit({ auth: token });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const response = await Promise.race([
    octokit.request("POST /copilot/chat/completions", {
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            { type: "text", text: IMAGE_PROMPT },
          ],
        },
      ],
    }),
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new AppError(ErrorCode.COPILOT_MARKDOWN_FAILED, "GitHub Copilot SDK request timed out")),
        timeoutMs
      );
    }),
  ]).catch((err) => {
    if (err instanceof AppError) throw err;
    throw new AppError(ErrorCode.COPILOT_MARKDOWN_FAILED, "GitHub Copilot SDK failed to convert image to Markdown", {
      message: String(err),
    });
  }).finally(() => {
    clearTimeout(timeoutId);
  });

  const markdown = (response as CopilotChatResponse).data?.choices?.[0]?.message?.content;
  if (!markdown) {
    throw new AppError(ErrorCode.COPILOT_MARKDOWN_FAILED, "No Markdown content received from GitHub Copilot");
  }
  return markdown.trim();
}

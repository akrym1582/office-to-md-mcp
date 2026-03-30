import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { execCommand } from "../utils/exec.js";
import { AppError, ErrorCode } from "../types/errors.js";
import { logger } from "../utils/logger.js";

export type CopilotProvider = "github-copilot-cli" | "unavailable";

/**
 * Default GitHub Models API endpoint used by `gh api`.
 * Override via the `COPILOT_ENDPOINT` environment variable.
 */
const DEFAULT_COPILOT_ENDPOINT = "https://models.github.ai/inference/chat/completions";

/**
 * Default model for vision-capable chat completions.
 * Override via the `COPILOT_MODEL` environment variable.
 */
const DEFAULT_COPILOT_MODEL = "openai/gpt-4o";

/**
 * System prompt that instructs the Copilot model to convert a PDF page image
 * into well-structured Markdown text.
 */
export const PDF_TO_MARKDOWN_SYSTEM_PROMPT = [
  "You are a document conversion assistant.",
  "Your task is to convert the provided PDF page image into well-structured Markdown text.",
  "",
  "Follow these rules:",
  "- Reproduce all visible text content accurately.",
  "- Preserve the document structure: headings, paragraphs, lists (ordered and unordered), tables, and code blocks.",
  "- Use appropriate Markdown syntax for headings (#, ##, ###), bold (**), italic (*), links, and tables.",
  "- For tables, use GitHub-flavored Markdown table syntax with proper alignment.",
  "- Do not add any commentary, explanation, or notes. Output only the Markdown representation of the document content.",
  "- If the image contains diagrams or charts that cannot be represented as text, describe them briefly in italics.",
  "- Maintain the reading order of the original document.",
].join("\n");

export function getGithubToken(): string | null {
  return process.env.GITHUB_TOKEN ?? process.env.github_token ?? null;
}

/**
 * Build the JSON request body for a chat-completions call that includes an
 * image encoded as a base-64 data URL.
 */
export function buildChatCompletionsBody(
  base64Image: string,
  mimeType: string,
  model?: string,
): string {
  const selectedModel = model ?? process.env.COPILOT_MODEL ?? DEFAULT_COPILOT_MODEL;
  return JSON.stringify({
    model: selectedModel,
    messages: [
      {
        role: "system",
        content: PDF_TO_MARKDOWN_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Convert this PDF page image to Markdown. Output only the Markdown content.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
  });
}

/**
 * Extract the assistant's text content from a chat-completions JSON response.
 */
export function extractContentFromResponse(raw: string): string {
  let response: { choices?: { message?: { content?: string } }[] };
  try {
    response = JSON.parse(raw) as typeof response;
  } catch {
    throw new AppError(
      ErrorCode.COPILOT_MARKDOWN_FAILED,
      "Copilot API returned invalid JSON",
      { response: raw },
    );
  }
  const content = response?.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError(
      ErrorCode.COPILOT_MARKDOWN_FAILED,
      "Copilot API returned no content",
      { response: raw },
    );
  }
  return content.trim();
}

/**
 * Convert a single image (typically a rendered PDF page) to Markdown text by
 * calling the GitHub Copilot / GitHub Models chat-completions API via the
 * `gh` CLI.
 *
 * The image is read as base-64, embedded in a vision-capable chat request
 * together with a system prompt that instructs the model to produce Markdown,
 * and the response is parsed to return the Markdown string.
 */
export async function convertImageToMarkdown(
  imagePath: string,
  copilotCliPath: string,
  token: string,
  timeoutMs = 60_000,
  model?: string,
): Promise<string> {
  logger.info("Converting image to Markdown with Copilot CLI", { imagePath });

  // Read image and encode as base-64
  const imageBuffer = await fs.promises.readFile(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).toLowerCase().replace(".", "");
  const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";

  // Build chat-completions request body
  const requestBody = buildChatCompletionsBody(base64Image, mimeType, model);

  // Write to a temp file so we can pass it via --input to gh api
  const tmpFile = path.join(os.tmpdir(), `copilot-req-${crypto.randomUUID()}.json`);
  await fs.promises.writeFile(tmpFile, requestBody, "utf8");

  const endpoint = process.env.COPILOT_ENDPOINT ?? DEFAULT_COPILOT_ENDPOINT;

  try {
    const result = await execCommand(
      copilotCliPath,
      [
        "api", endpoint,
        "--method", "POST",
        "-H", "Content-Type: application/json",
        "--input", tmpFile,
      ],
      { timeoutMs, env: { ...process.env, GITHUB_TOKEN: token } },
    ).catch((err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT")
        throw new AppError(ErrorCode.COPILOT_CLI_NOT_FOUND, `GitHub Copilot CLI not found: ${copilotCliPath}`);
      throw err;
    });

    if (result.exitCode !== 0)
      throw new AppError(ErrorCode.COPILOT_MARKDOWN_FAILED, "Copilot CLI failed to convert image", {
        stderr: result.stderr,
        exitCode: result.exitCode,
      });

    return extractContentFromResponse(result.stdout);
  } finally {
    await fs.promises.unlink(tmpFile).catch((err) => {
      logger.debug("Failed to clean up temp request file", { tmpFile, error: (err as Error).message });
    });
  }
}

/**
 * Convert an array of page images into Markdown strings.
 * Each image is sent to the Copilot model independently and returns one
 * Markdown string per page.
 */
export async function convertPdfPagesToMarkdown(
  imagePaths: string[],
  copilotCliPath: string,
  token: string,
  timeoutMs = 60_000,
  model?: string,
): Promise<string[]> {
  const results: string[] = [];
  for (const imagePath of imagePaths) {
    const md = await convertImageToMarkdown(imagePath, copilotCliPath, token, timeoutMs, model);
    results.push(md);
  }
  return results;
}

/**
 * Merge per-page Markdown strings into a single document.
 * Optionally adds `## Page N` headings before each page.
 */
export function mergePageMarkdowns(
  pages: string[],
  preservePageHeadings = true,
): string {
  if (pages.length === 0) return "";
  if (pages.length === 1) return pages[0];
  return pages
    .map((md, i) =>
      preservePageHeadings ? `## Page ${i + 1}\n\n${md}` : md,
    )
    .join("\n\n---\n\n");
}

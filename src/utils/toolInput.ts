import { AppError, ErrorCode } from "../types/errors.js";

export interface PathInput {
  filePath?: string;
  path?: string;
}

export function resolveFilePathInput(input: PathInput): string {
  const filePath = input.filePath ?? input.path;
  if (!filePath) {
    throw new AppError(ErrorCode.INVALID_TOOL_INPUT, "Either filePath or path must be provided");
  }
  return filePath;
}

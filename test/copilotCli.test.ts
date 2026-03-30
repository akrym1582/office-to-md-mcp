import {
  PDF_TO_MARKDOWN_SYSTEM_PROMPT,
  buildChatCompletionsBody,
  extractContentFromResponse,
  mergePageMarkdowns,
  getGithubToken,
} from "../src/services/copilotCli";

describe("copilotCli", () => {
  describe("PDF_TO_MARKDOWN_SYSTEM_PROMPT", () => {
    it("should be a non-empty string", () => {
      expect(typeof PDF_TO_MARKDOWN_SYSTEM_PROMPT).toBe("string");
      expect(PDF_TO_MARKDOWN_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it("should contain key instructions for Markdown conversion", () => {
      expect(PDF_TO_MARKDOWN_SYSTEM_PROMPT).toContain("Markdown");
      expect(PDF_TO_MARKDOWN_SYSTEM_PROMPT).toContain("document");
      expect(PDF_TO_MARKDOWN_SYSTEM_PROMPT).toContain("headings");
      expect(PDF_TO_MARKDOWN_SYSTEM_PROMPT).toContain("tables");
    });
  });

  describe("buildChatCompletionsBody", () => {
    it("should return valid JSON with expected structure", () => {
      const body = buildChatCompletionsBody("dGVzdA==", "image/png");
      const parsed = JSON.parse(body);

      expect(parsed).toHaveProperty("model");
      expect(parsed).toHaveProperty("messages");
      expect(parsed.messages).toHaveLength(2);
    });

    it("should include the system prompt in the first message", () => {
      const body = buildChatCompletionsBody("dGVzdA==", "image/png");
      const parsed = JSON.parse(body);

      expect(parsed.messages[0].role).toBe("system");
      expect(parsed.messages[0].content).toBe(PDF_TO_MARKDOWN_SYSTEM_PROMPT);
    });

    it("should include the image as a Base64 data URL in the user message", () => {
      const body = buildChatCompletionsBody("abc123", "image/jpeg");
      const parsed = JSON.parse(body);

      expect(parsed.messages[1].role).toBe("user");
      expect(parsed.messages[1].content).toBeInstanceOf(Array);

      const imageContent = parsed.messages[1].content.find(
        (c: { type: string }) => c.type === "image_url",
      );
      expect(imageContent).toBeDefined();
      expect(imageContent.image_url.url).toBe("data:image/jpeg;base64,abc123");
    });

    it("should include a text instruction in the user message", () => {
      const body = buildChatCompletionsBody("abc123", "image/png");
      const parsed = JSON.parse(body);

      const textContent = parsed.messages[1].content.find(
        (c: { type: string }) => c.type === "text",
      );
      expect(textContent).toBeDefined();
      expect(textContent.text).toContain("Markdown");
    });

    it("should use the provided model name", () => {
      const body = buildChatCompletionsBody("abc123", "image/png", "custom-model");
      const parsed = JSON.parse(body);

      expect(parsed.model).toBe("custom-model");
    });

    it("should fall back to default model when none is provided", () => {
      const orig = process.env.COPILOT_MODEL;
      delete process.env.COPILOT_MODEL;

      const body = buildChatCompletionsBody("abc123", "image/png");
      const parsed = JSON.parse(body);

      expect(parsed.model).toBe("openai/gpt-4o");

      if (orig !== undefined) process.env.COPILOT_MODEL = orig;
    });
  });

  describe("extractContentFromResponse", () => {
    it("should extract content from a valid response", () => {
      const response = JSON.stringify({
        choices: [{ message: { content: "# Hello World\n\nSome text." } }],
      });

      expect(extractContentFromResponse(response)).toBe("# Hello World\n\nSome text.");
    });

    it("should trim whitespace from content", () => {
      const response = JSON.stringify({
        choices: [{ message: { content: "  hello  " } }],
      });

      expect(extractContentFromResponse(response)).toBe("hello");
    });

    it("should throw on invalid JSON", () => {
      expect(() => extractContentFromResponse("not json")).toThrow("invalid JSON");
    });

    it("should throw when choices array is empty", () => {
      const response = JSON.stringify({ choices: [] });
      expect(() => extractContentFromResponse(response)).toThrow("no content");
    });

    it("should throw when content is missing", () => {
      const response = JSON.stringify({
        choices: [{ message: {} }],
      });
      expect(() => extractContentFromResponse(response)).toThrow("no content");
    });
  });

  describe("mergePageMarkdowns", () => {
    it("should return empty string for empty array", () => {
      expect(mergePageMarkdowns([])).toBe("");
    });

    it("should return the single page without heading when only one page", () => {
      expect(mergePageMarkdowns(["# Hello"])).toBe("# Hello");
    });

    it("should add page headings by default", () => {
      const result = mergePageMarkdowns(["Page one", "Page two"]);

      expect(result).toContain("## Page 1");
      expect(result).toContain("## Page 2");
      expect(result).toContain("Page one");
      expect(result).toContain("Page two");
    });

    it("should separate pages with horizontal rules", () => {
      const result = mergePageMarkdowns(["A", "B"]);
      expect(result).toContain("---");
    });

    it("should omit page headings when preservePageHeadings is false", () => {
      const result = mergePageMarkdowns(["A", "B"], false);

      expect(result).not.toContain("## Page");
      expect(result).toContain("A");
      expect(result).toContain("B");
    });
  });

  describe("getGithubToken", () => {
    const origToken = process.env.GITHUB_TOKEN;
    const origTokenLower = process.env.github_token;

    afterEach(() => {
      if (origToken !== undefined) process.env.GITHUB_TOKEN = origToken;
      else delete process.env.GITHUB_TOKEN;
      if (origTokenLower !== undefined) process.env.github_token = origTokenLower;
      else delete process.env.github_token;
    });

    it("should return GITHUB_TOKEN if set", () => {
      process.env.GITHUB_TOKEN = "test-token";
      expect(getGithubToken()).toBe("test-token");
    });

    it("should fall back to github_token", () => {
      delete process.env.GITHUB_TOKEN;
      process.env.github_token = "lower-token";
      expect(getGithubToken()).toBe("lower-token");
    });

    it("should return null when no token is set", () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.github_token;
      expect(getGithubToken()).toBeNull();
    });
  });
});

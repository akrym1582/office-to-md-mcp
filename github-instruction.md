# GitHub Instructions for office-to-md-mcp

This document describes how to configure the MCP server for use with **GitHub Copilot** and related GitHub tooling.

---

## Configuring GitHub Copilot CLI integration

The `convert_pdf_images_to_markdown` tool uses the **GitHub CLI** (`gh`) with Copilot extensions to convert PDF page images into Markdown.

### 1. Install GitHub CLI

```bash
# macOS
brew install gh

# Ubuntu/Debian
sudo apt-get install gh

# Windows (winget)
winget install --id GitHub.cli
```

### 2. Authenticate

```bash
gh auth login
```

### 3. Set the GitHub token environment variable

The server reads the token from `GITHUB_TOKEN` (preferred) or `github_token` (fallback).

```bash
export GITHUB_TOKEN="ghp_your_token_here"
```

For persistent configuration, add this to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.).

---

## Using as a GitHub Copilot MCP server

Add the server to your MCP client configuration (e.g. VS Code `settings.json` or Claude Desktop `config.json`):

```json
{
  "mcpServers": {
    "office-to-md-mcp": {
      "command": "node",
      "args": ["/path/to/office-to-md-mcp/dist/server.js"],
      "env": {
        "GITHUB_TOKEN": "${env:GITHUB_TOKEN}"
      }
    }
  }
}
```

---

## Checking capabilities at runtime

Use the `get_capabilities` tool to verify all integrations are working:

```
Tool: get_capabilities
Input: {}
```

Expected output when fully configured:

```json
{
  "libreOffice": true,
  "python": true,
  "unoHelper": true,
  "pdfRenderer": true,
  "pdfRendererTool": "pdftoppm",
  "copilotCli": true,
  "copilotCliPath": "/usr/bin/gh",
  "githubToken": true
}
```

---

## PDF to Markdown workflow

When `gh` and `GITHUB_TOKEN` are available, calling `convert_pdf_images_to_markdown` will:

1. Render each PDF page to a PNG image using `pdftoppm`
2. Send each image to GitHub Copilot CLI for transcription
3. Merge the per-page Markdown into a single document

The Copilot prompt instructs it to:
- Faithfully transcribe all readable text
- Preserve document headings and structure
- Convert tables to Markdown tables where possible
- Summarise diagrams and charts as Markdown bullets
- Mark illegible areas as `[unclear]`

---

## Token scopes

The `GITHUB_TOKEN` used for Copilot CLI calls requires the `copilot` scope. When creating a personal access token (PAT):

1. Go to **GitHub → Settings → Developer settings → Personal access tokens**
2. Create a new token with the **`copilot`** scope
3. Set it as `GITHUB_TOKEN` in your environment

---

## Troubleshooting

**`copilotCli: false` in capabilities**  
Ensure `gh` is installed and available on `PATH`.

**`githubToken: false` in capabilities**  
Set the `GITHUB_TOKEN` environment variable before starting the server.

**Copilot Markdown conversion returns empty results**  
Check that the token has the `copilot` scope. Run `gh auth status` to verify authentication.

**`provider: "unavailable"` in response**  
This is not an error — it means neither `gh` nor a token was found. The tool returns an empty Markdown string gracefully rather than failing.

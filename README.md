# Invoicer MCP

Local MCP integration for Codex, Claude Code and other desktop clients. No hosted server is required.

Install Invoicer 2.4+ and use Settings → Integrations to copy a direct configuration. The optional plugin below uses the version-pinned npm CLI and requires Node.js 22.18+ and npm.

## Claude Code plugin

```sh
claude plugin marketplace add InBrief-Inc/invoicer-mcp
claude plugin install invoicer@invoicer-plugins
```

Select the intended workspace in Invoicer before starting the connection, then restart it after switching workspaces. Your MCP client controls local tool permissions. Requested business data is shared with your chosen AI provider.

[Setup and support](https://invoicer.inbrief.sh/mcp) · [Privacy](https://invoicer.inbrief.sh/privacy)

Web connectors require a hosted relay and will follow separately. This repository contains only plugin metadata and assets; it does not contain desktop application source or workspace data.

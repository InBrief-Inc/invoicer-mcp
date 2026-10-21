# Invoicer MCP

Local MCP integration for Codex, Claude Code and other desktop clients. No hosted server is required.

Install Invoicer 2.4+ and use Settings → Integrations to copy a direct configuration. The plugin below includes the MCP server and its JavaScript dependencies. It requires Node.js 22.18+; no npm installation is needed at runtime.

## Claude Code plugin

```sh
claude plugin marketplace add InBrief-Inc/invoicer-mcp
claude plugin install invoicer@invoicer-plugins
```

Select the intended workspace in Invoicer before starting the connection, then restart it after switching workspaces. Your MCP client controls local tool permissions. Requested business data is shared with your chosen AI provider.

[Setup and support](https://invoicer.inbrief.sh/mcp) · [Privacy](https://invoicer.inbrief.sh/privacy)

Web connectors require a hosted relay and will follow separately. This repository contains the plugin metadata, bundled CLI server and PDF assets. It does not contain the desktop application source or workspace data.

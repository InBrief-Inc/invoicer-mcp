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

Web connectors require a hosted relay and will follow separately. This repository contains the plugin metadata, readable MCP runtime and PDF assets. It does not contain the desktop application source or workspace data.

## Build and test

Plugin 2.4.1 packages the MCP tools from the published CLI 2.4.0. It does not require a new desktop release. The generated runtime is committed as readable JavaScript files below Claude’s 256 KiB text-file limit; no package install runs when the plugin starts.

```sh
npm ci
npm run build
npm test
npm run check
```

The build removes unused interactive and email-sending CLI entry points, preserves dependency notices, and records the source package integrity and output hashes. Tests run the installed plugin from a separate folder without `node_modules`, exercise all 15 tools, and compare its tool schemas and PDF bytes with the published CLI. The original desktop application source and user workspaces are never copied into the distribution.

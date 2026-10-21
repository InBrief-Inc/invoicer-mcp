# Invoicer MCP plugin 2.4.1

Connect your assistant to your local Invoicer workspace. The MCP server includes its JavaScript dependencies as readable modules, along with the PDF fonts. Requires Node.js 22.18 or newer. No npm download or hosted server is needed at runtime.

## Install in Claude Code

```text
/plugin install invoicer --marketplace InBrief-Inc/invoicer-mcp
```

You can also add the marketplace and install the plugin:

```sh
claude plugin marketplace add InBrief-Inc/invoicer-mcp
claude plugin install invoicer@invoicer-plugins
```

Select your workspace in Invoicer before starting the connection. Restart the connection after switching workspaces. The plugin can read clients, invoices, time entries and timers; log work and manage timers; preview and save unscheduled invoice drafts; and export invoice PDFs. It cannot send invoices or make payments.

Tool results are shared with the assistant you use. Your workspace remains on your computer. Review the host assistant's tool permissions before enabling writes.

Setup: https://invoicer.inbrief.sh/mcp
Privacy: https://invoicer.inbrief.sh/privacy
Terms: https://invoicer.inbrief.sh/terms
Support: support@inbrief.sh

## Readable runtime and reproducible builds

This plugin version packages the published `@invoicer/cli@2.4.0` MCP implementation. It remains compatible with Invoicer desktop 2.4.0 or later. Plugin packaging versions are independent of the desktop release.

Claude starts `node server/dist/cli.js mcp` from the installed plugin. That entry point imports the committed JavaScript modules in `server/dist/modules/`. Every text file is under Claude’s 256 KiB inspection limit. Modules keep readable function names, source-module labels, license notices and initialization order; the packaging does not download dependencies or decode executable payloads at startup. The only runtime prerequisites are Node.js and access to the local workspace.

The runtime exposes only the 15 MCP tools. The interactive CLI, email-sending commands and native credential binaries are not included. PDF font tables and dictionary data remain ordinary data used by the included font parser. Dependency license files and embedded notices are collected in `server/dist/THIRD_PARTY_NOTICES.txt`; the font license is in `server/pdf-fonts.LICENSE`.

Build scripts, the exact npm dependency lockfile, packaging regression tests and an all-tool integration test are in the repository root. Run `npm ci`, `npm run build`, `npm test` and `npm run check` there to reproduce and check the files. `server/BUILD.json` records the source package integrity and generated file hashes. None of these build tools is required on the user’s computer.

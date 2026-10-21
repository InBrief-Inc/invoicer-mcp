# Invoicer 2.4.0

Connect your assistant to your local Invoicer workspace. The bundled MCP server includes its JavaScript dependencies and PDF fonts. Requires Node.js 22.18 or newer. No npm download or hosted server is needed at runtime.

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

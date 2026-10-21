# Invoicer local MCP plugin privacy policy

Updated October 21, 2026. Developer: Milad Fahmy. Contact: support@inbrief.sh.

This policy covers the local Invoicer MCP plugin distributed in this repository. It runs on your computer and connects to the Invoicer workspace selected before the connection starts. No Invoicer-hosted relay is used by this plugin.

## Data read and saved

Tools read the workspace's clients, time entries, timers and invoices. Those records can include names, email addresses, postal addresses, invoice amounts and work descriptions. When you request a write, the plugin saves time entries, timer changes or unscheduled invoice drafts in your local workspace. It also saves local retry records to prevent repeated requests from creating duplicate changes. PDF export reads invoice details and returns the PDF to your assistant.

Credentials and private filesystem paths are excluded from normal tool results. The plugin does not send invoices, make payments or transmit credentials to the assistant.

## Sharing

Requested tool results, including personal data and PDFs, are passed to the assistant application you chose. That application and its AI provider handle those results under their own privacy terms. Review their permissions and policies before connecting. The MCP server does not send workspace data to an Invoicer cloud service, analytics service or other external endpoint.

## Retention and control

Workspace records and retry records remain on your computer until you delete them. They are not automatically deleted after 30 days or when you uninstall the plugin. Your assistant provider may separately retain the conversations and tool results it receives. Restart the MCP connection after changing workspaces. You can disconnect the plugin in your assistant and manage or delete the workspace through Invoicer or your local files.

The plugin is intended for professional time tracking and invoicing, and is not directed to children. Contact support@inbrief.sh about this policy or the plugin.

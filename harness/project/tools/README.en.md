# Tools

Audience: both

> **Summary:** one sheet per external service the project uses (MCP, CLI or REST): what it is for, how it was tested, who may write.
> Read the sheet before using the service.

## How to add a connection

1. Copy `TEMPLATE.md` to `<name>/README.md` inside this folder.
2. Fill every field. Never write a key or token value: only the names of the variables.
3. Add one row to the index below.

## Index

| Connection | Account or target | Route (MCP / CLI / REST) | Mode (read-only / read-write) | Last OK |
| --- | --- | --- | --- | --- |
| <name> | <account or target> | <route> | <mode> | <date> |

Connections documented elsewhere (for example a `tools/` folder at the project root) are listed here by path.

## For the assistant

Before using an external service, read its sheet. Run its `test_connection` only if the sheet says it is safe for an agent.

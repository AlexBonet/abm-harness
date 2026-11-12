# <Connection name>

Audience: both

> **Summary:** one sentence: which service this is and what the project uses it for.

- **Purpose:** <what the project does with this service>
- **Route:** <MCP, CLI or REST> - <why this route and not another>
- **Account or target:** <which account, project or workspace>
- **How it was tested:** <date and what was checked>
- **Who may write:** <nobody (read-only) / who and under which condition>
- **Limits:** <rate limits, costs, data it must never touch>
- **.env.example:** <names of the variables only, never their values>
- **Safe for an agent to run `test_connection`:** <yes / no>

## `test_connection` contract

The project may ship a `test_connection` script next to this sheet. It must:

- only check the identity (who am I on this service), never change anything;
- be read-only;
- exit 0 and print `OK <name> → <identity>`;
- exit non-zero and print the reason when it fails;
- never print a secret.

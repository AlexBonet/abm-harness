# Pack: comms

> **Summary:** how the docs folder stays readable and current. Each rule has an id and a named check; `{{ABMH}}checks/check.sh prueba` runs them.

| id | rule | check | type | gate |
| --- | --- | --- | --- | --- |
| COM-01 | Every docs file declares its reader and opens with a summary quote | com-01.sh | script | Prueba |
| COM-02 | `MEMORY.md` stays within 8 KB and each entry within 600 bytes | com-02.sh | script | Prueba |
| COM-03 | The docs folder has a `GLOSSARY.md` | com-03.sh | script | Prueba |
| COM-04 | `STATUS` and `LEEME` carry a recent "last reviewed" date | com-04.sh | script | Prueba |

## Waiting for an agent

No script can judge these; they stay out until an agent check exists:

- Every reply opens with `En corto`, at most 3 decisions with a recommendation (baseline §2).
- The final report has the Post-Flight shape (baseline §4).
- Re-reading the rules every ~10 tool calls (baseline §5).
- `MEMORY.md` keeps only what is not derivable from code, git or the SPEC.

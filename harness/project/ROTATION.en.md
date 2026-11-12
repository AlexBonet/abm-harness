# ROTATION

Audience: both

> **Summary:** what to do when a secret leaks or a person leaves: which secrets exist, where each one lives and the exact steps to replace it.
> Never write a secret here, only its name and where it is stored.
> Last reviewed: YYYY-MM-DD

## Secrets

| Name | Used by | Stored in | Rotated by |
| --- | --- | --- | --- |
| secret name, never its value | service or file that reads it | vault, CI setting or env file outside git | person |

## Steps when one leaks

1. Revoke or rotate the secret at its provider first.
2. Store the new value where the table says; never in a versioned file.
3. Remove the leaked value from the repository history if it was pushed, with the human's OK.
4. Redeploy what depends on it and check it still works.
5. Record what happened in `decisions/` or `STATUS`.

## Who is told

- Name the person or channel to tell and when.

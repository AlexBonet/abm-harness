# Pack: code-kotlin

> **Summary:** how the code checks read Kotlin projects. Installed when a Gradle Kotlin build or `.kt` files are detected, or with `--packs code-kotlin`.

## What the checks use

- Sources: `.kt` files outside `build/`; tests: `test/`, `androidTest/`, `commonTest/` or `*Test.kt`.
- Domain folder: any folder named `domain`; forbidden imports: `android.`, `androidx.`, `java.sql`, `io.ktor`, `retrofit2`, `okhttp3`, Firebase.
- Comments: `//`, `/* */`, KDoc; allowed: `@Suppress`, `noinspection`, `ktlint-disable`, `detekt`.
- `Any`: `: Any`, `<Any>`, `as Any`; allowed: `override fun equals(other: Any?)`.
- UI text: `Text("...")`, `text =`, `contentDescription =`, `label =`, `title =` with a literal.
- Signatures: top-level `fun name(params)`, `override` excluded.

## Verify command

- `./gradlew test` plus the project's linter (for example `./gradlew detekt`).

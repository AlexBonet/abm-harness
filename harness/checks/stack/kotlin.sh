STACK=kotlin
EXT="kt"
TEST_RE='(^|/)(test|androidTest|commonTest)/|Test\.kt$'
COMMENT_RE='^[[:space:]]*(//|/\*|\* |\*/|\*$)|([[:space:]]|;)//|[[:space:]]/\*'
DIRECTIVE_RE='noinspection|ktlint-disable|@Suppress|detekt|SPDX'
ANY_RE=': Any\??([^A-Za-z0-9_]|$)|<Any\??>|as Any\??([^A-Za-z0-9_]|$)'
ANY_ALLOWED_RE='override fun equals\('
DOMAIN_NAME=domain
DOMAIN_FORBIDDEN_RE='^import (android\.|androidx\.|java\.sql|javax\.sql|io\.ktor|retrofit2|okhttp3|com\.google\.firebase|io\.github\.jan)'
UI_STRING_RE='(Text\(|text = |contentDescription = |label = |title = )"[^"$]*[A-Za-z]{2,}'
SIG_SED='s/^((public|suspend|inline) )*fun ([A-Za-z0-9_]+\(.*\)).*/\3/p'
SIG_EXEMPT_RE='^main\('

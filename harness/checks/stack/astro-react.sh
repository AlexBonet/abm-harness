STACK=astro-react
EXT="ts tsx js jsx mjs astro"
TEST_RE='(\.|/)(test|spec)\.|(^|/)(tests?|__tests__)/'
COMMENT_RE='^[[:space:]]*(//|/\*|\* |\*/|\*$|<!--|\{/\*)|([[:space:]]|;)//|[[:space:]]/\*'
DIRECTIVE_RE='@ts-|eslint-|prettier-ignore|biome-ignore|SPDX|noinspection'
ANY_RE=': any([^A-Za-z0-9_]|$)|as any([^A-Za-z0-9_]|$)|<any>|(^|[^A-Za-z0-9_])any\[\]'
ANY_ALLOWED_RE='^$'
DOMAIN_NAME=domain
DOMAIN_FORBIDDEN_RE="(from|require\\()[[:space:]]*['\"](react|react-dom|astro|astro:[a-z]+|@astrojs/[a-z-]+|next|@supabase/[a-z-]+|firebase[a-z/-]*)(/[^'\"]*)?['\"]"
UI_STRING_RE='>[[:space:]]*[A-Za-z][A-Za-z ,.!?-]{2,}[[:space:]]*<|(alt|title|placeholder|aria-label)="[A-Za-z]'
SIG_SED='s/^export (async )?function ([A-Za-z0-9_]+\(.*\)).*/\2/p'
SIG_EXEMPT_RE='^(main|getStaticPaths|GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|ALL)\('

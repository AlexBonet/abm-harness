# abm-harness

Instala el arnés ABMH (reglas de trabajo, plantillas, protocolos, skills y agentes de revisión) en cualquier proyecto, **dentro de ese proyecto**. Primero te enseña un plan sin escribir nada; solo si aceptas ese plan exacto, lo instala.

English: [README.en.md](README.en.md)

## Inicio rápido

Necesitas Node 20 o superior, git y pnpm. En la raíz de tu proyecto:

```sh
pnpm dlx github:AlexBonet/abm-harness#v0.1.0 init                      # enseña el plan; no escribe nada
pnpm dlx github:AlexBonet/abm-harness#v0.1.0 init --accept-plan <id>   # instala exactamente ese plan
pnpm dlx github:AlexBonet/abm-harness#v0.1.0 update                    # plan para actualizar; se acepta igual
pnpm dlx github:AlexBonet/abm-harness#v0.1.0 doctor                    # comprueba la instalación; no cambia nada
pnpm dlx github:AlexBonet/abm-harness#v0.1.0 remove                    # plan para quitar lo que instaló
```

`remove` deja el proyecto como estaba antes. Licencia MIT (`LICENSE`, `NOTICES.md`).

## Qué es y qué no es

- Es un instalador pequeño (un script de Node, sin dependencias) con cinco comandos: `init`, `update`, `remove`, `doctor` y `migrate` (este último solo para mover `shared-domain/` a `00-docs/`).
- No toca nada fuera del proyecto (salvo la copia de seguridad de `migrate`), no lee ni escribe `.env`, no hace commit ni push.
- No instala los mods de Claude Code (Cabina, Guardia, Migraciones). Las reglas se hacen cumplir con un git hook y con instrucciones.
- No usa npm ni npx. Si necesitas un gestor de paquetes, usa pnpm.

## Qué instala para trabajar

- `.abmh/lanes/`: 6 carriles (Consulta, Cambio, SPEC corta, SDD, Bug, Deploy). Primero se mide el riesgo y luego se elige carril; lo de «siempre SDD» manda sobre cualquiera.
- `.abmh/gates/`: 6 peajes (Prueba, Revisión, Diseño, SEO, Seguridad, Despliegue).
- `.abmh/packs/` y `.abmh/checks/`: packs de reglas (código, comunicación y memoria, seguridad, más uno por stack detectado —Kotlin o Astro/React— el de migraciones y datos si hay carpeta de migraciones, el de despliegue siempre y el de diseño si hay interfaz; el de SEO web solo si lo pides). Cada regla tiene un id y un script `.sh` que la comprueba; `sh .abmh/checks/check.sh prueba`, `seguridad`, `despliegue`, `diseño` o `seo` muestra PASS, FAIL o NOT RUN por regla. Si no se detecta el stack, queda «pendiente» y se completa con `update --packs <id>`.
- `.abmh/agents/`: 10 fichas de agente. Con el perfil `abm-estricto` se añade `.abmh/strict.md` (pnpm, arquitectura limpia, cero comentarios).

## Instalar

Necesitas Node 20 o superior y git. Una sola vez, descarga el repo:

```sh
git clone https://github.com/AlexBonet/abm-harness.git ~/abm-harness
```

Opcional, para escribir menos:

```sh
alias abmh='node ~/abm-harness/bin/abmh.mjs'
```

## Usar en un proyecto

1. Entra en la **raíz** del proyecto (la carpeta que contiene `.git`):

   ```sh
   cd /ruta/a/tu-proyecto
   node ~/abm-harness/bin/abmh.mjs init
   ```

2. Lee el plan. Verás algo así (no se ha escrito nada todavía):

   ```
   abmh init plan for /ruta/a/tu-proyecto
   plan id: c32bb855310e…
   [harness]
     create-file .abmh/core/ (34 files) - harness file
     create-file .abmh/skills/ (2 files) - harness file
   [claude]
     link .claude/skills/spec -> .abmh/skills/spec - expose to the assistant
   [instructions]
     block AGENTS.md - add the harness block to the existing file
   [hooks]
     config core.hooksPath=.abmh/hooks - run the harness git hook

   Nothing is written until you accept this exact plan:
     node ~/abm-harness/bin/abmh.mjs init --accept-plan c32bb855310e…
   ```

3. Si te parece bien, copia y ejecuta la última línea (con el id completo). Eso instala.

Si el proyecto cambia entre el plan y la aceptación, el instalador se niega (`ABMH_PLAN_CHANGED`, código 3), no escribe nada y te pide otro plan.

## Qué queda escrito

| Dónde | Qué |
|---|---|
| `.abmh/` | Copia del arnés (`core/`, `skills/`, `agents/`, `hooks/`) `manifest.json` (el registro de todo lo instalado) y `harness.yaml` (versión, perfil y carpeta de docs). |
| `00-docs/` | `LEEME.md`, `STATUS.md`, `MEMORY.md` y `GAPS.md`, cada uno con `Audience:` y un resumen de 3 líneas (la ruta se cambia con `--docs-dir`). |
| `00-docs/decisions/` | Una guía y una plantilla para registrar decisiones. |
| `.claude/skills/`, `.claude/agents/` | Enlaces a `.abmh/` para Claude Code. |
| `.agents/skills/` | Enlaces a las skills de `.abmh/skills/` (todas menos `abms-spec-review`) para Codex, Gemini, Cursor y OpenCode. |
| `AGENTS.md` | Un bloque entre `<!-- abmh:start -->` y `<!-- abmh:end -->`. Si el archivo no existe, se crea. Lo que ya tenías no se toca. |
| `GEMINI.md` | El mismo bloque. Se crea con el valor por defecto (todos los asistentes); con `--assistants` sin `gemini` no se crea. |
| `.git/config` | `core.hooksPath` apuntando a `.abmh/hooks`, solo si el repo no tiene ya hooks propios. |

`harness.yaml` lo escribe el instalador: para cambiar la carpeta de docs usa `update --docs-dir`; para cambiar de perfil, `remove` y `init`.

Si un enlace no se puede crear en tu sistema, se copia el archivo en su lugar. Si una ruta ya existe y es tuya, se salta y se avisa en el plan.

Haz tú el commit de `.abmh/` si quieres compartirlo con tu equipo; el instalador nunca lo hace.

## Opciones de `init`

| Opción | Qué hace |
|---|---|
| `--assistants claude,codex,gemini,cursor,opencode` | Para qué asistentes instalar (por defecto, todos). |
| `--lang es` o `--lang en` | Idioma de "Resumen" y "En corto" (por defecto, español). |
| `--ci` | Solo en `init`: escribe también `.github/workflows/abmh-ci.yml` (lint, tipos, tests y `verify.sh` con pnpm). Sin ella el plan solo avisa de que existe. |
| `--packs code-kotlin`, `code-astro-react`, `data`, `design` o `seo` | Elige un stack, el pack de migraciones, el de diseño o el de SEO web que la detección no vio, o completa un proyecto pendiente con `update --packs`. |
| `--profile universal` o `--profile abm-estricto` | `universal` (por defecto) instala lo imprescindible; `abm-estricto` añade además las plantillas de proyecto de ABMS. |
| `--docs-dir <carpeta>` | Raíz de los docs (por defecto `00-docs`); las decisiones van en `<carpeta>/decisions/`. También vale en `update`. Si un archivo que se iba a crear ya existe y es tuyo, el plan lo avisa y propone otra ruta. |
| `--no-hooks` | No instala el git hook. |
| `--yes` | Solo en `init`: no hace las preguntas aunque estés en una terminal. |
| `--root <carpeta>` | Instala en otra carpeta; úsalo si no estás en la raíz del repo. |
| `--accept-plan <id>` | Aplica el plan con ese id. |

Repetir `init` en un proyecto ya instalado no cambia nada.

En una terminal, `init` pregunta lo que no puede detectar (perfil, asistentes, pack de SEO, el archivo de CI y, si ya existe `00-docs`, otra carpeta para los docs) y solo para lo que no diste como opción; después enseña el plan como siempre. Sin terminal (un script, un CI) o con `--yes` no pregunta nunca.

## Actualizar y quitar

```sh
node ~/abm-harness/bin/abmh.mjs update     # muestra un plan nuevo; acéptalo igual que init
node ~/abm-harness/bin/abmh.mjs remove     # muestra qué quitaría; acéptalo con su id
```

- `update` no pisa los archivos que hayas editado a mano: los salta y los lista.
- Una instalación antigua que usaba `docs/decisions/` se migra con `update`: crea la carpeta nueva, borra de la vieja solo lo que instaló el instalador y no has tocado, y lista lo que se queda donde estaba. Nunca mueve archivos tuyos.
- `remove` borra solo lo que el manifiesto dice que instaló y que sigue igual. Lo que editaste se queda y se lista. Si `AGENTS.md` lo creó el instalador y solo contiene el bloque, se borra; si no, solo se quita el bloque.
- Si una instalación se corta a medias, `init` te dice el id con el que reanudarla, y `remove` también funciona.

## Migrar `shared-domain/` a `00-docs/`

Para un proyecto que ya tiene `shared-domain/`:

```sh
node ~/abm-harness/bin/abmh.mjs migrate
```

Muestra un plan (qué se renombra, qué archivos cambian de texto y cuántas veces) y no escribe nada. Aceptarlo con `--accept-plan <id>` hace, en este orden:

1. Guarda una copia `.tar.gz` y un `.json` en `<carpeta padre del proyecto>/_backups/` (otra carpeta con `--backup-dir`; nunca dentro del proyecto). Es lo único que se escribe fuera del proyecto.
2. Renombra `shared-domain/` a `00-docs/`.
3. Cambia el texto `shared-domain/` por `00-docs/` en archivos `.md .json .yaml .yml .sh .ts .js`. Se salta `node_modules`, `.git`, `.abmh`, `.env*`, enlaces simbólicos, binarios y archivos de más de 1 MB. No borra nada.

Para volver atrás: `migrate --restore <copia.tar.gz>` muestra un plan; al aceptarlo aparta la `00-docs/` actual como `00-docs.restored-<fecha>/` (no la borra) y recupera la copia. Si `00-docs/` ya existe con contenido o `shared-domain/` no existe, se niega sin escribir. Dentro de un repo grande, pasa `--root <carpeta>`.

## Comprobar la instalación (`doctor`)

`abmh doctor` no cambia el proyecto (solo usa ficheros temporales fuera de él y los borra). Imprime una línea por comprobación (`OK`, `FAIL` o `NOT RUN`) y, en cada `FAIL`, cómo arreglarlo. Una comprobación que no pudo ejecutarse nunca sale como OK.

| Id | Qué mira |
|---|---|
| D1 | manifiesto válido y versión del arnés al día |
| D2 | archivos del arnés, enlaces y bloque de `AGENTS.md` sin tocar o perdidos (`harness.yaml` y tus docs se pueden editar) |
| D3 | git hook instalado en este clon; con husky u otro gestor de hooks sale NOT RUN y el único freno es el CI |
| D4 | packs de `harness.yaml` iguales a los instalados; sin stack detectado sale NOT RUN |
| D5 | `LEEME`, `STATUS`, `MEMORY`, `GAPS` y `decisions/` existen |
| SEC, DEP | resultado de `check.sh seguridad` y `check.sh despliegue` (`RELEASE.md` y `RECOVERY.md` sin rellenar salen FAIL) |

Salida de `doctor`: 0 todo OK · 1 algún FAIL · 2 solo NOT RUN.

## Códigos de salida

0 bien · 2 uso incorrecto · 3 el plan cambió · 4 rechazado por seguridad o conflicto · 5 falló al aplicar.

## Skills

El núcleo son ocho. Cinco viajan con el arnés y se instalan como `spec`: `spec`, `abms-spec-review`, `grill`, `wizard` y `diagnose`. Tres son de Claude Code y solo se nombran, nunca se copian: `code-review`, `simplify` y `security-review`.

- Regla de oro: una skill entra solo si sustituye a otra o arregla un fallo medido. Ampliar el núcleo lo decide una persona y edita `tests/skills.test.mjs`.
- `grill` y `wizard` llevan la marca para que Claude Code nunca los invoque por su cuenta, y su texto dice que solo se usan si se piden por nombre; `diagnose` sí puede invocarse. `grill` acaba ofreciendo términos de glosario y decisiones, y escribe solo lo que la persona acepta.
- Packs, nombrados y no instalados: web (`impeccable`, `landing`, `design:accessibility-review`, `design:design-system`) y deploy (`wrangler`, `workers-best-practices`, `web-perf`, `engineering:deploy-checklist`).
- Las skills de terceros solo se absorben como ideas, con fuente y licencia en la cabecera.

## Límites conocidos

- Algunas plantillas y la skill `spec` conservan ejemplos y rutas pensados para el sistema ABMS (por ejemplo `shared-domain/`). Sirven como guía, pero en un proyecto ajeno puede que no apliquen tal cual.
- La skill `abms-spec-review` y los agentes revisores solo se enlazan para Claude Code, porque necesitan subagentes de Claude.
- Si algo falla, no borres a mano: ejecuta `remove`.
- Con husky u otro gestor de hooks, `init` no instala el git hook (no pisa el tuyo): el escaneo de secretos corre solo en el CI. `doctor` lo dice.
- Si el proyecto ignora `.claude/skills/` o `.agents/skills/` en su `.gitignore`, los enlaces de skills existen en tu copia pero no se comparten por git.
- `RELEASE.md` y `RECOVERY.md` se instalan sin rellenar: las reglas de despliegue fallan hasta que los completes.
- Windows y monorepos no se han probado.

## Desarrollo

`harness/` es la fuente del arnés. `sh scripts/verify.sh` comprueba todo: reglas del repo, tests y, si el repo vive dentro de un árbol de trabajo que lo consume, que `node scripts/sync.mjs --check` coincida; si no hay tal árbol, esa comprobación sale NOT RUN (no cuenta como OK) y el resto sigue.

## Licencia

MIT, ver `LICENSE`. Las ideas tomadas de terceros, con su fuente y licencia, están en `NOTICES.md`.

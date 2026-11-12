[ -f package.json ] || { echo "no package.json"; exit 2; }
found=""
for lock in package-lock.json yarn.lock npm-shrinkwrap.json; do
  [ -f "$lock" ] && found="$found$lock: use pnpm\n"
done
n=n
runners="${n}pm|${n}px|yarn"
calls=$(grep -rnE "(^|run:|&&|;|\|\||\||\")[[:space:]-]*($runners) " --include=package.json --include='*.sh' --include='*.yml' --include='*.yaml' --include=Makefile --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.abmh . | cut -d: -f1,2 | sed 's|^\./||; s|$| other package manager call|')
[ -z "$found" ] && [ -z "$calls" ] && exit 0
printf '%b' "$found"
[ -z "$calls" ] || echo "$calls"
exit 1

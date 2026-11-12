import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { project, sh, write } from './checkhelpers.mjs'
import { install, makeRepo } from './helpers.mjs'

const LD = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"X"}</script>'
const page = ({ title = '<title>Home</title>', description = '<meta name="description" content="A page">', canonical = '<link rel="canonical" href="https://x.test/">', ld = LD, body = '<h1>Hi</h1>' } = {}) =>
  `<!doctype html>\n<html>\n<head>\n${title}\n${description}\n${canonical}\n${ld}\n</head>\n<body>\n${body}\n</body>\n</html>\n`
const SITEMAP = '<urlset>\n<url><loc>https://x.test/</loc></url>\n</urlset>\n'
const SITE = { 'dist/index.html': page(), 'dist/sitemap.xml': SITEMAP, 'dist/robots.txt': 'User-agent: *\n' }

const seo = (files = SITE, yaml = 'html_dir: dist\n') => {
  const dir = project({ files })
  write(dir, '.abmh/harness.yaml', `version: x\nprofile: universal\ndocsDir: 00-docs\n${yaml}`)
  return dir
}

const CASES = [
  ['SEO-01', 'seo-01.sh', 'dist/index.html', page({ title: '<title>  </title>' }), /dist\/index\.html: .*title/],
  ['SEO-02', 'seo-02.sh', 'dist/index.html', page({ description: '<meta name="description" content="">' }), /dist\/index\.html: .*description/],
  ['SEO-03', 'seo-03.sh', 'dist/index.html', page({ canonical: '' }), /dist\/index\.html: .*canonical/],
  ['SEO-06', 'seo-06.sh', 'dist/index.html', page({ body: '<h1>A</h1><h1>B</h1>' }), /dist\/index\.html: .*H1/],
  ['SEO-07', 'seo-07.sh', 'dist/index.html', page({ ld: '<script type="application/ld+json">{"@type": </script>' }), /dist\/index\.html: .*JSON-LD/],
]

test('every SEO check passes on a complete built site', () => {
  const dir = seo()
  for (const id of ['01', '02', '03', '04', '05', '06', '07']) assert.equal(sh(dir, `seo-${id}.sh`).code, 0, id)
})

for (const [id, script, file, broken, pattern] of CASES) {
  test(`${id} fails on the broken page and names it`, () => {
    const result = sh(seo({ ...SITE, [file]: broken }), script)
    assert.equal(result.code, 1, result.out)
    assert.match(result.out, pattern)
  })
}

test('SEO-06 also fails on a page with no H1, and accepts attributes in any order and single quotes', () => {
  assert.equal(sh(seo({ ...SITE, 'dist/index.html': page({ body: '<p>x</p>' }) }), 'seo-06.sh').code, 1)
  const loose = page({ description: "<meta content='A page' name='description'>", canonical: "<link href='https://x.test/' rel='canonical'>", body: '<h1 class="big">Hi</h1>' })
  const dir = seo({ ...SITE, 'dist/index.html': loose })
  for (const id of ['02', '03', '06']) assert.equal(sh(dir, `seo-${id}.sh`).code, 0, id)
})

test('SEO-04 needs sitemap.xml with a loc and SEO-05 needs robots.txt', () => {
  const noMap = { ...SITE }
  delete noMap['dist/sitemap.xml']
  assert.match(sh(seo(noMap), 'seo-04.sh').out, /sitemap\.xml/)
  assert.equal(sh(seo(noMap), 'seo-04.sh').code, 1)
  assert.equal(sh(seo({ ...SITE, 'dist/sitemap.xml': '<urlset></urlset>' }), 'seo-04.sh').code, 1)
  const noRobots = { ...SITE }
  delete noRobots['dist/robots.txt']
  const result = sh(seo(noRobots), 'seo-05.sh')
  assert.equal(result.code, 1)
  assert.match(result.out, /robots\.txt/)
})

test('pages with noindex and 404.html are not judged, nested pages are', () => {
  const files = { ...SITE, 'dist/404.html': '<html></html>', 'dist/gone/index.html': page({ title: '' }).replace('</head>', '<meta name="robots" content="noindex"></head>') }
  assert.equal(sh(seo(files), 'seo-01.sh').code, 0)
  const nested = sh(seo({ ...files, 'dist/blog/post/index.html': page({ title: '' }) }), 'seo-01.sh')
  assert.equal(nested.code, 1)
  assert.match(nested.out, /dist\/blog\/post\/index\.html/)
})

test('SEO-07 accepts pages without JSON-LD and several blocks', () => {
  const other = { ...SITE, 'dist/about/index.html': page({ ld: '' }) }
  assert.equal(sh(seo(other), 'seo-07.sh').code, 0)
  const two = page({ ld: `${LD}\n${LD}` })
  assert.equal(sh(seo({ ...SITE, 'dist/index.html': two }), 'seo-07.sh').code, 0)
  const bad = page({ ld: `${LD}\n<script type="application/ld+json">nope</script>` })
  assert.equal(sh(seo({ ...SITE, 'dist/index.html': bad }), 'seo-07.sh').code, 1)
})

test('every SEO check is NOT RUN without html_dir, without the folder or without pages', () => {
  for (const id of ['01', '02', '03', '04', '05', '06', '07']) {
    const script = `seo-${id}.sh`
    const none = sh(seo(SITE, ''), script)
    assert.equal(none.code, 2, `${id} none`)
    assert.match(none.out, /html_dir/)
    assert.equal(sh(seo(SITE, 'html_dir: build\n'), script).code, 2, `${id} folder`)
    assert.equal(sh(seo({ 'dist/robots.txt': 'x' }), script).code, 2, `${id} pages`)
  }
})

test('SEO-07 is NOT RUN when neither node nor jq is available', () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'abmh-bin-'))
  for (const tool of ['sh', 'grep', 'sed', 'tr', 'find', 'sort', 'wc', 'cat', 'head', 'tail', 'dirname', 'awk', 'git']) {
    fs.symlinkSync(execFileSync('sh', ['-c', `command -v ${tool}`], { encoding: 'utf8' }).trim(), path.join(bin, tool))
  }
  const result = sh(seo(), 'seo-07.sh', [], { PATH: bin })
  assert.equal(result.code, 2)
  assert.match(result.out, /node or jq/)
})

test('check.sh seo runs the SEO rules and a fresh install without html_dir reports NOT RUN, never a pass', () => {
  const result = sh(seo(), 'check.sh', ['seo'])
  assert.equal(result.code, 0, result.out)
  for (const id of ['01', '02', '03', '04', '05', '06', '07']) assert.match(result.out, new RegExp(`PASS SEO-${id}`))
  const dir = makeRepo({ 'README.md': 'x\n' })
  install(dir, ['--packs', 'seo'])
  const fresh = sh(dir, 'check.sh', ['seo'])
  assert.equal(fresh.code, 0)
  assert.doesNotMatch(fresh.out, /PASS/)
  assert.match(fresh.out, /NOT RUN SEO-07/)
})

test('SEO checks accept unquoted attributes and uppercase tags, and noindex written unquoted is skipped', () => {
  const loose = '<!DOCTYPE html><HTML><HEAD><TITLE>Home</TITLE><meta name=description content="A page"><link rel=canonical href=https://x.test/></HEAD><BODY><H1>Hi</H1></BODY></HTML>'
  const dir = seo({ ...SITE, 'dist/index.html': loose })
  for (const id of ['01', '02', '03', '06']) assert.equal(sh(dir, `seo-${id}.sh`).code, 0, id)
  const quiet = page({ title: '' }).replace('</head>', '<meta name=robots content=noindex></head>')
  assert.equal(sh(seo({ ...SITE, 'dist/quiet/index.html': quiet }), 'seo-01.sh').code, 0)
})

test('SEO-01 does not take an svg title for the page title', () => {
  const svg = page({ title: '', body: '<svg><title>icon</title></svg><h1>Hi</h1>' })
  assert.equal(sh(seo({ ...SITE, 'dist/index.html': svg }), 'seo-01.sh').code, 1)
})

test('SEO-04 accepts sitemap-index.xml', () => {
  const files = { ...SITE, 'dist/sitemap-index.xml': '<sitemapindex><sitemap><loc>https://x.test/s.xml</loc></sitemap></sitemapindex>' }
  delete files['dist/sitemap.xml']
  assert.equal(sh(seo(files), 'seo-04.sh').code, 0)
})

test('SEO-07 reads every block: escapes, angle brackets, uppercase tags, empty blocks', () => {
  const ld = (json, tag = 'script') => `<${tag} type="application/ld+json">${json}</${tag}>`
  const check = (json, tag) => sh(seo({ ...SITE, 'dist/index.html': page({ ld: ld(json, tag) }) }), 'seo-07.sh').code
  assert.equal(check('{"a":"x\\ny",}'), 1)
  assert.equal(check('{"a":"a<b",}'), 1)
  assert.equal(check('{"a":"a<b"}'), 0)
  assert.equal(check('{"a":1}', 'SCRIPT'), 0)
  assert.equal(check('{"a":,}', 'SCRIPT'), 1)
  assert.equal(check(''), 1)
})

test('SEO-07 is NOT RUN when no page has any JSON-LD at all', () => {
  const none = sh(seo({ ...SITE, 'dist/index.html': page({ ld: '' }) }), 'seo-07.sh')
  assert.equal(none.code, 2)
  assert.match(none.out, /no JSON-LD/)
})

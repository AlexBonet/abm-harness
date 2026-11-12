# Pack: seo

> **Summary:** what a public web page needs to be found and read by search engines. Optional: installed only with `--packs seo`, and only for public sites (not for apps behind a login). `{{ABMH}}checks/check.sh seo` runs the checks over the built HTML and reports PASS, FAIL or NOT RUN per id.

| id | rule | check | type | gate |
| --- | --- | --- | --- | --- |
| SEO-01 | Every page has a non-empty `<title>` | seo-01.sh | script | SEO |
| SEO-02 | Every page has a non-empty meta description | seo-02.sh | script | SEO |
| SEO-03 | Every page has a canonical link | seo-03.sh | script | SEO |
| SEO-04 | `sitemap.xml` exists and lists at least one `<loc>` | seo-04.sh | script | SEO |
| SEO-05 | `robots.txt` exists | seo-05.sh | script | SEO |
| SEO-06 | Every page has exactly one H1 | seo-06.sh | script | SEO |
| SEO-07 | Every JSON-LD block parses as JSON | seo-07.sh | script | SEO |

## Settings

- `html_dir:` in `{{ABMH}}harness.yaml`, written by hand: the folder with the built HTML (for example `dist`). The checks read the generated HTML only. Without it, with a missing folder or with no pages, every SEO check reports NOT RUN.
- Pages with `noindex` and `404.html` are not judged.
- SEO-07 needs `node` or `jq`; with neither, or when no page has any JSON-LD block, it reports NOT RUN. It checks that the JSON parses, not that it fits the page type.
- SEO-04 also accepts `sitemap-index.xml`. SEO-01 reads the `<head>` only.
- The checks look for tags with `grep` on the generated HTML, so unusual markup can read as missing; fix the markup or tell the Reviewer.

## Waiting for an agent

No script can judge these; they stay out until an agent check exists:

- Speed and HTTP status codes.
- Content that answers the page's purpose and a clear heading structure beyond one H1.
- Structured data that fits the page type.
- Search with AI: whether the page can be quoted and summarised.

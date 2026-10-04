// Lightweight development preview for this Jekyll page. Production still uses
// Jekyll/GitHub Pages; this server is only for local interaction/browser checks.
import { createServer } from 'node:http';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Liquid } from 'liquidjs';
import MarkdownIt from 'markdown-it';
import * as sass from 'sass';
import { parse as parseYaml } from 'yaml';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const assetRoot = await realpath(path.join(root, 'assets'));
const host = '127.0.0.1';
const port = 4173;
const markdown = new MarkdownIt({ html: true });

// Match the heading IDs used by this site's Jekyll/Kramdown document.
markdown.renderer.rules.heading_open = (tokens, index, options, env, renderer) => {
  const text = tokens[index + 1]?.content || '';
  const id = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
  if (id) tokens[index].attrSet('id', id);
  return renderer.renderToken(tokens, index, options);
};

function within(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function checkedFile(parent, candidate) {
  if (!within(parent, candidate)) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
  const resolved = await realpath(candidate);
  if (!within(parent, resolved) || !(await stat(resolved)).isFile()) {
    throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
  }
  return resolved;
}

function frontMatter(source) {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return { attributes: {}, body: source };
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end < 0) throw new Error('Unclosed YAML front matter');
  return {
    attributes: parseYaml(lines.slice(1, end).join('\n')) || {},
    body: lines.slice(end + 1).join('\n')
  };
}

async function readData(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const data = {};
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) data[entry.name] = await readData(filename);
    else if (/\.ya?ml$/i.test(entry.name)) {
      data[path.parse(entry.name).name] = parseYaml(await readFile(filename, 'utf8'));
    } else if (entry.name.endsWith('.json')) {
      data[path.parse(entry.name).name] = JSON.parse(await readFile(filename, 'utf8'));
    }
  }
  return data;
}

async function renderHome() {
  const site = parseYaml(await readFile(path.join(root, '_config.yml'), 'utf8'));
  site.data = await readData(path.join(root, '_data'));
  const engine = new Liquid({
    root: [path.join(root, '_includes'), root],
    extname: '.html',
    dynamicPartials: false,
    strictFilters: true
  });
  const rawIncludes = [];
  let renderingMarkdown = true;
  engine.registerFilter('relative_url', value => {
    const base = String(site.baseurl || '').replace(/^\/+|\/+$/g, '');
    const suffix = String(value || '').replace(/^\.?\//, '');
    return `${base ? `/${base}` : ''}/${suffix}`;
  });
  // Jekyll's default slugify replaces runs outside Unicode letters/numbers with
  // a hyphen, then strips edge hyphens and lowercases the stable title anchor.
  engine.registerFilter('slugify', value => String(value || '')
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase());
  engine.registerTag('include_relative', {
    parse(token) {
      this.filename = token.args.trim().replace(/^['"]|['"]$/g, '');
      this.directory = token.file ? path.dirname(token.file) : root;
    },
    async render(context) {
      const filename = await checkedFile(root, path.resolve(this.directory, this.filename));
      const source = await readFile(filename, 'utf8');
      const rendered = await engine.render(engine.parse(source, filename), context);
      // The site's includes contain complete HTML fragments, including the .md
      // publications/services files. Kramdown preserves these HTML blocks across
      // blank lines. Markdown-it otherwise treats later indented list items as
      // code blocks, so keep raw HTML includes out of its Markdown parser.
      if (renderingMarkdown && /^\s*</.test(rendered)) {
        const marker = `<!--preview-raw-include-${rawIncludes.length}-->`;
        rawIncludes.push({ marker, rendered });
        return `\n\n${marker}\n\n`;
      }
      return rendered;
    }
  });

  const sourcePath = path.join(root, 'index.md');
  const page = frontMatter(await readFile(sourcePath, 'utf8'));
  const liquid = await engine.render(engine.parse(page.body, sourcePath), { site, page: page.attributes });
  let content = markdown.render(liquid);
  // Restore parents before children in case an HTML include includes another.
  for (let index = rawIncludes.length - 1; index >= 0; index--) {
    const { marker, rendered } = rawIncludes[index];
    content = content.replaceAll(marker, rendered);
  }
  renderingMarkdown = false;
  const layoutPath = await checkedFile(path.join(root, '_layouts'),
    path.resolve(root, '_layouts', `${page.attributes.layout || 'homepage'}.html`));
  const layout = frontMatter(await readFile(layoutPath, 'utf8')).body;
  return engine.render(engine.parse(layout, layoutPath), { site, page: page.attributes, content });
}

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp4': 'video/mp4'
};

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end('Method not allowed');
      return;
    }
    const url = new URL(request.url, `http://${host}:${port}`);
    const pathname = decodeURIComponent(url.pathname);
    let body;
    let contentType;
    if (pathname === '/' || pathname === '/index.html') {
      body = await renderHome();
      contentType = 'text/html; charset=utf-8';
    } else if (pathname.startsWith('/assets/') && !pathname.includes('\\') && !pathname.includes('\0')) {
      const candidate = path.resolve(root, `.${pathname}`);
      let filename;
      try {
        filename = await checkedFile(assetRoot, candidate);
      } catch (error) {
        if (error.code !== 'ENOENT' || !pathname.startsWith('/assets/css/') || !pathname.endsWith('.css')) throw error;
        filename = await checkedFile(assetRoot, candidate.replace(/\.css$/, '.scss'));
      }
      if (filename.endsWith('.scss')) {
        const source = frontMatter(await readFile(filename, 'utf8')).body;
        body = sass.compileString(source, {
          url: pathToFileURL(filename),
          loadPaths: [path.join(root, '_sass')],
          silenceDeprecations: ['import']
        }).css;
        contentType = mime['.css'];
      } else {
        body = await readFile(filename);
        contentType = mime[path.extname(filename).toLowerCase()] || 'application/octet-stream';
      }
    } else {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : error instanceof URIError ? 400 : 500;
    if (status === 500) console.error(error);
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(status === 500 ? 'Preview render failed; check the terminal.' : 'Not found');
  }
});

server.listen(port, host, () => {
  console.log(`Jekyll source preview: http://${host}:${port}`);
});

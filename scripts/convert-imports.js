const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SRC_DIR = path.join(process.cwd(), 'src');
const VALID_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const ASSET_EXTENSIONS = new Set([
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.pcss',
  '.styl',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.ico'
]);

const HEADER_COMMENT = '// ✅ Imports converted to use absolute alias "@/"';
const WARN_COMMENT = '// ⚠️ Check import path manually — could not resolve automatically\n';

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (VALID_EXTENSIONS.has(ext)) {
        processFile(fullPath);
      }
    }
  }
}

function shouldSkipConversion(importPath) {
  if (!importPath.startsWith('.')) {
    return { skip: true };
  }
  const lower = importPath.toLowerCase();
  for (const ext of ASSET_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return { skip: true };
    }
  }
  return { skip: false };
}

function resolveNewPath(filePath, importPath) {
  const { skip } = shouldSkipConversion(importPath);
  if (skip) {
    return { action: 'skip' };
  }

  const resolved = path.normalize(path.join(path.dirname(filePath), importPath));
  if (!resolved.startsWith(SRC_DIR)) {
    return { action: 'warn' };
  }

  const relativeToSrc = path.relative(SRC_DIR, resolved);
  if (relativeToSrc.startsWith('..')) {
    return { action: 'warn' };
  }

  return {
    action: 'convert',
    newPath: '@/'.concat(relativeToSrc.replace(/\\/g, '/')),
  };
}

function addReplacement(mods, start, end, text) {
  mods.push({ start, end, text });
}

function ensureHeader(content) {
  if (content.startsWith(HEADER_COMMENT)) {
    return content;
  }
  return `${HEADER_COMMENT}\n${content}`;
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  const scriptKind =
    ext === '.ts'
      ? ts.ScriptKind.TS
      : ext === '.tsx'
        ? ts.ScriptKind.TSX
        : ext === '.jsx'
          ? ts.ScriptKind.TSX
          : ts.ScriptKind.JS;

  const sourceFile = ts.createSourceFile(filePath, original, ts.ScriptTarget.Latest, true, scriptKind);
  const modifications = [];
  let fileChanged = false;

  function handleModuleSpecifier(node) {
    if (!node.moduleSpecifier) {
      return;
    }
    const literal = node.moduleSpecifier;
    if (!ts.isStringLiteralLike(literal)) {
      return;
    }
    const text = literal.text;
    if (text.startsWith('@/')) {
      return;
    }

    const { action, newPath } = resolveNewPath(filePath, text);
    if (action === 'convert') {
      const quote = original[literal.getStart(sourceFile)];
      addReplacement(modifications, literal.getStart(sourceFile), literal.getEnd(), `${quote}${newPath}${quote}`);
      fileChanged = true;
    } else if (action === 'warn') {
      addReplacement(modifications, node.getStart(sourceFile), node.getStart(sourceFile), WARN_COMMENT);
      fileChanged = true;
    }
  }

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      handleModuleSpecifier(node);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      handleModuleSpecifier(node);
    } else if (ts.isCallExpression(node)) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')
      ) {
        const [arg] = node.arguments;
        if (arg && ts.isStringLiteralLike(arg)) {
          const text = arg.text;
          if (text.startsWith('@/')) {
            // already absolute
            return;
          }
          const { action, newPath } = resolveNewPath(filePath, text);
          if (action === 'convert') {
            const quote = original[arg.getStart(sourceFile)];
            addReplacement(modifications, arg.getStart(sourceFile), arg.getEnd(), `${quote}${newPath}${quote}`);
            fileChanged = true;
          } else if (action === 'warn') {
            addReplacement(modifications, node.getStart(sourceFile), node.getStart(sourceFile), WARN_COMMENT);
            fileChanged = true;
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!fileChanged) {
    return;
  }

  modifications.sort((a, b) => a.start - b.start);
  let result = original;
  let offset = 0;
  for (const mod of modifications) {
    const start = mod.start + offset;
    const end = mod.end + offset;
    result = `${result.slice(0, start)}${mod.text}${result.slice(end)}`;
    offset += mod.text.length - (mod.end - mod.start);
  }

  result = ensureHeader(result);
  fs.writeFileSync(filePath, result);
  console.log(`Updated: ${path.relative(process.cwd(), filePath)}`);
}

walk(SRC_DIR);

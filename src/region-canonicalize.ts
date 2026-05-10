/**
 * Browser-side mirror of `@fidemark/sdk/dom`. Kept in this package so the
 * badge bundle does not pull in the full SDK (which depends on ethers /
 * EAS SDK and is Node-only). The TypeScript SDK, the Python SDK, and the
 * Go SDK all share the same canonicalization rules; the parity tests in
 * each SDK use a common fixture file at `sources/sdk/_fixtures/`.
 *
 * If you change the rules here you must also change them in
 * `sources/sdk/typescript/src/dom.ts`, `sources/sdk/python/src/fidemark/dom.py`,
 * and `sources/sdk/go/fidemark/dom.go`, then re-run the fixture suites.
 */

export const FIDEMARK_DOM_VERSION = 1;

const BLOCK_TAGS = new Set([
  "BR",
  "P",
  "DIV",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "ARTICLE",
  "SECTION",
  "HEADER",
  "FOOTER",
  "BLOCKQUOTE",
  "PRE",
  "TABLE",
  "TR",
]);

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

const COMMENT_NODE = 8;
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

interface DomNode {
  nodeType: number;
  nodeValue: string | null;
  childNodes: ArrayLike<DomNode>;
}

interface DomElement extends DomNode {
  tagName: string;
  hasAttribute(name: string): boolean;
}

type Segment = { kind: "text"; value: string } | { kind: "break" };

function isElement(n: DomNode): n is DomElement {
  return n.nodeType === ELEMENT_NODE;
}

function walk(node: DomNode, out: Segment[]): void {
  if (node.nodeType === COMMENT_NODE) return;
  if (node.nodeType === TEXT_NODE) {
    if (node.nodeValue) out.push({ kind: "text", value: node.nodeValue });
    return;
  }
  if (!isElement(node)) {
    for (let i = 0; i < node.childNodes.length; i++) {
      walk(node.childNodes[i]!, out);
    }
    return;
  }
  const tag = node.tagName.toUpperCase();
  if (SKIP_TAGS.has(tag)) return;
  if (node.hasAttribute("data-fidemark-ignore")) return;
  for (let i = 0; i < node.childNodes.length; i++) {
    walk(node.childNodes[i]!, out);
  }
  if (BLOCK_TAGS.has(tag)) out.push({ kind: "break" });
}

const WS_RUN = /[\t\n\r\f ]+/g;

function buildString(segments: Segment[]): string {
  const parts: string[] = [];
  for (const seg of segments) {
    if (seg.kind === "text") parts.push(seg.value.replace(WS_RUN, " "));
    else parts.push("\n");
  }
  const collapsed = parts.join("").replace(/\n+/g, "\n");
  const lines = collapsed.split("\n").map((l) => l.replace(/^ +| +$/g, ""));
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start] === "") start++;
  while (end > start && lines[end - 1] === "") end--;
  return lines.slice(start, end).join("\n").normalize("NFC");
}

export function canonicalizeDom(root: Element): string {
  const segments: Segment[] = [];
  walk(root as unknown as DomNode, segments);
  return buildString(segments);
}

export async function hashRegion(root: Element): Promise<string> {
  const text = canonicalizeDom(root);
  const bytes = new TextEncoder().encode(text);
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto is unavailable in this environment.");
  const digest = await subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "0x" + hex;
}

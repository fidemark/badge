# @fidemark/badge

> *A drop-in verification badge for content attested with Fidemark.*

Embeddable verification badge for the **Fidemark** content-provenance protocol. One package ships two consumers:

- **React component**: `import { FidemarkBadge } from "@fidemark/badge"` (~3 KB ESM, React 18+ peer).
- **Web Component**: `import "@fidemark/badge/web-component"` registers `<fidemark-badge>` globally (~4 KB ESM, plus an IIFE bundle for `<script>` tags). No React required at runtime.

The badge fetches `/api/attestation/<uid>` from `https://verify.fidemark.dev` (override via `apiBase` / `api-base`), renders a Human / AI / Multi-party / Verified-human pill, and links out to the public verify page.

## Install

```bash
npm install @fidemark/badge
# or:  pnpm add @fidemark/badge
# or:  yarn add @fidemark/badge
```

React 18 or newer is a peer dependency for the React component entry. The `web-component` entry has no peer dependency.

## Usage

### React

```tsx
import { FidemarkBadge } from "@fidemark/badge";

export function ArticleFooter({ uid }: { uid: string }) {
  return <FidemarkBadge uid={uid} theme="light" />;
}
```

Props:

| Prop      | Type                  | Default                          | Notes                                              |
| --------- | --------------------- | -------------------------------- | -------------------------------------------------- |
| `uid`     | `string`              | required                         | Attestation UID.                                   |
| `apiBase` | `string`              | `https://verify.fidemark.dev`    | Origin that hosts the JSON API + verify page.      |
| `theme`   | `"light" \| "dark"`   | `"light"`                        | Visual theme.                                      |

### Web Component

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@fidemark/badge@^0.1/dist/web-component.js"></script>
<fidemark-badge uid="0xabc..." theme="dark"></fidemark-badge>
```

Pin an exact version (`@fidemark/badge@0.1.2`) for reproducible deploys, or self-host `dist/web-component.js` (ESM) / `dist/web-component.global.js` (IIFE for plain `<script>`) from your own static origin if you would rather not depend on a public CDN.

Or register from your own bundle:

```ts
import "@fidemark/badge/web-component";
```

Attributes:

| Attribute    | Notes                                              |
| ------------ | -------------------------------------------------- |
| `uid`        | Attestation UID (required).                        |
| `api-base`   | Override the JSON API origin.                      |
| `theme`      | `light` (default) or `dark`.                       |

The element renders inside a Shadow DOM, so it inherits no styles from the host page and exposes a `::part(badge)` for layout overrides.

## What it shows

| Attestation kind          | Pill label                     |
| ------------------------- | ------------------------------ |
| Human Proof               | `✓ Human Proof`                |
| Human Proof + ENS         | `✓ Human Proof (ENS)`          |
| AI Proof                  | `✓ AI Proof · <modelId>`       |
| Multi-party (N-of-N)      | `✓ Multi-party Proof · N signers` |
| Verified-human (PoP)      | `✓ Verified-human Proof`       |
| Revoked                   | `✗ Revoked`                    |

Clicking the badge opens `verify.fidemark.dev/<uid>` in a new tab so anyone can audit the underlying on-chain attestation.

## Documentation

- **Concepts**: https://docs.fidemark.dev/concepts/how-it-works/
- **SDK reference**: https://docs.fidemark.dev/sdk/installation/
- **Verify page**: https://verify.fidemark.dev
- **Landing**: https://fidemark.dev

## Versioning

Semantic versioning. Breaking surface changes bump the major; new features bump the minor; patch releases fix bugs.

## Issues

This repository is a **published mirror** of the Fidemark monorepo. Source lives privately, but issues
and feature requests are tracked here, please open one if you hit a bug or want to propose an addition.

## License

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

This badge is the open-source verification widget for the Fidemark Protocol.
The protocol contracts and all related apps and services live in a private
repository and are licensed separately under proprietary terms; the deployed
contract bytecode is independently verifiable on-chain at the addresses
bundled in the Fidemark SDK.

© 2026 Vincent Cibelli (VinciDev). The "Fidemark" name, logo, and brand are
reserved by Vincent Cibelli (VinciDev) and are not granted by Apache 2.0.
Forks of this badge are welcome under the License, but please rename them so
users can tell them apart from the official Fidemark project.

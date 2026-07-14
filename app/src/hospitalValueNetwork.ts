// Sterile Fill-Finish value network — NAICS 325412 (Waldner PAS).
//
// Exported live from Neo4j by `scripts/export_sff.py` into
// `src/data/valueNetwork.json` (the SFF unit tree, 6,616 units across L7→L3).
// This module just re-exports it under the historical `hospitalVN` / `vnMeta`
// names the pages already consume, so no page code changed when the mock
// hospital tree (NAICS 622110) was replaced with the real SFF tree.
//
// To refresh: run `python scripts/export_sff.py` (see MANUAL.md).
import vnData from './data/valueNetwork.json'

export interface VNNode {
  id: string
  level: string
  name: string
  cfj: string | null
  /** UNSPSC classification (code + commodity name) for L5-and-lower units.
   *  Optional: populated where the product↔UNSPSC mapping is known. */
  unspsc?: { code: string; name: string }
  children?: VNNode[]
}

// Market / value-network meta: naics, market label, root name, unit count and
// per-level counts. Same shape the Market page's header + level legend expect.
export const vnMeta = vnData.meta

// The tree is a single L7 root; the pages take a VNNode[] of top-level nodes.
export const hospitalVN: VNNode[] = [vnData.root as VNNode]

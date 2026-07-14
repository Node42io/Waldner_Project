import type { Company } from "./types";
import companies from "../../data/sales/companies.json";

// Sales dataset — the 91 validated Sterile Fill-Finish target accounts from
// Neo4j (Company)-[:in_lead_list]->(:LeadList {customer_name:'Waldner PAS'}),
// enriched to the full `Company` shape by `scripts/build_sales.py` (firmographics
// from companies.json / the enrichment CSV, real management contacts, and DACH
// plant coordinates). The historical `MOCK_COMPANIES` name is kept so the Sales
// page code is unchanged — the data is now real, not mock.
//
// To refresh: run `python scripts/build_sales.py` (see MANUAL.md).
export const MOCK_COMPANIES: Company[] = companies as unknown as Company[];

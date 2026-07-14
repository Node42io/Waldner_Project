import { useNavigate } from 'react-router-dom'
import { BookOpenText, Buildings } from '@phosphor-icons/react'
import { Button, PageTemplate, WidgetCard, NaicsRow } from '@node42/ui-kit'
import { ReportActions } from './ReportActions'
import { ReportSidebar } from './ReportSidebar'
import { slugify } from './sections'
import { UPSELL_COPY } from './copy'
import { vnMeta } from './hospitalValueNetwork'
import { useGlossary } from './Glossary'

// "Product Management" landing page — the market picker that precedes the Value
// Network. It lists the NAICS industries in scope; only the first (the analysed
// market, kept in sync with vnMeta) is live and opens its Value Network. The rest
// are locked placeholders — hovering shows the upgrade prompt (they ship with the
// full Node42 platform).
type Naics = { code: string; name: string }

// First entry mirrors the analysed market so the two pages never drift; the rest
// are representative healthcare NAICS shown as locked, non-clickable rows.
const NAICS_LIST: Naics[] = [
  { code: vnMeta.naics, name: vnMeta.market },
  { code: '325414', name: 'Biological Product (except Diagnostic) Manufacturing' },
  { code: '325413', name: 'In-Vitro Diagnostic Substance Manufacturing' },
  { code: '325411', name: 'Medicinal and Botanical Manufacturing (API)' },
  { code: '339112', name: 'Surgical and Medical Instrument Manufacturing' },
  { code: '423450', name: 'Medical, Dental & Hospital Equipment Wholesalers' },
  { code: '541714', name: 'Research and Development in Biotechnology' },
  { code: '311999', name: 'All Other Miscellaneous Food Manufacturing' },
]

const PM_DESCRIPTION =
  'Select a market to explore its value network, buying centre and unmet needs.'

export default function ProductManagementPage() {
  const navigate = useNavigate()
  const { open } = useGlossary()
  return (
    <PageTemplate
      sidebar={<ReportSidebar />}
      sidebarDefaultCollapsed
      actions={<ReportActions />}
      title="Product Management"
      titleId={slugify('Product Management')}
      description={<span style={{ display: 'block' }}>{PM_DESCRIPTION}</span>}
    >
      <WidgetCard
        title="Select a NAICS Market"
        titleTransform="none"
        icon={<Buildings size={24} weight="regular" />}
        headerAction={
          <Button
            variant="tertiary"
            size="sm"
            leftIcon={<BookOpenText size={16} weight="regular" />}
            onClick={() => open('naics-code')}
          >
            NAICS code
          </Button>
        }
        style={{ marginTop: 'var(--space-300)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-200)', width: '100%' }}>
          {NAICS_LIST.map((n, i) => (
            <NaicsRow
              key={n.code}
              code={n.code}
              name={n.name}
              locked={i > 0}
              lockedTooltip={UPSELL_COPY}
              onOpen={i === 0 ? () => navigate('/market-page') : undefined}
            />
          ))}
        </div>
      </WidgetCard>
    </PageTemplate>
  )
}

import { useNavigate, useLocation } from 'react-router-dom'
import { Cube, ChartLineUp, GitDiff, SquaresFour } from '@phosphor-icons/react'
import { SidebarItem } from '@node42/ui-kit'

// Shared navigation for the ODI-waldner app. Two top-level areas: Product
// Management — whose entry point is the NAICS market picker (/product-management),
// which opens the Value Network page (/market-page, with the ODI Matrix as a
// drill-down) — and Sales, a placeholder for now.
export function ReportSidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Product Management owns the value-network flow: the NAICS market picker
  // (its entry point), the market/value-network page, and the ODI matrix that
  // drills down from it.
  const productManagementActive =
    pathname === '/product-management' ||
    pathname === '/market-page'

  return (
    <>
      <SidebarItem
        label="Product Management"
        icon={<Cube size={16} weight="regular" />}
        selected={productManagementActive}
        onClick={() => navigate('/product-management')}
      />
      <SidebarItem
        label="Sales"
        icon={<ChartLineUp size={16} weight="regular" />}
        selected={pathname === '/sales'}
        onClick={() => navigate('/sales')}
      />
      <SidebarItem
        label="Value Network Coverage"
        icon={<GitDiff size={16} weight="regular" />}
        selected={pathname === '/value-network-coverage'}
        onClick={() => navigate('/value-network-coverage')}
      />
      <SidebarItem
        label="Coverage (Cards)"
        icon={<SquaresFour size={16} weight="regular" />}
        selected={pathname === '/value-network-coverage-cards'}
        onClick={() => navigate('/value-network-coverage-cards')}
      />
    </>
  )
}

export default ReportSidebar

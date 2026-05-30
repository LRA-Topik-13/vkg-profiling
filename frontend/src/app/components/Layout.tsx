import { useState } from 'react';
import { Outlet } from 'react-router';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from './Sidebar';
import ScrollToTop from './ScrollToTop';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex">
      <ScrollToTop />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div
        className="flex-1 min-w-0 min-h-screen transition-all duration-300"
        style={{ marginLeft: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
      >
        <Outlet />
      </div>
    </div>
  );
}

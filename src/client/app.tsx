import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { TargetPage } from './pages/target-page';
import { TimelinePage } from './pages/timeline-page';
import { usePlan } from './use-plan';

/** Client-side navigation keeps the old scroll offset; start every page at the top. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  const { state, replace } = usePlan();
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<TimelinePage state={state} replace={replace} />} />
        <Route path="/target/:id" element={<TargetPage state={state} />} />
        <Route path="*" element={<TimelinePage state={state} replace={replace} />} />
      </Routes>
    </>
  );
}

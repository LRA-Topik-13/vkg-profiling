import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * Resets the window scroll position to the top whenever the route changes.
 * Watches both the pathname (sidebar navigation between dimensions) and the
 * search params (tab switches within a dimension, which use ?tab=N), since
 * react-router does not reset scroll on navigation by default.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return null;
}

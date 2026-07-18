import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const RouterContext = createContext(null);

export function Router({ children }) {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const value = useMemo(() => ({ path, navigate(to) { if (to !== path) { window.history.pushState({}, '', to); setPath(to); window.scrollTo(0, 0); } } }), [path]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() { return useContext(RouterContext); }

export function Link({ to, children, ...props }) {
  const { navigate } = useRouter();
  return <a href={to} onClick={(event) => { if (!event.ctrlKey && !event.metaKey) { event.preventDefault(); navigate(to); } }} {...props}>{children}</a>;
}

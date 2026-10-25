import { lazy, type ComponentType } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { NotFound } from './pages/NotFound';
import { SignIn } from './pages/SignIn';

// Route-level code splitting: charting code only loads on the pages that draw charts.
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const Overview = page(() => import('./pages/Overview'), 'Overview');
const Incidents = page(() => import('./pages/Incidents'), 'Incidents');
const IncidentDetail = page(() => import('./pages/IncidentDetail'), 'IncidentDetail');
const Services = page(() => import('./pages/Services'), 'Services');
const Evaluation = page(() => import('./pages/Evaluation'), 'Evaluation');

const router = createBrowserRouter([
  { path: '/sign-in', element: <SignIn /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <Overview /> },
          { path: 'incidents', element: <Incidents /> },
          { path: 'incidents/:id', element: <IncidentDetail /> },
          { path: 'services', element: <Services /> },
          { path: 'evaluation', element: <Evaluation /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}

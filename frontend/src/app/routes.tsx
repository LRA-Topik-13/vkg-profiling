import { createBrowserRouter } from 'react-router';
import Layout from './components/Layout';
import LandingPage from './components/LandingPage';
import DimensionPage from './components/DimensionPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: 'accuracy',
        element: <DimensionPage dimension="accuracy" />,
      },
      {
        path: 'completeness',
        element: <DimensionPage dimension="completeness" />,
      },
      {
        path: 'conciseness',
        element: <DimensionPage dimension="conciseness" />,
      },
    ],
  },
]);

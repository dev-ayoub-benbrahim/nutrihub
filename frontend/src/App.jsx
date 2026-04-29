import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar  from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import Footer  from './components/layout/Footer';

// Pages
import Login      from './pages/Auth/Login';
import Register   from './pages/Auth/Register';
import HomePage   from './pages/Home/HomePage';
import Dashboard  from './pages/Dashboard/DashboardPage';

// Placeholder pages — to be built later
const Placeholder = ({ title }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <p className="text-5xl mb-4 opacity-40">🚧</p>
    <h2 className="font-serif text-2xl font-light text-cream mb-2">{title}</h2>
    <p className="text-sm text-muted">Coming in the next phase</p>
  </div>
);

//redirects to /login if not authenticated 
function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-forest flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin"/>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-forest">
      <Navbar />
      <div className="flex pt-[60px]">
        <Sidebar />
        <main className="ml-[220px] flex-1 min-h-[calc(100vh-60px)] flex flex-col">
          <div className="flex-1 p-7">
            <Outlet />
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}

// redirects to / if already authenticated 
function PublicLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-forest flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin"/>
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/" replace />;

  return <Outlet />;
}


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background:  '#1A2B1E',
              color:       '#F7F3EC',
              border:      '1px solid rgba(74,124,89,0.3)',
              borderRadius:'10px',
              fontSize:    '14px',
            },
            success: { iconTheme: { primary: '#4A7C59', secondary: '#F7F3EC' } },
            error:   { iconTheme: { primary: '#C4622D', secondary: '#F7F3EC' } },
          }}
        />

        <Routes>
          {/* Public routes */}
          <Route element={<PublicLayout />}>
            <Route path="/login"    element={<Login />}    />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Protected routes */}
          <Route element={<ProtectedLayout />}>
            <Route path="/"              element={<HomePage />}   />
            <Route path="/profile"       element={<Dashboard />}  />
            <Route path="/meal-planner"  element={<Placeholder title="Meal Planner" />} />
            <Route path="/communities"   element={<Placeholder title="Communities"  />} />
            <Route path="/saved"         element={<Placeholder title="Saved Recipes"/>} />
            <Route path="/add-recipe"    element={<Placeholder title="Add Recipe"   />} />
            <Route path="/recipes/:id"   element={<Placeholder title="Recipe Detail"/>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
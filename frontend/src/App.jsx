import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar  from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import Footer  from './components/layout/Footer';
import OnboardingWizard from './components/onboardingwizard';

import Login               from './pages/Auth/Login';
import Register            from './pages/Auth/Register';
import HomePage            from './pages/Home/HomePage';
import DashboardPage       from './pages/Dashboard/DashboardPage';
import EditProfilePage     from './pages/Dashboard/EditProfilePage';
import UserProfilePage     from './pages/Dashboard/UserProfilePage';
import RecipeDetails       from './pages/Recipes/RecipeDetails';
import RecipesPage         from './pages/Recipes/RecipesPage';
import EditRecipePage      from './pages/Recipes/EditRecipePage';
import SavedPage           from './pages/Recipes/SavedPage';
import AddRecipePage       from './pages/AddRecipe/AddRecipePage';
import CommunitiesPage     from './pages/Community/CommunitiesPage';
import CommunityDetailPage from './pages/Community/CommunityDetailPage';
import PeoplePage          from './pages/People/PeoplePage';
import AdminPage           from './pages/Admin/AdminPage';
import MealPlannerPage     from './pages/MealPlanner/MealPlannerPage';

const Spinner = () => (
  <div className="min-h-screen bg-forest flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin"/>
  </div>
);

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();
  // Check if this is a brand-new registration
  const [showOnboarding, setShowOnboarding] = useState(
    () => sessionStorage.getItem('nutrihub_new_user') === '1'
  );

  const handleOnboardingComplete = () => {
    sessionStorage.removeItem('nutrihub_new_user');
    setShowOnboarding(false);
  };

  if (loading)          return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-forest">
      <Navbar />
      <div className="flex pt-[60px]">
        <Sidebar />
        <main className="ml-[220px] flex-1 min-h-[calc(100vh-60px)] flex flex-col">
          <div className="flex-1 p-7"><Outlet /></div>
          <Footer />
        </main>
      </div>
      {/* Onboarding wizard — shown once after new registration */}
      {showOnboarding && (
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      )}
    </div>
  );
}

function PublicLayout() {
  const { isAuthenticated, loading } = useAuth();
  if (loading)         return <Spinner />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1A2B1E', color: '#F7F3EC',
              border: '1px solid rgba(74,124,89,0.3)',
              borderRadius: '10px', fontSize: '14px',
            },
            success: { iconTheme: { primary: '#4A7C59', secondary: '#F7F3EC' } },
            error:   { iconTheme: { primary: '#C4622D', secondary: '#F7F3EC' } },
          }}
        />
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/login"    element={<Login />}    />
            <Route path="/register" element={<Register />} />
          </Route>

          <Route element={<ProtectedLayout />}>
            <Route path="/"                 element={<HomePage />}            />
            <Route path="/profile"          element={<DashboardPage />}       />
            <Route path="/profile/edit"     element={<EditProfilePage />}     />
            <Route path="/users/:id"        element={<UserProfilePage />}     />
            <Route path="/recipes/search"   element={<RecipesPage />}         />
            <Route path="/recipes/:id/edit" element={<EditRecipePage />}      />
            <Route path="/recipes/:id"      element={<RecipeDetails />}       />
            <Route path="/saved"            element={<SavedPage />}           />
            <Route path="/add-recipe"       element={<AddRecipePage />}       />
            <Route path="/communities"      element={<CommunitiesPage />}     />
            <Route path="/communities/:id"  element={<CommunityDetailPage />} />
            <Route path="/people"           element={<PeoplePage />}          />
            <Route path="/meal-planner"     element={<MealPlannerPage />}     />
            <Route path="/admin"            element={<AdminPage />}           />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
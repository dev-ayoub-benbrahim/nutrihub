import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { getErrorMessage } from '../../utils/helpers';
import RecipeCard from '../../components/recipes/RecipeCard';

export default function RecipesPage() {
  const [searchParams]         = useSearchParams();
  const navigate               = useNavigate();
  const query                  = searchParams.get('q') || '';
  const [recipes, setRecipes]  = useState([]);
  const [loading, setLoading]  = useState(false);
  const [error,   setError]    = useState(null);
  const [total,   setTotal]    = useState(0);

  useEffect(() => {
    if (!query.trim()) { setRecipes([]); setTotal(0); return; }
    const search = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get(`/recipes?search=${encodeURIComponent(query)}&limit=24`);
        setRecipes(data.recipes || []);
        setTotal(data.pagination?.total || 0);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    search();
  }, [query]);

  return (
    <div className="anim-up">
      <div className="mb-6">
        <h1 className="font-serif text-[32px] font-light text-cream leading-tight">
          {query
            ? <>Results for <em className="text-gold not-italic italic">"{query}"</em></>
            : <em className="text-gold not-italic italic">Search Recipes</em>
          }
        </h1>
        {!loading && total > 0 && (
          <p className="text-sm text-muted mt-1">{total} recipe{total === 1 ? '' : 's'} found</p>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl overflow-hidden animate-pulse">
              <div className="h-44 bg-forest3"/>
              <div className="p-4 space-y-2.5">
                <div className="h-4 bg-forest3 rounded w-4/5"/>
                <div className="h-3 bg-forest3 rounded w-1/3"/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No query entered */}
      {!loading && !query && (
        <div className="text-center py-20">
          <p className="text-5xl mb-4 opacity-30">🔍</p>
          <p className="font-serif text-xl font-light text-cream mb-2">What are you looking for?</p>
          <p className="text-sm text-muted">Use the search bar above to find recipes by name, ingredient, or cuisine</p>
        </div>
      )}

      {/* No results — single message, no RecipeList empty state below */}
      {!loading && query && recipes.length === 0 && !error && (
        <div className="text-center py-20">
          <p className="text-5xl mb-4 opacity-30">🔍</p>
          <p className="font-serif text-xl font-light text-cream mb-2">No recipes found for "{query}"</p>
          <p className="text-sm text-muted mb-5">Try a different ingredient, cuisine, or dish name</p>
          <button onClick={() => navigate('/')} className="text-gold text-sm hover:text-gold-l transition-colors">
            Browse all recipes →
          </button>
        </div>
      )}

      {/* Results grid — only rendered when we actually have results */}
      {!loading && recipes.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
          {recipes.map((recipe, i) => (
            <div key={recipe.id} className="anim-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <RecipeCard recipe={recipe}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
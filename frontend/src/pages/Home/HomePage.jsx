import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { getErrorMessage } from '../../utils/helpers';
import RecipeList from '../../components/recipes/RecipeList';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

const SORTS    = ['trending', 'recent', 'popular'];
const CUISINES = ['all', 'italian', 'japanese', 'mediterranean', 'mexican', 'indian', 'caribbean', 'moroccan'];

export default function HomePage() {
  const navigate  = useNavigate();
  const [recipes, setRecipes]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);
  const [sort,    setSort]      = useState('recent');
  const [cuisine, setCuisine]   = useState('all');
  const [page,    setPage]      = useState(1);
  const [hasMore, setHasMore]   = useState(false);

  // Fetch recipes whenever sort, cuisine or page changes
  useEffect(() => {
    const fetchRecipes = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ sort, page, limit: 12 });
        if (cuisine !== 'all') params.append('cuisine', cuisine);

        const { data } = await api.get(`/recipes?${params}`);
        // data = { recipes: [...], total, page, totalPages }
        if (page === 1) {
          setRecipes(data.recipes || []);
        } else {
          setRecipes((prev) => [...prev, ...(data.recipes || [])]);
        }
        setHasMore(data.page < data.totalPages);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchRecipes();
  }, [sort, cuisine, page]);

  // Reset to page 1 when filters change
  const handleSort    = (s) => { setSort(s);    setPage(1); };
  const handleCuisine = (c) => { setCuisine(c); setPage(1); };

  return (
    <div className="anim-up">

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-[32px] font-light text-cream leading-tight">
            Discover <em className="text-gold not-italic italic">Recipes</em>
          </h1>
          <p className="text-sm text-muted mt-1">
            Community recipes from food lovers around the world
          </p>
        </div>
        <Button onClick={() => navigate('/add-recipe')} size="sm" className="flex-shrink-0">
          + Add Recipe
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2.5 mb-6 flex-wrap">
        {/* Sort chips */}
        {SORTS.map((s) => (
          <button
            key={s}
            onClick={() => handleSort(s)}
            className={[
              'px-3.5 py-1.5 rounded-full text-[13px] border transition-all duration-200',
              sort === s
                ? 'border-gold/50 bg-[rgba(212,168,67,0.12)] text-gold'
                : 'border-[rgba(74,124,89,0.2)] text-muted hover:text-cream hover:border-sage/40',
            ].join(' ')}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}

        <div className="w-px h-5 bg-[rgba(74,124,89,0.2)] mx-1"/>

        {/* Cuisine filters */}
        {CUISINES.map((c) => (
          <button
            key={c}
            onClick={() => handleCuisine(c)}
            className={[
              'px-3.5 py-1.5 rounded-full text-[13px] border transition-all duration-200',
              cuisine === c
                ? 'border-sage bg-[rgba(74,124,89,0.18)] text-cream'
                : 'border-[rgba(74,124,89,0.2)] text-muted hover:text-cream hover:border-sage/40',
            ].join(' ')}
          >
            {c === 'all' ? 'All Cuisines' : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Recipe grid — handles loading, empty, and populated states internally */}
      <RecipeList recipes={recipes} loading={loading && page === 1} />

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center mt-8">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => p + 1)}
            loading={loading && page > 1}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
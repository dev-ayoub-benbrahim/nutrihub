import { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { getErrorMessage } from '../../utils/helpers';
import RecipeList from '../../components/recipes/RecipeList';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const SORTS    = ['recent', 'popular', 'trending'];
const CUISINES = ['all', 'italian', 'japanese', 'mediterranean', 'mexican', 'indian', 'caribbean', 'moroccan'];

export default function HomePage() {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const [recipes, setRecipes]  = useState([]);
  const [loading, setLoading]  = useState(true);
  const [error,   setError]    = useState(null);
  const [sort,    setSort]     = useState('recent');
  const [cuisine, setCuisine]  = useState('all');
  const [feed,    setFeed]     = useState('explore'); // 'explore' | 'following'
  const [page,    setPage]     = useState(1);
  const [hasMore, setHasMore]  = useState(false);

  useEffect(() => {
    const fetchRecipes = async () => {
      setLoading(true);
      setError(null);
      try {
        let url;
        if (feed === 'following') {
          url = `/recipes?feed=following&page=${page}&limit=12`;
        } else {
          const params = new URLSearchParams({ sort, page, limit: 12 });
          if (cuisine !== 'all') params.append('cuisine', cuisine);
          url = `/recipes?${params}`;
        }
        const { data } = await api.get(url);
        if (page === 1) {
          setRecipes(data.recipes || []);
        } else {
          setRecipes(prev => [...prev, ...(data.recipes || [])]);
        }
        setHasMore(data.pagination?.page < data.pagination?.totalPages);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchRecipes();
  }, [sort, cuisine, feed, page]);

  const handleSort    = (s) => { setSort(s);    setPage(1); setFeed('explore'); };
  const handleCuisine = (c) => { setCuisine(c); setPage(1); };
  const handleFeed    = (f) => { setFeed(f);    setPage(1); setRecipes([]); };

  return (
    <div className="anim-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="font-serif text-[32px] font-light text-cream leading-tight">
            {feed === 'following'
              ? <>Following <em className="text-gold not-italic italic">Feed</em></>
              : <>Discover <em className="text-gold not-italic italic">Recipes</em></>
            }
          </h1>
          <p className="text-sm text-muted mt-1">
            {feed === 'following'
              ? 'Latest recipes from people you follow'
              : 'Community recipes from food lovers around the world'
            }
          </p>
        </div>
        <Button onClick={() => navigate('/add-recipe')} size="sm" className="flex-shrink-0">
          + Add Recipe
        </Button>
      </div>

      {/* Feed tabs */}
      <div className="flex gap-1 mb-5 bg-forest2 p-1 rounded-xl w-fit border border-[rgba(74,124,89,0.18)]">
        <button onClick={() => handleFeed('explore')}
                className={`px-4 py-1.5 rounded-[8px] text-sm transition-all duration-200
                            ${feed === 'explore' ? 'bg-forest3 text-cream font-medium' : 'text-muted hover:text-cream'}`}>
          Explore
        </button>
        {user && (
          <button onClick={() => handleFeed('following')}
                  className={`px-4 py-1.5 rounded-[8px] text-sm transition-all duration-200
                              ${feed === 'following' ? 'bg-forest3 text-cream font-medium' : 'text-muted hover:text-cream'}`}>
            For You
          </button>
        )}
      </div>

      {/* Filter bar — only on explore */}
      {feed === 'explore' && (
        <div className="flex items-center gap-2.5 mb-6 flex-wrap">
          {SORTS.map(s => (
            <button key={s} onClick={() => handleSort(s)}
                    className={`px-3.5 py-1.5 rounded-full text-[13px] border transition-all duration-200
                                ${sort === s
                                  ? 'border-gold/50 bg-[rgba(212,168,67,0.12)] text-gold'
                                  : 'border-[rgba(74,124,89,0.2)] text-muted hover:text-cream hover:border-sage/40'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <div className="w-px h-5 bg-[rgba(74,124,89,0.2)] mx-1"/>
          {CUISINES.map(c => (
            <button key={c} onClick={() => handleCuisine(c)}
                    className={`px-3.5 py-1.5 rounded-full text-[13px] border transition-all duration-200
                                ${cuisine === c
                                  ? 'border-sage bg-[rgba(74,124,89,0.18)] text-cream'
                                  : 'border-[rgba(74,124,89,0.2)] text-muted hover:text-cream hover:border-sage/40'}`}>
              {c === 'all' ? 'All Cuisines' : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* For You empty state */}
      {feed === 'following' && !loading && recipes.length === 0 && !error && (
        <div className="text-center py-20">
          <p className="text-5xl mb-4 opacity-40">👥</p>
          <p className="font-serif text-xl font-light text-cream mb-2">
            Your feed is empty
          </p>
          <p className="text-sm text-muted mb-5 max-w-xs mx-auto">
            Follow some chefs and food lovers to see their latest recipes here
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/people')}>
            Find people to follow
          </Button>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Recipe grid */}
      {!(feed === 'following' && !loading && recipes.length === 0) && (
        <RecipeList recipes={recipes} loading={loading && page === 1}/>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center mt-8">
          <Button variant="secondary" onClick={() => setPage(p => p + 1)} loading={loading && page > 1}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
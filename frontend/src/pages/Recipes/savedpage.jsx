import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage, formatCookTime, formatCount } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function SavedPage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [saves,   setSaves]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data } = await api.get(`/social/users/${user.id}/saves`);
        setSaves(data.saves || []);
      } catch { } finally { setLoading(false); }
    };
    load();
  }, [user]);

  const handleUnsave = async (e, recipeId) => {
    e.stopPropagation();
    try {
      await api.delete(`/social/recipes/${recipeId}/save`);
      setSaves(prev => prev.filter(r => r.id !== recipeId));
      toast.success('Removed from saved');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  return (
    <div className="max-w-3xl mx-auto anim-up">
      <div className="mb-6">
        <h1 className="font-serif text-[32px] font-light text-cream">
          Saved <em className="text-gold not-italic italic">Recipes</em>
        </h1>
        {!loading && saves.length > 0 && (
          <p className="text-sm text-muted mt-1">{saves.length} recipe{saves.length !== 1 ? 's' : ''} saved</p>
        )}
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-forest2 rounded-2xl animate-pulse"/>
          ))}
        </div>
      )}

      {!loading && saves.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-6xl mb-5 opacity-25">🔖</span>
          <h2 className="font-serif text-2xl font-light text-cream mb-2">Nothing saved yet</h2>
          <p className="text-sm text-muted mb-6">Tap the save button on any recipe to add it here</p>
          <button onClick={() => navigate('/')} className="text-sm text-gold hover:text-gold-l transition-colors">
            Browse recipes →
          </button>
        </div>
      )}

      {!loading && saves.length > 0 && (
        <div className="flex flex-col gap-3">
          {saves.map((recipe, i) => (
            <div
              key={recipe.id}
              onClick={() => navigate(`/recipes/${recipe.id}`)}
              className="flex gap-4 bg-forest2 border border-[rgba(74,124,89,0.18)]
                         rounded-2xl p-4 cursor-pointer transition-all duration-200
                         hover:border-[rgba(74,124,89,0.35)] hover:bg-forest3/50
                         hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] anim-up"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              {/* Thumbnail */}
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-forest3 flex-shrink-0">
                {recipe.imageURL
                  ? <img src={recipe.imageURL} alt={recipe.title} className="w-full h-full object-cover"/>
                  : <div className="w-full h-full flex items-center justify-center text-3xl opacity-25">🍽️</div>
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <h3 className="font-serif text-[17px] text-cream leading-snug mb-1 truncate">{recipe.title}</h3>
                  <div className="flex items-center gap-3 text-[12px] text-muted flex-wrap">
                    {recipe.cuisine && <span className="text-sage-l">{recipe.cuisine}</span>}
                    {recipe.cookTime && <span className="flex items-center gap-1"><ClockIcon/>{formatCookTime(recipe.cookTime)}</span>}
                    {recipe.savedAt && (
                      <span>Saved {new Date(recipe.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    )}
                  </div>
                  {recipe.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {recipe.tags.slice(0, 4).map(t => (
                        <span key={t.id || t.tag} className="text-[10px] px-2 py-0.5 rounded-md
                                                            bg-[rgba(74,124,89,0.14)] text-sage-l
                                                            border border-[rgba(74,124,89,0.22)]">
                          {t.tag || t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-rust-l"><HeartIcon/>{formatCount(recipe._count?.likes ?? 0)}</span>
                    <span className="flex items-center gap-1 text-xs text-muted"><CommentIcon/>{formatCount(recipe._count?.comments ?? 0)}</span>
                  </div>
                  <button
                    onClick={(e) => handleUnsave(e, recipe.id)}
                    className="text-[11px] text-muted hover:text-red-400 flex items-center gap-1
                               border border-[rgba(74,124,89,0.2)] hover:border-red-500/30
                               px-2.5 py-1 rounded-lg transition-all duration-200"
                  >
                    <TrashIcon/> Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ClockIcon   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const HeartIcon   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>;
const CommentIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
const TrashIcon   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>;
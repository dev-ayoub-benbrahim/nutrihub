import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { useAuth } from '../../hooks/useAuth';
import { formatCookTime, getInitials, getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import ReportModal from '../../components/ReportModal';

export default function RecipeDetails() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { user }     = useAuth();

  const [recipe,   setRecipe]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [liked,    setLiked]    = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [likeCount,setLikeCount]= useState(0);
  const [comment,  setComment]  = useState('');
  const [posting,  setPosting]  = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/recipes/${id}`);
        setRecipe(data);
        setLikeCount(data._count?.likes || 0);
        // Restore like/save state from server — fixes the "liked but looks unliked" bug
        setLiked(data.isLiked || false);
        setSaved(data.isSaved || false);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleLike = async () => {
    if (!user) return navigate('/login');
    try {
      if (liked) {
        const { data } = await api.delete(`/social/recipes/${id}/like`);
        setLikeCount(data.likeCount);
      } else {
        const { data } = await api.post(`/social/recipes/${id}/like`);
        setLikeCount(data.likeCount);
      }
      setLiked(l => !l);
    } catch {
      toast.error('Could not update like');
    }
  };

  const handleSave = async () => {
    if (!user) return navigate('/login');
    try {
      if (saved) {
        await api.delete(`/social/recipes/${id}/save`);
        toast.success('Removed from saved');
      } else {
        await api.post(`/social/recipes/${id}/save`);
        toast.success('Recipe saved');
      }
      setSaved(s => !s);
    } catch {
      toast.error('Could not update save');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this recipe? This cannot be undone.')) return;
    try {
      await api.delete(`/recipes/${id}`);
      toast.success('Recipe deleted');
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!user) return navigate('/login');
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/social/recipes/${id}/comments`, {
        content: comment.trim(),
      });
      setRecipe(prev => ({
        ...prev,
        comments: [data.comment, ...(prev.comments || [])],
        _count: { ...prev._count, comments: (prev._count?.comments || 0) + 1 },
      }));
      setComment('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onBack={() => navigate('/')} />;
  if (!recipe) return null;

  const isOwner = user?.id === recipe.userId;

  return (
    <div className="max-w-4xl mx-auto anim-up">

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted hover:text-cream text-sm
                   mb-5 transition-colors duration-200"
      >
        <BackIcon /> Back
      </button>

      {/* Hero image */}
      <div className="w-full h-72 rounded-2xl overflow-hidden bg-forest3 mb-6 relative">
        {recipe.imageURL ? (
          <img src={recipe.imageURL} alt={recipe.title}
               className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl opacity-25">
            🍽️
          </div>
        )}
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-forest/60 via-transparent to-transparent"/>
        {/* Badges */}
        {recipe.cuisine && (
          <span className="absolute bottom-4 left-4 bg-forest/80 backdrop-blur-sm
                           border border-[rgba(74,124,89,0.25)] text-muted
                           text-[11px] font-semibold uppercase tracking-wide
                           px-2.5 py-1 rounded-lg">
            {recipe.cuisine}
          </span>
        )}
        {recipe.difficulty && (
          <span className={`absolute bottom-4 right-4 text-[11px] font-semibold
                            uppercase tracking-wide px-2.5 py-1 rounded-lg
                            border backdrop-blur-sm bg-forest/80
                            ${recipe.difficulty === 'EASY'   ? 'text-sage-l border-sage/30' :
                              recipe.difficulty === 'MEDIUM' ? 'text-gold border-gold/30' :
                                                               'text-rust-l border-rust/30'}`}>
            {recipe.difficulty}
          </span>
        )}
      </div>

      {/* Title + meta */}
      <div className="mb-5">
        <h1 className="font-serif text-[34px] font-light text-cream leading-tight mb-2">
          {recipe.title}
        </h1>
        <div className="flex items-center gap-4 flex-wrap text-sm text-muted">
          {recipe.user && (
            <span className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sage to-rust
                              flex items-center justify-center text-[10px] font-bold text-cream">
                {getInitials(recipe.user.name)}
              </div>
              <span
                className="text-sage-l cursor-pointer hover:text-cream transition-colors"
                onClick={() => navigate(`/users/${recipe.user.id}`)}
              >
                {recipe.user.name}
              </span>
              {recipe.user.role === 'EXPERT' && (
                <span className="text-[10px] text-gold border border-gold/30 px-1.5 py-0.5 rounded-md">
                  Expert
                </span>
              )}
            </span>
          )}
          {recipe.cookTime && (
            <span className="flex items-center gap-1">
              <ClockIcon /> {formatCookTime(recipe.cookTime)}
            </span>
          )}
          {recipe.prepTime && (
            <span className="text-muted">Prep: {formatCookTime(recipe.prepTime)}</span>
          )}
        </div>
      </div>

      {/* Tags */}
      {recipe.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {recipe.tags.map(t => (
            <span key={t.id}
              className="text-[11px] px-2.5 py-1 rounded-lg
                         bg-[rgba(74,124,89,0.14)] text-sage-l
                         border border-[rgba(74,124,89,0.22)]">
              {t.tag}
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 mb-7 pb-5
                      border-b border-[rgba(74,124,89,0.18)]">
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm
                      transition-all duration-200
                      ${liked
                        ? 'bg-[rgba(196,98,45,0.15)] border-rust/40 text-rust-l'
                        : 'border-[rgba(74,124,89,0.25)] text-muted hover:border-rust/40 hover:text-rust-l'
                      }`}
        >
          <HeartIcon filled={liked} /> {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
        </button>

        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm
                      transition-all duration-200
                      ${saved
                        ? 'bg-[rgba(212,168,67,0.12)] border-gold/40 text-gold'
                        : 'border-[rgba(74,124,89,0.25)] text-muted hover:border-gold/40 hover:text-gold'
                      }`}
        >
          <BookmarkIcon filled={saved} /> {saved ? 'Saved' : 'Save'}
        </button>

        <span className="flex items-center gap-1.5 text-sm text-muted ml-1">
          <CommentIcon /> {recipe._count?.comments || 0} comments
        </span>

        <div className="ml-auto flex items-center gap-2">
          {!isOwner && user && (
            <button
              onClick={() => setShowReport(true)}
              className="text-xs text-muted hover:text-red-400 transition-colors"
            >
              Report
            </button>
          )}
          {isOwner && (
            <>
            <button
              onClick={() => navigate(`/recipes/${id}/edit`)}
              className="text-sm text-muted hover:text-cream
                         border border-[rgba(74,124,89,0.25)] px-3 py-2
                         rounded-xl transition-all duration-200 hover:border-sage/40"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="text-sm text-red-400 hover:text-red-300
                         border border-red-500/20 hover:border-red-400/40
                         px-3 py-2 rounded-xl transition-all duration-200"
            >
              Delete
            </button>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {recipe.description && (
        <p className="text-cream/80 text-[15px] leading-relaxed mb-7">
          {recipe.description}
        </p>
      )}

      {/* Two-column: ingredients + steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-7">

        {/* Ingredients */}
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
          <h2 className="font-serif text-[18px] font-light text-cream mb-4 flex items-center gap-2">
            <span className="text-gold">🥗</span> Ingredients
          </h2>
          {recipe.ingredients?.length > 0 ? (
            <ul className="space-y-2">
              {recipe.ingredients.map(ri => (
                <li key={ri.id}
                    className="flex items-start justify-between py-2
                               border-b border-[rgba(74,124,89,0.12)] last:border-0">
                  <span className="text-[14px] text-cream capitalize">
                    {ri.ingredient?.name || ri.name}
                  </span>
                  <span className="text-[13px] text-gold font-medium ml-3 flex-shrink-0">
                    {ri.quantity} {ri.unit}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">No ingredients listed</p>
          )}
        </div>

        {/* Nutrition */}
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
          <h2 className="font-serif text-[18px] font-light text-cream mb-4 flex items-center gap-2">
            <span className="text-gold">📊</span> Nutrition
          </h2>
          <div className="space-y-2">
            {[
              // USDA-calculated from ingredients first, manual entry as fallback
              ...((() => {
                const usdaCal  = recipe.ingredients?.reduce((s, i) => s + (i.ingredient?.caloriesPer100g ? i.ingredient.caloriesPer100g * i.quantity / 100 : 0), 0) || 0;
                const usdaPro  = recipe.ingredients?.reduce((s, i) => s + (i.ingredient?.proteinPer100g  ? i.ingredient.proteinPer100g  * i.quantity / 100 : 0), 0) || 0;
                const usdaCarb = recipe.ingredients?.reduce((s, i) => s + (i.ingredient?.carbsPer100g    ? i.ingredient.carbsPer100g    * i.quantity / 100 : 0), 0) || 0;
                const usdaFat  = recipe.ingredients?.reduce((s, i) => s + (i.ingredient?.fatPer100g      ? i.ingredient.fatPer100g      * i.quantity / 100 : 0), 0) || 0;
                const hasUsda  = usdaCal > 0 || usdaPro > 0;
                return [
                  ['Calories',      hasUsda ? usdaCal.toFixed(0)  : recipe.caloriesPerServing?.toFixed(0), 'kcal'],
                  ['Protein',       hasUsda ? usdaPro.toFixed(1)  : recipe.proteinPerServing?.toFixed(1),  'g'],
                  ['Carbohydrates', hasUsda ? usdaCarb.toFixed(1) : recipe.carbsPerServing?.toFixed(1),   'g'],
                  ['Fat',           hasUsda ? usdaFat.toFixed(1)  : recipe.fatPerServing?.toFixed(1),     'g'],
                ];
              })()),
            ].map(([label, value, unit]) => (
              <div key={label}
                   className="flex justify-between items-center py-2
                              border-b border-[rgba(74,124,89,0.12)] last:border-0">
                <span className="text-[13px] text-muted">{label}</span>
                <span className="text-[14px] text-cream font-medium">
                  {value && parseFloat(value) > 0 ? `${value} ${unit}` : '—'}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted mt-3">
            {recipe.ingredients?.some(i => i.ingredient?.caloriesPer100g)
              ? '✓ Calculated from USDA FoodData Central data'
              : recipe.caloriesPerServing
                ? '📝 Values entered by recipe author'
                : 'Nutritional data not yet available'
            }
          </p>
        </div>
      </div>

      {/* Steps */}
      {recipe.steps?.length > 0 && (
        <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5 mb-7">
          <h2 className="font-serif text-[18px] font-light text-cream mb-5 flex items-center gap-2">
            <span className="text-gold">👨‍🍳</span> Method
          </h2>
          <ol className="space-y-4">
            {recipe.steps.map(step => (
              <li key={step.id} className="flex gap-4">
                <span className="w-8 h-8 rounded-full bg-[rgba(74,124,89,0.18)]
                                 border border-[rgba(74,124,89,0.25)]
                                 flex items-center justify-center flex-shrink-0
                                 text-[13px] font-semibold text-gold">
                  {step.stepNumber}
                </span>
                <p className="text-[14px] text-cream/85 leading-relaxed pt-1">
                  {step.instruction}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Comments */}
      <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl p-5">
        <h2 className="font-serif text-[18px] font-light text-cream mb-5">
          Comments <span className="text-muted text-[15px]">({recipe._count?.comments || 0})</span>
        </h2>

        {/* Add comment */}
        {user ? (
          <form onSubmit={handleComment} className="flex gap-3 mb-5">
            <div className="w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br
                            from-sage to-rust flex items-center justify-center
                            text-cream text-[11px] font-bold mt-1">
              {getInitials(user.name)}
            </div>
            <div className="flex-1 flex gap-2">
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Add a comment..."
                maxLength={500}
                className="flex-1 bg-forest border border-[rgba(74,124,89,0.25)]
                           rounded-xl px-4 py-2.5 text-sm text-cream
                           placeholder:text-muted outline-none
                           focus:border-sage transition-colors duration-200"
              />
              <button
                type="submit"
                disabled={!comment.trim() || posting}
                className="px-4 py-2.5 bg-sage hover:bg-sage-l text-cream
                           text-sm rounded-xl transition-colors duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {posting ? '...' : 'Post'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted mb-5">
            <button onClick={() => navigate('/login')} className="text-gold hover:text-gold-l">
              Sign in
            </button>{' '}
            to leave a comment
          </p>
        )}

        {/* Comment list */}
        {recipe.comments?.length > 0 ? (
          <ul className="space-y-4">
            {recipe.comments.map(c => (
              <li key={c.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br
                                from-sage to-rust flex items-center justify-center
                                text-cream text-[11px] font-bold">
                  {getInitials(c.user?.name || '?')}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-medium text-cream">{c.user?.name}</span>
                    <span className="text-[11px] text-muted">
                      {new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-[13px] text-cream/80 leading-relaxed">{c.content}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted text-center py-4">
            No comments yet — be the first to share your thoughts
          </p>
        )}
      </div>

      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        recipeId={parseInt(id)}
        context={recipe?.title}
      />
    </div>
  );
}

// Loading / Error states 
function LoadingState() {
  return (
    <div className="max-w-4xl mx-auto animate-pulse">
      <div className="h-72 bg-forest2 rounded-2xl mb-6"/>
      <div className="h-8 bg-forest2 rounded w-2/3 mb-3"/>
      <div className="h-4 bg-forest2 rounded w-1/3 mb-6"/>
      <div className="grid grid-cols-2 gap-5">
        <div className="h-48 bg-forest2 rounded-2xl"/>
        <div className="h-48 bg-forest2 rounded-2xl"/>
      </div>
    </div>
  );
}

function ErrorState({ message, onBack }) {
  return (
    <div className="text-center py-20">
      <p className="text-4xl mb-4 opacity-40">⚠️</p>
      <p className="font-serif text-xl text-cream mb-2">Something went wrong</p>
      <p className="text-sm text-muted mb-5">{message}</p>
      <button onClick={onBack} className="text-gold text-sm hover:text-gold-l">← Go back</button>
    </div>
  );
}

// Icons 
const BackIcon     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>;
const ClockIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const HeartIcon    = ({ filled }) => <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>;
const BookmarkIcon = ({ filled }) => <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>;
const CommentIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
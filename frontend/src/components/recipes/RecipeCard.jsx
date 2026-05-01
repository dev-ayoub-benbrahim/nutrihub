import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCookTime, formatCount } from '../../utils/helpers';

export default function RecipeCard({ recipe }) {
  const navigate  = useNavigate();
  const [saved, setSaved] = useState(false);

  if (!recipe) return null;
  const { id, title, imageURL, cuisine, cookTime, tags = [], user, _count = {} } = recipe;

  return (
    <article
      onClick={() => navigate(`/recipes/${id}`)}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/recipes/${id}`)}
      className="group bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl
                 overflow-hidden cursor-pointer transition-all duration-200
                 hover:-translate-y-0.5 hover:border-[rgba(74,124,89,0.35)]
                 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
    >
      {/* Image */}
      <div className="relative h-44 bg-forest3 overflow-hidden">
        {imageURL
          ? <img src={imageURL} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
          : <div className="w-full h-full flex items-center justify-center text-5xl opacity-25">🍽️</div>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-forest/80 via-transparent to-transparent"/>
        {cuisine && (
          <span className="absolute top-3 left-3 bg-forest/80 backdrop-blur-sm
                           border border-[rgba(74,124,89,0.25)] text-muted
                           text-[10px] font-semibold uppercase tracking-[0.5px] px-2 py-1 rounded-md">
            {cuisine}
          </span>
        )}
        {cookTime && (
          <span className="absolute top-3 right-3 bg-forest/80 backdrop-blur-sm
                           border border-[rgba(74,124,89,0.25)] text-gold
                           text-[10px] font-semibold px-2 py-1 rounded-md flex items-center gap-1">
            <ClockIcon/> {formatCookTime(cookTime)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="font-serif text-[17px] font-normal text-cream leading-snug mb-1.5">{title}</h3>
        {user && (
          <p className="text-xs text-muted mb-3">
            by{' '}
            <span
              className="text-sage-l hover:text-cream cursor-pointer transition-colors"
              onClick={(e) => { e.stopPropagation(); navigate(`/users/${user.id}`); }}
            >
              {user.name}
            </span>
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.slice(0, 3).map((t) => (
              <span key={t.id || t.tag || t}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-[rgba(74,124,89,0.14)]
                               text-sage-l border border-[rgba(74,124,89,0.22)]">
                {t.tag || t}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-[rgba(74,124,89,0.15)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-rust-l"><HeartIcon/> {formatCount(_count.likes ?? 0)}</span>
            <span className="flex items-center gap-1 text-xs text-muted"><CommentIcon/> {formatCount(_count.comments ?? 0)}</span>
          </div>
          {/* stopPropagation only on the button, not the whole footer */}
          <button
            onClick={(e) => { e.stopPropagation(); setSaved(s => !s); }}
            className={`text-xs px-2.5 py-1 rounded-md border transition-all duration-200 flex items-center gap-1
                        ${saved ? 'border-gold/40 text-gold bg-[rgba(212,168,67,0.1)]'
                                : 'border-[rgba(74,124,89,0.25)] text-muted hover:border-gold/40 hover:text-gold'}`}
          >
            <BookmarkIcon filled={saved}/> {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </article>
  );
}

const ClockIcon    = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const HeartIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>;
const CommentIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
const BookmarkIcon = ({ filled }) => <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>;
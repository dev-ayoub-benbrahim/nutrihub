import RecipeCard from './RecipeCard';

export default function RecipeList({ recipes, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!recipes || recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center anim-in">
        <span className="text-5xl mb-4 opacity-40">🍽️</span>
        <h3 className="font-serif text-xl font-light text-cream mb-2">
          No recipes yet
        </h3>
        <p className="text-sm text-muted max-w-xs">
          Be the first to share a recipe with the NutriHub community
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
      {recipes.map((recipe, i) => (
        <div
          key={recipe.id}
          className="anim-up"
          style={{ animationDelay: `${i * 0.06}s` }}
        >
          <RecipeCard recipe={recipe} />
        </div>
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-forest2 border border-[rgba(74,124,89,0.18)] rounded-2xl overflow-hidden animate-pulse">
      <div className="h-44 bg-forest3"/>
      <div className="p-4 space-y-2.5">
        <div className="h-4 bg-forest3 rounded w-4/5"/>
        <div className="h-3 bg-forest3 rounded w-1/3"/>
        <div className="flex gap-1.5 pt-1">
          <div className="h-5 w-16 bg-forest3 rounded-md"/>
          <div className="h-5 w-14 bg-forest3 rounded-md"/>
        </div>
      </div>
    </div>
  );
}
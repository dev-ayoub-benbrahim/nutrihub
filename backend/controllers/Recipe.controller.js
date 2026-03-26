import prisma from "../lib/prisma"
import {v2 as cloudinary} from "cloudinary"
import streamifier from "streamifier"

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: pocess.env.CLOUDINARY_API_SECRET,
})

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "nutrihub/recipes" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

export const createRecipe = async (req, res) =>{
    try {
        const {
            title,
            description,
            prepTime,
            cookTime,
            difficulty,
            cuisine,
            ingredients,
            steps,
            tags,
        } = req.body
    
    if (!title || !description || !ingredients|| !steps)
        return res.status(400).json({message: 'Title, description, ingredients and steps are required'})
    const parsedIngredients = JSON.parse(ingredients)
    const parsedSteps       = JSON.parse(steps)
    const parsedTags        = tags? JSON.parse(tags) : []
    // Upload image    
    let imageUrl = null
    if (req.file){
        const result = await uploadToCloudinary(req.file.buffer)
        imageUrl = result.secure_url
    }
    // Create recipe with nested writes
    const recipe = await prisma.recipe.create({
        data: {
            title,
            description,
            imageUrl,
            prepTime: prepTime ? parseInt(prepTime) :null,
            cookTime: cookTime ? parseInt(cookTime) :null,
            difficulty: difficulty || "EASY",
            cuisine: cuisine  || null,
            usedId: req.user.id,

            steps: {
                create: parsedSteps.map((s) => ({
                    stepNumber: s.stepNumber,
                    instruction: s.instruction,
                })),

            },
            tags: {
                create: parsedTags.map((tag) => ({ tag })),
            },

            ingredients: {
                create: await Promise.all(
                    parsedIngredients.map(async (ing) => {
                        const ingredient = await prisma.ingredient.upsert({
                            where: {name: ing.name.toLowerCase().trim()},
                            update: {},
                            create:{name: ing.name.toLowerCase().trim()}

                        })
                        return {
                            ingredientId: ingredient.id,
                            quantity: parseFloat(ing.quantity),
                            unit: ing.unit,
                        }
                    })
                )
            }
        },
        include: {
            user: {select: {id: true, name:true, avatarUrl: true, role:true}},
            ingredientq: {include: {ingredient: true}},
            steps: {orderBy: {stepNumber: "asc"}},
            tags: true,
            _count: {select: {likes:true, comments: true, saves: true}},
        },

    }) 

    res.status(201).json(recipe)


    }catch(error){
    console.error("createRecipe error:", error);
    res.status(500).json({ message: "Server error" });
    }
}


export const getRecipes = async (req, res) => {
  try {
    const {
      sort    = "recent",
      cuisine,
      tag,
      page    = 1,
      limit   = 12,
    } = req.query;
 
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
 
    const where = {
      isPublished: true,
      ...(cuisine && { cuisine: { equals: cuisine, mode: "insensitive" } }),
      ...(tag     && { tags: { some: { tag: { equals: tag, mode: "insensitive" } } } }),
    };

    let orderBy;
    let recipes;
 
    if (sort === "popular") {
      recipes = await prisma.recipe.findMany({
        where,
        include: {
          user:        { select: { id: true, name: true, avatarUrl: true, role: true } },
          tags:        true,
          _count:      { select: { likes: true, comments: true, saves: true } },
        },
        skip,
        take,
      });
      recipes.sort((a, b) => b._count.likes - a._count.likes);
 
    } else if (sort === "trending") {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      recipes = await prisma.recipe.findMany({
        where: {
          ...where,
          likes: { some: { createdAt: { gte: sevenDaysAgo } } },
        },
        include: {
          user:        { select: { id: true, name: true, avatarUrl: true, role: true } },
          tags:        true,
          _count:      { select: { likes: true, comments: true, saves: true } },
        },
        skip,
        take,
      });
 
    } else {
      recipes = await prisma.recipe.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          user:        { select: { id: true, name: true, avatarUrl: true, role: true } },
          tags:        true,
          _count:      { select: { likes: true, comments: true, saves: true } },
        },
        skip,
        take,
      });
    }
 
    const total = await prisma.recipe.count({ where });
 
    res.json({
      recipes,
      pagination: {
        total,
        page:       parseInt(page),
        limit:      take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("getRecipes error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
 
export const getRecipeById = async (req, res) => {
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user:        { select: { id: true, name: true, avatarUrl: true, role: true, specialisation: true } },
        ingredients: { include: { ingredient: true } },
        steps:       { orderBy: { stepNumber: "asc" } },
        tags:        true,
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: "desc" },
          take: 20, 
        },
        _count: { select: { likes: true, comments: true, saves: true } },
      },
    });
 
    if (!recipe || !recipe.isPublished)
      return res.status(404).json({ message: "Recipe not found" });
 
    res.json(recipe);
  } catch (error) {
    console.error("getRecipeById error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
 
export const updateRecipe = async (req, res) => {
  try {
    const recipeId = parseInt(req.params.id);
 
    const existing = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!existing)
      return res.status(404).json({ message: "Recipe not found" });
 
    if (existing.userId !== req.user.id)
      return res.status(403).json({ message: "Not authorised to edit this recipe" });
 
    const { title, description, prepTime, cookTime, difficulty, cuisine, isPublished } = req.body;
 
    let imageUrl = existing.imageUrl;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      imageUrl = result.secure_url;
    }
 
    const updated = await prisma.recipe.update({
      where: { id: recipeId },
      data: {
        ...(title        !== undefined && { title }),
        ...(description  !== undefined && { description }),
        ...(prepTime     !== undefined && { prepTime: parseInt(prepTime) }),
        ...(cookTime     !== undefined && { cookTime: parseInt(cookTime) }),
        ...(difficulty   !== undefined && { difficulty }),
        ...(cuisine      !== undefined && { cuisine }),
        ...(isPublished  !== undefined && { isPublished: Boolean(isPublished) }),
        imageUrl,
      },
      include: {
        user:        { select: { id: true, name: true, avatarUrl: true } },
        ingredients: { include: { ingredient: true } },
        steps:       { orderBy: { stepNumber: "asc" } },
        tags:        true,
        _count:      { select: { likes: true, comments: true, saves: true } },
      },
    });
 
    res.json(updated);
  } catch (error) {
    console.error("updateRecipe error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
 
export const deleteRecipe = async (req, res) => {
  try {
    const recipeId = parseInt(req.params.id);
 
    const existing = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!existing)
      return res.status(404).json({ message: "Recipe not found" });
 
    const isOwner = existing.userId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";
 
    if (!isOwner && !isAdmin)
      return res.status(403).json({ message: "Not authorised to delete this recipe" });
 
    await prisma.recipe.delete({ where: { id: recipeId } });
 
    res.json({ message: "Recipe deleted successfully" });
  } catch (error) {
    console.error("deleteRecipe error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
 
export const getUserRecipes = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
 
    const recipes = await prisma.recipe.findMany({
      where:   { userId, isPublished: true },
      orderBy: { createdAt: "desc" },
      include: {
        tags:   true,
        _count: { select: { likes: true, comments: true, saves: true } },
      },
      skip,
      take: parseInt(limit),
    });
 
    const total = await prisma.recipe.count({ where: { userId, isPublished: true } });
 
    res.json({
      recipes,
      pagination: {
        total,
        page:       parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("getUserRecipes error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

// protect required auth 
// Returns 401 if no valid token. Use on all routes that need a user.
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token)
    return res.status(401).json({ message: "Not authorised" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await prisma.user.findUnique({
      where:  { id: decoded.id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!req.user)
      return res.status(401).json({ message: "User no longer exists" });

    next();
  } catch {
    res.status(401).json({ message: "Not authorised — token invalid" });
  }
};

// attaches user if token present, continues either way 
// Use on public routes that show extra data when the user is logged in
// (e.g. isMember flag on communities, isLiked on recipes).
export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer")) return next(); 

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await prisma.user.findUnique({
      where:  { id: decoded.id },
      select: { id: true, email: true, name: true, role: true },
    });
  } catch {
   
  }
  next();
};

//role-based guard, use after protect 
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission" });
    }
    next();
  };
};
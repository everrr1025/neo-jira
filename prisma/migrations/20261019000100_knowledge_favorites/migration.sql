CREATE TABLE "KnowledgeFavorite" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "itemId" TEXT NOT NULL REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("userId", "itemId")
);
CREATE INDEX "KnowledgeFavorite_itemId_idx" ON "KnowledgeFavorite"("itemId");

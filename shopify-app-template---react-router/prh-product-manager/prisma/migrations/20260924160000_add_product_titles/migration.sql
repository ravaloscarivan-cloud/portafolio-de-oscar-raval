CREATE TABLE "ProductTitle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "productGid" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "spanishTitle" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "ProductTitle_shop_productGid_key" ON "ProductTitle"("shop", "productGid");
CREATE INDEX "ProductTitle_shop_handle_idx" ON "ProductTitle"("shop", "handle");

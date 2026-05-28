-- Refresh token con selector: el token pasa a ser "selector.secret".
-- El selector (público, indexado y único) permite buscar la sesión en O(1)
-- en vez de iterar argon2 sobre 100 candidatas. Las sesiones viejas quedan
-- con selector NULL → no matchean el formato nuevo → fuerzan re-login (ok).

ALTER TABLE "sesion" ADD COLUMN "selector" TEXT;
CREATE UNIQUE INDEX "sesion_selector_key" ON "sesion"("selector");

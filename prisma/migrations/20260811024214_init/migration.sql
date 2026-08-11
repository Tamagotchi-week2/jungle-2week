-- CreateEnum
CREATE TYPE "EggType" AS ENUM ('air', 'land', 'sea', 'gold');

-- CreateEnum
CREATE TYPE "Trait" AS ENUM ('a', 'b', 'c');

-- CreateEnum
CREATE TYPE "Combo" AS ENUM ('aa', 'ab', 'ac', 'bb', 'bc', 'cc');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('crop', 'mineral', 'seafood');

-- CreateEnum
CREATE TYPE "GatherKind" AS ENUM ('mine', 'fish');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('proposed', 'joined', 'accepted', 'rejected', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_adult_reward_claimed" BOOLEAN NOT NULL DEFAULT false,
    "pending_reward_is_gold" BOOLEAN,
    "tutorial_step" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "species" (
    "id" SERIAL NOT NULL,
    "egg_type" "EggType" NOT NULL,
    "combo" "Combo" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_eggs" (
    "user_id" TEXT NOT NULL,
    "egg_type" "EggType" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_eggs_pkey" PRIMARY KEY ("user_id","egg_type")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "egg_type" "EggType" NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "is_albino" BOOLEAN NOT NULL DEFAULT false,
    "trait_a" INTEGER NOT NULL DEFAULT 0,
    "trait_b" INTEGER NOT NULL DEFAULT 0,
    "trait_c" INTEGER NOT NULL DEFAULT 0,
    "feed_count" INTEGER NOT NULL DEFAULT 0,
    "last_fed_seq_a" INTEGER NOT NULL DEFAULT 0,
    "last_fed_seq_b" INTEGER NOT NULL DEFAULT 0,
    "last_fed_seq_c" INTEGER NOT NULL DEFAULT 0,
    "stage2_trait" "Trait",
    "species_id" INTEGER,
    "is_traded" BOOLEAN NOT NULL DEFAULT false,
    "locked_by_trade_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "user_id" TEXT NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("user_id","resource_type")
);

-- CreateTable
CREATE TABLE "farm_plots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "planted_at" TIMESTAMP(3),

    CONSTRAINT "farm_plots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gather_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "GatherKind" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bite_delay" INTEGER,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "gather_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dex_entries" (
    "user_id" TEXT NOT NULL,
    "species_id" INTEGER NOT NULL,
    "has_normal" BOOLEAN NOT NULL DEFAULT false,
    "has_albino" BOOLEAN NOT NULL DEFAULT false,
    "first_acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dex_entries_pkey" PRIMARY KEY ("user_id","species_id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'proposed',
    "from_user_id" TEXT NOT NULL,
    "from_pet_id" TEXT NOT NULL,
    "to_user_id" TEXT,
    "to_pet_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guestbook_entries" (
    "id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "message" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guestbook_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "species_name_key" ON "species"("name");

-- CreateIndex
CREATE UNIQUE INDEX "species_egg_type_combo_key" ON "species"("egg_type", "combo");

-- CreateIndex
CREATE INDEX "pets_owner_id_stage_idx" ON "pets"("owner_id", "stage");

-- CreateIndex
CREATE INDEX "farm_plots_user_id_idx" ON "farm_plots"("user_id");

-- CreateIndex
CREATE INDEX "gather_sessions_user_id_resolved_idx" ON "gather_sessions"("user_id", "resolved");

-- CreateIndex
CREATE UNIQUE INDEX "trades_code_key" ON "trades"("code");

-- CreateIndex
CREATE INDEX "trades_status_expires_at_idx" ON "trades"("status", "expires_at");

-- CreateIndex
CREATE INDEX "guestbook_entries_created_at_idx" ON "guestbook_entries"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "user_eggs" ADD CONSTRAINT "user_eggs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_plots" ADD CONSTRAINT "farm_plots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gather_sessions" ADD CONSTRAINT "gather_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dex_entries" ADD CONSTRAINT "dex_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dex_entries" ADD CONSTRAINT "dex_entries_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_from_pet_id_fkey" FOREIGN KEY ("from_pet_id") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_to_pet_id_fkey" FOREIGN KEY ("to_pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

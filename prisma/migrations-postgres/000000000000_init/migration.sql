-- pg_trgm powers the GIN trigram index on food.searchText (Chinese +
-- English substring search). Available on Supabase and stock Postgres.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "CalcAs" AS ENUM ('male', 'female', 'average');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('fat_loss', 'muscle_gain', 'maintenance', 'recomposition', 'performance', 'health');

-- CreateEnum
CREATE TYPE "DietType" AS ENUM ('omnivore', 'flexitarian', 'pescatarian', 'vegetarian', 'lacto_ovo_vegetarian', 'lacto_vegetarian', 'ovo_vegetarian', 'vegan');

-- CreateEnum
CREATE TYPE "AllergenSeverity" AS ENUM ('allergy', 'intolerance', 'avoid');

-- CreateEnum
CREATE TYPE "PreferenceKind" AS ENUM ('like', 'dislike', 'avoid_ingredient', 'cuisine', 'texture', 'other');

-- CreateEnum
CREATE TYPE "MetricSource" AS ENUM ('manual', 'smart_scale', 'agent', 'import');

-- CreateEnum
CREATE TYPE "FoodStatus" AS ENUM ('active', 'retired');

-- CreateEnum
CREATE TYPE "ExerciseCategory" AS ENUM ('cardio', 'strength', 'flexibility', 'sports', 'daily_activity', 'other');

-- CreateEnum
CREATE TYPE "ExerciseIntensity" AS ENUM ('low', 'moderate', 'high');

-- CreateEnum
CREATE TYPE "ExerciseSource" AS ENUM ('photo', 'text', 'device', 'manual', 'import');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- CreateEnum
CREATE TYPE "LogSource" AS ENUM ('photo', 'text', 'barcode', 'manual', 'import');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_access_token" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "lastFour" CHAR(4) NOT NULL,
    "scopes" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_access_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sex" "Sex",
    "calcAs" "CalcAs",
    "birthDate" DATE,
    "heightCm" DECIMAL(4,1),
    "activityLevel" "ActivityLevel",
    "customActivityFactor" DECIMAL(3,2),
    "timezone" VARCHAR(40),
    "nutrientRefStandard" VARCHAR(16),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalType" "GoalType" NOT NULL,
    "targetWeightKg" DECIMAL(5,2),
    "weeklyRateKg" DECIMAL(4,2),
    "targetDate" DATE,
    "dailyCalorieTarget" INTEGER,
    "proteinTargetG" DECIMAL(6,1),
    "carbTargetG" DECIMAL(6,1),
    "fatTargetG" DECIMAL(6,1),
    "fiberTargetG" DECIMAL(6,1),
    "waterTargetMl" INTEGER,
    "rationale" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activeKey" VARCHAR(191),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dietary_preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dietType" "DietType",
    "religiousDiets" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dietary_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_allergen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allergen" VARCHAR(64) NOT NULL,
    "severity" "AllergenSeverity" NOT NULL DEFAULT 'allergy',
    "note" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_allergen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preference_tag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "PreferenceKind" NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "note" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preference_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_metric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metricType" VARCHAR(32) NOT NULL,
    "value" DECIMAL(7,2) NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "measuredDate" DATE NOT NULL,
    "timezone" VARCHAR(40) NOT NULL,
    "source" "MetricSource" NOT NULL DEFAULT 'agent',
    "note" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "body_metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_source" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "license" VARCHAR(64) NOT NULL,
    "licenseUrl" VARCHAR(255),
    "attributionText" TEXT NOT NULL,
    "attributionUrl" VARCHAR(255),
    "requiresShareAlike" BOOLEAN NOT NULL DEFAULT false,
    "redistributable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "data_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_run" (
    "id" BIGSERIAL NOT NULL,
    "sourceCode" VARCHAR(32) NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "datasetVersion" VARCHAR(128) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "stats" JSONB,
    "notes" TEXT,

    CONSTRAINT "import_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food" (
    "id" BIGSERIAL NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "sourceKey" VARCHAR(64) NOT NULL,
    "dataType" VARCHAR(24) NOT NULL,
    "name" VARCHAR(512) NOT NULL,
    "nameEn" VARCHAR(512),
    "nameZh" VARCHAR(512),
    "aliases" TEXT,
    "brand" VARCHAR(255),
    "category" VARCHAR(255),
    "barcode" VARCHAR(32),
    "ediblePct" DECIMAL(5,1),
    "searchText" TEXT,
    "completeness" DECIMAL(3,2),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "FoodStatus" NOT NULL DEFAULT 'active',
    "contentHash" CHAR(40),
    "lastImportRunId" BIGINT,
    "createdByUserId" TEXT,
    "sourceMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_nutrients" (
    "foodId" BIGINT NOT NULL,
    "energyKcal" DECIMAL(9,3),
    "proteinG" DECIMAL(9,3),
    "fatG" DECIMAL(9,3),
    "carbG" DECIMAL(9,3),
    "fiberG" DECIMAL(9,3),
    "sugarsG" DECIMAL(9,3),
    "waterG" DECIMAL(9,3),
    "alcoholG" DECIMAL(9,3),
    "cholesterolMg" DECIMAL(9,3),
    "satFatG" DECIMAL(9,3),
    "mufaG" DECIMAL(9,3),
    "pufaG" DECIMAL(9,3),
    "transFatG" DECIMAL(9,3),
    "sodiumMg" DECIMAL(9,3),
    "calciumMg" DECIMAL(9,3),
    "ironMg" DECIMAL(9,3),
    "potassiumMg" DECIMAL(9,3),
    "magnesiumMg" DECIMAL(9,3),
    "phosphorusMg" DECIMAL(9,3),
    "zincMg" DECIMAL(9,3),
    "copperMg" DECIMAL(9,3),
    "manganeseMg" DECIMAL(9,3),
    "seleniumUg" DECIMAL(9,3),
    "vitAUgRae" DECIMAL(9,3),
    "caroteneUg" DECIMAL(9,3),
    "retinolUg" DECIMAL(9,3),
    "vitCMg" DECIMAL(9,3),
    "vitDUg" DECIMAL(9,3),
    "vitEMg" DECIMAL(9,3),
    "vitKUg" DECIMAL(9,3),
    "thiaminMg" DECIMAL(9,3),
    "riboflavinMg" DECIMAL(9,3),
    "niacinMg" DECIMAL(9,3),
    "pantothenicMg" DECIMAL(9,3),
    "vitB6Mg" DECIMAL(9,3),
    "folateUg" DECIMAL(9,3),
    "vitB12Ug" DECIMAL(9,3),
    "cholineMg" DECIMAL(9,3),
    "caffeineMg" DECIMAL(9,3),
    "traceFlags" JSONB,
    "extras" JSONB,

    CONSTRAINT "food_nutrients_pkey" PRIMARY KEY ("foodId")
);

-- CreateTable
CREATE TABLE "food_portion" (
    "id" BIGSERIAL NOT NULL,
    "foodId" BIGINT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "description" VARCHAR(255) NOT NULL,
    "gramWeight" DECIMAL(9,2) NOT NULL,
    "sourcePortionId" VARCHAR(32),

    CONSTRAINT "food_portion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activity" VARCHAR(100) NOT NULL,
    "category" "ExerciseCategory",
    "intensity" "ExerciseIntensity",
    "durationMin" DECIMAL(6,1),
    "distanceKm" DECIMAL(6,2),
    "energyKcal" DECIMAL(7,1) NOT NULL,
    "extraMetrics" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "localDate" DATE NOT NULL,
    "timezone" VARCHAR(40) NOT NULL,
    "source" "ExerciseSource" NOT NULL,
    "confidence" DECIMAL(3,2),
    "originalDescription" TEXT,
    "note" VARCHAR(500),
    "createdBy" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "foodId" BIGINT,
    "description" VARCHAR(500),
    "mealType" "MealType" NOT NULL,
    "mealLabel" VARCHAR(50),
    "amountInput" DECIMAL(8,2),
    "unitInput" VARCHAR(50),
    "grams" DECIMAL(8,2),
    "energyKcal" DECIMAL(7,1) NOT NULL,
    "proteinG" DECIMAL(7,2) NOT NULL,
    "carbG" DECIMAL(7,2) NOT NULL,
    "fatG" DECIMAL(7,2) NOT NULL,
    "fiberG" DECIMAL(7,2),
    "sugarG" DECIMAL(7,2),
    "satFatG" DECIMAL(7,2),
    "sodiumMg" DECIMAL(8,1),
    "extraNutrients" JSONB,
    "eatenAt" TIMESTAMP(3) NOT NULL,
    "localDate" DATE NOT NULL,
    "timezone" VARCHAR(40) NOT NULL,
    "source" "LogSource" NOT NULL,
    "confidence" DECIMAL(3,2),
    "originalDescription" TEXT,
    "note" VARCHAR(500),
    "createdBy" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diet_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "personal_access_token_tokenHash_key" ON "personal_access_token"("tokenHash");

-- CreateIndex
CREATE INDEX "personal_access_token_userId_idx" ON "personal_access_token"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_userId_key" ON "user_profile"("userId");

-- CreateIndex
CREATE INDEX "goal_userId_isActive_idx" ON "goal"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "goal_activeKey_key" ON "goal"("activeKey");

-- CreateIndex
CREATE UNIQUE INDEX "dietary_preference_userId_key" ON "dietary_preference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_allergen_userId_allergen_key" ON "user_allergen"("userId", "allergen");

-- CreateIndex
CREATE UNIQUE INDEX "preference_tag_userId_kind_label_key" ON "preference_tag"("userId", "kind", "label");

-- CreateIndex
CREATE INDEX "body_metric_userId_metricType_measuredAt_idx" ON "body_metric"("userId", "metricType", "measuredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "body_metric_userId_metricType_measuredDate_key" ON "body_metric"("userId", "metricType", "measuredDate");

-- CreateIndex
CREATE UNIQUE INDEX "data_source_code_key" ON "data_source"("code");

-- CreateIndex
CREATE INDEX "import_run_sourceCode_status_idx" ON "import_run"("sourceCode", "status");

-- CreateIndex
CREATE INDEX "food_barcode_idx" ON "food"("barcode");

-- CreateIndex
CREATE INDEX "food_name_idx" ON "food"("name");

-- CreateIndex
CREATE INDEX "food_createdByUserId_idx" ON "food"("createdByUserId");

-- CreateIndex
CREATE INDEX "food_status_sourceId_idx" ON "food"("status", "sourceId");

-- CreateIndex
CREATE INDEX "ft_food_search" ON "food" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "food_sourceId_sourceKey_key" ON "food"("sourceId", "sourceKey");

-- CreateIndex
CREATE INDEX "food_portion_foodId_idx" ON "food_portion"("foodId");

-- CreateIndex
CREATE INDEX "exercise_log_userId_localDate_idx" ON "exercise_log"("userId", "localDate");

-- CreateIndex
CREATE INDEX "exercise_log_userId_startedAt_idx" ON "exercise_log"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "diet_log_userId_localDate_idx" ON "diet_log"("userId", "localDate");

-- CreateIndex
CREATE INDEX "diet_log_userId_eatenAt_idx" ON "diet_log"("userId", "eatenAt");

-- CreateIndex
CREATE INDEX "diet_log_foodId_idx" ON "diet_log"("foodId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_access_token" ADD CONSTRAINT "personal_access_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal" ADD CONSTRAINT "goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dietary_preference" ADD CONSTRAINT "dietary_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_allergen" ADD CONSTRAINT "user_allergen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_tag" ADD CONSTRAINT "preference_tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_metric" ADD CONSTRAINT "body_metric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food" ADD CONSTRAINT "food_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food" ADD CONSTRAINT "food_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_nutrients" ADD CONSTRAINT "food_nutrients_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_portion" ADD CONSTRAINT "food_portion_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_log" ADD CONSTRAINT "exercise_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_log" ADD CONSTRAINT "diet_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_log" ADD CONSTRAINT "diet_log_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("id") ON DELETE SET NULL ON UPDATE CASCADE;


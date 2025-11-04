# file location: codex/setup.sh
#!/bin/bash
# ===============================================
# 🧰 Setup Script for HNPSystem Codex Environment
# ===============================================

echo "🔧 Starting Codex environment setup..."

# Step 1: Install Node dependencies
echo "📦 Installing npm packages..."
npm install

# Step 2: Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
  echo "🧩 Creating .env.local from example..."
  cp .env.example .env.local || true
fi

# Step 3: Check Supabase CLI availability
if ! command -v supabase &> /dev/null
then
  echo "⚠️ Supabase CLI not installed — skipping DB sync."
else
  echo "🧱 Syncing Supabase schema..."
  npx supabase db push || echo "⚠️ Failed to sync schema."
fi

echo "✅ Codex environment setup complete!"

#!/bin/bash

# Orchestrator AI Backend Setup Script

echo "🚀 Orchestrator AI Backend Setup"
echo "=================================="
echo ""

# Check Python version
echo "Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Python $python_version found"
echo ""

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv
echo "✓ Virtual environment created"
echo ""

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate
echo "✓ Virtual environment activated"
echo ""

# Install dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt
echo "✓ Dependencies installed"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration"
    echo ""
fi

# Generate secret key
echo "Generating SECRET_KEY..."
secret_key=$(openssl rand -hex 32)
if [ -f .env ]; then
    # Update SECRET_KEY in .env if it exists
    if grep -q "SECRET_KEY=" .env; then
        sed -i.bak "s/SECRET_KEY=.*/SECRET_KEY=$secret_key/" .env
        rm .env.bak
        echo "✓ SECRET_KEY updated in .env"
    fi
fi
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration (DATABASE_URL, OPENAI_API_KEY, etc.)"
echo "2. Create PostgreSQL database: createdb orchestrator_db"
echo "3. Run migrations: alembic upgrade head"
echo "4. Start server: uvicorn app.main:app --reload"
echo ""
echo "Or use Docker:"
echo "docker-compose up -d"
echo ""

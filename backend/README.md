# Orchestrator AI Backend

FastAPI backend for the Orchestrator AI workflow orchestration platform.

## Features

- ✅ JWT-based authentication
- ✅ PostgreSQL database with SQLAlchemy ORM
- ✅ OpenAI GPT-4o integration for workflow generation
- ✅ RESTful API design
- ✅ Comprehensive input validation
- ✅ Database migrations with Alembic
- ✅ Docker support
- ✅ CORS configuration
- ✅ Structured logging

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- OpenAI API key

### Installation

1. **Clone and navigate to backend directory**
```bash
cd backend
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. **Initialize database**
```bash
# Create database
createdb orchestrator_db

# Run migrations
alembic upgrade head
```

6. **Run the server**
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

## Docker Setup (Recommended)

1. **Create .env file**
```bash
cp .env.example .env
# Edit with your values
```

2. **Start all services**
```bash
docker-compose up -d
```

3. **Run migrations**
```bash
docker-compose exec backend alembic upgrade head
```

4. **View logs**
```bash
docker-compose logs -f backend
```

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/api/docs`
- ReDoc: `http://localhost:8000/api/redoc`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get tokens
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and revoke tokens
- `GET /api/auth/me` - Get current user info

### Workflows
- `POST /api/workflow/generate` - Generate workflow with AI
- `GET /api/workflow/list` - List user's workflows
- `GET /api/workflow/{id}` - Get specific workflow
- `PUT /api/workflow/{id}` - Update workflow
- `DELETE /api/workflow/{id}` - Delete workflow

### Templates
- `POST /api/template/save` - Save workflow as template
- `GET /api/template/list` - List user's templates
- `GET /api/template/{id}` - Get specific template
- `DELETE /api/template/{id}` - Delete template
- `POST /api/template/{id}/clone` - Clone template

## Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history
```

## Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=app tests/
```

## Project Structure

```
backend/
├── app/
│   ├── api/              # API routes
│   │   ├── auth.py
│   │   ├── workflow.py
│   │   └── template.py
│   ├── core/             # Core utilities
│   │   ├── security.py
│   │   └── exceptions.py
│   ├── models/           # Database models
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # Business logic
│   │   └── ai_service.py
│   ├── config.py         # Configuration
│   ├── database.py       # Database setup
│   └── main.py           # FastAPI app
├── alembic/              # Database migrations
├── tests/                # Test suite
├── requirements.txt      # Python dependencies
├── Dockerfile            # Docker configuration
└── docker-compose.yml    # Docker Compose setup
```

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=sk-...
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
FRONTEND_URL=http://localhost:5173
ENVIRONMENT=development
LOG_LEVEL=INFO
```

## Security

- Passwords hashed with bcrypt
- JWT tokens for authentication
- Refresh token rotation
- CORS properly configured
- Input validation with Pydantic
- SQL injection prevention with ORM

## Production Deployment

See `DEPLOYMENT_GUIDE.md` in the root directory for detailed deployment instructions.

## License

MIT

## Support

For issues or questions, please refer to the main project documentation.

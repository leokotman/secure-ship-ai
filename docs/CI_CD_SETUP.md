# CI/CD Setup Guide

Complete guide for Continuous Integration and Continuous Deployment for SecureShip.

## Table of Contents
- [Overview](#overview)
- [CI Pipeline](#ci-pipeline)
- [CD Pipeline](#cd-pipeline)
- [Local Testing](#local-testing)
- [GitHub Setup](#github-setup)
- [Deployment Options](#deployment-options)
- [Troubleshooting](#troubleshooting)

---

## Overview

### CI Pipeline (`.github/workflows/ci.yml`)
Runs on every push and pull request to `main`:

1. **Backend Lint** - Code quality checks (Ruff, Mypy)
2. **Backend Tests** - Unit and integration tests with PostgreSQL
3. **Frontend Lint** - ESLint and TypeScript checks
4. **Frontend Tests** - Jest tests with coverage
5. **Security Scan** - Trivy vulnerability scanning

### CD Pipeline (`.github/workflows/cd.yml`)
Runs on push to `main` or version tags:

1. **Build Docker Images** - Backend and frontend containers
2. **Push to Registry** - GitHub Container Registry (GHCR)
3. **Deploy to Staging** - Automatic on main branch
4. **Deploy to Production** - Manual approval on version tags

---

## CI Pipeline

### Backend CI Jobs

#### 1. Backend Lint
```yaml
- Ruff code quality check
- Mypy type checking
- Python 3.11
- Cached pip dependencies
```

**Local equivalent:**
```bash
cd backend
make lint
```

#### 2. Backend Tests
```yaml
- Runs pytest with coverage
- PostgreSQL 15 service container
- Environment variables for test config
- Uploads test results as artifacts
```

**Environment variables:**
- `DATABASE_URL` - Test PostgreSQL connection
- `JWT_SECRET` - Test JWT secret
- `AUTH0_DOMAIN` - Test Auth0 domain
- `AUTH0_AUDIENCE` - Test Auth0 audience

**Local equivalent:**
```bash
cd backend
make test
```

**Run with specific tests:**
```bash
cd backend
pytest tests/test_shipments.py -v
pytest tests/ -k "test_create"
```

### Frontend CI Jobs

#### 3. Frontend Lint
```yaml
- ESLint checks
- TypeScript type checking
- Node 18
- Cached npm dependencies
```

**Local equivalent:**
```bash
cd frontend
make lint
npm run type-check
```

#### 4. Frontend Tests
```yaml
- Jest unit tests
- Coverage reporting
- Uploads coverage to Codecov
- Uploads test artifacts
```

**Local equivalent:**
```bash
cd frontend
npm test -- --coverage
```

**Run specific tests:**
```bash
cd frontend
npm test -- VerificationFlow
npm test -- --watch
```

#### 5. Security Scan
```yaml
- Trivy vulnerability scanner
- Scans dependencies and code
- Uploads results to GitHub Security
```

**Local equivalent:**
```bash
# Install Trivy
brew install aquasecurity/trivy/trivy  # macOS
# or
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Run scan
trivy fs . --severity HIGH,CRITICAL
```

---

## CD Pipeline

### Build and Push Docker Images

Automatically builds and pushes Docker images to GitHub Container Registry (GHCR).

**Image tags:**
- `main` - Latest from main branch
- `v1.2.3` - Semantic version tags
- `sha-abc1234` - Git commit SHA

**Accessing images:**
```bash
# Pull backend image
docker pull ghcr.io/YOUR_ORG/secure-ship-ai-backend:main

# Pull frontend image
docker pull ghcr.io/YOUR_ORG/secure-ship-ai-frontend:main
```

### Deployment Environments

#### Staging Environment
- **Trigger**: Automatic on push to `main`
- **URL**: `https://staging.secureship.example.com`
- **Purpose**: Pre-production testing
- **Approval**: Not required

#### Production Environment
- **Trigger**: Manual on version tags (`v*.*.*`)
- **URL**: `https://secureship.example.com`
- **Purpose**: Live production
- **Approval**: Required (configure in GitHub)

---

## Local Testing

### Run All Tests
```bash
# From project root
make test

# Or individually
cd backend && make test
cd frontend && make test
```

### Run with Coverage
```bash
# Backend
cd backend
pytest --cov=secureship --cov-report=html --cov-report=term

# Frontend
cd frontend
npm test -- --coverage
```

### View Coverage Reports
```bash
# Backend (opens in browser)
open backend/htmlcov/index.html

# Frontend (opens in browser)
open frontend/coverage/lcov-report/index.html
```

### Pre-commit Checks
Run before pushing to ensure CI will pass:

```bash
# Backend
cd backend
make lint     # Ruff + Mypy
make format   # Auto-fix issues
make test     # Run tests

# Frontend
cd frontend
make lint          # ESLint
npm run type-check # TypeScript
make test          # Jest tests
```

---

## GitHub Setup

### 1. Enable GitHub Actions
1. Go to repository Settings → Actions → General
2. Allow all actions and reusable workflows
3. Enable "Read and write permissions" for `GITHUB_TOKEN`

### 2. Configure Secrets
Go to Settings → Secrets and variables → Actions

**Required secrets:**
```yaml
# Production deployment (optional)
DEPLOY_SSH_KEY        # SSH key for deployment server
DEPLOY_HOST           # Deployment server hostname
DEPLOY_USER           # SSH username

# External services (optional)
CODECOV_TOKEN         # For coverage reports
SLACK_WEBHOOK         # For notifications
```

### 3. Configure Environments
Go to Settings → Environments

**Create environments:**
1. **staging**
   - No protection rules needed
   - Set environment URL
   
2. **production**
   - ✅ Required reviewers (select team members)
   - ✅ Wait timer (e.g., 5 minutes)
   - Set environment URL

### 4. Branch Protection Rules
Go to Settings → Branches → Add rule

**For `main` branch:**
- ✅ Require a pull request before merging
- ✅ Require status checks to pass:
  - `backend-lint`
  - `backend-test`
  - `frontend-lint`
  - `frontend-test`
  - `security-scan`
- ✅ Require branches to be up to date
- ✅ Do not allow bypassing the above settings

---

## Deployment Options

### Option 1: Docker Compose on VPS

**Setup:**
```bash
# On your server
git clone https://github.com/YOUR_ORG/secure-ship-ai
cd secure-ship-ai

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://postgres:password@postgres:5432/secureship
JWT_SECRET=your-production-secret
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-audience
OLLAMA_HOST=http://ollama:11434
EOF

# Deploy
docker-compose up -d
```

**Update CD workflow:**
```yaml
- name: Deploy to staging
  env:
    SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
  run: |
    echo "$SSH_KEY" > key.pem
    chmod 600 key.pem
    ssh -i key.pem ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }} \
      'cd /app/secure-ship-ai && \
       git pull && \
       docker-compose pull && \
       docker-compose up -d'
```

### Option 2: Kubernetes

**Prerequisites:**
- Kubernetes cluster (EKS, GKE, AKS, or self-hosted)
- kubectl configured
- Helm (optional)

**Update CD workflow:**
```yaml
- name: Deploy to staging
  run: |
    kubectl set image deployment/backend \
      backend=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:${{ github.sha }}
    kubectl set image deployment/frontend \
      frontend=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-frontend:${{ github.sha }}
    kubectl rollout status deployment/backend
    kubectl rollout status deployment/frontend
```

### Option 3: Serverless (Frontend)

**Vercel:**
```yaml
- name: Deploy frontend to Vercel
  uses: amondnet/vercel-action@v25
  with:
    vercel-token: ${{ secrets.VERCEL_TOKEN }}
    vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
    vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
    working-directory: ./frontend
```

**Netlify:**
```yaml
- name: Deploy frontend to Netlify
  uses: netlify/actions/cli@master
  with:
    args: deploy --prod --dir=frontend/.next
  env:
    NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
    NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

### Option 4: AWS (Backend)

**Elastic Beanstalk:**
```yaml
- name: Deploy to AWS Elastic Beanstalk
  uses: einaregilsson/beanstalk-deploy@v21
  with:
    aws_access_key: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws_secret_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    application_name: secureship
    environment_name: secureship-prod
    version_label: ${{ github.sha }}
    region: us-east-1
    deployment_package: backend-deploy.zip
```

**ECS/Fargate:**
```yaml
- name: Deploy to Amazon ECS
  uses: aws-actions/amazon-ecs-deploy-task-definition@v1
  with:
    task-definition: task-definition.json
    service: secureship-service
    cluster: secureship-cluster
    wait-for-service-stability: true
```

---

## Monitoring and Notifications

### Slack Notifications

Add to workflow:
```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
    text: |
      CI/CD Pipeline: ${{ job.status }}
      Commit: ${{ github.sha }}
      Author: ${{ github.actor }}
```

### Email Notifications

GitHub Actions sends email automatically on workflow failures to:
- Commit author
- Repository watchers

Configure in: Settings → Notifications

### Status Badges

Add to README.md:
```markdown
![CI](https://github.com/YOUR_ORG/secure-ship-ai/actions/workflows/ci.yml/badge.svg)
![CD](https://github.com/YOUR_ORG/secure-ship-ai/actions/workflows/cd.yml/badge.svg)
[![codecov](https://codecov.io/gh/YOUR_ORG/secure-ship-ai/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_ORG/secure-ship-ai)
```

---

## Troubleshooting

### Tests Fail in CI but Pass Locally

**Problem**: Database connection issues
```yaml
# Check database service status in CI logs
# Ensure DATABASE_URL is correct in CI
```

**Problem**: Environment differences
```bash
# Match Node/Python versions
# Check package-lock.json / poetry.lock are committed
```

**Problem**: Timezone issues
```yaml
# Set TZ environment variable in CI
env:
  TZ: UTC
```

### Docker Build Failures

**Problem**: Layer caching issues
```yaml
# Clear cache
cache-from: type=gha
cache-to: type=gha,mode=max
```

**Problem**: Build context too large
```bash
# Add to .dockerignore
node_modules/
.venv/
__pycache__/
*.pyc
.git/
coverage/
```

### Deployment Failures

**Problem**: SSH connection refused
```bash
# Check SSH key format
# Ensure server allows key-based auth
# Verify firewall rules
```

**Problem**: Container registry authentication
```bash
# Check GITHUB_TOKEN permissions
# Verify package write permissions enabled
```

### Performance Issues

**Problem**: CI runs too slow
```yaml
# Enable caching
- uses: actions/cache@v3
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}

# Run jobs in parallel
jobs:
  backend-test:
  frontend-test:  # Runs simultaneously
```

**Problem**: Tests timeout
```yaml
# Increase timeout
timeout-minutes: 30

# Split test suites
pytest tests/unit/
pytest tests/integration/
```

---

## Best Practices

### 1. Version Everything
```bash
# Create version tags
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### 2. Keep Secrets Secure
- ❌ Never commit secrets to git
- ✅ Use GitHub Secrets
- ✅ Rotate secrets regularly
- ✅ Use environment-specific secrets

### 3. Test Before Deploy
```bash
# Always run tests locally first
make test

# Use feature branches
git checkout -b feature/new-feature
# Make changes, test, then PR
```

### 4. Monitor Production
- Set up application monitoring (Sentry, DataDog)
- Configure uptime monitoring (UptimeRobot, Pingdom)
- Set up log aggregation (Papertrail, Logtail)

### 5. Rollback Strategy
```bash
# Keep previous versions accessible
docker tag app:v1.0.0 app:previous

# Quick rollback
docker-compose pull app:previous
docker-compose up -d
```

---

## Quick Reference

### Run Tests Locally
```bash
make test                    # All tests
cd backend && make test      # Backend only
cd frontend && npm test      # Frontend only
```

### Check CI Status
```bash
# View all workflows
gh workflow list

# View specific run
gh run view <run-id>

# Watch workflow
gh run watch
```

### Manual Deployment
```bash
# Build images
docker build -t backend:local ./backend
docker build -t frontend:local ./frontend

# Push to registry
docker tag backend:local ghcr.io/org/backend:v1.0.0
docker push ghcr.io/org/backend:v1.0.0
```

### Useful Commands
```bash
# Re-run failed jobs
gh run rerun <run-id> --failed

# Cancel workflow
gh run cancel <run-id>

# Download artifacts
gh run download <run-id>
```

---

## Next Steps

1. ✅ Review and merge this CI/CD setup
2. 🔄 Test the CI pipeline on a feature branch
3. 🔄 Configure GitHub branch protection
4. 🔄 Set up production deployment target
5. 🔄 Configure monitoring and alerting
6. 🔄 Document deployment procedures
7. 🔄 Train team on CI/CD processes

---

## Support

**Questions?** Open an issue or contact the DevOps team.

**CI/CD failing?** Check:
1. GitHub Actions logs
2. Recent changes in dependencies
3. Environment variables configuration
4. Network connectivity issues

**Need help?** Consult the team's Slack channel or documentation wiki.

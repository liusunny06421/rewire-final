# Rewire

Rewire is a starter app for an ADHD coaching experience with:

- onboarding flow
- category-based chat
- OpenAI-powered coaching
- a Dashboard tab
- a My Routines tab
- routines saved between sessions
- an experimental ADHD prediction model in `model/`

## What is in this project

- `src/App.jsx` → the main app
- `src/main.jsx` → starts the React app
- `index.html` → app page shell
- `api/chat.js` → serverless chat endpoint for OpenAI
- `model/adhd_model.py` → ADHD classifier training script
- `model/verify_model.py` → quick model artifact verification
- `model/requirements.txt` → Python ML dependencies
- `.env.example` → sample environment file
- `.gitignore` → keeps secrets and clutter out of GitHub
- `package.json` → project settings and dependencies
- `vite.config.js` → frontend config

## Important

Do **not** upload your real OpenAI key to GitHub.

Your real secret should go in a file named `.env`, and `.gitignore` is set up so GitHub should ignore it.

## Folder structure

```bash
rewire-app/
  index.html
  package.json
  vite.config.js
  api/
    chat.js
  .env.example
  .gitignore
  README.md
  model/
    adhd_assessment_v2.csv
    adhd_model.py
    verify_model.py
    requirements.txt
  src/
    App.jsx
    main.jsx

## Model setup

To train and verify the ADHD model locally:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r model/requirements.txt
python3 model/adhd_model.py
python3 model/verify_model.py
```

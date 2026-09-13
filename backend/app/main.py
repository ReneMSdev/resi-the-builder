from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import profile, generate, revise, render, resumes

app = FastAPI(title="Resume Builder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to actual frontend URL(s) once deployed
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profile.router)
app.include_router(generate.router)
app.include_router(revise.router)
app.include_router(render.router)
app.include_router(resumes.router)


@app.get("/health")
def health():
    return {"status": "ok"}

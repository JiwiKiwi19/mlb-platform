// Railway infrastructure for the backend workers (frontend is on Vercel).
// Preview: `railway config plan`   Apply: `railway config apply`
//
// Variables are unmanaged: this file never reads or writes them, so secrets stay out of git.
// Set them per service in Railway (see README → Deployment).
import { defineRailway, github, project, service } from "railway/iac";

// Both workers build the same image from backend/Dockerfile and differ only in start command.
const worker = (startCommand: string) => ({
  // checkSuites: wait for GitHub CI to pass before deploying a commit.
  source: github("JiwiKiwi19/mlb-platform", { branch: "main", rootDirectory: "backend", checkSuites: true }),
  // No builder set: Railway auto-detects backend/Dockerfile (an explicit "DOCKERFILE" doesn't persist).
  deploy: {
    startCommand,
    // No HTTP port, so Railway can't health-check these; restart them if they crash.
    restartPolicyType: "ON_FAILURE" as const,
    restartPolicyMaxRetries: 10,
  },
  replicas: { iad: 1 },
});

export default defineRailway(() => {
  const consumer = service("consumer", worker("python -m mlb_pipeline.consumer"));
  const producer = service("producer", worker("python -m mlb_pipeline.producer"));

  return project("consumer", {
    variables: { managed: false },
    resources: [consumer, producer],
  });
});

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";

dotenv.config();
const app = express();
app.use(express.json());

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const SYSTEM_PROMPT = `
You are a coding AI.
You specialize in:
- Node.js
- C#
- Roblox Lua
- Web development
You always output correct, production-ready code.
You do not hallucinate APIs.
`;

async function openaiChat(messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages
      ]
    })
  });
  return (await res.json()).choices[0].message.content;

  async function readRepo(owner, repo) {
  const tree = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: "main",
    recursive: "true"
  });

  const files = [];
  for (const item of tree.data.tree) {
    if (item.type === "blob") {
      const file = await octokit.git.getBlob({
        owner,
        repo,
        file_sha: item.sha
      });
      files.push({
        path: item.path,
        content: Buffer.from(file.data.content, "base64").toString()
      });
    }
  }
  return files;
}

  async function writeFile(owner, repo, path, content, message) {
  let sha;
  try {
    const existing = await octokit.repos.getContent({
      owner, repo, path
    });
    sha = existing.data.sha;
  } catch {}

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString("base64"),
    sha
  });
}
}
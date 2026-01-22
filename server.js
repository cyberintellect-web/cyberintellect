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

// ---------------- OPENAI ----------------
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

  const data = await res.json();
  return data.choices[0].message.content;
}

// ---------------- GITHUB READ ----------------
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

// ---------------- GITHUB WRITE ----------------
async function writeFile(owner, repo, path, content, message) {
  let sha;

  try {
    const existing = await octokit.repos.getContent({
      owner,
      repo,
      path
    });
    sha = existing.data.sha;
  } catch {
    sha = undefined;
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString("base64"),
    sha
  });
}

// ---------------- API ENDPOINT ----------------
app.post("/task", async (req, res) => {
  try {
    const { owner, repo, prompt } = req.body;

    const files = await readRepo(owner, repo);
    const context = files
      .map(f => `FILE: ${f.path}\n${f.content}`)
      .join("\n\n");

    const result = await openaiChat([
      { role: "user", content: "Repository:\n" + context },
      { role: "user", content: prompt }
    ]);

    res.json({ result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI server running on port ${PORT}`);
});

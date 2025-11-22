import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
// import { retrieveDocs, embedText, callLLM } from "./helpers/vector.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = 3001;
const SECRET = process.env.MCP_SECRET;

app.post("/analyze-email", async (req, res) => {
  try {
    // const auth = req.headers.authorization || "";
    // if (!auth.startsWith("Bearer ")) {
    //   return res.status(401).send("Unauthorized: Missing Bearer token");
    // }
    // const token = auth.split(" ")[1];
    // try {
    //   jwt.verify(token, SECRET);
    // } catch (jwtErr) {
    //   return res.status(401).send("Unauthorized: Invalid or malformed token");
    // }

    const { email } = req.body;
    console.log("Received email to analyze:", email);
    res.json(email);

    // const text = `${email.subject}\n${email.bodyPlain}`;
    // const contextDocs = await retrieveDocs(text);
    // const llmResponse = await callLLM(text, contextDocs);

    // res.json(llmResponse);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

import { authorize, listMessages } from "./helpers/gmail.js";

app.get("/get-unread-emails", async (req, res) => {
    try {
        const auth = await authorize();
        const messages = await listMessages(auth);
        res.json(messages);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => console.log(`MCP running on http://localhost:${PORT}`));

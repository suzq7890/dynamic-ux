import express from "express";
import cors from "cors";
import { itemsRouter } from "./routes/items";
import { todayRouter } from "./routes/today";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/items", itemsRouter);
app.use("/api/today", todayRouter);

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

import express from "express";

export const app = express();

app.get("/api/v1/health", (req, res, next) => {
  res.status(200).json({ status: "success", data: null });
});

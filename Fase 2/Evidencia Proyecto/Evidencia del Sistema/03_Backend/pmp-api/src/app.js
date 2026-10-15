import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger.js";

import authRoutes from "./routes/auth.routes.js";
import osRoutes from "./routes/os.routes.js";
import usersRoutes from "./routes/users.routes.js";
import adminUsersRoutes from "./routes/admin.users.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js"; // <--- 1. IMPORTAR
import labRoutes from "./routes/lab.routes.js";
import qaRoutes from "./routes/qa.routes.js";
import bodegaRoutes from "./routes/bodega.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import masterRoutes from "./routes/master.routes.js";
import badgeRoutes from "./routes/badges.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import bridgeRoutes from "./routes/bridge.routes.js";
import equipmentScanRoutes from "./routes/equipmentScan.routes.js";

import requirementsRoutes from './routes/requirements.routes.js';
import assetsRoutes from './routes/assets.routes.js';
const app = express();

app.use(cors());
// Photo payloads are parsed only after authentication and role checks in their routes.
const standardJson=express.json();
app.use((req,res,next)=>(req.method==='POST'&&/^\/api\/(os\/confirmar-retiro|lab\/finish)\/?$/.test(req.path)||req.method==='PUT'&&/^\/api\/lab\/work\/[^/]+\/?$/.test(req.path))?next():standardJson(req,res,next));

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes); // Movido arriba
app.use("/api/os", osRoutes);
app.use('/api/requerimientos', requirementsRoutes);
app.use('/api/activos', assetsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/admin/users", adminUsersRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/lab", labRoutes);
app.use("/api/qa", qaRoutes);
app.use("/api/bodega", bodegaRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/master", masterRoutes);
app.use("/api/dashboard", badgeRoutes);
app.use("/api/bridge", bridgeRoutes);
app.use("/api/equipment-scan", equipmentScanRoutes);
// app.use("/api/ai", aiRoutes); // Ya movido arriba

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "PMP AI Engine" }));

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal Server Error" });
});

export default app;

import "dotenv/config";

const routerModules = {
  auth: "../src/routes/auth.routes.js",
  ai: "../src/routes/ai.routes.js",
  os: "../src/routes/os.routes.js",
  users: "../src/routes/users.routes.js",
  adminUsers: "../src/routes/admin.users.routes.js",
  dashboard: "../src/routes/dashboard.routes.js",
  lab: "../src/routes/lab.routes.js",
  qa: "../src/routes/qa.routes.js",
  bodega: "../src/routes/bodega.routes.js",
  admin: "../src/routes/admin.routes.js",
  master: "../src/routes/master.routes.js",
  badges: "../src/routes/badges.routes.js"
};

const expectedSharedOrder = ["firebaseAuth", "ensureUserMiddleware", "enforceReadOnlyRole"];
const report = [];
const violations = [];

for (const [name, modulePath] of Object.entries(routerModules)) {
  const { default: router } = await import(modulePath);
  const sharedLayers = router.stack
    .map((layer, index) => ({ layer, index }))
    .filter(({ layer }) => !layer.route);
  const sharedOrder = sharedLayers.map(({ layer }) => layer.name);
  const firstRouteIndex = router.stack.findIndex((layer) => Boolean(layer.route));

  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).map((method) => method.toUpperCase()),
      stack: layer.route.stack.map((routeLayer) => routeLayer.name || "<anonymous>")
    }));

  if (sharedOrder.slice(0, 3).join("|") !== expectedSharedOrder.join("|")) {
    violations.push(`${name}: orden compartido incorrecto (${sharedOrder.join(" -> ")})`);
  }
  if (sharedLayers.some(({ index }) => index >= firstRouteIndex)) {
    violations.push(`${name}: existe middleware compartido declarado despues de una ruta`);
  }

  for (const route of routes) {
    const needsSpecificAuthorization = name !== "auth";
    if (needsSpecificAuthorization && route.stack.length < 2) {
      violations.push(`${name} ${route.methods.join(",")} ${route.path}: falta autorizacion especifica`);
    }
  }

  report.push({ router: name, sharedOrder, routes });
}

console.log(JSON.stringify({ report, violations }, null, 2));

if (violations.length > 0) process.exitCode = 1;

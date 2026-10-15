import "dotenv/config";
import app from "./src/app.js";

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`API running: http://localhost:${port}`);
  console.log(`Swagger:     http://localhost:${port}/docs`);
});
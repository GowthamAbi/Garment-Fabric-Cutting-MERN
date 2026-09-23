import "dotenv/config";
import "./config/mongoosePlugins.js";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { validateEnvironment } from "./config/environment.js";

validateEnvironment();
await connectDatabase();

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`UG SaaS API running on port ${port}`);
});

import dotenv from "dotenv";

// Load environment variables before modules such as Cloudinary read them.
dotenv.config({ path: ".env", quiet: true });
